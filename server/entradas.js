// Entradas na catraca (EVO /api/v1/entries), resumidas por unidade: mapa de calor dia da semana × hora,
// entradas por dia do mês e quantas pessoas diferentes vieram. Só contagens: ninguém é identificado no que é gravado
// (o id do aluno só existe em memória, para contar pessoas diferentes).
//
// A rota devolve TODAS as unidades (o idBranch é ignorado) e aceita páginas de 10 mil registros: um dia de pico tem
// ~150 mil registros na rede, então o mês inteiro sai em poucas centenas de chamadas.
// Conta como entrada: "Controle de acesso" com ação de entrada (catraca, teclado, app ou liberação manual).
// Fica de fora: saída (output), bloqueios (débito, PARQ, duplo acesso...), impressão de treino e agendamento.
import { evoGet } from "./evo.js";
import { UNIT_NAMES } from "./units.js";

const PAGE = 10000;

export const ehEntrada = (e) => e.entryType === "Controle de acesso" && (e.entryAction === "entry" || e.entryAction === "Manual Entry");

/** Acumulador vazio de uma unidade para um mês de `dias` dias. */
const novo = (dias) => ({ calor: Array(7 * 24).fill(0), entradasDia: Array(dias).fill(0), _pessoas: new Set() });

/**
 * Soma uma lista de registros no acumulador `por` (unidade → acumulador). A data vem no horário local da unidade
 * ("2026-11-06T18:42:10"): dia da semana (0 = domingo) e hora saem do próprio texto, sem fuso.
 */
export function acumularEntradas(por, registros, dias) {
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
    const quem = e.idMember ? `m${e.idMember}` : e.idProspect ? `p${e.idProspect}` : null;
    if (quem) u._pessoas.add(quem);
  }
  return por;
}

/** Fecha o acumulador: total de entradas e pessoas diferentes (sem guardar quem). */
export function fecharEntradas(por) {
  const out = {};
  for (const [nome, u] of Object.entries(por)) {
    out[nome] = { calor: u.calor, entradasDia: u.entradasDia, entradas: u.calor.reduce((s, n) => s + n, 0), frequentadores: u._pessoas.size };
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
    for (let skip = 0; ; skip += PAGE) {
      const rows = await evoGet(`/api/v1/entries?registerDateStart=${dia}T00:00:00&registerDateEnd=${dia}T23:59:59&take=${PAGE}&skip=${skip}`);
      acumularEntradas(por, rows, fim);
      if (rows.length < PAGE) break;
    }
  }
  return fecharEntradas(por);
}
