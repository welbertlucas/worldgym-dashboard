import { dashboardData, getUnitData, type UnitData } from "@/data/dashboardData";
import { sameMonthLastYear } from "@/data/alerts";

/** Valor do mesmo mês do ano anterior (rede ou unidade), ou null se não existir na planilha. Só lê dados existentes. */
export function priorYearValue(month: string, unit: string | null, pick: (u: UnitData) => number): number | null {
  const base = sameMonthLastYear(month);
  if (unit) {
    const u = getUnitData(base, unit);
    return u ? pick(u) : null;
  }
  const m = dashboardData.find((d) => d.month === base);
  return m ? pick(m.total) : null;
}
