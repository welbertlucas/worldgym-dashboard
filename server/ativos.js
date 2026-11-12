// Alunos ativos no fim de um mês, reconstruídos do histórico de contratos do EVO.
// Ativo no dia D = tem contrato que já começou até D, não foi cancelado até D e ainda não terminou em D.
// Contratos aqui são tuplas [início, fim, cancelamento, status, recorrente, trancamentos] (datas AAAA-MM-DD ou null);
// trancamentos = [[início, fim, desbloqueio antecipado]] (campo freezes do EVO).
import { fetchAll } from "./evo.js";
import { UNIT_NAMES } from "./units.js";
import { FAIXAS_IDADE, faixaDeIdade, generoDe } from "./perfil.js";

export const ativoNoDia = (contratos, dia) =>
  contratos.some(([ini, fim, cancel]) => ini && ini <= dia && !(cancel && cancel <= dia) && fim && fim >= dia);

export const contarAtivos = (alunos, dia) => alunos.reduce((n, a) => n + (ativoNoDia(a.c, dia) ? 1 : 0), 0);

const dia10 = (x) => (x ? String(x).slice(0, 10) : null);

// g = gênero (0 fem, 1 masc, 2 outros) e n = nascimento: só em memória, para o perfil dos cancelamentos (nunca gravados).
export const resumoAluno = (m) => ({
  id: m.idMember,
  g: generoDe(m.gender),
  n: dia10(m.birthDate),
  c: (m.memberships || []).map((c) => [
    dia10(c.startDate), dia10(c.endDate), dia10(c.cancelDate), c.membershipStatus, Boolean(c.valueNextMonth),
    (c.freezes || []).map((z) => [dia10(z.startSuspend), dia10(z.endSuspend), dia10(z.unlockDate)]),
  ]),
});

const trancadoNoDia = (trancamentos, dia) =>
  (trancamentos ?? []).some(([ini, fim, desbloqueio]) => ini && ini <= dia && fim && fim >= dia && !(desbloqueio && desbloqueio <= dia));

/**
 * Suspensos (contrato trancado) no dia D: alunos ativos em D cujo contrato vigente tem um trancamento cobrindo D.
 * Continuam contando nos ativos (o contrato segue valendo); o número sai à parte, como no EVO Insights.
 * Conferido com o status "suspended" do próprio EVO em 11/11/2026: Goiânia 2 × 2, Arniqueira 10 × 10.
 */
export const contarSuspensos = (alunos, dia) =>
  alunos.reduce((n, a) => n + (a.c.some(([ini, fim, cancel, , , tr]) => ini && ini <= dia && !(cancel && cancel <= dia) && fim && fim >= dia && trancadoNoDia(tr, dia)) ? 1 : 0), 0);

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

/**
 * Perfil dos cancelamentos do mês: por gênero e por faixa de idade (no dia 1º do mês), [ativos no início, cancelados no mês].
 * Mesmas regras do churn do painel (cancelados ÷ ativos no início), então as somas batem com ativosIni e cancelados.
 */
export function cancelamentosPorPerfil(alunos, ym, hoje) {
  const fim = diaDeCorte(ym, hoje);
  const ini = `${ym}-01`;
  const antes = diaAnterior(ini);
  const g = [0, 1, 2].map(() => [0, 0]), i = Array.from({ length: FAIXAS_IDADE }, () => [0, 0]);
  for (const a of alunos) {
    const noInicio = ativoNoDia(a.c, antes);
    const cancelou = a.c.some(([, , cancel]) => cancel && cancel >= ini && cancel <= fim);
    if (!noInicio && !cancelou) continue;
    const gi = a.g ?? 2, ii = faixaDeIdade(a.n, ini);
    if (noInicio) { g[gi][0]++; i[ii][0]++; }
    if (cancelou) { g[gi][1]++; i[ii][1]++; }
  }
  return { g, i };
}

/** Baixa os alunos de uma unidade (ou usa `membros` já baixados) e calcula o movimento de cada mês pedido. */
export async function ativosDaUnidade(idBranch, meses, hoje, membros = null) {
  const alunos = (membros ?? (await fetchAll(`/members?idBranch=${idBranch}`))).map(resumoAluno);
  return Object.fromEntries(meses.map((ym) => [ym, { ...movimentoDoMes(alunos, ym, hoje), ...fluxoDoMes(alunos, ym, hoje), suspensosFim: contarSuspensos(alunos, diaDeCorte(ym, hoje)), cancelPerfil: cancelamentosPorPerfil(alunos, ym, hoje) }]));
}

export const UNIDADES = UNIT_NAMES;
