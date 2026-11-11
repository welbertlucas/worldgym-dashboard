import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Building2, Check, Minus } from "lucide-react";
import { getDataByMonth, getLatestData, getAvailableMonths, type UnitData } from "@/data/dashboardData";
import {
  CATEGORY_LABEL, INDICATORS, compareIndicator, formatDelta, formatIndicator, formatRelative, isPercentIndicator, reviewReason, summarizeComparison,
  type Category, type Comparison, type Indicator,
} from "@/data/unitIndicators";
import { Chip, ChipMes } from "@/components/DateFilter";
import { isPartialMonth } from "@/data/periods";
import { cn } from "@/lib/utils";

interface UnitComparisonProps {
  selectedMonth: string;
  /** Unidades já escolhidas (vindas do detalhe da unidade); sem elas, as duas primeiras da lista. */
  inicialA?: string;
  inicialB?: string;
}

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

/** Diferença da primeira sobre a segunda unidade, como chip (verde = favorável à primeira, vermelho = favorável à segunda). */
function DiffChip({ ind, c }: { ind: Indicator; c: Comparison }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums";
  if (c.state === "nodata") return <span className={cn(base, "bg-secondary text-muted-foreground")}>Sem dado</span>;
  if (c.state === "uncomputable") return <span className={cn(base, "bg-secondary text-muted-foreground")}>Sem base de comparação</span>;
  if (c.state === "equal") return <span className={cn(base, "bg-secondary text-muted-foreground")}><Minus className="h-3 w-3" aria-hidden />Equivalente</span>;
  const Arrow = c.diff! > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = c.state === "neutral" ? "bg-secondary text-muted-foreground" : c.winner === "a" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive";
  return (
    <span className={cn(base, tone)}>
      <Arrow className="h-3 w-3" aria-hidden />
      {isPercentIndicator(ind) ? formatDelta(ind, c.delta!) : formatRelative(c.diff!)}
      {c.state === "neutral" && <span className="font-normal"> · sem regra</span>}
    </span>
  );
}

function Tile({ ind, ua, ub, partial }: { ind: Indicator; ua: UnitData; ub: UnitData; partial: boolean }) {
  const c = compareIndicator(ind, ua, ub, partial);
  const valor = (v: number, ganhou: boolean) => (
    <span className={cn("flex items-center gap-1 font-display text-xl leading-none font-semibold tabular-nums", ganhou ? "text-foreground" : "text-muted-foreground")}>
      {formatIndicator(ind, v)}
      {ganhou && <><Check className="h-3.5 w-3.5 text-success" aria-hidden /><span className="sr-only">favorável</span></>}
    </span>
  );
  return (
    <li className="rounded-xl border border-border bg-white p-4">
      <p className="text-xs text-muted-foreground">{ind.label}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div><p className="mb-1 truncate text-xs text-muted-foreground">{ua.name}</p>{valor(c.a, c.winner === "a")}</div>
        <div><p className="mb-1 truncate text-xs text-muted-foreground">{ub.name}</p>{valor(c.b, c.winner === "b")}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <DiffChip ind={ind} c={c} />
        {isPercentIndicator(ind) && c.diff !== null && c.state !== "equal" && <span className="text-xs tabular-nums text-muted-foreground">{formatRelative(c.diff)} relativo</span>}
      </div>
    </li>
  );
}

function UnitPanel({ label, value, onChange, units, wins, id }: { label: string; value: string; onChange: (v: string) => void; units: string[]; wins: number | null; id: string }) {
  return (
    <div className="rounded-2xl bg-secondary/50 p-4 sm:p-5">
      <Chip id={id} rotulo={label} valor={value || "Escolha uma unidade"} icone={<Building2 className="h-4 w-4" />} value={value} onChange={onChange}>
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </Chip>
      {wins !== null && (
        <p className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-[2.25rem] leading-none font-semibold tracking-tight tabular-nums text-foreground">{wins}</span>
          <span className="text-sm text-muted-foreground">{wins === 1 ? "indicador favorável" : "indicadores favoráveis"}</span>
        </p>
      )}
    </div>
  );
}

export function UnitComparison({ selectedMonth, inicialA, inicialB }: UnitComparisonProps) {
  const months = getAvailableMonths();
  const [refMonth, setRefMonth] = useState(selectedMonth);
  const monthData = getDataByMonth(refMonth) || getLatestData();
  const units = monthData.units.map((u) => u.name);
  const [unitA, setUnitA] = useState(inicialA && units.includes(inicialA) ? inicialA : units[0] ?? "");
  const [unitB, setUnitB] = useState(inicialB && units.includes(inicialB) ? inicialB : units[1] ?? units[0] ?? "");

  // As unidades mudam de mês a mês (abertura/fechamento): reescolhe padrões válidos quando o mês muda.
  useEffect(() => {
    if (!units.includes(unitA)) setUnitA(units[0] ?? "");
    if (!units.includes(unitB)) setUnitB(units[1] ?? units[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthData.month]);

  const partialMes = isPartialMonth(monthData.month);
  const dataA = monthData.units.find((u) => u.name === unitA);
  const dataB = monthData.units.find((u) => u.name === unitB);
  const summary = dataA && dataB ? summarizeComparison(dataA, dataB, 3, partialMes) : null;

  return (
    <section aria-labelledby="comparativo-titulo" className="card-surface space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="comparativo-titulo" className="text-base font-semibold text-foreground">Comparativo de unidades</h3>
          <p className="text-sm text-muted-foreground">Compare duas unidades no mesmo mês, indicador a indicador.</p>
        </div>
        <div className="w-full min-w-0 sm:w-72">
          <ChipMes id="comparativo-mes" rotulo="Mês de referência" value={refMonth} months={months} onChange={setRefMonth} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <UnitPanel id="comparativo-a" label="Primeira unidade" value={unitA} onChange={setUnitA} units={units} wins={summary ? summary.winsA : null} />
        <UnitPanel id="comparativo-b" label="Segunda unidade" value={unitB} onChange={setUnitB} units={units} wins={summary ? summary.winsB : null} />
      </div>

      {!dataA || !dataB || !summary ? (
        <p className="text-sm text-muted-foreground">Selecione duas unidades para comparar.</p>
      ) : (
        <>
          {unitA === unitB && <p className="text-sm text-warning">As duas unidades são a mesma. Escolha unidades diferentes para ver diferenças.</p>}

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-secondary px-2.5 py-1 tabular-nums text-foreground">Equivalentes ou sem regra <b>{summary.equal + summary.neutral}</b></span>
            <span className="rounded-full bg-secondary px-2.5 py-1 tabular-nums text-foreground">Sem comparação possível <b>{summary.needsReview.length}</b></span>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><span className="h-4 w-1 rounded-full bg-foreground/70" aria-hidden />Maiores diferenças</h4>
            {summary.biggest.length ? (
              <ul className="grid gap-3 md:grid-cols-3">
                {summary.biggest.map(({ indicator, comparison }) => (
                  <li key={indicator.key} className="rounded-xl border border-border bg-white p-4">
                    <p className="text-xs text-muted-foreground">{indicator.label}</p>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="font-display text-2xl leading-none font-semibold tabular-nums text-foreground">{isPercentIndicator(indicator) ? formatDelta(indicator, comparison.delta!) : formatRelative(comparison.diff!)}</span>
                    </p>
                    <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                      {unitA} <b className="text-foreground">{formatIndicator(indicator, comparison.a)}</b> · {unitB} <b className="text-foreground">{formatIndicator(indicator, comparison.b)}</b>
                      {isPercentIndicator(indicator) ? <> · {formatRelative(comparison.diff!)} relativo</> : <> · diferença de {formatDelta(indicator, comparison.delta!)}</>}
                      {!indicator.direction && <> · sem regra</>}
                    </p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Nenhuma diferença calculável.</p>}
            <p className="mt-2 text-xs text-muted-foreground">Ordenadas pela variação relativa da primeira unidade sobre a segunda. Percentuais altos podem vir de valores pequenos: confira os valores de cada unidade.</p>
          </div>

          {summary.needsReview.length > 0 && (
            <details className="rounded-xl border border-border bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Precisam de análise adicional ({summary.needsReview.length})
              </summary>
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {summary.needsReview.map(({ indicator, comparison }) => (
                  <li key={indicator.key} className="text-sm">
                    <span className="font-medium text-foreground">{indicator.label}</span>
                    <span className="block text-xs text-muted-foreground">{reviewReason(indicator, comparison, partialMes)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="space-y-6 border-t border-border pt-5">
            {CATEGORIES.map((cat) => (
              <div key={cat}>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><span className="h-4 w-1 rounded-full bg-foreground/70" aria-hidden />{CATEGORY_LABEL[cat]}</h4>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {INDICATORS.filter((i) => i.category === cat).map((i) => <Tile key={i.key} ind={i} ua={dataA} ub={dataB} partial={partialMes} />)}
                </ul>
              </div>
            ))}
          </div>

          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            <Check className="inline h-3 w-3 align-[-1px] text-success" aria-hidden /> indica o resultado favorável. Maior é melhor, exceto em churn, cancelados e inadimplência, onde menor é melhor.
            O chip mostra a diferença da primeira sobre a segunda unidade: verde quando favorece a primeira, vermelho quando favorece a segunda. Receitas complementares não têm regra de interpretação.
            Nos indicadores percentuais a diferença vem em pontos percentuais (p.p.).
          </p>
        </>
      )}
    </section>
  );
}
