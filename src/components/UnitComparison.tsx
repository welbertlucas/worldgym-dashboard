import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, Minus } from "lucide-react";
import { getDataByMonth, getLatestData, getAvailableMonths, type UnitData } from "@/data/dashboardData";
import {
  CATEGORY_LABEL, INDICATORS, compareIndicator, formatDelta, formatIndicator, formatRelative, isPercentIndicator, reviewReason, summarizeComparison,
  type Category, type Comparison, type Indicator,
} from "@/data/unitIndicators";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface UnitComparisonProps {
  selectedMonth: string;
}

// A cor identifica a unidade (não o desempenho): o verde fica reservado ao selo "favorável".
const COLOR_A = "hsl(222 25% 14%)";
const COLOR_B = "hsl(210 28% 62%)";
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function DiffCell({ ind, c }: { ind: Indicator; c: Comparison }) {
  if (c.state === "nodata") return <span className="text-xs text-muted-foreground">Sem dado</span>;
  if (c.state === "uncomputable") return <span className="text-xs text-muted-foreground">Sem base de comparação</span>;
  if (c.state === "equal") return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="w-3.5 h-3.5" aria-hidden />Equivalente</span>;
  const Arrow = c.diff! > 0 ? ArrowUpRight : ArrowDownRight;
  // Percentuais: diferença em p.p. em destaque + variação relativa (%) logo abaixo; demais: só a variação relativa.
  const percent = isPercentIndicator(ind);
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums text-foreground">
        <Arrow className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />{percent ? formatDelta(ind, c.delta!) : formatRelative(c.diff!)}
      </span>
      {percent && <span className="text-[11px] text-muted-foreground tabular-nums">{formatRelative(c.diff!)} relativo</span>}
      {c.state === "neutral" && <span className="text-[11px] text-muted-foreground">sem regra</span>}
    </span>
  );
}

function ValueCell({ ind, value, side, winner }: { ind: Indicator; value: number; side: "a" | "b"; winner: boolean }) {
  const mark = winner ? <><Check className="w-3.5 h-3.5 text-success shrink-0" aria-hidden /><span className="sr-only">favorável</span></> : null;
  return (
    <span className={cn("w-[6.75rem] shrink-0 flex items-center gap-1 tabular-nums text-sm", side === "a" ? "justify-end" : "justify-start", winner ? "font-semibold text-foreground" : "text-muted-foreground")}>
      {side === "a" && mark}
      {formatIndicator(ind, value)}
      {side === "b" && mark}
    </span>
  );
}

function Row({ ind, ua, ub }: { ind: Indicator; ua: UnitData; ub: UnitData }) {
  const c = compareIndicator(ind, ua, ub);
  const scale = Math.max(Math.abs(c.a), Math.abs(c.b));
  const showBars = c.state !== "nodata" && scale > 0;
  const w = (v: number) => `${(Math.abs(v) / scale) * 100}%`;
  // Valor negativo: barra listrada (comprimento = valor absoluto), para não parecer positivo.
  const fill = (v: number, color: string) => (v < 0 ? `repeating-linear-gradient(135deg, ${color} 0 4px, transparent 4px 8px)` : color);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[10.5rem_minmax(0,1fr)_7.5rem] items-center gap-x-4 gap-y-1.5 py-2.5">
      <span className="text-sm font-medium text-foreground">{ind.label}</span>
      <div className="sm:order-3 text-right"><DiffCell ind={ind} c={c} /></div>
      <div className="col-span-2 sm:col-span-1 sm:order-2 flex items-center gap-2">
        <ValueCell ind={ind} value={c.a} side="a" winner={c.winner === "a"} />
        <div className="flex-1 flex items-center gap-px" aria-hidden>
          <div className="flex-1 h-2.5 rounded-l-full bg-secondary flex justify-end overflow-hidden">
            {showBars && <div className="h-full" style={{ width: w(c.a), background: fill(c.a, COLOR_A) }} />}
          </div>
          <div className="flex-1 h-2.5 rounded-r-full bg-secondary overflow-hidden">
            {showBars && <div className="h-full" style={{ width: w(c.b), background: fill(c.b, COLOR_B) }} />}
          </div>
        </div>
        <ValueCell ind={ind} value={c.b} side="b" winner={c.winner === "b"} />
      </div>
    </li>
  );
}

function UnitPanel({ label, color, value, onChange, units, wins, id }: { label: string; color: string; value: string; onChange: (v: string) => void; units: string[]; wins: number | null; id: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 sm:p-5">
      <span className="block h-1 w-10 rounded-full mb-3" style={{ background: color }} aria-hidden />
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1">
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </Select>
      <p className="mt-3 text-xl font-semibold tracking-tight text-foreground truncate">{value || "—"}</p>
      {wins !== null && <p className="text-sm text-muted-foreground">Resultado favorável em <b className="text-foreground tabular-nums">{wins}</b> {wins === 1 ? "indicador" : "indicadores"}</p>}
    </div>
  );
}

export function UnitComparison({ selectedMonth }: UnitComparisonProps) {
  const months = getAvailableMonths();
  const [refMonth, setRefMonth] = useState(selectedMonth);
  const monthData = getDataByMonth(refMonth) || getLatestData();
  const units = monthData.units.map((u) => u.name);
  const [unitA, setUnitA] = useState(units[0] ?? "");
  const [unitB, setUnitB] = useState(units[1] ?? units[0] ?? "");

  // As unidades mudam de mês a mês (abertura/fechamento): reescolhe padrões válidos quando o mês muda.
  useEffect(() => {
    if (!units.includes(unitA)) setUnitA(units[0] ?? "");
    if (!units.includes(unitB)) setUnitB(units[1] ?? units[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthData.month]);

  const dataA = monthData.units.find((u) => u.name === unitA);
  const dataB = monthData.units.find((u) => u.name === unitB);
  const summary = dataA && dataB ? summarizeComparison(dataA, dataB) : null;

  return (
    <section aria-labelledby="comparativo-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h3 id="comparativo-titulo" className="text-base font-semibold text-foreground">Comparativo de unidades</h3>
          <p className="text-sm text-muted-foreground">Compare duas unidades no mesmo mês, indicador a indicador.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="comparativo-mes" className="text-xs font-medium text-muted-foreground">Mês de referência</label>
          <Select id="comparativo-mes" value={refMonth} onChange={(e) => setRefMonth(e.target.value)} className="w-48">
            {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        <UnitPanel id="comparativo-a" label="Primeira unidade" color={COLOR_A} value={unitA} onChange={setUnitA} units={units} wins={summary ? summary.winsA : null} />
        <UnitPanel id="comparativo-b" label="Segunda unidade" color={COLOR_B} value={unitB} onChange={setUnitB} units={units} wins={summary ? summary.winsB : null} />
      </div>

      {!dataA || !dataB || !summary ? (
        <p className="mt-4 text-sm text-muted-foreground">Selecione duas unidades para comparar.</p>
      ) : (
        <>
          {unitA === unitB && <p className="mt-3 text-sm text-warning">As duas unidades são a mesma. Escolha unidades diferentes para ver diferenças.</p>}

          <div className="mt-4 grid lg:grid-cols-3 gap-x-8 gap-y-5 rounded-2xl bg-secondary/50 p-4 sm:p-5">
            <div>
              <h4 className="text-sm font-semibold mb-2">Quem lidera</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLOR_A }} aria-hidden /><span className="truncate">{unitA}</span><b className="ml-auto tabular-nums">{summary.winsA}</b></li>
                <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLOR_B }} aria-hidden /><span className="truncate">{unitB}</span><b className="ml-auto tabular-nums">{summary.winsB}</b></li>
                <li className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full shrink-0 bg-border" aria-hidden />Equivalentes ou sem regra<b className="ml-auto tabular-nums text-foreground">{summary.equal + summary.neutral}</b></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Maiores diferenças</h4>
              {summary.biggest.length ? (
                <ul className="space-y-2.5 text-sm">
                  {summary.biggest.map(({ indicator, comparison }) => (
                    <li key={indicator.key}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{indicator.label}</span>
                        <span className="tabular-nums font-semibold shrink-0">
                          {isPercentIndicator(indicator) ? formatDelta(indicator, comparison.delta!) : formatRelative(comparison.diff!)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR_A }} aria-hidden />{formatIndicator(indicator, comparison.a)}
                        <span className="mx-1.5">vs.</span>
                        <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR_B }} aria-hidden />{formatIndicator(indicator, comparison.b)}
                        {isPercentIndicator(indicator)
                          ? <> · {formatRelative(comparison.diff!)} relativo</>
                          : <> · diferença de {formatDelta(indicator, comparison.delta!)}</>}
                        {!indicator.direction && <> · sem regra</>}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Nenhuma diferença calculável.</p>}
              <p className="text-[11px] text-muted-foreground mt-2">Ordenadas pela variação relativa da primeira unidade sobre a segunda. Percentuais altos podem vir de valores pequenos: confira os valores de cada unidade.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Precisam de análise adicional</h4>
              {summary.needsReview.length ? (
                <ul className="space-y-1.5 text-sm">
                  {summary.needsReview.map(({ indicator, comparison }) => (
                    <li key={indicator.key}>
                      <span className="font-medium">{indicator.label}</span>
                      <span className="block text-xs text-muted-foreground">{reviewReason(indicator, comparison)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Todos os indicadores têm comparação.</p>}
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {CATEGORIES.map((cat) => (
              <div key={cat}>
                <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                  <h4 className="text-sm font-semibold text-foreground">{CATEGORY_LABEL[cat]}</h4>
                  <p className="hidden sm:block text-xs text-muted-foreground">Barras na mesma escala, a partir do zero</p>
                </div>
                <ul className="divide-y divide-border/60">
                  {INDICATORS.filter((i) => i.category === cat).map((i) => <Row key={i.key} ind={i} ua={dataA} ub={dataB} />)}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            <Check className="inline w-3 h-3 text-success align-[-1px]" aria-hidden /> indica o resultado favorável. Maior é melhor, exceto em churn, cancelados e inadimplência, onde menor é melhor.
            Receitas complementares não têm regra de interpretação e não indicam favorável. Barras listradas indicam valor negativo (o comprimento é o valor absoluto). Nos indicadores percentuais, a diferença é mostrada em pontos percentuais (p.p.) e a variação relativa (%) aparece separada. A variação relativa é calculada sobre a segunda unidade.
          </p>
        </>
      )}
    </section>
  );
}
