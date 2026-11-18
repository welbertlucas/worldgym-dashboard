// Overview por período: junta vários meses num só "mês" para os velocímetros. O que é soma soma (faturamento, recebimento, vendas
// online); o que é taxa vira média ponderada pela base de cada mês (alunos ativos no início, pagantes, contratos a vencer e
// oportunidades), então escolher um mês só dá o mesmo número do velocímetro mensal. Só lê o que o painel já carregou: nenhuma chamada.
import type { UnitData } from "@/data/dashboardData";
import type { MonthView } from "@/data/kpiView";

const arred = (v: number) => Math.round(v * 10) / 10;

/**
 * Média das taxas de cada mês ponderada pela base do mês. Meses sem base (meses antigos, de antes do EVO) ficam de fora quando
 * existe ao menos um com base; se nenhum tem, vale a média simples. Sem nenhum mês, 0.
 */
export function mediaPonderada(meses: MonthView[], taxa: (t: UnitData) => number, base: (t: UnitData) => number | undefined): number {
  const comBase = meses.filter((m) => (base(m.total) ?? 0) > 0);
  if (comBase.length) {
    const peso = comBase.reduce((s, m) => s + (base(m.total) as number), 0);
    return arred(comBase.reduce((s, m) => s + taxa(m.total) * (base(m.total) as number), 0) / peso);
  }
  return meses.length ? arred(meses.reduce((s, m) => s + taxa(m.total), 0) / meses.length) : 0;
}

const soma = (meses: MonthView[], f: (t: UnitData) => number | undefined) => meses.reduce((s, m) => s + (f(m.total) ?? 0), 0);

/** Os meses de um período, do primeiro ao último (as pontas valem). Vazio se algum dos dois não existe ou estão invertidos. */
export function mesesDoPeriodo(todos: { month: string }[], de: string, ate: string): string[] {
  const lista = todos.map((m) => m.month).sort();
  const i = lista.indexOf(de), j = lista.indexOf(ate);
  return i < 0 || j < 0 || i > j ? [] : lista.slice(i, j + 1);
}

/** O período anterior, com o mesmo número de meses, logo antes do primeiro. Vazio se não há meses suficientes para trás. */
export function periodoAnterior(todos: { month: string }[], de: string, ate: string): string[] {
  const lista = todos.map((m) => m.month).sort();
  const n = mesesDoPeriodo(todos, de, ate).length;
  const i = lista.indexOf(de);
  return n === 0 || i - n < 0 ? [] : lista.slice(i - n, i);
}

/**
 * Um "mês" que representa o período: a vista do último mês, com os números somados ou ponderados. Serve direto de `cur`/`prev`
 * dos velocímetros. O mês em andamento entra com o que tem até agora (quem chama avisa que é parcial).
 */
export function agregarPeriodo(meses: MonthView[]): MonthView {
  const ultimo = meses[meses.length - 1];
  const t = ultimo.total;
  const previsao = meses.reduce((s, m) => s + (m.total.previsaoFaturamento ?? m.total.faturamento), 0);
  const total: UnitData = {
    ...t,
    faturamento: soma(meses, (x) => x.faturamento),
    recebimento: soma(meses, (x) => x.recebimento),
    vendasOnline: soma(meses, (x) => x.vendasOnline),
    cancelados: soma(meses, (x) => x.cancelados),
    oportunidades: soma(meses, (x) => x.oportunidades),
    conversoes: soma(meses, (x) => x.conversoes),
    ...(meses.some((m) => m.total.previsaoFaturamento !== undefined) ? { previsaoFaturamento: previsao } : {}),
    churn: mediaPonderada(meses, (x) => x.churn, (x) => x.ativosIni),
    inadimplenciaPerc: mediaPonderada(meses, (x) => x.inadimplenciaPerc, (x) => x.pagantes),
    renovacoes: mediaPonderada(meses, (x) => x.renovacoes, (x) => x.aVencer),
    icv: mediaPonderada(meses, (x) => x.icv, (x) => x.oportunidades),
  };
  return { month: ultimo.month, total, units: ultimo.units };
}

const abreviado = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

/** "jul–nov/2026", "nov/2025–fev/2026" ou "nov/2026" (um mês só). */
export function rotuloPeriodo(de: string, ate: string): string {
  if (de === ate) return `${abreviado(de)}/${de.slice(0, 4)}`;
  return de.slice(0, 4) === ate.slice(0, 4) ? `${abreviado(de)}–${abreviado(ate)}/${ate.slice(0, 4)}` : `${abreviado(de)}/${de.slice(0, 4)}–${abreviado(ate)}/${ate.slice(0, 4)}`;
}
