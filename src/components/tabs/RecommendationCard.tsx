import { type Recommendation, ALERT_LABELS } from "@/data/recommendations";
import { Badge } from "@/components/ui/badge";

const sevLabel = { critical: "Crítico", attention: "Atenção", info: "Informativo" } as const;
const sevVariant = { critical: "destructive", attention: "warning", info: "secondary" } as const;

export function RecommendationCard({ rec, defaultOpen = false }: { rec: Recommendation; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="card-surface group">
      <summary className="cursor-pointer list-none p-3 sm:p-4 flex flex-wrap items-center gap-2">
        <Badge variant={sevVariant[rec.severity]}>{sevLabel[rec.severity]}</Badge>
        <span className="font-bold text-sm">{rec.unit}</span>
        <span className="text-xs font-medium text-muted-foreground">{ALERT_LABELS[rec.kind]}</span>
        <span className="text-sm text-foreground w-full sm:w-auto sm:flex-1 sm:text-right">{rec.fact}</span>
      </summary>
      <div className="px-3 sm:px-4 pb-4 pt-1 grid gap-3 text-sm border-t border-border/40">
        <div>
          <Badge variant="outline" className="mb-1">Fato (dos dados)</Badge>
          <p>{rec.fact} <span className="text-muted-foreground text-xs">Regra: {rec.rule}.</span></p>
        </div>
        {rec.yoy && (
          <div>
            <Badge variant="outline" className="mb-1">Comparativo com o ano anterior</Badge>
            <p>{rec.yoy.fact}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rec.yoy.reading === "confirmed" && "Leitura (hipótese): a piora aparece nos dois comparativos, o que sugere problema persistente e não só sazonal."}
              {rec.yoy.reading === "seasonal" && "Leitura (hipótese): o resultado está igual ou melhor que no mesmo mês do ano anterior, o que sugere oscilação sazonal. Severidade reduzida."}
              {rec.yoy.reading === "context" && "Contexto: o comparativo anual não confirma nem descarta a oscilação."}
            </p>
          </div>
        )}
        <div>
          <Badge variant="secondary" className="mb-1">Hipóteses — a verificar, não confirmadas</Badge>
          <ul className="list-disc pl-5 space-y-0.5">{rec.hypotheses.map((h) => <li key={h}>{h}</li>)}</ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Como investigar</p>
          <ul className="list-disc pl-5 space-y-0.5">{rec.investigate.map((h) => <li key={h}>{h}</li>)}</ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Ação sugerida</p>
          <ul className="list-disc pl-5 space-y-0.5">{rec.correct.map((h) => <li key={h}>{h}</li>)}</ul>
        </div>
        <p className="text-xs text-muted-foreground"><b>Acompanhar:</b> {rec.followUp}</p>
      </div>
    </details>
  );
}
