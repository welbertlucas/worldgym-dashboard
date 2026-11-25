// Alunos ativos por hexágono do Censo, a partir do CEP (Estudos de ponto, camada "Base de clientes"; 25/11/2026).
// A tabela CEP -> posição de cada estado vem do CNEFE 2022 do IBGE (scripts/cep-posicoes.py, gravada em estudos/cep/<UF>.json). A rotina noturna dos
// alunos (scripts/evo-alunos.mjs) põe cada aluno ativo no hexágono do Censo mais perto da posição do CEP dele e grava SÓ A CONTAGEM por hexágono
// (estudos/alunos-hex/<id>.json). Nenhum CEP, nome ou endereço de aluno é guardado ou impresso.
import { lerJson } from "./armazem.js";
import { UNIT_NAMES } from "./units.js";

export const arquivoCep = (uf) => `estudos/cep/${String(uf).toUpperCase()}.json`;
export const arquivoAlunosHex = (id) => `estudos/alunos-hex/${id}.json`;
/** Posição de CEP com espalhamento (raio de 90% dos endereços) acima disto é CEP rural ou de estrada longa: não vai para o mapa. */
export const P90_MAX_KM = 1;
/** Hexágono mais longe que isto da posição do CEP não recebe o aluno. */
export const RAIO_HEXAGONO_KM = 0.25;

export const normalizarCep = (v) => { const s = String(v ?? "").replace(/\D/g, ""); return s.length === 8 ? s : ""; };

export function tabelaCepValida(t) {
  if (!t || typeof t.uf !== "string" || !/^[A-Z]{2}$/.test(t.uf) || !t.ceps || typeof t.ceps !== "object") return false;
  const amostra = Object.entries(t.ceps).slice(0, 50);
  return amostra.length > 0 && amostra.every(([cep, v]) => /^\d{8}$/.test(cep) && Array.isArray(v) && v.length >= 4 && Number.isFinite(v[0]) && Number.isFinite(v[1]));
}

const km = (a, b) => Math.hypot((a[0] - b[0]) * 110.6, (a[1] - b[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180));
const PASSO = 0.004; // ~440 m: o balde é maior que o raio de busca, então basta olhar o balde e os vizinhos
const balde = (la, ln) => `${Math.floor(la / PASSO)},${Math.floor(ln / PASSO)}`;

/** Índice espacial dos hexágonos do Censo (só os com moradores) para achar o mais perto de uma posição. */
export function indiceDeHexagonos(celulas) {
  const idx = new Map();
  celulas.forEach((c, i) => { if (!c[2]) return; const k = balde(c[0], c[1]); (idx.get(k) ?? idx.set(k, []).get(k)).push(i); });
  return { celulas, idx };
}
export function hexagonoMaisPerto({ celulas, idx }, la, ln, raioKm = RAIO_HEXAGONO_KM) {
  const [bi, bj] = [Math.floor(la / PASSO), Math.floor(ln / PASSO)];
  let melhor = -1, dMin = raioKm;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const i of idx.get(`${bi + di},${bj + dj}`) ?? []) {
    const d = km([la, ln], [celulas[i][0], celulas[i][1]]);
    if (d < dMin) { dMin = d; melhor = i; }
  }
  return melhor;
}

/**
 * Conta os alunos (já filtrados: só ativos) por hexágono. `tabelas` = { UF: tabela de CEPs }. Devolve `celulas` ([lat, lng, alunos], na malha do Censo,
 * para a tela não depender da ordem do arquivo do Censo) e os totais de controle (só números).
 */
export function contarAlunosPorHexagono(membros, tabelas, indice) {
  const lista = Object.values(tabelas);
  const conta = new Map();
  const r = { total: membros.length, semCep: 0, foraDaTabela: 0, baixaPrecisao: 0, semHexagono: 0, comPosicao: 0 };
  for (const m of membros) {
    const cep = normalizarCep(m.zipCode);
    if (!cep) { r.semCep++; continue; }
    const v = lista.map((t) => t.ceps[cep]).find(Boolean);
    if (!v) { r.foraDaTabela++; continue; }
    if (v[3] > P90_MAX_KM) { r.baixaPrecisao++; continue; }
    const i = hexagonoMaisPerto(indice, v[0], v[1]);
    if (i < 0) { r.semHexagono++; continue; }
    conta.set(i, (conta.get(i) ?? 0) + 1);
    r.comPosicao++;
  }
  const celulas = [...conta.entries()].map(([i, n]) => [indice.celulas[i][0], indice.celulas[i][1], n]).sort((a, b) => b[2] - a[2]);
  return { ...r, celulas };
}

/** Carrega do Blob as tabelas de CEP dos estados pedidos (as que não existem ficam de fora). */
export async function lerTabelasCep(ufs) {
  const out = {};
  for (const uf of ufs) { const t = await lerJson(arquivoCep(uf)); if (tabelaCepValida(t)) out[uf] = t; }
  return out;
}

/** Contagem gravada de uma unidade, pelo nome. `permitido(nome)` diz se quem pede pode ver a unidade (modo unidade: só as próprias). */
export async function lerAlunosHex(nome, permitido = () => true) {
  const id = Object.entries(UNIT_NAMES).find(([, n]) => n === nome)?.[0];
  if (!id || !permitido(nome)) return null;
  const d = await lerJson(arquivoAlunosHex(id));
  return d && Array.isArray(d.celulas) ? d : null;
}
