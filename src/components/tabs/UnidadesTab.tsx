import { SectionTitle } from "@/components/SectionTitle";
import { UnitHighlights } from "@/components/UnitHighlights";
import { UnitDeltaChart } from "@/components/UnitDeltaChart";
import { ContratosAtivos } from "@/components/unidades/ContratosAtivos";
import { UnitsRanking } from "@/components/unidades/UnitsRanking";
import { TopUnitsTable } from "@/components/TopUnitsTable";
import { UnitComparison } from "@/components/UnitComparison";
import { type UnitDelta } from "@/data/unitMetrics";
import { getDataByMonth } from "@/data/dashboardData";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props {
  selectedMonth: string;
  /** Último mês fechado e o anterior: base das variações (cálculo existente). */
  evalMonth: string | null;
  prevEvalMonth: string | null;
  deltas: UnitDelta[];
}

export function UnidadesTab({ selectedMonth, evalMonth, prevEvalMonth, deltas }: Props) {
  const partial = isPartialMonth(selectedMonth);
  const units = getDataByMonth(selectedMonth)?.units ?? [];
  const hasDeltas = deltas.length > 0 && !!evalMonth && !!prevEvalMonth;

  return (
    <div className="space-y-10 sm:space-y-12">
      <div>
        <SectionTitle hint={`Período: ${formatMonthLong(selectedMonth)}${partial ? " (em andamento: valores parciais; variações e destaques usam " + (evalMonth ? formatMonthLong(evalMonth) : "o último mês fechado") + ")" : ""} • ${units.length} unidades`}>Unidades</SectionTitle>
      </div>

      {hasDeltas && (
        <UnitHighlights deltas={deltas} title="Evolução entre unidades" subtitle={<>{formatMonthLong(evalMonth!)} em relação a {formatMonthLong(prevEvalMonth!)}</>} />
      )}

      <div className="space-y-6">
        <UnitsRanking
          units={units}
          monthLabel={formatMonthLong(selectedMonth)}
          partial={partial}
          variationView={hasDeltas ? <UnitDeltaChart deltas={deltas} curMonth={evalMonth!} prevMonth={prevEvalMonth!} /> : undefined}
        />
        <TopUnitsTable selectedMonth={selectedMonth} />
      </div>

      <ContratosAtivos units={units} />

      <UnitComparison selectedMonth={selectedMonth} />
    </div>
  );
}
