import { type MonthData } from "@/data/dashboardData";
import { type Indicator } from "@/data/unitIndicators";
import { isPartialMonth } from "@/data/periods";

export const PERIODOS = [
  { n: 3, label: "3 meses" },
  { n: 6, label: "6 meses" },
  { n: 12, label: "12 meses" },
  { n: 24, label: "24 meses" },
] as const;

export interface SeriesRow {
  month: string;
  /** Valor da unidade (null = sem dado naquele mês). */
  unit: number | null;
}

/** Zero só é dado de verdade em faturamento e recebimento; nos outros, zero é campo não lançado. */
const ZERO_REAL = new Set(["faturamento", "recebimento"]);
export const valorOuNulo = (ind: Indicator, v: number | undefined): number | null =>
  v === undefined || (v === 0 && !ZERO_REAL.has(ind.key)) ? null : v;

/** Meses fechados dos últimos `n` (o mês em andamento é parcial e fica de fora). */
export function ultimosFechados(data: MonthData[], n: number, now: Date = new Date()): MonthData[] {
  return data.filter((m) => !isPartialMonth(m.month, now)).slice(-n);
}

/** Meses fechados entre `de` e `ate` (inclusive). Se vierem invertidos, troca. */
export function mesesNoIntervalo(data: MonthData[], de: string, ate: string, now: Date = new Date()): string[] {
  const [a, b] = de <= ate ? [de, ate] : [ate, de];
  return data.filter((m) => !isPartialMonth(m.month, now) && m.month >= a && m.month <= b).map((m) => m.month);
}

/** Valor do indicador da unidade em cada um dos meses (null = sem dado lançado). */
export function seriesPorMeses(data: MonthData[], unitName: string, ind: Indicator, meses: string[]): SeriesRow[] {
  return meses.map((month) => {
    const u = data.find((m) => m.month === month)?.units.find((x) => x.name === unitName);
    return { month, unit: u ? valorOuNulo(ind, ind.value(u)) : null };
  });
}

export interface Posicao { posicao: number; de: number }

/** Posição da unidade entre as que têm dado no mês (1 = melhor, conforme a direção do indicador). null se não há regra ou dado. */
export function posicaoNaRede(md: MonthData | undefined, unitName: string, ind: Indicator): Posicao | null {
  if (!md || !ind.direction) return null;
  const vals = md.units
    .map((u) => ({ name: u.name, v: valorOuNulo(ind, ind.value(u)) }))
    .filter((x): x is { name: string; v: number } => x.v !== null);
  const eu = vals.find((x) => x.name === unitName);
  if (!eu) return null;
  const melhores = vals.filter((x) => (ind.direction === "higher" ? x.v > eu.v : x.v < eu.v)).length;
  return { posicao: melhores + 1, de: vals.length };
}

/**
 * Referência da rede para comparar com uma unidade: em percentuais, o valor da rede no mês; nos demais (R$ e contagens),
 * a média das unidades com dado no mês, para ficar na mesma escala de uma unidade.
 */
export function serieDaRede(data: MonthData[], ind: Indicator, meses: string[]): SeriesRow[] {
  return meses.map((month) => {
    const md = data.find((m) => m.month === month);
    if (!md) return { month, unit: null };
    if (ind.format === "percent") return { month, unit: valorOuNulo(ind, ind.value(md.total)) };
    const vals = md.units.map((u) => valorOuNulo(ind, ind.value(u))).filter((v): v is number => v !== null);
    return { month, unit: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null };
  });
}
