import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { UnitHighlights } from "@/components/UnitHighlights";
import { RevenueTrend } from "@/components/executiva/RevenueTrend";
import { TopUnits } from "@/components/executiva/TopUnits";
import { KpiGrid, type KpiContext, type KpiSpec } from "@/components/kpi/KpiGrid";
import { MetasKpiCard, type RedeGoal } from "@/components/executiva/MetasKpiCard";
import { RecommendationCard } from "@/components/tabs/RecommendationCard";
import { type MonthData, dashboardData } from "@/data/dashboardData";
import { type Alert } from "@/data/alerts";
import { buildRecommendations } from "@/data/recommendations";
import { type UnitDelta } from "@/data/unitMetrics";
import { actualFor, isSingleGoal, progressToNext, tierReached, type Meta, type MetaKey } from "@/data/metas";
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
  onOpenMetas?: () => void;
}

const pctText = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

export function ExecutivaTab({ month, prev, alerts, evalMonth, deltas, metas, onOpenRiscos, onOpenUnidades, onOpenMetas }: Props) {
  const partial = isPartialMonth(month.month);
  const t = month.total;
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const attention = alerts.filter((a) => a.severity === "attention").length;
  const recs = buildRecommendations(alerts.filter((a) => a.severity !== "info")).slice(0, 5);

  // Metas da rede no mês exibido: progresso rumo ao próximo nível e nível atingido
  const redeGoals: RedeGoal[] = metas
    .filter((m) => m.month === month.month && m.unit === "TOTAL")
    .map((m) => {
      const a = actualFor(month, "TOTAL", m.key as MetaKey);
      if (a === null) return null;
      const { pct, next } = progressToNext(m.key, a, m);
      return { tier: tierReached(m.key, a, m), pct, done: next === null, single: isSingleGoal(m) };
    })
    .filter((x): x is RedeGoal => x !== null);

  // Gráfico de tendência: últimos 12 meses FECHADOS (o mês em andamento não entra, para não parecer queda).
  const closed = dashboardData.filter((d) => !isPartialMonth(d.month)).slice(-12);
  const partialMonthData = dashboardData.filter((d) => isPartialMonth(d.month)).slice(-1)[0];

  // Mesmo mês do ano anterior (só para mês fechado e se existir na planilha).
  const ly = partial ? undefined : dashboardData.find((d) => d.month === sameMonthLastYear(month.month));
  const ctx: KpiContext = { cur: month, prev, ly, partial };
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
  const recebRatio = t.faturamento ? (t.recebimento / t.faturamento) * 100 : 0;
  const specs: KpiSpec[] = [
    { title: "Faturamento", kind: "flow", pick: (v) => v.total.faturamento, fmt: formatAbbreviatedNumber },
    { title: "Recebimento", kind: "flow", pick: (v) => v.total.recebimento, fmt: formatAbbreviatedNumber, extra: [{ text: `${pctText(recebRatio)} do faturamento`, tone: "neutral" }] },
    { title: "Vendas Online", kind: "flow", pick: (v) => v.total.vendasOnline, fmt: brl },
    { title: "Churn", kind: "rate", rateKey: "churn", pick: (v) => v.total.churn, fmt: pctText },
    { title: "Inadimplência", kind: "rate", rateKey: "inadimplenciaPerc", pick: (v) => v.total.inadimplenciaPerc, fmt: pctText },
    { title: "Renovação", kind: "rate", rateKey: "renovacoes", pick: (v) => v.total.renovacoes, fmt: pctText },
    { title: "Conversão", kind: "rate", rateKey: "icv", pick: (v) => v.total.icv, fmt: pctText },
  ];

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
        <KpiGrid ctx={ctx} specs={specs}>
          <MetasKpiCard goals={redeGoals} partial={partial} onOpen={onOpenMetas ?? (() => {})} />
        </KpiGrid>
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
