import { useState } from "react";
import { type Alert, type Severity } from "@/data/alerts";
import { buildRecommendations, ALERT_LABELS } from "@/data/recommendations";
import { RecommendationCard } from "@/components/tabs/RecommendationCard";
import { SectionTitle } from "@/components/SectionTitle";
import { Select } from "@/components/ui/select";
import { formatMonthLong } from "@/data/periods";
import { KpiGaugeCard } from "@/components/executiva/KpiGaugeCard";

export function RiscosTab({ alerts, evalMonth }: { alerts: Alert[]; evalMonth: string | null }) {
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [unit, setUnit] = useState("");
  const recs = buildRecommendations(alerts);
  const units = Array.from(new Set(recs.map((r) => r.unit))).sort();
  const shown = recs.filter((r) => (sev === "all" || r.severity === sev) && (!unit || r.unit === unit));
  const count = (s: Severity) => alerts.filter((a) => a.severity === s).length;

  return (
    <div className="space-y-4">
      <SectionTitle>Riscos e Recomendações</SectionTitle>
      <p className="text-sm text-muted-foreground">
        {evalMonth ? <>Avaliação do último mês fechado: <b>{formatMonthLong(evalMonth)}</b>, comparado ao mês anterior. O mês em andamento não entra nos alertas.</> : "Ainda não há mês fechado para avaliar."}{" "}
        Cada item separa o <b>fato</b> (calculado da planilha) das <b>hipóteses</b> (causas a verificar — o dashboard não conhece as causas).
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
      <div role="group" aria-label="Filtros de alertas" className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl border border-border bg-secondary/50 p-3 sm:p-4">
        <div className="flex flex-col gap-1 flex-1 min-w-[11rem] sm:flex-none">
          <label htmlFor="filtro-severidade" className="text-xs font-medium text-muted-foreground">Severidade</label>
          <Select id="filtro-severidade" value={sev} onChange={(e) => setSev(e.target.value as "all" | Severity)} className="sm:w-52">
            <option value="all">Todas as severidades</option>
            <option value="critical">Crítico</option>
            <option value="attention">Atenção</option>
            <option value="info">Informativo</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[11rem] sm:flex-none">
          <label htmlFor="filtro-unidade-risco" className="text-xs font-medium text-muted-foreground">Unidade</label>
          <Select id="filtro-unidade-risco" value={unit} onChange={(e) => setUnit(e.target.value)} className="sm:w-52">
            <option value="">Todas as unidades</option>
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </div>
        <p className="text-sm text-muted-foreground sm:ml-auto" aria-live="polite">{shown.length} de {recs.length} itens</p>
      </div>
      {shown.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted-foreground">Nenhum alerta com os filtros atuais.</p>
      ) : (
        <div className="space-y-2">{shown.map((r, i) => <RecommendationCard key={r.id} rec={r} evalMonth={evalMonth} defaultOpen={i === 0 && r.severity === "critical"} />)}</div>
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
