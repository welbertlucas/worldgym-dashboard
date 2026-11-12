import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { UnitHighlights } from "@/components/UnitHighlights";
import { RevenueTrend } from "@/components/executiva/RevenueTrend";
import { TopUnits } from "@/components/executiva/TopUnits";
import { KpiGrid, type KpiContext, type KpiSpec } from "@/components/kpi/KpiGrid";
import { MetasKpiCard, type RedeGoal } from "@/components/executiva/MetasKpiCard";
import { RecommendationCard } from "@/components/tabs/RecommendationCard";
import { type MonthData, dashboardData, dashboardDataRede } from "@/data/dashboardData";
import { type Alert } from "@/data/alerts";
import { buildRecommendations } from "@/data/recommendations";
import { type UnitDelta } from "@/data/unitMetrics";
import { formatMetaValue, highestTier, isSingleGoal, progressToNext, resolveGoal, tierReached, TIER_LABEL, type Meta, type MetaKey } from "@/data/metas";
import { formatMonthLong, isPartialMonth } from "@/data/periods";
import { sameMonthLastYear } from "@/data/alerts";
import { formatAbbreviatedNumber } from "@/lib/utils";

interface Props {
  month: MonthData;
  prev?: MonthData;
  /** Há um mês marcado em "Comparar com": os velocímetros mostram só ele, sem o chip do ano anterior. */
  comparaMesEscolhido?: boolean;
  alerts: Alert[];
  evalMonth: string | null;
  deltas: UnitDelta[];
  metas: Meta[];
  onOpenPlano: () => void;
  onOpenUnidades: () => void;
  onOpenMetas?: () => void;
  /** Meses usados no gráfico e no mesmo mês do ano anterior: a rede, ou só as unidades da pessoa. */
  serie?: MonthData[];
  /** Perfil de unidades: as unidades da pessoa (a tela mostra só a soma delas, nada da rede). null = vê a rede. */
  unidades?: string[] | null;
}

const pctText = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

export function ExecutivaTab({ month, prev, comparaMesEscolhido, alerts, evalMonth, deltas, metas, onOpenPlano, onOpenUnidades, onOpenMetas, serie = dashboardDataRede, unidades = null }: Props) {
  const umaUnidade = unidades?.length === 1 ? unidades[0] : null;
  const escopo = !unidades ? "da rede" : umaUnidade ? "da unidade" : "das suas unidades";
  // Meta de um indicador no mês: a da rede (linha TOTAL), a da unidade, ou a soma das metas das unidades da pessoa
  // (só para indicadores que somam; a meta TOTAL da rede não vale para quem vê só algumas unidades).
  const metaDe = (key: MetaKey) =>
    !unidades ? resolveGoal(metas, month, month.month, null, key)
    : umaUnidade ? resolveGoal(metas, month, month.month, umaUnidade, key)
    : resolveGoal(metas.filter((m) => m.unit !== "TOTAL" && m.unit !== "REDE"), month, month.month, null, key);
  const partial = isPartialMonth(month.month);
  const t = month.total;
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const attention = alerts.filter((a) => a.severity === "attention").length;
  const recs = buildRecommendations(alerts.filter((a) => a.severity !== "info"), dashboardData).slice(0, 5);

  // Metas no mês exibido (da rede ou das unidades da pessoa): progresso rumo ao próximo nível e nível atingido
  const chaves = [...new Set(metas.filter((m) => m.month === month.month && (unidades ? unidades.includes(m.unit) : m.unit === "TOTAL")).map((m) => m.key as MetaKey))];
  const redeGoals: RedeGoal[] = chaves
    .map((key) => {
      const g = metaDe(key);
      if (!g) return null;
      const { pct, next } = progressToNext(key, g.actual, g.meta);
      return { tier: tierReached(key, g.actual, g.meta), pct, done: next === null, single: isSingleGoal(g.meta) };
    })
    .filter((x): x is RedeGoal => x !== null);

  // Gráfico de tendência: últimos 12 meses FECHADOS (o mês em andamento não entra, para não parecer queda).
  const closed = serie.filter((d) => !isPartialMonth(d.month)).slice(-12);
  const partialMonthData = serie.filter((d) => isPartialMonth(d.month)).slice(-1)[0];

  // Mesmo mês do ano anterior (só para mês fechado e se existir na planilha).
  const ly = partial || comparaMesEscolhido ? undefined : serie.find((d) => d.month === sameMonthLastYear(month.month));
  const ctx: KpiContext = { cur: month, prev, ly, partial };
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
  // Ritmo do mês: em que nível da meta de faturamento a previsão fecha o mês.
  const goal = metaDe("faturamento");
  const ritmoDaMeta = (previsao: number): KpiSpec["extra"] => {
    if (!goal) return undefined;
    const top = highestTier(goal.meta);
    const nivel = tierReached("faturamento", previsao, goal.meta);
    return [
      {
        text: isSingleGoal(goal.meta) && top
          ? `No ritmo atual: ${nivel === "abaixo" ? `abaixo da meta ${TIER_LABEL[top.tier]}` : `meta ${TIER_LABEL[top.tier]} atingida`}`
          : `No ritmo atual: ${nivel === "abaixo" ? "abaixo do bronze" : `nível ${TIER_LABEL[nivel]}`}`,
        tone: nivel === "abaixo" ? "bad" : "good",
      },
      ...(top ? [{ text: `${Math.floor((previsao / top.value) * 100)}% da meta ${TIER_LABEL[top.tier]} (${formatMetaValue("faturamento", top.value)})`, tone: "neutral" as const }] : []),
    ];
  };
  const recebRatio = t.faturamento ? (t.recebimento / t.faturamento) * 100 : 0;
  const specs: KpiSpec[] = [
    { title: "Faturamento", kind: "flow", pick: (v) => v.total.faturamento, fmt: formatAbbreviatedNumber },
    // Só no mês em andamento: o que ainda vai vencer até o fim do mês somado ao que já venceu (mês fechado = faturamento).
    ...(partial && t.previsaoFaturamento !== undefined
      ? [{ title: "Previsão de faturamento", kind: "flow" as const, pick: (v: MonthData) => v.total.previsaoFaturamento ?? v.total.faturamento, fmt: formatAbbreviatedNumber, extra: ritmoDaMeta(t.previsaoFaturamento!) }]
      : []),
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
        <SectionTitle level="page" hint={`${umaUnidade ? `Números de ${umaUnidade}` : unidades ? `Soma das suas ${unidades.length} unidades` : "Totais da rede"} no mês selecionado. A marca no arco é o mês anterior.`}>
          <span id="indicadores-titulo">Overview</span>
        </SectionTitle>
        <KpiGrid ctx={ctx} specs={specs}>
          <MetasKpiCard goals={redeGoals} partial={partial} onOpen={onOpenMetas ?? (() => {})} escopo={escopo} />
        </KpiGrid>
      </section>

      {/* Com uma unidade só não há o que ranquear: o gráfico ocupa a linha toda */}
      <section className={umaUnidade ? "" : "grid gap-6 xl:grid-cols-3"}>
        <div className={umaUnidade ? "min-w-0" : "xl:col-span-2 min-w-0"}>
          <RevenueTrend closed={closed} all={serie} partialMonth={partialMonthData} escopo={umaUnidade ? `de ${umaUnidade}` : escopo} />
        </div>
        {!umaUnidade && <TopUnits units={month.units} monthLabel={formatMonthLong(month.month)} partial={partial} onOpen={onOpenUnidades} />}
      </section>

      <section aria-labelledby="prioridades-titulo" className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-5 sm:p-6">
          <div className="flex-1 min-w-[14rem]">
            <h3 id="prioridades-titulo" className="text-base font-semibold text-foreground">Plano de ação</h3>
            <p className="text-sm text-muted-foreground">Os cinco itens mais urgentes do último mês fechado</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-destructive/10 text-destructive font-semibold px-3 py-1">{critical} críticos</span>
            <span className="rounded-full bg-warning/10 text-warning font-semibold px-3 py-1">{attention} em atenção</span>
            <button type="button" onClick={onOpenPlano} className="rounded-lg text-primary-ink font-semibold underline underline-offset-4 hover:text-primary-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver o plano completo</button>
          </div>
        </div>
        {recs.length ? (
          <div className="divide-y divide-border border-t border-border">{recs.map((r) => <RecommendationCard key={r.id} rec={r} flat evalMonth={evalMonth} />)}</div>
        ) : (
          <p className="border-t border-border p-5 text-sm text-muted-foreground">Nenhum alerta crítico ou de atenção no último mês fechado.</p>
        )}
      </section>

      {deltas.length > 1 && (
        <section>
          <SectionTitle>Comparação entre unidades</SectionTitle>
          <UnitHighlights deltas={deltas} />
          <p className="text-xs text-muted-foreground mt-2">Baseado no último mês fechado vs. o anterior. Unidades novas (sem mês anterior) ficam de fora.</p>
        </section>
      )}
    </div>
  );
}
