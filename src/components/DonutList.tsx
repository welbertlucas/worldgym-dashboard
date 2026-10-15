import { cn } from "@/lib/utils";

export interface DonutItem {
  label: string;
  /** Valor numérico que define a fatia. */
  value: number;
  color: string;
  /** Texto à direita na lista (valor formatado). */
  valueText: string;
}

const R = 38;
const C = 2 * Math.PI * R;

/** Participação de cada item no total (0–100). Itens com valor ≤ 0 têm participação 0. */
export function shares(items: { value: number }[]): number[] {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  return items.map((i) => (total > 0 ? (Math.max(0, i.value) / total) * 100 : 0));
}

interface DonutListProps {
  title: string;
  subtitle?: string;
  items: DonutItem[];
  /** Texto no centro da rosca (ex.: total). */
  center: { value: string; caption: string };
  /** Texto do estado vazio quando não há nada a mostrar. */
  empty?: string;
  className?: string;
}

/** Rosca com lista de valores ao lado (participação de partes num todo). */
export function DonutList({ title, subtitle, items, center, empty, className }: DonutListProps) {
  const pct = shares(items);
  const has = pct.some((p) => p > 0);
  let offset = 0;
  return (
    <section className={cn("card-surface p-5 sm:p-6", className)} aria-label={title}>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      {!has ? (
        <p className="mt-5 rounded-xl bg-secondary/40 px-4 py-8 text-center text-sm text-muted-foreground">{empty ?? "Sem dados para mostrar."}</p>
      ) : (
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="relative mx-auto sm:mx-0 shrink-0 w-40 h-40">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" role="img" aria-label={`${title}: ${items.map((i, k) => `${i.label} ${pct[k].toFixed(0)}%`).join(", ")}`}>
              <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(222 16% 94%)" strokeWidth="13" />
              {items.map((it, i) => {
                const len = (pct[i] / 100) * C;
                if (len <= 0) return null;
                const gap = Math.min(1.6, len * 0.3); // folga entre fatias
                const seg = <circle key={it.label} cx="50" cy="50" r={R} fill="none" stroke={it.color} strokeWidth="13" strokeDasharray={`${Math.max(len - gap, 0.5)} ${C}`} strokeDashoffset={-offset} />;
                offset += len;
                return seg;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display text-2xl font-semibold leading-none text-foreground tabular-nums">{center.value}</span>
              <span className="mt-1 text-[11px] text-muted-foreground">{center.caption}</span>
            </div>
          </div>
          <ul className="flex-1 min-w-0 divide-y divide-border">
            {items.map((it, i) => (
              <li key={it.label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: it.color }} aria-hidden />
                <span className="flex-1 min-w-0 truncate text-foreground">{it.label}</span>
                <span className="w-14 text-right text-muted-foreground tabular-nums">{pct[i].toFixed(pct[i] > 0 && pct[i] < 10 ? 1 : 0).replace(".", ",")}%</span>
                <span className="w-28 text-right font-semibold tabular-nums text-foreground">{it.valueText}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
