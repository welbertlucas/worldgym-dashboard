import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { type UnitData } from "@/data/dashboardData";
import { cn } from "@/lib/utils";

const INADIMPLENCIA = "Inadimplência (cancelamento automático)";
const MAX_BARRAS = 8;

/** Ordena os motivos do maior para o menor e junta a cauda em "Demais motivos". */
export function motivosOrdenados(m: Record<string, number>) {
  const lista = Object.entries(m).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const topo = lista.slice(0, MAX_BARRAS);
  const resto = lista.slice(MAX_BARRAS).reduce((s, [, n]) => s + n, 0);
  return resto > 0 ? [...topo, ["Demais motivos", resto] as [string, number]] : topo;
}

/** Contratos cancelados: na rede, por tipo; na unidade, pelo nome do plano (os 8 maiores e o resto em "Demais"). */
export function contratosCancelados(total: Pick<UnitData, "canceladosTipos" | "canceladosPlanos">, porTipo: boolean, soma: number): [string, number][] {
  const base: [string, number][] = porTipo
    ? Object.entries(total.canceladosTipos ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
    : [...(total.canceladosPlanos ?? [])];
  const topo = base.slice(0, MAX_BARRAS);
  const resto = soma - topo.reduce((s, [, n]) => s + n, 0);
  return resto > 0 && topo.length ? [...topo, [porTipo ? "Demais tipos" : "Demais planos", resto]] : topo;
}

function Barras({ linhas, soma, rotulo, destaque }: { linhas: [string, number][]; soma: number; rotulo: string; destaque?: string }) {
  const maior = linhas[0]?.[1] || 1;
  const pct = (n: number) => `${((n / soma) * 100).toFixed(1).replace(".", ",")}%`;
  return (
    <ol className="space-y-2" aria-label={rotulo}>
      {linhas.map(([nome, n]) => (
        <li key={nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm text-foreground" title={nome}>{nome}</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">{n.toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">· {pct(n)}</span></span>
          <div className="col-span-2 h-2 rounded-full bg-secondary" aria-hidden>
            <div className={cn("h-full rounded-full", nome === destaque ? "bg-destructive" : "bg-foreground/70")} style={{ width: `${Math.max((n / maior) * 100, 1.5)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MotivosCancelamento({ total, monthLabel, partial, unitLabel, porTipo = false }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string; porTipo?: boolean }) {
  const motivos = total.motivosCancel;
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const soma = motivos ? Object.values(motivos).reduce((s, n) => s + n, 0) : 0;
  if (!motivos || soma === 0) return <ChartCard title="Motivos de cancelamento" subtitle={subtitle}><ChartEmpty>Sem cancelamentos com motivo do EVO neste mês.</ChartEmpty></ChartCard>;

  const linhas = motivosOrdenados(motivos);
  const contratos = contratosCancelados(total, porTipo, soma);
  const inadimplentes = motivos[INADIMPLENCIA] ?? 0;
  const pct = (n: number) => `${((n / soma) * 100).toFixed(1).replace(".", ",")}%`;
  return (
    <ChartCard
      title="Motivos de cancelamento e contratos cancelados"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Alunos que cancelaram" value={soma.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Por inadimplência" value={pct(inadimplentes)} swatch={<span className="h-2 w-2 rounded-full bg-destructive" />} />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivos</h4>
          <Barras linhas={linhas} soma={soma} rotulo="Motivos de cancelamento, do mais para o menos frequente" destaque={INADIMPLENCIA} />
        </div>
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{porTipo ? "Contratos cancelados por tipo" : "Planos cancelados"}</h4>
          {contratos.length
            ? <Barras linhas={contratos} soma={soma} rotulo={porTipo ? "Contratos cancelados por tipo" : "Planos cancelados"} />
            : <p className="rounded-xl bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">Os contratos cancelados aparecem depois da próxima carga do EVO deste mês.</p>}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Cada aluno conta uma vez no mês, pelo primeiro contrato cancelado. "Outros" reúne os motivos digitados à mão. Promoção de 1º mês, parcerias, militares e gift card aparecem como Promoções{porTipo ? "; escolha uma unidade para ver os planos pelo nome" : ""}. Só contagens: nenhum dado do aluno é guardado.</p>
    </ChartCard>
  );
}
