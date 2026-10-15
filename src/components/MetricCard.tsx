import { type LucideIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive";
  className?: string;
  /** Série curta (ex.: 12 meses fechados) desenhada como mini-gráfico de tendência. */
  spark?: number[];
}

// A cor aparece só no indicador de status (ponto e traço do mini-gráfico); o número fica em tinta.
const tone = {
  default: { dot: "bg-muted-foreground/40", stroke: "hsl(220 10% 55%)" },
  success: { dot: "bg-success", stroke: "hsl(142 65% 36%)" },
  warning: { dot: "bg-warning", stroke: "hsl(32 92% 45%)" },
  destructive: { dot: "bg-destructive", stroke: "hsl(0 72% 48%)" },
};

export function MetricCard({ title, value, subtitle, icon: Icon, variant = "default", className, spark }: MetricCardProps) {
  const t = tone[variant];
  const gid = `spark-${title.replace(/\W/g, "")}`;
  return (
    <div className={cn("card-surface p-5 flex flex-col gap-3 transition-shadow hover:shadow-md", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full shrink-0", t.dot)} aria-hidden />
        <span className="text-sm font-medium flex-1">{title}</span>
        <Icon className="w-4 h-4" aria-hidden />
      </div>
      <p className="font-display text-[2.5rem] leading-none font-semibold tracking-tight text-foreground">{value}</p>
      {subtitle && <p className="text-xs font-medium text-muted-foreground -mt-1">{subtitle}</p>}
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
