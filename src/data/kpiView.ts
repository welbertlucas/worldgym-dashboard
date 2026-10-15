import { getDataByMonth, type UnitData } from "@/data/dashboardData";

/** O que um indicador precisa de um mês: o total (rede ou unidade) e as unidades que o compõem. */
export interface MonthView { month: string; total: UnitData; units: UnitData[] }

/** Visão de um mês para a rede (unit nulo) ou para uma unidade; undefined se o mês/unidade não existe. */
export function viewFor(month: string | undefined, unit: string | null): MonthView | undefined {
  const md = month ? getDataByMonth(month) : undefined;
  if (!md) return undefined;
  if (!unit) return md;
  const u = md.units.find((x) => x.name === unit);
  return u ? { month: md.month, total: u, units: [u] } : undefined;
}

export const sumUnits = (v: MonthView, pick: (u: UnitData) => number) => v.units.reduce((s, u) => s + pick(u), 0);

export const shortMonth = (m: string) =>
  new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
