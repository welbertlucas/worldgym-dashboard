import { Check } from "lucide-react";
import { META_INDICATORS, TIER_LABEL, TIERS, formatMetaValue, progressToNext, tierReached, type Meta, type MetaKey, type Tier } from "@/data/metas";
import { TIER_COLOR, formatGap, shownPct, tierName } from "@/components/metas/TierGauge";
import { cn } from "@/lib/utils";

const R = 42;
const C = 2 * Math.PI * R;

interface Props { metaKey: MetaKey; actual: number; meta: Meta; partial: boolean; title: string; subtitle: string }

/** Rosca de atingimento: centro = realizado; o arco mostra quanto já foi alcançado do próximo nível. */
export function GoalRing({ metaKey, actual, meta, partial, title, subtitle }: Props) {
  const reached = tierReached(metaKey, actual, meta);
  const { pct, next } = progressToNext(metaKey, actual, meta);
  const lower = META_INDICATORS[metaKey].lowerIsBetter;
  const shown = shownPct(pct, next === null);
  const ok = (t: Tier) => reached !== "abaixo" && TIERS.indexOf(reached) >= TIERS.indexOf(t);
  const color = TIER_COLOR[reached];
  return (
    <section className="card-surface p-5 sm:p-6" aria-label={title}>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="relative mx-auto sm:mx-0 shrink-0 w-48 h-48">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" role="img"
            aria-label={`${META_INDICATORS[metaKey].label}: ${formatMetaValue(metaKey, actual)}, ${shown}% ${next ? `da meta ${TIER_LABEL[next.tier]}` : "— todos os níveis atingidos"}`}>
            <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(222 16% 94%)" strokeWidth="11" />
            {shown > 0 && <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(shown / 100) * C} ${C}`} />}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <span className="text-[11px] text-muted-foreground">{partial ? "Realizado até agora" : "Realizado"}</span>
            <span className="font-display text-[1.7rem] font-semibold leading-tight text-foreground tabular-nums">{formatMetaValue(metaKey, actual)}</span>
            <span className="mt-0.5 text-xs font-semibold tabular-nums" style={{ color: reached === "abaixo" ? undefined : color }}>
              {next ? `${shown}% da meta ${TIER_LABEL[next.tier]}` : "Todos os níveis atingidos"}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">
            <span className="inline-flex items-center gap-1.5 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />{tierName(reached, partial)}</span>
            {next && <span className="text-muted-foreground"> • {lower ? "reduzir " : "faltam "}<b className="text-foreground tabular-nums">{formatGap(metaKey, next.gap)}</b> para o {TIER_LABEL[next.tier]}</span>}
          </p>
          <ul className="mt-3 divide-y divide-border">
            {TIERS.filter((t) => meta[t] !== undefined).map((t) => (
              <li key={t} className={cn("flex items-center gap-3 py-2 text-sm", ok(t) ? "text-foreground font-semibold" : "text-muted-foreground")}>
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: TIER_COLOR[t] }} aria-hidden />
                <span className="flex-1">{TIER_LABEL[t]}</span>
                <span className="tabular-nums">{formatMetaValue(metaKey, meta[t]!)}</span>
                {ok(t) ? <><Check className="w-4 h-4 text-success" aria-hidden /><span className="sr-only">atingido</span></> : <span className="w-4" aria-hidden />}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
