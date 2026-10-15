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

/**
 * Separa o valor do mês em andamento da série dos meses fechados: o parcial vai para o campo "parcial"
 * (marcador isolado) e nunca entra na linha de tendência. Só reposiciona o valor; não altera o cálculo.
 */
export function splitPartial<K extends string>(key: K, partial: boolean, value: number): Record<K | "parcial", number | null> {
  return { [key]: partial ? null : value, parcial: partial ? value : null } as Record<K | "parcial", number | null>;
}
