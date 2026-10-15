import { DollarSign, ShoppingCart, AlertCircle, Target, Wallet, Users } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { SectionTitle } from "@/components/TabBar";
import { UnitHighlights } from "@/components/UnitHighlights";
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
}

const pctText = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const diffText = (cur: number, prev: number | undefined, mode: "pct" | "pp") => {
  if (prev === undefined || !prev) return undefined;
  const d = mode === "pct" ? ((cur - prev) / prev) * 100 : cur - prev;
  return `${d > 0 ? "+" : ""}${d.toFixed(1).replace(".", ",")}${mode === "pct" ? "%" : " p.p."} vs. mês anterior`;
};

export function ExecutivaTab({ month, prev, alerts, evalMonth, deltas, metas, onOpenRiscos }: Props) {
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
  const lyShort = ly ? new Date(Number(ly.month.slice(0, 4)), Number(ly.month.slice(5)) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "";
  const yoy = (cur: number, base: number | undefined, mode: "pct" | "pp") => {
    if (!ly || base === undefined || !base) return undefined;
    const d = mode === "pct" ? ((cur - base) / base) * 100 : cur - base;
    return `${d > 0 ? "+" : ""}${d.toFixed(1).replace(".", ",")}${mode === "pct" ? "%" : " p.p."} vs. ${lyShort}`;
  };
  const join = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(" • ") || undefined;

  const recebRatio = t.faturamento ? (t.recebimento / t.faturamento) * 100 : 0;
  const level = (v: number) => (v < 5 ? "success" : v < 8 ? "warning" : "destructive") as "success" | "warning" | "destructive";

  return (
    <div className="space-y-6 sm:space-y-8">
      {partial && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <b>{formatMonthLong(month.month)} está em andamento</b> — os valores são parciais e não são comparados nem geram alertas.
          {evalMonth && <> Alertas e destaques usam o último mês fechado: <b>{formatMonthLong(evalMonth)}</b>.</>}
        </div>
      )}
      <section>
        <SectionTitle hint="Totais da rede no mês selecionado; o traço mostra os últimos 12 meses fechados.">Visão executiva</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          <MetricCard title="Faturamento" value={formatAbbreviatedNumber(t.faturamento)} subtitle={join(diffText(t.faturamento, cmp?.total.faturamento, "pct"), yoy(t.faturamento, ly?.total.faturamento, "pct"))} icon={DollarSign} variant="success" spark={spark((m) => m.total.faturamento)} />
          <MetricCard title="Recebimento" value={formatAbbreviatedNumber(t.recebimento)} subtitle={join(`${pctText(recebRatio)} do faturamento`, diffText(t.recebimento, cmp?.total.recebimento, "pct"), yoy(t.recebimento, ly?.total.recebimento, "pct"))} icon={Wallet} variant={recebRatio < 90 ? "warning" : "success"} spark={spark((m) => m.total.recebimento)} />
          <MetricCard title="Vendas Online" value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(t.vendasOnline)} subtitle={join(diffText(t.vendasOnline, cmp?.total.vendasOnline, "pct"), yoy(t.vendasOnline, ly?.total.vendasOnline, "pct"))} icon={ShoppingCart} variant="default" spark={spark((m) => m.total.vendasOnline)} />
          <MetricCard title="Churn" value={pctText(t.churn)} subtitle={join(diffText(t.churn, cmp?.total.churn, "pp"), yoy(t.churn, ly?.total.churn, "pp"))} icon={AlertCircle} variant={level(t.churn)} spark={spark((m) => m.total.churn)} />
          <MetricCard title="Inadimplência" value={pctText(t.inadimplenciaPerc)} subtitle={join(diffText(t.inadimplenciaPerc, cmp?.total.inadimplenciaPerc, "pp"), yoy(t.inadimplenciaPerc, ly?.total.inadimplenciaPerc, "pp"))} icon={Users} variant={level(t.inadimplenciaPerc)} spark={spark((m) => m.total.inadimplenciaPerc)} />
          <MetricCard
            title="Metas da rede"
            value={redeTiers.length ? `${reachedBronze} de ${redeTiers.length}` : "—"}
            subtitle={redeTiers.length ? `Ouro ${tierCount("ouro")} • Prata ${tierCount("prata")} • Bronze ${tierCount("bronze")} • Abaixo ${tierCount("abaixo")}` : "Sem metas da rede cadastradas para este mês"}
            icon={Target}
            variant={!redeTiers.length ? "default" : reachedBronze === redeTiers.length ? "success" : tierCount("abaixo") * 2 >= redeTiers.length ? "destructive" : "warning"}
          />
        </div>
      </section>

      <section>
        <SectionTitle>Prioridades da diretoria</SectionTitle>
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <span className="rounded bg-destructive/10 text-destructive font-bold px-2 py-1">{critical} críticos</span>
          <span className="rounded bg-warning/10 text-warning font-bold px-2 py-1">{attention} em atenção</span>
          <button onClick={onOpenRiscos} className="text-primary font-semibold underline underline-offset-2">Ver todos os riscos e recomendações</button>
        </div>
        {recs.length ? (
          <div className="space-y-2">{recs.map((r) => <RecommendationCard key={r.id} rec={r} />)}</div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum alerta crítico ou de atenção no último mês fechado.</p>
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
