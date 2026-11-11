// Alunos ativos no fim de um mês, reconstruídos do histórico de contratos do EVO.
// Ativo no dia D = tem contrato que já começou até D, não foi cancelado até D e ainda não terminou em D.
// Contratos aqui são tuplas [início, fim, cancelamento, status, recorrente, ...] (datas AAAA-MM-DD ou null).
import { fetchAll } from "./evo.js";
import { UNIT_NAMES } from "./units.js";

export const ativoNoDia = (contratos, dia) =>
  contratos.some(([ini, fim, cancel]) => ini && ini <= dia && !(cancel && cancel <= dia) && fim && fim >= dia);

export const contarAtivos = (alunos, dia) => alunos.reduce((n, a) => n + (ativoNoDia(a.c, dia) ? 1 : 0), 0);

export const resumoAluno = (m) => ({
  id: m.idMember,
  c: (m.memberships || []).map((c) => [c.startDate?.slice(0, 10) ?? null, c.endDate?.slice(0, 10) ?? null, c.cancelDate?.slice(0, 10) ?? null, c.membershipStatus, Boolean(c.valueNextMonth)]),
});

/** Último dia a considerar no mês: o último dia dele, ou hoje se o mês ainda está em andamento. */
export function diaDeCorte(ym, hoje) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return hoje < ultimo ? hoje : ultimo;
}

/** Dia anterior a uma data AAAA-MM-DD. */
export function diaAnterior(dia) {
  const t = new Date(`${dia}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

/** Alunos distintos com algum contrato cancelado entre `de` e `ate` (inclusive). */
export const contarCancelados = (alunos, de, ate) =>
  alunos.reduce((n, a) => n + (a.c.some(([, , cancel]) => cancel && cancel >= de && cancel <= ate) ? 1 : 0), 0);

/**
 * Contratos de prazo fixo (sem cobrança recorrente) que terminam entre `de` e `ate` e não foram cancelados:
 * é o "a vencer" do painel de Renovações do EVO. Os recorrentes se renovam sozinhos todo mês e ficam de fora.
 */
export const contarAVencer = (alunos, de, ate) =>
  alunos.reduce((n, a) => n + a.c.filter(([, fim, cancel, , rec]) => fim && fim >= de && fim <= ate && !cancel && !rec).length, 0);

/** Números de um mês a partir do histórico de contratos: ativos no início e no fim, cancelados e contratos a vencer no mês. */
export function movimentoDoMes(alunos, ym, hoje) {
  const fim = diaDeCorte(ym, hoje);
  const ini = `${ym}-01`;
  return { ativosFim: contarAtivos(alunos, fim), ativosIni: contarAtivos(alunos, diaAnterior(ini)), cancelados: contarCancelados(alunos, ini, fim), aVencer: contarAVencer(alunos, ini, fim) };
}

const DIAS_POR_MES = 30.4375;
const diasEntre = (de, ate) => Math.round((new Date(`${ate}T00:00:00Z`) - new Date(`${de}T00:00:00Z`)) / 86400000);
const primeiroInicio = (a) => a.c.reduce((m, [ini]) => (ini && (!m || ini < m) ? ini : m), null);

/**
 * Fluxo de alunos no mês, fechando com ativosIni + entradas − saídas = ativosFim:
 *  - novos: não estavam ativos no início, estão no fim e o 1º contrato de sempre começou no mês;
 *  - retornos: idem, mas já tinham contrato antes (voltaram);
 *  - cancelados / vencidos: estavam ativos no início e não estão no fim, com cancelamento no mês ou sem (contrato acabou).
 * Permanência = média, em meses, do tempo desde o primeiro contrato dos alunos ativos no fim do mês.
 */
export function fluxoDoMes(alunos, ym, hoje) {
  const fim = diaDeCorte(ym, hoje);
  const ini = `${ym}-01`;
  const antes = diaAnterior(ini);
  let novos = 0, retornos = 0, cancelados = 0, vencidos = 0, somaDias = 0, ativos = 0;
  for (const a of alunos) {
    const noInicio = ativoNoDia(a.c, antes);
    const noFim = ativoNoDia(a.c, fim);
    const primeiro = primeiroInicio(a);
    if (!noInicio && noFim) (primeiro && primeiro >= ini ? novos++ : retornos++);
    if (noInicio && !noFim) (a.c.some(([, , cancel]) => cancel && cancel >= ini && cancel <= fim) ? cancelados++ : vencidos++);
    if (noFim && primeiro) { somaDias += Math.max(0, diasEntre(primeiro, fim)); ativos++; }
  }
  return {
    fluxoNovos: novos, fluxoRetornos: retornos, fluxoCancelados: cancelados, fluxoVencidos: vencidos,
    permanenciaMeses: ativos ? Math.round((somaDias / ativos / DIAS_POR_MES) * 10) / 10 : 0,
  };
}

/** Baixa os alunos de uma unidade (ou usa `membros` já baixados) e calcula o movimento de cada mês pedido. */
export async function ativosDaUnidade(idBranch, meses, hoje, membros = null) {
  const alunos = (membros ?? (await fetchAll(`/members?idBranch=${idBranch}`))).map(resumoAluno);
  return Object.fromEntries(meses.map((ym) => [ym, { ...movimentoDoMes(alunos, ym, hoje), ...fluxoDoMes(alunos, ym, hoje) }]));
}

export const UNIDADES = UNIT_NAMES;
