import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Area, Line, YAxis } from "recharts";
import { cn } from "@/lib/utils";

export interface MetricDetail {
  text: string;
  /** good = favorável, bad = desfavorável, neutral = informação sem direção (ex.: % do faturamento). */
  tone: "good" | "bad" | "neutral";
  /** Seta de direção; omitida em informações sem direção. */
  direction?: "up" | "down" | "flat";
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  /** Chips de variação, cada um identificando sua referência. */
  details?: MetricDetail[];
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive";
  className?: string;
  /** Série curta (ex.: 12 meses fechados) desenhada como mini-gráfico de tendência. */
  spark?: number[];
  /** Mesma série no período de comparação (ex.: ano anterior), em linha tracejada cinza. */
  sparkCompare?: (number | null)[];
  /** Valor do período de comparação, em cinza ao lado do valor principal. */
  previous?: { value: string; label: string };
  /** Sem borda e sombra: para compor uma grade de indicadores numa única superfície. */
  bare?: boolean;
  /** Estado vazio (ex.: sem metas): troca o valor por uma mensagem orientativa. */
  empty?: { message: string; hint: string };
}

// A cor aparece só no indicador de status (ponto e traço do mini-gráfico); o número fica em tinta.
const tone = {
  default: { dot: "bg-muted-foreground/40", stroke: "hsl(220 10% 55%)" },
  success: { dot: "bg-success", stroke: "hsl(142 65% 36%)" },
  warning: { dot: "bg-warning", stroke: "hsl(32 92% 45%)" },
  destructive: { dot: "bg-destructive", stroke: "hsl(0 72% 48%)" },
};
const chipTone = {
  good: "bg-success/10 text-success",
  bad: "bg-destructive/10 text-destructive",
  neutral: "bg-secondary text-muted-foreground",
};
const arrow = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

export function MetricCard({ title, value, subtitle, details, icon: Icon, variant = "default", className, spark, sparkCompare, previous, bare, empty }: MetricCardProps) {
  const t = tone[variant];
  const gid = `spark-${title.replace(/\W/g, "")}`;
  const frame = bare ? "" : "card-surface";

  if (empty) {
    return (
      <div className={cn("h-full flex flex-col gap-3 p-5", bare ? "bg-secondary/30" : "rounded-2xl border border-dashed border-border bg-secondary/40", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground/30" aria-hidden />
          <span className="text-sm font-medium flex-1">{title}</span>
          <Icon className="w-4 h-4" aria-hidden />
        </div>
        <p className="text-base font-semibold text-foreground leading-snug">{empty.message}</p>
        <p className="text-xs text-muted-foreground">{empty.hint}</p>
      </div>
    );
  }

  const data = spark?.map((v, i) => ({ i, v, p: sparkCompare?.[i] ?? null }));

  return (
    <div className={cn("h-full p-5 flex flex-col gap-2.5", frame, className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full shrink-0", t.dot)} aria-hidden />
        <span className="text-sm font-medium flex-1">{title}</span>
        <Icon className="w-4 h-4" aria-hidden />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-[2.35rem] leading-none font-semibold tracking-tight text-foreground">{value}</p>
        {previous && (
          <p className="text-right text-xs text-muted-foreground tabular-nums leading-tight" title={previous.label}>
            {previous.value}
            <span className="block text-[11px]">{previous.label}</span>
          </p>
        )}
      </div>
      {subtitle && <p className="text-xs font-medium text-muted-foreground">{subtitle}</p>}
      {details && details.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {details.map((d) => {
            const Arrow = d.direction ? arrow[d.direction] : null;
            return (
              <li key={d.text} className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", chipTone[d.tone])}>
                {Arrow && <Arrow className="w-3 h-3 shrink-0" aria-hidden />}
                {d.text}
              </li>
            );
          })}
        </ul>
      )}
      {data && data.length > 1 && (
        <div className="h-11 -mx-1 mt-auto pt-1" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.stroke} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={t.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              {sparkCompare && <Line type="monotone" dataKey="p" stroke="hsl(220 9% 70%)" strokeWidth={1.25} strokeDasharray="3 3" dot={false} connectNulls isAnimationActive={false} />}
              <Area type="monotone" dataKey="v" stroke={t.stroke} strokeWidth={1.75} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
