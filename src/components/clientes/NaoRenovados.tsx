import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";

const MAX_LINHAS = 8;
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");

/** Linhas da lista: na rede, por tipo de contrato; na unidade, pelo nome do plano. A cauda vira "Demais". */
export function linhasNaoRenovados(total: Pick<UnitData, "naoRenovados" | "naoRenovadosTipos" | "naoRenovadosPlanos" | "naoRenovadosFora">, porTipo: boolean): [string, number][] {
  const base: [string, number][] = porTipo
    ? Object.entries(total.naoRenovadosTipos ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
    : [...(total.naoRenovadosPlanos ?? [])];
  const topo = base.slice(0, MAX_LINHAS);
  const resto = (total.naoRenovados ?? 0) - (total.naoRenovadosFora ?? 0) - topo.reduce((s, [, n]) => s + n, 0);
  return resto > 0 && topo.length ? [...topo, [porTipo ? "Demais tipos" : "Demais planos", resto]] : topo;
}

/** Contratos de prazo fixo que venceram no mês: quantos renovaram, quantos não e quais contratos ficaram sem renovar. */
export function NaoRenovados({ total, monthLabel, partial, unitLabel, porTipo }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string; porTipo: boolean }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: até hoje)"}</>;
  const venceram = total.aVencer ?? 0;
  const nao = total.naoRenovados ?? 0;
  if (!total.renovacoesEvo || venceram === 0) return <ChartCard title="Contratos que venceram" subtitle={subtitle}><ChartEmpty>Sem contratos de prazo fixo vencidos no EVO neste mês.</ChartEmpty></ChartCard>;
  const renovados = Math.max(0, venceram - nao);
  const linhas = linhasNaoRenovados(total, porTipo);
  const maior = linhas[0]?.[1] ?? 1;
  return (
    <ChartCard
      title="Contratos que venceram"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Venceram no mês" value={venceram.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label={`Renovados (${pct(renovados, venceram)})`} value={renovados.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
          <HeadlineStat label={`Não renovados (${pct(nao, venceram)})`} value={nao.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-destructive" />} />
        </div>
      }
    >
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{porTipo ? "Não renovados por tipo de contrato" : "Planos que não foram renovados"}</h4>
      {linhas.length ? (
        <ol className="space-y-2" aria-label={porTipo ? "Contratos não renovados por tipo" : "Planos não renovados"}>
          {linhas.map(([nome, n]) => (
            <li key={nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
              <span className="truncate text-sm text-foreground" title={nome}>{nome}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{n.toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">· {pct(n, nao)}</span></span>
              <div className="col-span-2 h-2 rounded-full bg-secondary" aria-hidden>
                <div className="h-full rounded-full bg-destructive/70" style={{ width: `${Math.max((n / maior) * 100, 1.5)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">O detalhe dos contratos não renovados aparece depois da próxima carga do EVO deste mês.</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Contratos de prazo fixo (sem cobrança recorrente) que terminaram no mês e não foram cancelados; não renovados vêm do relatório de Renovações do EVO.
        {" "}Os números e a taxa são os do EVO. Diária, free pass e experimental entram na conta, como no EVO, mas não aparecem na lista{total.naoRenovadosFora ? ` (${total.naoRenovadosFora.toLocaleString("pt-BR")} não renovados neste mês)` : ""}; promoção de 1º mês, parcerias, militares e gift card aparecem como Promoções.
        {porTipo ? " Escolha uma unidade para ver os planos pelo nome." : " Planos pelo nome no EVO."}
        {" "}Só contagens: nenhum dado do aluno é guardado.
      </p>
    </ChartCard>
  );
}
