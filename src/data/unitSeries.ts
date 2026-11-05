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
  /** Mês de onde veio a referência, quando a unidade é comparada com ela mesma. */
  refMonth?: string;
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

/** Com o que a unidade é comparada nos gráficos. */
export type Referencia =
  | { tipo: "media" } // média das unidades da rede
  | { tipo: "unidade"; nome: string } // outra unidade, no mesmo mês
  | { tipo: "ano" } // ela mesma, 12 meses antes
  | { tipo: "anterior" }; // ela mesma, no período imediatamente anterior (mesma quantidade de meses)

/** Soma `k` meses a "AAAA-MM". */
export function deslocar(ym: string, k: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Meses fechados entre `de` e `ate` (inclusive). Se vierem invertidos, troca. */
export function mesesNoIntervalo(data: MonthData[], de: string, ate: string, now: Date = new Date()): string[] {
  const [a, b] = de <= ate ? [de, ate] : [ate, de];
  return data.filter((m) => !isPartialMonth(m.month, now) && m.month >= a && m.month <= b).map((m) => m.month);
}

export function seriesPorMeses(data: MonthData[], unitName: string, ind: Indicator, meses: string[], ref: Referencia): SeriesRow[] {
  const doMes = (ym: string) => data.find((m) => m.month === ym);
  const valorDa = (ym: string, nome: string) => {
    const u = doMes(ym)?.units.find((x) => x.name === nome);
    return u ? valorOuNulo(ind, ind.value(u)) : null;
  };
  return meses.map((month) => {
    const unit = valorDa(month, unitName);
    if (ref.tipo === "unidade") return { month, unit, ref: valorDa(month, ref.nome) };
    if (ref.tipo === "ano" || ref.tipo === "anterior") {
      const refMonth = deslocar(month, ref.tipo === "ano" ? -12 : -meses.length);
      return { month, unit, ref: valorDa(refMonth, unitName), refMonth };
    }
    const vals = (doMes(month)?.units ?? []).map((x) => valorOuNulo(ind, ind.value(x))).filter((v): v is number => v !== null);
    return { month, unit, ref: vals.length ? vals.reduce((t, v) => t + v, 0) / vals.length : null };
  });
}

/** Últimos `n` meses fechados contra a média da rede ou outra unidade (atalho usado nos testes e nos presets). */
export function seriesFor(data: MonthData[], unitName: string, ind: Indicator, n: number, refUnit: string | null, now: Date = new Date()): SeriesRow[] {
  const meses = ultimosFechados(data, n, now).map((m) => m.month);
  return seriesPorMeses(data, unitName, ind, meses, refUnit ? { tipo: "unidade", nome: refUnit } : { tipo: "media" });
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
