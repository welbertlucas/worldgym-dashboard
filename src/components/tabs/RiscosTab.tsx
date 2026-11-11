import { useState } from "react";
import { type Alert, type Severity } from "@/data/alerts";
import { buildRecommendations, ALERT_LABELS } from "@/data/recommendations";
import { RecommendationCard } from "@/components/tabs/RecommendationCard";
import { UnitLink } from "@/components/UnitLink";
import { agruparPorUnidade } from "@/data/riscosGrupos";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { Chip, Segmentos } from "@/components/DateFilter";
import { formatMonthLong } from "@/data/periods";
import { dashboardData } from "@/data/dashboardData";
import { KpiGaugeCard } from "@/components/executiva/KpiGaugeCard";

const SEVERIDADES = [["all", "Todas"], ["critical", "Crítico"], ["attention", "Atenção"], ["info", "Informativo"]] as const;

/**
 * `unit`: a unidade do filtro do topo (o mesmo de todas as telas). Com uma unidade escolhida,
 * os contadores e a lista ficam só com os alertas dela (os da rede saem).
 */
export function RiscosTab({ alerts: todos, evalMonth, unit = null }: { alerts: Alert[]; evalMonth: string | null; unit?: string | null }) {
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [modo, setModo] = useState<"unidade" | "lista">("unidade");
  const alerts = unit ? todos.filter((a) => a.unit === unit) : todos;
  const recs = buildRecommendations(alerts, dashboardData);
  const shown = recs.filter((r) => sev === "all" || r.severity === sev);
  const count = (s: Severity) => alerts.filter((a) => a.severity === s).length;

  return (
    <div className="space-y-4">
      <SectionTitle>Alertas</SectionTitle>
      <p className="text-sm text-muted-foreground">
        {evalMonth ? <>Avaliação do último mês fechado: <b>{formatMonthLong(evalMonth)}</b>, comparado ao mês anterior. O mês em andamento não entra nos alertas.</> : "Ainda não há mês fechado para avaliar."}{" "}
        Cada item separa o <b>fato</b> (calculado dos dados do EVO e da planilha) das <b>hipóteses</b> (causas a verificar — o dashboard não conhece as causas).
      </p>
      <div className="card-surface overflow-hidden" role="group" aria-label="Alertas por severidade">
        <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-3">
          {([
            ["critical", "Críticos", "bad"],
            ["attention", "Atenção", "warn"],
            ["info", "Informativos", "neutral"],
          ] as const).map(([sv, label, tone]) => {
            const n = count(sv);
            const share = alerts.length ? n / alerts.length : 0;
            return (
              <KpiGaugeCard key={sv} title={label} value={String(n)} fill={share} marker={null} tone={tone}
                details={[{ text: `${Math.round(share * 100)}% de ${alerts.length} ${alerts.length === 1 ? "item" : "itens"}`, tone: "neutral" }]} />
            );
          })}
        </div>
      </div>
      <div role="group" aria-label="Filtros de alertas" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
        <div className="min-w-0 lg:w-60">
          <Chip
            id="filtro-severidade"
            rotulo="Severidade"
            valor={SEVERIDADES.find(([v]) => v === sev)?.[1] ?? "Todas"}
            icone={<SlidersHorizontal className="h-4 w-4" />}
            ativo={sev !== "all"}
            value={sev}
            onChange={(v) => setSev(v as "all" | Severity)}
            aoLimpar={sev !== "all" ? () => setSev("all") : undefined}
            rotuloLimpar="Mostrar todas as severidades"
          >
            {SEVERIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Chip>
        </div>
        <Segmentos rotulo="Forma de exibir" opcoes={[["unidade", "Por unidade"], ["lista", "Lista completa"]] as const} valor={modo} onChange={setModo} />
        <p className="text-sm text-muted-foreground sm:ml-auto" aria-live="polite">{shown.length} de {recs.length} itens</p>
      </div>
      {shown.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted-foreground">
          {unit && !alerts.length ? <><b className="text-foreground">{unit}</b> não tem alertas{evalMonth ? ` em ${formatMonthLong(evalMonth)}` : ""}.</> : "Nenhum alerta com os filtros atuais."}
        </p>
      ) : (
        modo === "lista" ? (
          <div className="space-y-2">{shown.map((r, i) => <RecommendationCard key={r.id} rec={r} evalMonth={evalMonth} defaultOpen={i === 0 && r.severity === "critical"} />)}</div>
        ) : (
          <div className="space-y-3">
            {agruparPorUnidade(shown).map((g, i) => (
              <details key={g.unit} open={i === 0 && g.criticos > 0} className="group card-surface">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl p-4 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <h3 className="text-sm font-semibold text-foreground"><UnitLink name={g.unit} /></h3>
                  <ul className="flex flex-wrap gap-1.5 text-xs font-medium">
                    {g.criticos > 0 && <li className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">{g.criticos} {g.criticos === 1 ? "crítico" : "críticos"}</li>}
                    {g.atencao > 0 && <li className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">{g.atencao} em atenção</li>}
                    {g.informativos > 0 && <li className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">{g.informativos} {g.informativos === 1 ? "informativo" : "informativos"}</li>}
                  </ul>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="space-y-2 border-t border-border p-3 sm:p-4">
                  {g.itens.map((r) => <RecommendationCard key={r.id} rec={r} evalMonth={evalMonth} />)}
                </div>
              </details>
            ))}
          </div>
        )
      )}
      <details className="card-surface p-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Como os alertas são calculados</summary>
        <ul className="list-disc pl-5 mt-2 space-y-0.5">
          <li>{ALERT_LABELS.faturamento}: queda ≥ 7% (crítico ≥ 12%) vs. mês anterior, ou queda atípica para a própria unidade.</li>
          <li>{ALERT_LABELS.vendasOnline}: queda ≥ 30% vs. média dos 3 meses anteriores (base ≥ R$ 500).</li>
          <li>{ALERT_LABELS.churn} / {ALERT_LABELS.inadimplencia}: alta ≥ 1,5 p.p. ou nível acima de 8% (atenção); crítico quando acima de 8% e em alta.</li>
          <li>{ALERT_LABELS.recebimento}: recebimento abaixo de 90% do faturamento.</li>
          <li>{ALERT_LABELS.meta}: realizado abaixo do nível mais baixo cadastrado (em geral o bronze); crítico se tiver menos de 75% dele. Só quando há metas cadastradas.</li>
          <li>Comparativo anual: faturamento ≤ −10% (crítico ≤ −20%), churn e inadimplência +2 p.p., renovação −8 p.p. vs. o mesmo mês do ano anterior. Quando já há alerta vs. o mês anterior, os dois são combinados: piora nos dois = severidade maior; igual ou melhor que o ano anterior = severidade menor (provável sazonalidade).</li>
          <li>Novos contratos e vendas online: alerta da rede se cair 20% ou mais vs. o ano anterior (unidades comparáveis); unidade só alerta se cair 20% ou mais e for 20 p.p. pior que a rede.</li>
          <li>Unidades com menos de 3 meses de histórico não entram nos alertas de variação.</li>
        </ul>
      </details>
    </div>
  );
}
