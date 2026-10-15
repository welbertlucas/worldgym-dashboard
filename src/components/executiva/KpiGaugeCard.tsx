import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { HalfMoon } from "@/components/HalfMoon";
import { type MetricDetail } from "@/components/MetricCard";
import { type KpiTone } from "@/data/kpiGauge";
import { cn } from "@/lib/utils";

// Mesmas cores semânticas do restante do dashboard.
const TONE_COLOR: Record<KpiTone, string> = {
  good: "hsl(142 55% 40%)", warn: "hsl(38 92% 50%)", bad: "hsl(0 72% 51%)", neutral: "hsl(222 16% 45%)",
};
const chipTone = { good: "bg-success/10 text-success", bad: "bg-destructive/10 text-destructive", neutral: "bg-secondary text-muted-foreground" };
const arrow = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };
/** Linhas finas entre os cartões da grade (a borda externa é cortada pelo contêiner). */
export const TILE_FRAME = "bg-white shadow-[inset_-1px_-1px_0_0_hsl(var(--border))]";

interface Props {
  title: string;
  value: string;
  fill: number;
  marker: number | null;
  tone: KpiTone;
  /** Variações e referências (mês anterior, ano anterior). */
  details: MetricDetail[];
  /** Mês em andamento: o valor é parcial. */
  partial?: boolean;
  /** Conteúdo extra abaixo dos chips (ex.: link). */
  footer?: ReactNode;
}

/** Indicador em meia-lua: número dentro do arco, comparado ao mês anterior (marca no arco + chips). */
export function KpiGaugeCard({ title, value, fill, marker, tone, details, partial, footer }: Props) {
  return (
    <div className={cn("p-5 flex flex-col items-center gap-3 text-center", TILE_FRAME)}>
      <div className="flex w-full items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        {partial && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">Em andamento</span>}
      </div>
      <HalfMoon fill={fill} marker={marker} color={TONE_COLOR[tone]} label={`${title}: ${value}${partial ? " (parcial, mês em andamento)" : ""}`} className="max-w-[13rem]">
        <span className="font-display text-[2rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">{value}</span>
      </HalfMoon>
      {details.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-1.5">
          {details.map((d) => {
            const Arrow = d.direction ? arrow[d.direction] : null;
            return (
              <li key={d.text} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", chipTone[d.tone])}>
                {Arrow && <Arrow className="h-3 w-3" aria-hidden />}
                {d.text}
              </li>
            );
          })}
        </ul>
      )}
      {footer}
    </div>
  );
}
