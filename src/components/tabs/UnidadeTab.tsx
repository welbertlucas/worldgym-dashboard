import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { KpiGrid, type KpiContext, type KpiSpec } from "@/components/kpi/KpiGrid";
import { comercialSpecs, financeiroSpecs, retencaoSpecs } from "@/components/kpi/tabSpecs";
import { TrendCard } from "@/components/unidades/TrendCard";
import { ContratosTiles } from "@/components/unidades/ContratosTiles";
import { UnitsRanking } from "@/components/unidades/UnitsRanking";
import { UnitDeltaChart } from "@/components/UnitDeltaChart";
import { UnitComparison } from "@/components/UnitComparison";
import { contratosView } from "@/data/contratosAtivos";
import { dashboardData, getAvailableUnits } from "@/data/dashboardData";
import { INDICATOR_BY_KEY } from "@/data/unitIndicators";
import { PERIODOS, mesesNoIntervalo, serieDaRede, seriesPorMeses } from "@/data/unitSeries";
import { viewFor } from "@/data/kpiView";
import { sameMonthLastYear } from "@/data/alerts";
import { type UnitDelta } from "@/data/unitMetrics";
import { META_INDICATORS, TIER_LABEL, actualFor, getMeta, nextTier, tierReached, formatMetaValue, type Meta, type MetaKey } from "@/data/metas";
import { formatMonthLong, getLastClosedMonth, isPartialMonth } from "@/data/periods";
import { cn } from "@/lib/utils";

interface Props {
  unit: string;
  selectedMonth: string;
  /** Mês marcado em "Comparar com" no topo: os cartões passam a compará-lo com o mês exibido. */
  compareMonth: string | null;
  metas: Meta[];
  deltas: UnitDelta[];
  evalMonth: string | null;
  prevEvalMonth: string | null;
  onOpenMetas?: () => void;
}

const TREND_KEYS = ["faturamento", "recebimento", "inadimplenciaPerc", "churn", "renovacoes", "novosContratos"] as const;
const unitSpecs: KpiSpec[] = [
  financeiroSpecs[0], financeiroSpecs[1], financeiroSpecs[2], comercialSpecs[0],
  ...retencaoSpecs(false).filter((s) => ["Adimplentes", "Renovação", "Churn", "Inadimplência"].includes(s.title)),
];
const REDE = "__rede__";

/** Uma unidade: indicadores do mês, posição na rede (ranking com ela em destaque), metas, contratos e evolução contra a rede ou outra unidade. */
export function UnidadeDetalhe({ unit, selectedMonth, compareMonth, metas, deltas, evalMonth, prevEvalMonth, onOpenMetas }: Props) {
  const units = useMemo(() => getAvailableUnits(), []);
  const fechados = useMemo(() => dashboardData.filter((d) => !isPartialMonth(d.month)).map((d) => d.month), []);
  const [periodo, setPeriodo] = useState(12);
  const [comparar, setComparar] = useState(REDE);
  const mesesGrafico = mesesNoIntervalo(dashboardData, fechados[Math.max(0, fechados.length - periodo)] ?? "", fechados[fechados.length - 1] ?? "");

  const months = dashboardData.map((d) => d.month);
  const partial = isPartialMonth(selectedMonth);
  const idx = months.indexOf(selectedMonth);
  const prev = idx > 0 ? months[idx - 1] : undefined;
  const ctx: KpiContext = {
    cur: viewFor(selectedMonth, unit) ?? { month: selectedMonth, total: dashboardData[idx]?.total, units: [] },
    prev: viewFor(compareMonth && compareMonth !== selectedMonth ? compareMonth : prev, unit),
    ly: partial || compareMonth === sameMonthLastYear(selectedMonth) ? undefined : viewFor(sameMonthLastYear(selectedMonth), unit),
    partial,
  };

  // Posição na rede: no último mês fechado (o mês em andamento é parcial e distorceria o ranking).
  const rankMonth = partial ? getLastClosedMonth(months) : selectedMonth;
  const rankUnits = dashboardData.find((d) => d.month === rankMonth)?.units ?? [];
  const unitNow = dashboardData.find((d) => d.month === selectedMonth)?.units.find((u) => u.name === unit);
  const mesAtual = dashboardData.find((d) => d.month === selectedMonth);
  const metasDaUnidade = (Object.keys(META_INDICATORS) as MetaKey[]).flatMap((key) => {
    const meta = getMeta(metas, selectedMonth, unit, key);
    const actual = mesAtual ? actualFor(mesAtual, unit, key) : null;
    if (!meta || actual === null) return [];
    return [{ key, actual, nivel: tierReached(key, actual, meta), proximo: nextTier(key, actual, meta) }];
  });
  const ultimoComContratos = [...dashboardData].reverse().map((d) => d.units.find((u) => u.name === unit)).find((u) => u?.contratosAtivos !== undefined);
  const contratosDaUnidade = ultimoComContratos ? contratosView(ultimoComContratos) : null;
  const hasDeltas = deltas.length > 0 && !!evalMonth && !!prevEvalMonth;
  const outra = comparar !== REDE && comparar !== "" && comparar !== unit ? comparar : null;

  return (
    <div className="space-y-8 sm:space-y-10">
      <section aria-label={`Indicadores de ${unit}`}>
        {unitNow ? <KpiGrid ctx={ctx} specs={unitSpecs} columns="xl:grid-cols-4" /> : <p className="text-sm text-muted-foreground">{unit} não tem dados em {formatMonthLong(selectedMonth)}.</p>}
      </section>

      <section aria-label="Metas da unidade" className="card-surface flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Metas de {formatMonthLong(selectedMonth)}:</span>{" "}
          {metasDaUnidade.length === 0 ? `nenhuma cadastrada para ${unit}.` : metasDaUnidade.map(({ key, actual, nivel, proximo }, i) => (
            <span key={key}>{i > 0 && " · "}{META_INDICATORS[key].label} {formatMetaValue(key, actual)}{partial && " (parcial)"}, {nivel === "abaixo" ? "abaixo da meta" : `atingiu ${TIER_LABEL[nivel]}`}{proximo && `, falta ${formatMetaValue(key, proximo.gap)} para ${TIER_LABEL[proximo.tier]}`}</span>
          ))}
        </p>
        {onOpenMetas && <button type="button" onClick={onOpenMetas} className="no-print rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">Ver em Metas</button>}
      </section>

      <UnitsRanking
        units={rankUnits}
        monthLabel={rankMonth ? formatMonthLong(rankMonth) : ""}
        partial={false}
        destaque={unit}
        variationView={hasDeltas ? <UnitDeltaChart deltas={deltas} curMonth={evalMonth!} prevMonth={prevEvalMonth!} /> : undefined}
      />

      {contratosDaUnidade && (
        <section aria-labelledby="contratos-un-titulo" className="space-y-3">
          <div>
            <h3 id="contratos-un-titulo" className="text-base font-semibold text-foreground">Contratos ativos hoje</h3>
            <p className="text-sm text-muted-foreground">Foto do EVO, sobre {contratosDaUnidade.total.toLocaleString("pt-BR")} contratos ativos. Plano local libera até 9 unidades; plano rede, 10 ou mais (nas unidades Pro, todos são rede). Local e rede somam 100%; especiais/VIP e personal são recortes dentro deles.</p>
          </div>
          <ContratosTiles v={contratosDaUnidade} />
        </section>
      )}

      <section aria-labelledby="evolucao-un-titulo" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 id="evolucao-un-titulo" className="text-base font-semibold text-foreground">Evolução de {mesesGrafico.length} {mesesGrafico.length === 1 ? "mês" : "meses"}{mesesGrafico.length ? `: ${formatMonthLong(mesesGrafico[0])} a ${formatMonthLong(mesesGrafico[mesesGrafico.length - 1])}` : ""}</h3>
          <div className="no-print flex flex-wrap items-end gap-4">
            <div role="group" aria-label="Período dos gráficos" className="inline-flex overflow-hidden rounded-lg border border-border">
              {PERIODOS.map((p) => (
                <button key={p.n} type="button" aria-pressed={periodo === p.n} onClick={() => setPeriodo(p.n)} className={cn("h-9 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", periodo === p.n ? "bg-foreground text-background" : "bg-white text-foreground hover:bg-secondary")}>{p.label}</button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Comparar com
              <Select value={comparar} onChange={(e) => setComparar(e.target.value)} className="h-9 w-56 text-sm font-normal text-foreground">
                <option value="">Nada</option>
                <option value={REDE}>Média da rede</option>
                {units.filter((u) => u !== unit).map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {TREND_KEYS.map((k) => {
            const ind = INDICATOR_BY_KEY[k];
            const comp = comparar === REDE ? { label: ind.format === "percent" ? "Rede" : "Média da rede", rows: serieDaRede(dashboardData, ind, mesesGrafico) }
              : outra ? { label: outra, rows: seriesPorMeses(dashboardData, outra, ind, mesesGrafico) } : undefined;
            return <TrendCard key={k} ind={ind} rows={seriesPorMeses(dashboardData, unit, ind, mesesGrafico)} unitLabel={unit} comp={comp} />;
          })}
        </div>
        <p className="text-xs text-muted-foreground">Meses sem dado lançado aparecem como lacuna. Em percentuais, a linha da rede é o resultado da rede; em valores e contagens, é a média das unidades, para ficar na mesma escala. Inadimplência vem do EVO a partir de 11/2025; antes, da planilha.</p>
      </section>

      {outra && <UnitComparison key={`${unit}|${outra}`} selectedMonth={rankMonth ?? selectedMonth} inicialA={unit} inicialB={outra} />}
    </div>
  );
}
