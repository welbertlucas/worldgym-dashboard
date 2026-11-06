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

/** Quanto do mês já passou em `ref` (0 a 1). */
export function fracaoDoMes(month: string, ref: Date = new Date()): number {
  const [y, m] = month.split("-").map(Number);
  const ini = new Date(y, m - 1, 1).getTime();
  const fim = new Date(y, m, 1).getTime();
  return Math.min(1, Math.max(0, (ref.getTime() - ini) / (fim - ini)));
}

/** Projeção linear de fechamento: o ritmo até agora repetido até o fim do mês. Só vale depois dos primeiros 3 dias (10% do mês). */
export function projetarFechamento(valor: number, fracao: number): number | null {
  return fracao >= 0.1 && valor > 0 ? valor / fracao : null;
}
