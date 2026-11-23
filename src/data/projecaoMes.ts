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

export interface ProjecaoFaturamentoMes {
  /** Já venceu até agora. */
  jaVenceu: number;
  /** Já lançado no EVO para o mês inteiro (já venceu + vai vencer): soma dos títulos, não é estimativa. */
  lancado: number;
  /** Vendas que ainda devem entrar: contratos novos que faltam × valor médio de um contrato novo; null sem projeção de contratos. */
  vendasFuturas: number | null;
  /** lançado + vendas futuras (só o lançado enquanto não há projeção de contratos). */
  estimativa: number;
  /** Para a explicação: contratos que faltam, valor médio e a projeção de contratos. */
  faltam: number;
  ticket: number;
  contratos: Projecao | null;
}

/** Projeção de faturamento do mês em andamento; null se o EVO não trouxe a previsão. */
export function projecaoFaturamento(total: UnitData, month: string, partial: boolean, unit: string | null, atualizadoEm: string | null): ProjecaoFaturamentoMes | null {
  const lancado = total.previsaoFaturamento;
  if (!partial || lancado === undefined || !(lancado > 0)) return null;
  const contratos = projecaoContratos(total, month, partial, unit, atualizadoEm);
  const tv = total.tipoVenda;
  const nVendas = tv ? tv.novo[0] + tv.remat[0] : 0;
  const ticket = tv && nVendas > 0 ? (tv.novo[1] + tv.remat[1]) / nVendas : 0;
  const faltam = contratos ? Math.max(0, contratos.valor - (total.novosContratos ?? contratos.realizado)) : 0;
  const vendasFuturas = contratos && ticket ? faltam * ticket : null;
  // O que já venceu é pela conta dos títulos (o "lançado" também é): o faturamento do Atlas, que é o Total de Vendas, mede outra coisa.
  return { jaVenceu: total.faturamentoTitulos ?? total.faturamento, lancado, vendasFuturas, estimativa: lancado + (vendasFuturas ?? 0), faltam, ticket, contratos };
}
