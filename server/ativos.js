// Alunos ativos no fim de um mês, reconstruídos do histórico de contratos do EVO.
// Ativo no dia D = tem contrato que já começou até D, não foi cancelado até D e ainda não terminou em D.
// Contratos aqui são tuplas [início, fim, cancelamento, status, ...] (datas AAAA-MM-DD ou null).
import { fetchAll } from "./evo.js";
import { UNIT_NAMES } from "./units.js";

export const ativoNoDia = (contratos, dia) =>
  contratos.some(([ini, fim, cancel]) => ini && ini <= dia && !(cancel && cancel <= dia) && fim && fim >= dia);

export const contarAtivos = (alunos, dia) => alunos.reduce((n, a) => n + (ativoNoDia(a.c, dia) ? 1 : 0), 0);

export const resumoAluno = (m) => ({
  id: m.idMember,
  c: (m.memberships || []).map((c) => [c.startDate?.slice(0, 10) ?? null, c.endDate?.slice(0, 10) ?? null, c.cancelDate?.slice(0, 10) ?? null, c.membershipStatus]),
});

/** Último dia a considerar no mês: o último dia dele, ou hoje se o mês ainda está em andamento. */
export function diaDeCorte(ym, hoje) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return hoje < ultimo ? hoje : ultimo;
}

/** Baixa os alunos de uma unidade e conta os ativos no fim de cada mês pedido. */
export async function ativosDaUnidade(idBranch, meses, hoje) {
  const alunos = (await fetchAll(`/members?idBranch=${idBranch}`)).map(resumoAluno);
  return Object.fromEntries(meses.map((ym) => [ym, contarAtivos(alunos, diaDeCorte(ym, hoje))]));
}

export const UNIDADES = UNIT_NAMES;
