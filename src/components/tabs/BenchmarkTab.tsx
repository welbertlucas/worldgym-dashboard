import { SectionTitle } from "@/components/SectionTitle";
import { UnitHighlights } from "@/components/UnitHighlights";
import { UnitDeltaChart } from "@/components/UnitDeltaChart";
import { ContratosAtivos } from "@/components/unidades/ContratosAtivos";
import { UnitsRanking } from "@/components/unidades/UnitsRanking";
import { TopUnitsTable } from "@/components/TopUnitsTable";
import { AtalhosSecoes, Secao } from "@/components/unidades/Secao";
import { type UnitDelta } from "@/data/unitMetrics";
import { getDataByMonthRede } from "@/data/dashboardData";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props {
  selectedMonth: string;
  /** Último mês fechado e o anterior: base das variações. */
  evalMonth: string | null;
  prevEvalMonth: string | null;
  deltas: UnitDelta[];
}

/** Benchmark: as unidades comparadas entre si (sempre todas; o filtro de unidade não se aplica aqui). */
export function BenchmarkTab({ selectedMonth, evalMonth, prevEvalMonth, deltas }: Props) {
  const partial = isPartialMonth(selectedMonth);
  const units = getDataByMonthRede(selectedMonth)?.units ?? [];
  const hasDeltas = deltas.length > 0 && !!evalMonth && !!prevEvalMonth;
  const secoes = [
    ...(hasDeltas ? [{ id: "bm-destaques", rotulo: "Quem melhorou e quem piorou" }] : []),
    { id: "bm-ranking", rotulo: "Ranking" },
    { id: "bm-contratos", rotulo: "Contratos ativos" },
    { id: "bm-tabela", rotulo: "Tabela completa" },
  ];
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <SectionTitle hint={`As ${units.length} unidades comparadas entre si em ${formatMonthLong(selectedMonth)}${partial ? " (mês em andamento: valores parciais)" : ""}. Clique no nome de uma unidade para abrir o retrato dela em Unidades.`}>Benchmark</SectionTitle>
        <AtalhosSecoes itens={secoes} />
      </div>

      {hasDeltas && (
        <Secao id="bm-destaques" titulo="Quem melhorou e quem piorou" descricao={<>Variação de {formatMonthLong(evalMonth!)} em relação a {formatMonthLong(prevEvalMonth!)} (último mês fechado contra o anterior).</>}>
          <UnitHighlights deltas={deltas} />
        </Secao>
      )}

      <Secao id="bm-ranking" titulo="Ranking" descricao="Posição de cada unidade no indicador escolhido. Em “Variação”, quanto cada uma mudou do penúltimo para o último mês fechado.">
        <UnitsRanking units={units} monthLabel={formatMonthLong(selectedMonth)} partial={partial} variationView={hasDeltas ? <UnitDeltaChart deltas={deltas} curMonth={evalMonth!} prevMonth={prevEvalMonth!} /> : undefined} />
      </Secao>

      <Secao id="bm-contratos" titulo="Contratos ativos" descricao="Foto de hoje do EVO: especiais/VIP, personal e plano local ou rede, por unidade.">
        <ContratosAtivos units={units} />
        {!units.some((u) => u.contratosAtivos !== undefined) && <p className="text-sm text-muted-foreground">A foto de contratos só existe no mês em andamento. Escolha o mês atual no topo para ver.</p>}
      </Secao>

      <Secao id="bm-tabela" titulo="Tabela completa" descricao="Todos os indicadores de todas as unidades no mês, com busca e escolha de colunas.">
        <details className="card-surface p-5">
          <summary className="cursor-pointer text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Abrir tabela</summary>
          <div className="mt-4"><TopUnitsTable selectedMonth={selectedMonth} /></div>
        </details>
      </Secao>
    </div>
  );
}
