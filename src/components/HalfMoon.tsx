import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const CX = 100, CY = 100, R = 80, T = 15;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Ponto no arco: 0° = extremo esquerdo, 90° = topo, 180° = extremo direito. */
const point = (deg: number, r: number) => ({ x: CX - r * Math.cos(rad(deg)), y: CY - r * Math.sin(rad(deg)) });

/** Ângulo (0–180°) de uma fração 0–1 do arco, limitado às pontas. */
export function arcAngle(fraction: number): number {
  return 180 * Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
}

export function arcPath(a0: number, a1: number, r: number): string {
  const p0 = point(a0, r), p1 = point(a1, r);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

interface HalfMoonProps {
  /** Quanto do arco está preenchido (0–1). */
  fill: number;
  color: string;
  /** Marca de referência no arco (0–1), ex.: o mês anterior. */
  marker?: number | null;
  label: string;
  /** Conteúdo dentro do arco (o número). */
  children?: ReactNode;
  className?: string;
}

/** Meia-lua de progresso: trilho cinza, arco colorido com pontas arredondadas, marca de referência e o número dentro. Fundo transparente. */
export function HalfMoon({ fill, color, marker, label, children, className }: HalfMoonProps) {
  const a = arcAngle(fill);
  const m = marker === null || marker === undefined ? null : arcAngle(marker);
  const m0 = m === null ? null : point(m, R - T / 2 - 3);
  const m1 = m === null ? null : point(m, R + T / 2 + 3);
  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox="0 0 200 108" className="w-full h-auto" role="img" aria-label={label}>
        <path d={arcPath(0, 180, R)} fill="none" stroke="hsl(222 16% 94%)" strokeWidth={T} strokeLinecap="round" />
        {a > 0.5 && <path d={arcPath(0, a, R)} fill="none" stroke={color} strokeWidth={T} strokeLinecap="round" />}
        {m0 && m1 && <line x1={m0.x} y1={m0.y} x2={m1.x} y2={m1.y} stroke="hsl(222 25% 14%)" strokeWidth="2.2" strokeLinecap="round" />}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end text-center pb-0.5">{children}</div>
    </div>
  );
}
