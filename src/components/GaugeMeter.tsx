import { cn } from "@/lib/utils";

export interface GaugeZone { from: number; to: number; color: string; opacity?: number }
export interface GaugeTick { value: number; text: string }

const CX = 100, CY = 100, R = 80, T = 16;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Ponto no arco: 0° = extremo esquerdo, 90° = topo, 180° = extremo direito. */
const point = (deg: number, r: number) => ({ x: CX - r * Math.cos(rad(deg)), y: CY - r * Math.sin(rad(deg)) });

/** Ângulo (0–180°) de um valor na escala [min, max], limitado às pontas. */
export function gaugeAngle(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return 180 * Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function arcPath(a0: number, a1: number, r: number): string {
  const p0 = point(a0, r), p1 = point(a1, r);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

interface GaugeProps {
  zones: GaugeZone[];
  min?: number;
  max: number;
  value: number;
  /** Rótulos nas pontas e nos limites das faixas. */
  ticks?: GaugeTick[];
  label: string;
  className?: string;
}

/** Velocímetro: faixas coloridas num semicírculo e ponteiro no valor atual. Fundo transparente (funciona sobre branco). */
export function GaugeMeter({ zones, min = 0, max, value, ticks, label, className }: GaugeProps) {
  const angle = gaugeAngle(value, min, max);
  const tip = point(angle, R - T / 2 - 3);
  return (
    <svg viewBox="-22 0 244 118" className={cn("w-full h-auto", className)} role="img" aria-label={label}>
      {zones.map((z, i) => {
        const a0 = gaugeAngle(z.from, min, max);
        const a1 = gaugeAngle(z.to, min, max);
        if (a1 - a0 <= 0.2) return null;
        // pequena folga entre faixas, sem comer as pontas do semicírculo
        const g = 0.7;
        const s = i === 0 ? a0 : a0 + g, e = i === zones.length - 1 ? a1 : a1 - g;
        return <path key={i} d={arcPath(s, Math.max(s, e), R)} fill="none" stroke={z.color} strokeOpacity={z.opacity ?? 1} strokeWidth={T} />;
      })}
      {ticks?.map((tk) => {
        const a = gaugeAngle(tk.value, min, max);
        const p = point(a, R + T / 2 + 9);
        const anchor = a < 25 ? "end" : a > 155 ? "start" : "middle";
        return (
          <text key={`${tk.value}-${tk.text}`} x={p.x} y={p.y + 3} textAnchor={anchor} fontSize="9.5" fill="hsl(220 9% 40%)" className="tabular-nums">
            {tk.text}
          </text>
        );
      })}
      <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke="hsl(222 25% 14%)" strokeWidth="3" strokeLinecap="round" />
      <circle cx={CX} cy={CY} r="7" fill="hsl(222 25% 14%)" />
      <circle cx={CX} cy={CY} r="2.5" fill="#fff" />
    </svg>
  );
}
