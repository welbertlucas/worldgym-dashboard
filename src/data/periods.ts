// "Mês fechado" = qualquer mês anterior ao mês corrente. O mês corrente é parcial.
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isPartialMonth(month: string, now: Date = new Date()): boolean {
  return month >= monthKey(now);
}

/** Último mês (da lista, em ordem crescente) que já fechou, ou null. */
export function getLastClosedMonth(months: string[], now: Date = new Date()): string | null {
  const current = monthKey(now);
  const closed = months.filter((m) => m < current);
  return closed.length ? closed[closed.length - 1] : null;
}

export function formatMonthLong(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
