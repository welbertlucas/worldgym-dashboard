// Entradas na catraca (EVO /api/v1/entries), resumidas por unidade: mapa de calor dia da semana × hora,
// entradas por dia do mês e quantas pessoas diferentes vieram. Só contagens: ninguém é identificado no que é gravado
// (o id do aluno só existe em memória, para contar pessoas diferentes).
//
// A rota devolve TODAS as unidades (o idBranch é ignorado) e aceita páginas de 10 mil registros: um dia de pico tem
// ~150 mil registros na rede, então o mês inteiro sai em poucas centenas de chamadas.
// Conta como entrada: "Controle de acesso" com ação de entrada (catraca, teclado, app ou liberação manual).
// Fica de fora: saída (output), bloqueios (débito, PARQ, duplo acesso...), impressão de treino e agendamento.
//
// Liberações manuais ("Manual Entry"): além de contarem como entrada, são contadas à parte com o motivo do bloqueio
// que a mesma pessoa levou na mesma unidade até 30 min antes (a catraca barra e a recepção libera; em 09/11/2026 a
// liberação veio 23 s depois do bloqueio na mediana e no máximo ~18 min). Quem liberou e o motivo digitado na
// liberação NÃO saem pela API (o EVO confirmou em 11/11/2026: só na tela Controle de entradas).
import { evoGet } from "./evo.js";
import { UNIT_NAMES } from "./units.js";

const PAGE = 10000;

export const ehEntrada = (e) => e.entryType === "Controle de acesso" && (e.entryAction === "entry" || e.entryAction === "Manual Entry");

/** Acumulador vazio de uma unidade para um mês de `dias` dias. */
const novo = (dias) => ({ calor: Array(7 * 24).fill(0), entradasDia: Array(dias).fill(0), _pessoas: new Set(), liberacoes: 0, _motivos: {} });

export const SEM_BLOQUEIO = "Sem bloqueio antes";
const JANELA_MS = 30 * 60 * 1000;

/** Motivo do bloqueio do EVO em poucas palavras (os textos variam: "Duplo acesso. aguarde. ", "PARQ pendente atestado"...). */
export function motivoDoBloqueio(texto) {
  const t = String(texto ?? "").trim();
  if (/parq|par-q/i.test(t)) return "PAR-Q pendente";
  if (/saldo devedor|d[eé]bito|inadimpl/i.test(t)) return "Saldo devedor";
  if (/sem assinatura/i.test(t)) return "Contrato sem assinatura";
  if (/inativo/i.test(t)) return "Aluno inativo";
  if (/duplo acesso/i.test(t)) return "Duplo acesso";
  if (/n[aã]o permite acesso|catraca/i.test(t)) return "Catraca fora do plano";
  if (/bloqueado no cadastro/i.test(t)) return "Bloqueado no cadastro";
  if (/wellhub|gympass|totalpass|check-?in/i.test(t)) return "Agregador sem check-in";
  if (/personal|cref/i.test(t)) return "Personal irregular";
  if (/agendamento/i.test(t)) return "Sem agendamento";
  return t ? "Outros" : SEM_BLOQUEIO;
}

const quemEntrou = (e) => (e.idMember ? `m${e.idMember}` : e.idProspect ? `p${e.idProspect}` : null);
const instante = (e) => Date.parse(`${String(e.date ?? "").slice(0, 19)}Z`);

/**
 * Soma uma lista de registros no acumulador `por` (unidade → acumulador). A data vem no horário local da unidade
 * ("2026-11-06T18:42:10"): dia da semana (0 = domingo) e hora saem do próprio texto, sem fuso.
 * Passe os registros de um dia inteiro de uma vez: o motivo de cada liberação manual é procurado nos bloqueios da lista.
 */
export function acumularEntradas(por, registros, dias) {
  // Bloqueios por unidade + pessoa, para achar o que veio antes de cada liberação manual.
  const bloqueios = new Map();
  for (const e of registros) {
    if (e.entryType !== "Controle de acesso" || e.entryAction !== "Blocked") continue;
    const q = quemEntrou(e);
    if (!q) continue;
    const k = `${e.idBranch}|${q}`;
    if (!bloqueios.has(k)) bloqueios.set(k, []);
    bloqueios.get(k).push([instante(e), e.blockReason]);
  }
  for (const e of registros) {
    const nome = UNIT_NAMES[e.idBranch];
    if (!nome || !ehEntrada(e)) continue;
    const d = String(e.date ?? "");
    const [y, m, dd] = [Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10))];
    const h = Number(d.slice(11, 13));
    if (!y || !m || !dd || !(h >= 0 && h < 24)) continue;
    const u = (por[nome] ??= novo(dias));
    const sem = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
    u.calor[sem * 24 + h] += 1;
    if (dd <= u.entradasDia.length) u.entradasDia[dd - 1] += 1;
    const quem = quemEntrou(e);
    if (quem) u._pessoas.add(quem);
    if (e.entryAction === "Manual Entry") {
      const t = instante(e);
      let antes = null;
      for (const b of bloqueios.get(`${e.idBranch}|${quem}`) ?? []) if (b[0] <= t && t - b[0] <= JANELA_MS && (!antes || b[0] > antes[0])) antes = b;
      const motivo = antes ? motivoDoBloqueio(antes[1]) : SEM_BLOQUEIO;
      u.liberacoes += 1;
      u._motivos[motivo] = (u._motivos[motivo] ?? 0) + 1;
    }
  }
  return por;
}

/** Fecha o acumulador: total de entradas e pessoas diferentes (sem guardar quem). */
export function fecharEntradas(por) {
  const out = {};
  for (const [nome, u] of Object.entries(por)) {
    out[nome] = {
      calor: u.calor, entradasDia: u.entradasDia, entradas: u.calor.reduce((s, n) => s + n, 0), frequentadores: u._pessoas.size,
      liberacoes: u.liberacoes, liberacoesMotivos: Object.entries(u._motivos).sort((a, b) => b[1] - a[1]),
    };
  }
  return out;
}

/** Entradas de um mês, do dia 1 até `ate` (AAAA-MM-DD; no mês corrente, hoje). Lê dia a dia. */
export async function entradasDoMes(ym, ate) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const fim = ate && ate.slice(0, 7) === ym ? Number(ate.slice(8, 10)) : ultimo;
  const por = {};
  for (let d = 1; d <= fim; d++) {
    const dia = `${ym}-${String(d).padStart(2, "0")}`;
    const doDia = [];
    for (let skip = 0; ; skip += PAGE) {
      const rows = await evoGet(`/api/v1/entries?registerDateStart=${dia}T00:00:00&registerDateEnd=${dia}T23:59:59&take=${PAGE}&skip=${skip}`);
      for (const r of rows) doDia.push(r);
      if (rows.length < PAGE) break;
    }
    acumularEntradas(por, doDia, fim);
  }
  return fecharEntradas(por);
}
