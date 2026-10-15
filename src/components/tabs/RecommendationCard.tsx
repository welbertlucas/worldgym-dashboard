import { ChevronDown } from "lucide-react";
import { type Recommendation, type Support, ALERT_LABELS } from "@/data/recommendations";
import { Badge } from "@/components/ui/badge";
import { ShareButtons } from "@/components/tabs/ShareButtons";

const sevLabel = { critical: "Crítico", attention: "Atenção", info: "Informativo" } as const;
const sevVariant = { critical: "destructive", attention: "warning", info: "secondary" } as const;
// Faixa lateral na cor da severidade (mesma semântica dos indicadores: vermelho, âmbar, neutro).
const sevAccent = { critical: "border-l-destructive", attention: "border-l-warning", info: "border-l-border" } as const;

function Block({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">{title}</h4>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

const supportTag: Record<Support, string | null> = { indicio: "indício nos dados", "sem-indicio": "sem sinal nos dados", neutro: null };

function Hypotheses({ items }: { items: Recommendation["hypotheses"] }) {
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((h) => (
        <li key={h.text}>
          {h.text}
          {supportTag[h.support] && (
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${h.support === "indicio" ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"}`}>
              {supportTag[h.support]}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function List({ items }: { items: string[] }) {
  return <ul className="list-disc pl-5 space-y-1">{items.map((h) => <li key={h}>{h}</li>)}</ul>;
}

export function RecommendationCard({ rec, defaultOpen = false, flat = false, evalMonth }: { rec: Recommendation; defaultOpen?: boolean; flat?: boolean; evalMonth?: string | null }) {
  return (
    <div className="relative">
    <details open={defaultOpen} className={flat ? "group" : `group card-surface border-l-[3px] ${sevAccent[rec.severity]} open:shadow-md`}>
      <summary
        className={`list-none [&::-webkit-details-marker]:hidden cursor-pointer p-3 sm:p-4 pr-[4rem] sm:pr-[4.5rem] flex items-start gap-3 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${flat ? "pl-5 sm:pl-6" : "rounded-2xl group-open:rounded-b-none"}`}
      >
        <Badge variant={sevVariant[rec.severity]} className="mt-0.5 shrink-0">{sevLabel[rec.severity]}</Badge>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-sm">{rec.unit}</span>
            <span className="text-xs font-medium text-muted-foreground">{ALERT_LABELS[rec.kind]}</span>
          </p>
          <p className="text-sm text-foreground mt-0.5">{rec.fact}</p>
        </div>
        <ChevronDown className="w-4 h-4 mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>

      <div className={`border-t border-border grid gap-4 md:grid-cols-2 ${flat ? "p-5 sm:p-6 bg-secondary/30" : "p-3 sm:p-4"}`}>
        <Block title={<Badge variant="outline">Fato (dos dados)</Badge>} className="md:col-span-2">
          <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
            {rec.fact} <span className="text-muted-foreground text-xs">Regra: {rec.rule}.</span>
          </div>
        </Block>

        {rec.yoy && (
          <Block title={<Badge variant="outline">Comparativo com o ano anterior</Badge>} className="md:col-span-2">
            <p>{rec.yoy.fact}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {rec.yoy.reading === "confirmed" && "Leitura (hipótese): a piora aparece nos dois comparativos, o que sugere problema persistente e não só sazonal."}
              {rec.yoy.reading === "seasonal" && "Leitura (hipótese): o resultado está igual ou melhor que no mesmo mês do ano anterior, o que sugere oscilação sazonal. Severidade reduzida."}
              {rec.yoy.reading === "context" && "Contexto: o comparativo anual não confirma nem descarta a oscilação."}
            </p>
          </Block>
        )}

        {(rec.evidence.signals.length > 0 || rec.evidence.context.length > 0 || rec.evidence.quiet.length > 0) && (
          <Block title={<Badge variant="outline">O que os dados indicam (da planilha)</Badge>} className="md:col-span-2">
            {rec.evidence.signals.length > 0 && <List items={rec.evidence.signals} />}
            {rec.evidence.context.length > 0 && <List items={rec.evidence.context} />}
            {rec.evidence.quiet.length > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">Sem sinal relevante em: {rec.evidence.quiet.join(", ").toLowerCase()}.</p>
            )}
          </Block>
        )}

        <Block title={<Badge variant="secondary">Hipóteses — a verificar, não confirmadas</Badge>} className="md:col-span-2">
          <div className="rounded-xl border border-dashed border-border px-3 py-2.5"><Hypotheses items={rec.hypotheses} /></div>
        </Block>

        <Block title="Como investigar"><List items={rec.investigate} /></Block>
        <Block title="Ação sugerida"><List items={rec.correct} /></Block>

        <p className="md:col-span-2 text-xs text-muted-foreground border-t border-border pt-3"><b>Acompanhar:</b> {rec.followUp}</p>
      </div>
    </details>
    <ShareButtons rec={rec} evalMonth={evalMonth} className={`absolute right-3 sm:right-4 top-2.5 sm:top-3 ${flat ? "right-4 sm:right-6" : ""}`} />
    </div>
  );
}
