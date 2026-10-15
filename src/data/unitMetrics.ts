import { type MonthData, type UnitData } from "@/data/dashboardData";

export type TrendKey = "faturamento" | "vendasOnline" | "churn" | "inadimplenciaPerc" | "renovacoes";

/** Para cada indicador: maior é melhor? e a unidade da variação (% relativo ou p.p.). */
export const TREND_META: Record<TrendKey, { label: string; higherIsBetter: boolean; mode: "pct" | "pp" }> = {
  faturamento: { label: "Faturamento", higherIsBetter: true, mode: "pct" },
  vendasOnline: { label: "Vendas online", higherIsBetter: true, mode: "pct" },
  churn: { label: "Churn", higherIsBetter: false, mode: "pp" },
  inadimplenciaPerc: { label: "Inadimplência", higherIsBetter: false, mode: "pp" },
  renovacoes: { label: "Renovação", higherIsBetter: true, mode: "pp" },
};

export interface UnitDelta {
  unit: string;
  current: UnitData;
  previous: UnitData;
  deltas: Record<TrendKey, number>;
  /** Quantos dos indicadores melhoraram / pioraram (ignora variações desprezíveis). */
  improved: number;
  worsened: number;
}

const EPS: Record<"pct" | "pp", number> = { pct: 0.5, pp: 0.1 };

/** Variação de cada unidade entre dois meses (só unidades presentes nos dois). */
export function computeUnitDeltas(cur: MonthData, prev: MonthData): UnitDelta[] {
  const out: UnitDelta[] = [];
  for (const u of cur.units) {
    const p = prev.units.find((x) => x.name === u.name);
    if (!p || p.faturamento <= 0) continue;
    const deltas = {} as Record<TrendKey, number>;
    let improved = 0, worsened = 0;
    (Object.keys(TREND_META) as TrendKey[]).forEach((k) => {
      const meta = TREND_META[k];
      const d = meta.mode === "pct" ? (p[k] > 0 ? ((u[k] - p[k]) / p[k]) * 100 : 0) : u[k] - p[k];
      deltas[k] = d;
      if (Math.abs(d) >= EPS[meta.mode]) (d > 0) === meta.higherIsBetter ? improved++ : worsened++;
    });
    out.push({ unit: u.name, current: u, previous: p, deltas, improved, worsened });
  }
  return out;
}

/** Média ponderada (padrão: por adimplentes) — evita que unidade pequena pese igual a uma grande. */
export function weightedAverage(units: UnitData[], key: keyof UnitData, weightKey: keyof UnitData = "adimplentes"): number {
  const w = units.reduce((s, u) => s + (u[weightKey] as number), 0);
  if (!w) return 0;
  return units.reduce((s, u) => s + (u[key] as number) * (u[weightKey] as number), 0) / w;
}
