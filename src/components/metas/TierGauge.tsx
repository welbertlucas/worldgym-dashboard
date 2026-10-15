import { Check } from "lucide-react";
import {
  META_INDICATORS, TIER_LABEL, TIERS, bulletScale, formatMetaValue, progressToNext, tierReached,
  type BulletScale, type Meta, type MetaKey, type Tier, type TierResult,
} from "@/data/metas";
import { cn } from "@/lib/utils";

export const TIER_COLOR: Record<TierResult, string> = {
  ouro: "hsl(43 90% 48%)", prata: "hsl(220 9% 60%)", bronze: "hsl(25 60% 45%)", abaixo: "hsl(0 72% 51%)",
};

/** Percentual exibido: nunca mostra 100% enquanto o próximo nível não foi atingido (arredonda para baixo, máx. 99%). */
export function shownPct(pct: number, done: boolean): number {
  return done ? 100 : Math.min(99, Math.floor(pct + 1e-9));
}

/** Quanto falta/ou reduzir: em indicadores percentuais a diferença é em pontos percentuais, com casas para valores pequenos. */
export function formatGap(key: MetaKey, gap: number): string {
  if (META_INDICATORS[key].format !== "percent") return formatMetaValue(key, gap);
  return `${gap.toFixed(gap < 0.1 ? 2 : 1).replace(".", ",")} p.p.`;
}

/** Em mês em andamento, "abaixo do bronze" é um estado provisório, não um resultado. */
export function tierName(tier: TierResult, partial: boolean): string {
  return tier === "abaixo" && partial ? "Ainda abaixo do bronze" : TIER_LABEL[tier];
}

export function TierBadge({ tier, partial = false }: { tier: TierResult; partial?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
      <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLOR[tier] }} aria-hidden />
      {tierName(tier, partial)}
    </span>
  );
}

/** Anel de progresso rumo ao próximo nível (0–100%). */
export function ProgressRing({ pct, color, size = 92, label }: { pct: number; color: string; size?: number; label?: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 88 88" width={size} height={size} role="img" aria-label={`${label ?? Math.round(shown)}% da meta`}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="hsl(222 16% 92%)" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * c} ${c}`} transform="rotate(-90 44 44)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-semibold tabular-nums text-foreground">
        {label ?? Math.round(shown)}%
      </span>
    </div>
  );
}

/** Barra de faixas: zonas Bronze/Prata/Ouro ao fundo e barra fina escura com o realizado. */
export function TierBullet({ scale, thin = false }: { scale: BulletScale; thin?: boolean }) {
  const h = thin ? 10 : 16;
  return (
    <div className="relative w-full" style={{ height: h }} aria-hidden>
      <div className="absolute inset-0 overflow-hidden rounded-full bg-secondary">
        {scale.zones.map((z, i) => (
          <div
            key={i}
            className="absolute inset-y-0"
            style={{
              left: `${(z.from / scale.max) * 100}%`,
              width: `${((z.to - z.from) / scale.max) * 100}%`,
              background: TIER_COLOR[z.tier],
              opacity: z.tier === "abaixo" ? 0.14 : 0.38,
            }}
          />
        ))}
      </div>
      {scale.markers.map((m) => <div key={m.tier} className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: `${m.pos}%` }} />)}
      <div className="absolute left-0 rounded-full bg-foreground" style={{ top: "50%", height: thin ? 4 : 6, marginTop: thin ? -2 : -3, width: `${Math.max(scale.actualPos, 1)}%` }} />
    </div>
  );
}

/** Níveis cadastrados com o valor de cada um e a marca dos já atingidos. */
export function TierChips({ metaKey, actual, meta }: { metaKey: MetaKey; actual: number; meta: Meta }) {
  const reached = tierReached(metaKey, actual, meta);
  const ok = (t: Tier) => reached !== "abaixo" && TIERS.indexOf(reached) >= TIERS.indexOf(t);
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {TIERS.filter((t) => meta[t] !== undefined).map((t) => (
        <li key={t} className={cn("flex items-center gap-1.5 text-xs", ok(t) ? "text-foreground font-semibold" : "text-muted-foreground")}>
          <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLOR[t] }} aria-hidden />
          {TIER_LABEL[t]} <span className="tabular-nums">{formatMetaValue(metaKey, meta[t]!)}</span>
          {ok(t) && <><Check className="w-3.5 h-3.5 text-success" aria-hidden /><span className="sr-only">atingido</span></>}
        </li>
      ))}
    </ul>
  );
}

interface MetaCardProps { metaKey: MetaKey; actual: number; meta: Meta; partial: boolean }

/** Cartão de uma meta: anel, valor realizado, próximo nível, barra de faixas e níveis. */
export function MetaCard({ metaKey, actual, meta, partial }: MetaCardProps) {
  const reached = tierReached(metaKey, actual, meta);
  const { pct, next } = progressToNext(metaKey, actual, meta);
  const scale = bulletScale(metaKey, actual, meta);
  const ringColor = TIER_COLOR[next ? next.tier : "ouro"];
  return (
    <article className="card-surface p-5 flex flex-col gap-4" aria-label={`Meta de ${META_INDICATORS[metaKey].label}`}>
      <header className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground">{META_INDICATORS[metaKey].label}</h4>
        <TierBadge tier={reached} partial={partial} />
      </header>
      <div className="flex items-center gap-4">
        <ProgressRing pct={pct} color={ringColor} label={shownPct(pct, !next)} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{partial ? "Realizado até agora" : "Realizado"}</p>
          <p className="font-display text-[1.75rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">{formatMetaValue(metaKey, actual)}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {next
              ? <>{shownPct(pct, false)}% da meta {TIER_LABEL[next.tier]} • {META_INDICATORS[metaKey].lowerIsBetter ? "reduzir " : "faltam "}<b className="text-foreground tabular-nums">{formatGap(metaKey, next.gap)}</b></>
              : "Todos os níveis atingidos"}
          </p>
        </div>
      </div>
      {scale && <TierBullet scale={scale} />}
      <TierChips metaKey={metaKey} actual={actual} meta={meta} />
    </article>
  );
}

