import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { UnitHighlights } from "@/components/UnitHighlights";
import { UnitDeltaChart } from "@/components/UnitDeltaChart";
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
        <SectionTitle hint={`Período: ${formatMonthLong(selectedMonth)}${partial ? " (em andamento)" : ""} • ${units.length} unidades`}>Unidades</SectionTitle>
        {partial && <Notice>Os valores do mês em andamento são parciais. Variações e destaques usam o último mês fechado{evalMonth ? `: ${formatMonthLong(evalMonth)}` : ""}.</Notice>}
      </div>

      {hasDeltas && (
        <section aria-labelledby="evolucao-titulo">
          <h3 id="evolucao-titulo" className="text-base font-semibold text-foreground">Evolução entre unidades</h3>
          <p className="text-sm text-muted-foreground mb-4">{formatMonthLong(evalMonth!)} em relação a {formatMonthLong(prevEvalMonth!)}</p>
          <UnitHighlights deltas={deltas} />
        </section>
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

      <UnitComparison selectedMonth={selectedMonth} />
    </div>
  );
}
