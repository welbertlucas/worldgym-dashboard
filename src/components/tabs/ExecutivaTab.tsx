import { DollarSign, ShoppingCart, AlertCircle, Target, Wallet, Users } from "lucide-react";
import { MetricCard, type MetricDetail } from "@/components/MetricCard";
import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { UnitHighlights } from "@/components/UnitHighlights";
import { RevenueTrend } from "@/components/executiva/RevenueTrend";
import { TopUnits } from "@/components/executiva/TopUnits";
import { RecommendationCard } from "@/components/tabs/RecommendationCard";
import { type MonthData, dashboardData } from "@/data/dashboardData";
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
  const cmp = partial ? undefined : prev; // mês em andamento não é comparado
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
  const spark = (pick: (m: MonthData) => number) => closed.map(pick);

  // Mesmo mês do ano anterior (só para mês fechado e se existir na planilha).
  const ly = partial ? undefined : dashboardData.find((d) => d.month === sameMonthLastYear(month.month));
  const shortMonth = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  const lyShort = ly ? shortMonth(ly.month) : "";
  const vsPrev = (cur: number, base: number | undefined, mode: "pct" | "pp", higher: boolean) => variation(cur, base, mode, higher, "mês anterior");
  const vsYear = (cur: number, base: number | undefined, mode: "pct" | "pp", higher: boolean) => (ly ? variation(cur, base, mode, higher, lyShort) : undefined);
  // Linha tracejada dos mini-gráficos: o mesmo mês do ano anterior, quando existe.
  const sparkPrior = (pick: (m: MonthData) => number) => closed.map((m) => {
    const l = dashboardData.find((d) => d.month === sameMonthLastYear(m.month));
    return l ? pick(l) : null;
  });
  const previous = (text: string) => (cmp ? { value: text, label: shortMonth(cmp.month) } : undefined);
  const partialMonthData = dashboardData.filter((d) => isPartialMonth(d.month)).slice(-1)[0];

  const recebRatio = t.faturamento ? (t.recebimento / t.faturamento) * 100 : 0;
  const level = (v: number) => (v < 5 ? "success" : v < 8 ? "warning" : "destructive") as "success" | "warning" | "destructive";
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
  const tile = "bg-white";

  return (
    <div className="space-y-8 sm:space-y-10">
      {partial && (
        <Notice>
          <b>{formatMonthLong(month.month)} está em andamento</b> — os valores são parciais e não são comparados nem geram alertas.
          {evalMonth && <> Alertas e destaques usam o último mês fechado: <b>{formatMonthLong(evalMonth)}</b>.</>}
        </Notice>
      )}

      <section aria-labelledby="indicadores-titulo">
        <SectionTitle level="page" hint="Totais da rede no mês selecionado. A linha tracejada de cada indicador é o mesmo mês do ano anterior.">
          <span id="indicadores-titulo">Visão executiva</span>
        </SectionTitle>
        <div className="card-surface overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-border">
            <MetricCard bare className={tile} title="Faturamento" value={formatAbbreviatedNumber(t.faturamento)} previous={previous(formatAbbreviatedNumber(cmp?.total.faturamento ?? 0))} details={only(vsPrev(t.faturamento, cmp?.total.faturamento, "pct", true), vsYear(t.faturamento, ly?.total.faturamento, "pct", true))} icon={DollarSign} variant="success" spark={spark((m) => m.total.faturamento)} sparkCompare={sparkPrior((m) => m.total.faturamento)} />
            <MetricCard bare className={tile} title="Recebimento" value={formatAbbreviatedNumber(t.recebimento)} previous={previous(formatAbbreviatedNumber(cmp?.total.recebimento ?? 0))} details={only({ text: `${pctText(recebRatio)} do faturamento`, tone: "neutral" }, vsPrev(t.recebimento, cmp?.total.recebimento, "pct", true), vsYear(t.recebimento, ly?.total.recebimento, "pct", true))} icon={Wallet} variant={recebRatio < 90 ? "warning" : "success"} spark={spark((m) => m.total.recebimento)} sparkCompare={sparkPrior((m) => m.total.recebimento)} />
            <MetricCard bare className={tile} title="Vendas Online" value={brl(t.vendasOnline)} previous={previous(brl(cmp?.total.vendasOnline ?? 0))} details={only(vsPrev(t.vendasOnline, cmp?.total.vendasOnline, "pct", true), vsYear(t.vendasOnline, ly?.total.vendasOnline, "pct", true))} icon={ShoppingCart} variant="default" spark={spark((m) => m.total.vendasOnline)} sparkCompare={sparkPrior((m) => m.total.vendasOnline)} />
            <MetricCard bare className={tile} title="Churn" value={pctText(t.churn)} previous={previous(pctText(cmp?.total.churn ?? 0))} details={only(vsPrev(t.churn, cmp?.total.churn, "pp", false), vsYear(t.churn, ly?.total.churn, "pp", false))} icon={AlertCircle} variant={level(t.churn)} spark={spark((m) => m.total.churn)} sparkCompare={sparkPrior((m) => m.total.churn)} />
            <MetricCard bare className={tile} title="Inadimplência" value={pctText(t.inadimplenciaPerc)} previous={previous(pctText(cmp?.total.inadimplenciaPerc ?? 0))} details={only(vsPrev(t.inadimplenciaPerc, cmp?.total.inadimplenciaPerc, "pp", false), vsYear(t.inadimplenciaPerc, ly?.total.inadimplenciaPerc, "pp", false))} icon={Users} variant={level(t.inadimplenciaPerc)} spark={spark((m) => m.total.inadimplenciaPerc)} sparkCompare={sparkPrior((m) => m.total.inadimplenciaPerc)} />
            <MetricCard
              bare
              className={tile}
              title="Metas da rede"
              value={redeTiers.length ? `${reachedBronze} de ${redeTiers.length}` : "—"}
              subtitle={redeTiers.length ? `Ouro ${tierCount("ouro")} • Prata ${tierCount("prata")} • Bronze ${tierCount("bronze")} • Abaixo ${tierCount("abaixo")}` : undefined}
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
            <button type="button" onClick={onOpenRiscos} className="rounded-lg text-primary font-semibold underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver todos os riscos e recomendações</button>
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
