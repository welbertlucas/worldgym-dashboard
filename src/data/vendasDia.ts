// Vendas por dia do mês (novos contratos pelo dia da venda no EVO) e a projeção de fechamento do mês em andamento.

/** Dia da semana (0 = domingo) de um dia do mês AAAA-MM. */
export const diaDaSemana = (month: string, dia: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dia)).getUTCDay();
};

export const diasNoMes = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * Dias já fechados no mês: todos, se o mês acabou; senão, até a véspera da última leitura do EVO
 * (a rotina roda de madrugada, então o dia da leitura ainda não aconteceu).
 */
export function diasFechados(month: string, partial: boolean, atualizadoEm: string | null): number {
  const total = diasNoMes(month);
  if (!partial) return total;
  if (!atualizadoEm) return 0;
  // Data da leitura no horário de Brasília (UTC−3).
  const br = new Date(new Date(atualizadoEm).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  if (br.slice(0, 7) < month) return 0;
  if (br.slice(0, 7) > month) return total;
  return Math.min(total, Number(br.slice(8, 10)) - 1);
}

/** Média de novos contratos por dia da semana (0 = domingo) nos meses de referência. */
export function mediaPorDiaDaSemana(hist: [string, number[]][]): number[] {
  const soma = Array(7).fill(0), n = Array(7).fill(0);
  for (const [m, v] of hist) v.forEach((x, i) => { const w = diaDaSemana(m, i + 1); soma[w] += x; n[w] += 1; });
  return soma.map((s, w) => (n[w] ? s / n[w] : 0));
}

export interface Projecao {
  /** Fechamento projetado (novos contratos no mês). */
  valor: number;
  /** Realizado nos dias fechados. */
  realizado: number;
  /** Quanto do mês os meses de referência tinham vendido até o mesmo dia (0 a 1). */
  fatia: number;
}

/**
 * Mínimo de dias fechados para projetar. Nos testes com as vendas de jul–out/2026, antes do dia 10 nenhum método
 * acertou bem (erro médio de 20% a 30% numa unidade); do dia 10 ao 15, a curva do mês errou 2% a 8% na rede e 12% a 15% numa unidade.
 */
export const DIAS_MINIMOS = 10;

/**
 * Projeção do mês em andamento pela curva do mês: o realizado até o dia D dividido pela parte das vendas que os meses
 * de referência tinham feito até o mesmo dia D (as vendas se concentram em certos dias do mês, o que o ritmo linear ignora).
 * Sem meses de referência, usa o ritmo linear.
 */
export function projetarMes(v: number[], month: string, dias: number, hist: [string, number[]][]): Projecao | null {
  const total = diasNoMes(month);
  if (dias < DIAS_MINIMOS || dias >= total) return null;
  const realizado = v.slice(0, dias).reduce((a, b) => a + b, 0);
  if (!realizado) return null;
  let ate = 0, tudo = 0;
  for (const [, h] of hist) {
    ate += h.slice(0, Math.min(dias, h.length)).reduce((a, b) => a + b, 0);
    tudo += h.reduce((a, b) => a + b, 0);
  }
  const fatia = tudo && ate ? ate / tudo : dias / total;
  return { valor: realizado / fatia, realizado, fatia };
}
