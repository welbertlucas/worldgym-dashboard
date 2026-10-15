import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
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
  /** Linhas de variação, cada uma identificando sua referência. */
  details?: MetricDetail[];
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive";
  className?: string;
  /** Série curta (ex.: 12 meses fechados) desenhada como mini-gráfico de tendência. */
  spark?: number[];
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
const detailTone = { good: "text-success", bad: "text-destructive", neutral: "text-muted-foreground" };
const arrow = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

export function MetricCard({ title, value, subtitle, details, icon: Icon, variant = "default", className, spark, empty }: MetricCardProps) {
  const t = tone[variant];
  const gid = `spark-${title.replace(/\W/g, "")}`;

  if (empty) {
    return (
      <div className={cn("h-full rounded-2xl border border-dashed border-border bg-secondary/40 p-5 flex flex-col gap-3", className)}>
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

  return (
    <div className={cn("card-surface h-full p-5 flex flex-col gap-3 transition-shadow hover:shadow-md motion-reduce:transition-none", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full shrink-0", t.dot)} aria-hidden />
        <span className="text-sm font-medium flex-1">{title}</span>
        <Icon className="w-4 h-4" aria-hidden />
      </div>
      <p className="font-display text-[2.5rem] leading-none font-semibold tracking-tight text-foreground">{value}</p>
      {subtitle && <p className="text-xs font-medium text-muted-foreground -mt-1">{subtitle}</p>}
      {details && details.length > 0 && (
        <ul className="-mt-1 space-y-0.5">
          {details.map((d) => {
            const Arrow = d.direction ? arrow[d.direction] : null;
            return (
              <li key={d.text} className={cn("flex items-start gap-1 text-xs font-medium", detailTone[d.tone])}>
                {Arrow && <Arrow className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden />}
                <span>{d.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {spark && spark.length > 1 && (
        <div className="h-10 -mx-1 mt-auto" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.stroke} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={t.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area type="monotone" dataKey="v" stroke={t.stroke} strokeWidth={1.75} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
