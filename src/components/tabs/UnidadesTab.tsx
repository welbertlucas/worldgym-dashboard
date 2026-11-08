import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/SectionTitle";
import { UnitHighlights } from "@/components/UnitHighlights";
import { UnitDeltaChart } from "@/components/UnitDeltaChart";
import { ContratosAtivos } from "@/components/unidades/ContratosAtivos";
import { UnitsRanking } from "@/components/unidades/UnitsRanking";
import { TopUnitsTable } from "@/components/TopUnitsTable";
import { UnidadeDetalhe } from "@/components/tabs/UnidadeTab";
import { type UnitDelta } from "@/data/unitMetrics";
import { type Meta } from "@/data/metas";
import { getAvailableUnits, getDataByMonth } from "@/data/dashboardData";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props {
  selectedMonth: string;
  /** Último mês fechado e o anterior: base das variações (cálculo existente). */
  evalMonth: string | null;
  prevEvalMonth: string | null;
  deltas: UnitDelta[];
  /** Unidade a abrir (clique num nome de unidade em qualquer tela, ou o filtro geral); null = rede. */
  initialUnit: string | null;
  /** Muda a cada clique num nome de unidade, para reabrir a mesma unidade depois de trocá-la na página. */
  openKey?: number;
  compareMonth: string | null;
  metas: Meta[];
  onOpenMetas?: () => void;
}

/** Unidades: com "Rede", compara todas (ranking, destaques, contratos e tabela); com uma unidade, abre o detalhe dela. */
export function UnidadesTab({ selectedMonth, evalMonth, prevEvalMonth, deltas, initialUnit, openKey, compareMonth, metas, onOpenMetas }: Props) {
  const nomes = useMemo(() => getAvailableUnits(), []);
  const [unit, setUnit] = useState<string | null>(initialUnit);
  useEffect(() => { setUnit(initialUnit); }, [initialUnit, openKey]);
  const partial = isPartialMonth(selectedMonth);
  const units = getDataByMonth(selectedMonth)?.units ?? [];
  const hasDeltas = deltas.length > 0 && !!evalMonth && !!prevEvalMonth;
  const hint = unit
    ? `${formatMonthLong(selectedMonth)}${partial ? " (em andamento): os cartões são parciais; posição na rede e gráficos usam só meses fechados." : ""}`
    : `Período: ${formatMonthLong(selectedMonth)}${partial ? " (em andamento: valores parciais; variações e destaques usam " + (evalMonth ? formatMonthLong(evalMonth) : "o último mês fechado") + ")" : ""} • ${units.length} unidades`;

  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle hint={hint}>{unit ?? "Unidades"}</SectionTitle>
          {unit && (
            <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print shrink-0 text-xs font-medium">
              <Printer className="w-4 h-4" aria-hidden />
              <span>Exportar PDF</span>
            </Button>
          )}
        </div>
        {unit && <p className="hidden print:block text-sm text-muted-foreground">{unit} · {formatMonthLong(selectedMonth)} · emitido em {new Date().toLocaleDateString("pt-BR")}</p>}
        <label className="no-print flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Ver
          <Select value={unit ?? ""} onChange={(e) => setUnit(e.target.value || null)} className="h-9 w-64 text-sm font-normal text-foreground">
            <option value="">Rede (comparar todas as unidades)</option>
            {nomes.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </label>
      </div>

      {unit ? (
        <UnidadeDetalhe unit={unit} selectedMonth={selectedMonth} compareMonth={compareMonth} metas={metas} deltas={deltas} evalMonth={evalMonth} prevEvalMonth={prevEvalMonth} onOpenMetas={onOpenMetas} />
      ) : (
        <>
          {hasDeltas && (
            <UnitHighlights deltas={deltas} title="Evolução entre unidades" subtitle={<>{formatMonthLong(evalMonth!)} em relação a {formatMonthLong(prevEvalMonth!)}</>} />
          )}
          <UnitsRanking
            units={units}
            monthLabel={formatMonthLong(selectedMonth)}
            partial={partial}
            variationView={hasDeltas ? <UnitDeltaChart deltas={deltas} curMonth={evalMonth!} prevMonth={prevEvalMonth!} /> : undefined}
          />
          <ContratosAtivos units={units} />
          <details className="group card-surface p-5">
            <summary className="cursor-pointer text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Ver tabela completa <span className="text-sm font-normal text-muted-foreground">(todos os indicadores de todas as unidades, com busca)</span>
            </summary>
            <div className="mt-4"><TopUnitsTable selectedMonth={selectedMonth} /></div>
          </details>
          <p className="text-xs text-muted-foreground">Para ver uma unidade em detalhe ou comparar duas unidades, escolha a unidade em “Ver” ou clique no nome dela.</p>
        </>
      )}
    </div>
  );
}
