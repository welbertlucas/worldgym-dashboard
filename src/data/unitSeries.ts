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
  /** Referência: a outra unidade escolhida ou a média das unidades da rede. */
  ref: number | null;
}

/** Zero só é dado de verdade em faturamento e recebimento; nos outros, zero é campo não lançado. */
const ZERO_REAL = new Set(["faturamento", "recebimento"]);
export const valorOuNulo = (ind: Indicator, v: number | undefined): number | null =>
  v === undefined || (v === 0 && !ZERO_REAL.has(ind.key)) ? null : v;

/** Meses fechados dos últimos `n` (o mês em andamento é parcial e fica de fora). */
export function ultimosFechados(data: MonthData[], n: number, now: Date = new Date()): MonthData[] {
  return data.filter((m) => !isPartialMonth(m.month, now)).slice(-n);
}

export function seriesFor(data: MonthData[], unitName: string, ind: Indicator, n: number, refUnit: string | null, now: Date = new Date()): SeriesRow[] {
  return ultimosFechados(data, n, now).map((m) => {
    const u = m.units.find((x) => x.name === unitName);
    const unit = u ? valorOuNulo(ind, ind.value(u)) : null;
    let ref: number | null;
    if (refUnit) {
      const r = m.units.find((x) => x.name === refUnit);
      ref = r ? valorOuNulo(ind, ind.value(r)) : null;
    } else {
      const vals = m.units.map((x) => valorOuNulo(ind, ind.value(x))).filter((v): v is number => v !== null);
      ref = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    return { month: m.month, unit, ref };
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
