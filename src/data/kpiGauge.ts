import { gaugeMax, type Indicator } from "@/data/unitIndicators";

export type KpiTone = "good" | "warn" | "bad" | "neutral";
export interface GaugeModel {
  /** Preenchimento do arco (0–1). */
  fill: number;
  /** Posição do mês anterior no arco (0–1); null se não há mês anterior. */
  marker: number | null;
  tone: KpiTone;
}

/** Em valores absolutos o 100% do arco é 125% do mês anterior: a marca do mês anterior fica em 80% do arco. */
const ABS_SCALE = 1.25;

/**
 * Valor absoluto (faturamento etc.): arco = realizado ÷ mês anterior. Mês em andamento é parcial,
 * então não tem cor de bom/ruim — só mostra quanto do mês anterior já foi alcançado.
 */
export function absoluteGauge(cur: number, prev: number | undefined, partial: boolean): GaugeModel {
  if (!prev || prev <= 0) return { fill: 0, marker: null, tone: "neutral" };
  const fill = Math.max(0, Math.min(1, cur / (prev * ABS_SCALE)));
  const tone: KpiTone = partial ? "neutral" : cur >= prev ? "good" : cur >= prev * 0.95 ? "warn" : "bad";
  return { fill, marker: 1 / ABS_SCALE, tone };
}

/** Taxa (churn, inadimplência, renovação, conversão): arco = valor na escala do indicador; cor = faixa de leitura já existente. */
export function rateGauge(ind: Indicator, cur: number, prev: number | undefined): GaugeModel {
  const max = gaugeMax(ind, Math.max(cur, prev ?? 0));
  const fill = Math.max(0, Math.min(1, cur / max));
  const marker = prev && prev > 0 ? Math.max(0, Math.min(1, prev / max)) : null;
  return { fill, marker, tone: ind.tone ? ind.tone(cur) : "neutral" };
}
