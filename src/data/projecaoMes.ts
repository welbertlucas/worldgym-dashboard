// Projeções de fechamento do mês em andamento (novos contratos e faturamento), usadas no Gerencial e em Metas.
import { getDataByMonth, getUnitData, type UnitData } from "@/data/dashboardData";
import { diasFechados, projetarMes, type Projecao } from "@/data/vendasDia";

/** Meses de referência: os `n` anteriores ao mês mostrado que têm vendas por dia (para a projeção e a média por dia da semana). */
export function mesesDeReferencia(month: string, unit: string | null, n = 3): [string, number[]][] {
  const out: [string, number[]][] = [];
  let [y, m] = month.split("-").map(Number);
  for (let k = 0; k < 12 && out.length < n; k++) {
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    const v = (unit ? getUnitData(ym, unit) : getDataByMonth(ym)?.total)?.vendasDia;
    if (v?.length) out.push([ym, v]);
  }
  return out.reverse();
}

/** Projeção de novos contratos no fechamento do mês; null fora do mês em andamento ou antes do dia mínimo. */
export function projecaoContratos(total: UnitData, month: string, partial: boolean, unit: string | null, atualizadoEm: string | null): Projecao | null {
  if (!partial || !total.vendasDia?.length) return null;
  return projetarMes(total.vendasDia, month, diasFechados(month, partial, atualizadoEm), mesesDeReferencia(month, unit));
}

/** Dia mínimo para estimar o fechamento (antes disso o mês tem pouca venda e a estimativa balança demais), como a projeção de contratos. */
export const DIA_MINIMO_PROJECAO = 10;

export interface ProjecaoFaturamentoMes {
  /** Vendido até agora: o faturamento do mês (Total de vendas do EVO) até a véspera. */
  vendido: number;
  /** Deve fechar o mês em: vendido ÷ a parte do mês que costuma estar vendida até este dia. Null antes do dia mínimo ou sem histórico. */
  estimativa: number | null;
  /** Parte do faturamento do mês que, nos meses de referência, já estava vendida até este dia (0 a 1). */
  fracao: number | null;
  /** Dias fechados (dados até a véspera) e os meses usados na conta. */
  dia: number;
  meses: string[];
}

/** Faturamento (Total de vendas) por semana do mês, somando as unidades do escopo; null se nenhuma tem o número. */
function semanasDeVendas(ym: string, unit: string | null): number[] | null {
  const us = (getDataByMonth(ym)?.units ?? []).filter((u) => !unit || u.name === unit);
  const comDado = us.filter((u) => u.semanas?.some((w) => typeof w.totalVendas === "number"));
  if (!comDado.length) return null;
  const n = Math.max(...comDado.map((u) => u.semanas!.length));
  return Array.from({ length: n }, (_, k) => comDado.reduce((a, u) => a + (u.semanas![k]?.totalVendas ?? 0), 0));
}

/** Parte do mês já vendida até o fim do dia `d` (semanas de 7 dias; dentro da semana, proporcional aos dias). */
export function fracaoAteODia(semanas: number[], ym: string, d: number): number | null {
  const total = semanas.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  const dias = diasDoMes(ym);
  let acum = 0;
  semanas.forEach((v, k) => {
    const ini = 7 * k + 1, fim = k === semanas.length - 1 ? dias : Math.min(dias, 7 * (k + 1));
    if (d >= fim) acum += v;
    else if (d >= ini) acum += (v * (d - ini + 1)) / (fim - ini + 1);
  });
  return acum / total;
}
const diasDoMes = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

/**
 * Previsão de faturamento do mês em andamento, em duas linhas (decisão do dono, 23/11/2026): "vendido até agora" (o mesmo número do cartão
 * Faturamento) e "deve fechar o mês em". A estimativa divide o vendido pela parte do mês que, nos 3 meses anteriores, já estava vendida
 * até este mesmo dia (pela curva semanal do Total de vendas). Null fora do mês em andamento.
 */
export function projecaoFaturamento(total: UnitData, month: string, partial: boolean, unit: string | null, atualizadoEm: string | null): ProjecaoFaturamentoMes | null {
  if (!partial) return null;
  const vendido = total.faturamento ?? 0;
  const dia = diasFechados(month, partial, atualizadoEm);
  if (!(vendido > 0) || dia < 1) return null;
  const fracoes: number[] = [], meses: string[] = [];
  let [y, m] = month.split("-").map(Number);
  for (let k = 0; k < 6 && fracoes.length < 3; k++) {
    m -= 1; if (m === 0) { m = 12; y -= 1; }
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    const sem = semanasDeVendas(ym, unit);
    // mês mais curto: compara pelo mesmo dia, limitado ao fim dele
    const f = sem ? fracaoAteODia(sem, ym, Math.min(dia, diasDoMes(ym))) : null;
    if (f && f > 0) { fracoes.push(f); meses.push(ym); }
  }
  const fracao = fracoes.length ? fracoes.reduce((a, b) => a + b, 0) / fracoes.length : null;
  const estimativa = dia >= DIA_MINIMO_PROJECAO && fracao ? vendido / fracao : null;
  return { vendido, estimativa, fracao, dia, meses: meses.reverse() };
}
