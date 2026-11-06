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

export function MotivosCancelamento({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const motivos = total.motivosCancel;
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const soma = motivos ? Object.values(motivos).reduce((s, n) => s + n, 0) : 0;
  if (!motivos || soma === 0) return <ChartCard title="Motivos de cancelamento" subtitle={subtitle}><ChartEmpty>Sem cancelamentos com motivo do EVO neste mês.</ChartEmpty></ChartCard>;

  const linhas = motivosOrdenados(motivos);
  const maior = linhas[0][1];
  const inadimplentes = motivos[INADIMPLENCIA] ?? 0;
  const pct = (n: number) => `${((n / soma) * 100).toFixed(1).replace(".", ",")}%`;
  return (
    <ChartCard
      title="Motivos de cancelamento"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Alunos que cancelaram" value={soma.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Por inadimplência" value={pct(inadimplentes)} swatch={<span className="h-2 w-2 rounded-full bg-destructive" />} />
        </div>
      }
    >
      <ol className="space-y-2" aria-label="Motivos de cancelamento, do mais para o menos frequente">
        {linhas.map(([nome, n]) => (
          <li key={nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="truncate text-sm text-foreground" title={nome}>{nome}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{n.toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">· {pct(n)}</span></span>
            <div className="col-span-2 h-2 rounded-full bg-secondary" aria-hidden>
              <div className={cn("h-full rounded-full", nome === INADIMPLENCIA ? "bg-destructive" : "bg-foreground/70")} style={{ width: `${Math.max((n / maior) * 100, 1.5)}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">Cada aluno conta uma vez no mês. "Outros" reúne os motivos digitados à mão.</p>
    </ChartCard>
  );
}
