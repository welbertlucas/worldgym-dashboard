import { Target } from "lucide-react";
import { MetricCard, type MetricDetail } from "@/components/MetricCard";
import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { UnitHighlights } from "@/components/UnitHighlights";
import { RevenueTrend } from "@/components/executiva/RevenueTrend";
import { TopUnits } from "@/components/executiva/TopUnits";
import { KpiGaugeCard } from "@/components/executiva/KpiGaugeCard";
import { absoluteGauge, rateGauge } from "@/data/kpiGauge";
import { INDICATOR_BY_KEY } from "@/data/unitIndicators";
import { RecommendationCard } from "@/components/tabs/RecommendationCard";
import { type MonthData, type UnitData, dashboardData } from "@/data/dashboardData";
import { type Alert } from "@/data/alerts";
import { buildRecommendations } from "@/data/recommendations";
import { type UnitDelta } from "@/data/unitMetrics";
import { actualFor, tierReached, type Meta, type MetaKey, type TierResult } from "@/data/metas";
import { formatMonthLong, isPartialMonth } from "@/data/periods";
import { sameMonthLastYear } from "@/data/alerts";
import { formatAbbreviatedNumber } from "@/lib/utils";

interface Props {
  month: MonthData;
  prev?: MonthData;
  alerts: Alert[];
  evalMonth: string | null;
  deltas: UnitDelta[];
  metas: Meta[];
  onOpenRiscos: () => void;
  onOpenUnidades: () => void;
}

const pctText = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
/** Variação vs. uma referência. Texto idêntico ao anterior; acrescenta direção (seta) e tom (favorável/desfavorável). */
const variation = (cur: number, base: number | undefined, mode: "pct" | "pp", higherIsBetter: boolean, ref: string): MetricDetail | undefined => {
  if (base === undefined || !base) return undefined;
  const d = mode === "pct" ? ((cur - base) / base) * 100 : cur - base;
  const flat = Math.abs(d) < 0.05;
  return {
    text: `${d > 0 ? "+" : ""}${d.toFixed(1).replace(".", ",")}${mode === "pct" ? "%" : " p.p."} vs. ${ref}`,
    direction: flat ? "flat" : d > 0 ? "up" : "down",
    tone: flat ? "neutral" : d > 0 === higherIsBetter ? "good" : "bad",
  };
};
const only = (...xs: (MetricDetail | undefined)[]) => xs.filter((x): x is MetricDetail => !!x);

export function ExecutivaTab({ month, prev, alerts, evalMonth, deltas, metas, onOpenRiscos, onOpenUnidades }: Props) {
  const partial = isPartialMonth(month.month);
  const t = month.total;
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const attention = alerts.filter((a) => a.severity === "attention").length;
  const recs = buildRecommendations(alerts.filter((a) => a.severity !== "info")).slice(0, 5);

  // Níveis de meta da rede no mês exibido (bronze/prata/ouro)
  const redeTiers = metas
    .filter((m) => m.month === month.month && m.unit === "TOTAL")
    .map((m) => { const a = actualFor(month, "TOTAL", m.key as MetaKey); return a === null ? null : tierReached(m.key, a, m); })
    .filter((x): x is TierResult => x !== null);
  const tierCount = (tr: TierResult) => redeTiers.filter((x) => x === tr).length;
  const reachedBronze = redeTiers.filter((x) => x !== "abaixo").length;

  // Mini-gráficos: últimos 12 meses FECHADOS (o mês em andamento não entra, para não parecer queda).
  const closed = dashboardData.filter((d) => !isPartialMonth(d.month)).slice(-12);

  // Mesmo mês do ano anterior (só para mês fechado e se existir na planilha).
  const ly = partial ? undefined : dashboardData.find((d) => d.month === sameMonthLastYear(month.month));
  const shortMonth = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  const lyShort = ly ? shortMonth(ly.month) : "";
  const prevShort = prev ? shortMonth(prev.month) : "";
  const vsPrev = (cur: number, base: number | undefined, mode: "pct" | "pp", higher: boolean) => variation(cur, base, mode, higher, prevShort);
  const vsYear = (cur: number, base: number | undefined, mode: "pct" | "pp", higher: boolean) => (ly ? variation(cur, base, mode, higher, lyShort) : undefined);
  const partialMonthData = dashboardData.filter((d) => isPartialMonth(d.month)).slice(-1)[0];

  const recebRatio = t.faturamento ? (t.recebimento / t.faturamento) * 100 : 0;
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  // Valor absoluto: arco = realizado ÷ mês anterior. Mês em andamento mostra quanto do mês anterior já foi alcançado.
  const absTile = (title: string, pick: (u: UnitData) => number, fmt: (v: number) => string, extra: MetricDetail[] = []) => {
    const cur = pick(t), base = prev ? pick(prev.total) : undefined;
    const g = absoluteGauge(cur, base, partial);
    const details = partial
      ? only(...extra, base ? { text: `${Math.floor((cur / base) * 100)}% de ${fmt(base)} de ${prevShort}`, tone: "neutral" } : undefined)
      : only(...extra, vsPrev(cur, base, "pct", true), vsYear(cur, ly ? pick(ly.total) : undefined, "pct", true));
    return <KpiGaugeCard title={title} value={fmt(cur)} {...g} details={details} partial={partial} />;
  };
  // Taxa: arco na escala do indicador, cor pela faixa de leitura existente, marca = mês anterior (comparação provisória se parcial).
  const rateTile = (key: "churn" | "inadimplenciaPerc" | "renovacoes" | "icv", title: string) => {
    const ind = INDICATOR_BY_KEY[key];
    const higher = ind.direction === "higher";
    const cur = ind.value(t), base = prev ? ind.value(prev.total) : undefined;
    const g = rateGauge(ind, cur, base);
    return <KpiGaugeCard title={title} value={pctText(cur)} {...g} details={only(vsPrev(cur, base, "pp", higher), vsYear(cur, ly ? ind.value(ly.total) : undefined, "pp", higher))} partial={partial} />;
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {partial && (
        <Notice>
          <b>{formatMonthLong(month.month)} está em andamento</b> — os valores são parciais: a comparação com o mês anterior é provisória e não gera alertas.
          {evalMonth && <> Alertas e destaques usam o último mês fechado: <b>{formatMonthLong(evalMonth)}</b>.</>}
        </Notice>
      )}

      <section aria-labelledby="indicadores-titulo">
        <SectionTitle level="page" hint="Totais da rede no mês selecionado. A marca no arco é o mês anterior.">
          <span id="indicadores-titulo">Visão executiva</span>
        </SectionTitle>
        <div className="card-surface overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-border">
            {absTile("Faturamento", (u) => u.faturamento, formatAbbreviatedNumber)}
            {absTile("Recebimento", (u) => u.recebimento, formatAbbreviatedNumber, [{ text: `${pctText(recebRatio)} do faturamento`, tone: "neutral" }])}
            {absTile("Vendas Online", (u) => u.vendasOnline, brl)}
            {rateTile("churn", "Churn")}
            {rateTile("inadimplenciaPerc", "Inadimplência")}
            {rateTile("renovacoes", "Renovação")}
            {rateTile("icv", "Conversão")}
            <MetricCard
              bare
              className="bg-white"
              title="Metas da rede"
              value={redeTiers.length ? `${reachedBronze} de ${redeTiers.length}` : "—"}
              subtitle={redeTiers.length ? `${partial ? "Parcial do mês • " : ""}Ouro ${tierCount("ouro")} • Prata ${tierCount("prata")} • Bronze ${tierCount("bronze")} • ${partial ? "Ainda abaixo" : "Abaixo"} ${tierCount("abaixo")}` : undefined}
              icon={Target}
              variant={!redeTiers.length ? "default" : reachedBronze === redeTiers.length ? "success" : tierCount("abaixo") * 2 >= redeTiers.length ? "destructive" : "warning"}
              empty={redeTiers.length ? undefined : { message: "Sem metas da rede cadastradas para este mês", hint: "Preencha a aba Metas da planilha para acompanhar os níveis bronze, prata e ouro." }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 min-w-0">
          <RevenueTrend closed={closed} all={dashboardData} partialMonth={partialMonthData} />
        </div>
        <TopUnits units={month.units} monthLabel={formatMonthLong(month.month)} partial={partial} onOpen={onOpenUnidades} />
      </section>

      <section aria-labelledby="prioridades-titulo" className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-5 sm:p-6">
          <div className="flex-1 min-w-[14rem]">
            <h3 id="prioridades-titulo" className="text-base font-semibold text-foreground">Prioridades da diretoria</h3>
            <p className="text-sm text-muted-foreground">Até cinco itens de maior prioridade no último mês fechado</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-destructive/10 text-destructive font-semibold px-3 py-1">{critical} críticos</span>
            <span className="rounded-full bg-warning/10 text-warning font-semibold px-3 py-1">{attention} em atenção</span>
            <button type="button" onClick={onOpenRiscos} className="rounded-lg text-primary-ink font-semibold underline underline-offset-4 hover:text-primary-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver todos os riscos e recomendações</button>
          </div>
        </div>
        {recs.length ? (
          <div className="divide-y divide-border border-t border-border">{recs.map((r) => <RecommendationCard key={r.id} rec={r} flat />)}</div>
        ) : (
          <p className="border-t border-border p-5 text-sm text-muted-foreground">Nenhum alerta crítico ou de atenção no último mês fechado.</p>
        )}
      </section>

      {deltas.length > 0 && (
        <section>
          <SectionTitle>Comparação entre unidades</SectionTitle>
          <UnitHighlights deltas={deltas} />
          <p className="text-xs text-muted-foreground mt-2">Baseado no último mês fechado vs. o anterior. Unidades novas (sem mês anterior) ficam de fora.</p>
        </section>
      )}
    </div>
  );
}
