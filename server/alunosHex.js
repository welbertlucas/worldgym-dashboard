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

// ---------- CEP que não está na tabela: posição pela região do CEP (prefixo) ----------
// O CNEFE de 2022 não tem todos os CEPs (CEP criado depois, de empresa ou de loteamento novo). CEP vizinho tem o mesmo começo: o CEP 72010-123 fica perto
// do 72010-456. Quando o CEP do aluno não está na tabela, usa a posição mediana dos CEPs que começam igual (7, 6 e depois 5 dígitos), só se esses
// CEPs são próximos entre si (90% a até P90_MAX_KM da mediana). Teste com 1/3 dos CEPs do DF escondidos: 98% recuperados, erro mediano de 140 m e p90 de 470 m.
export const NIVEIS_PREFIXO = [7, 6, 5];
const medianaPonderada = (v, eixo) => {
  const s = v.map((x) => [x[eixo], x[2] || 1]).sort((a, b) => a[0] - b[0]);
  const tot = s.reduce((a, b) => a + b[1], 0);
  let acc = 0;
  for (const [x, w] of s) { acc += w; if (acc >= tot / 2) return x; }
  return s[s.length - 1][0];
};
const cachePrefixos = new WeakMap();
/** Posição de cada prefixo de CEP: Map por nível -> Map(prefixo -> [lat, lng]). Só prefixos cujos CEPs são próximos entre si. */
export function indiceDePrefixos(tabelas) {
  const feito = cachePrefixos.get(tabelas);
  if (feito) return feito;
  const grupos = NIVEIS_PREFIXO.map(() => new Map());
  for (const t of Object.values(tabelas)) {
    for (const [cep, v] of Object.entries(t.ceps)) {
      if (!(v[3] <= P90_MAX_KM)) continue;
      NIVEIS_PREFIXO.forEach((n, i) => { const k = cep.slice(0, n); (grupos[i].get(k) ?? grupos[i].set(k, []).get(k)).push(v); });
    }
  }
  const out = grupos.map((g) => {
    const m = new Map();
    for (const [k, v] of g) {
      const c = [medianaPonderada(v, 0), medianaPonderada(v, 1)];
      const d = v.map((x) => km(c, [x[0], x[1]])).sort((a, b) => a - b);
      if (d[Math.ceil(0.9 * (d.length - 1))] <= P90_MAX_KM) m.set(k, c); // arredonda para cima: com 2 CEPs distantes o grupo não passa
    }
    return m;
  });
  cachePrefixos.set(tabelas, out);
  return out;
}
/** Posição de um CEP que não está na tabela, pelo prefixo mais longo que tem CEPs próximos entre si; null se nenhum serve. */
export function posicaoPorPrefixo(cep, tabelas) {
  const idx = indiceDePrefixos(tabelas);
  for (let i = 0; i < NIVEIS_PREFIXO.length; i++) { const c = idx[i].get(cep.slice(0, NIVEIS_PREFIXO[i])); if (c) return c; }
  return null;
}

/**
 * Conta os alunos (já filtrados: só ativos) por hexágono. `tabelas` = { UF: tabela de CEPs }. Devolve `celulas` ([lat, lng, alunos], na malha do Censo,
 * para a tela não depender da ordem do arquivo do Censo) e os totais de controle (só números).
 */
export function contarAlunosPorHexagono(membros, tabelas, indice) {
  const lista = Object.values(tabelas);
  const conta = new Map();
  const r = { total: membros.length, semCep: 0, foraDaTabela: 0, baixaPrecisao: 0, semHexagono: 0, comPosicao: 0, porPrefixo: 0 };
  for (const m of membros) {
    const cep = normalizarCep(m.zipCode);
    if (!cep) { r.semCep++; continue; }
    const v = lista.map((t) => t.ceps[cep]).find(Boolean);
    let pos = null, porPrefixo = false;
    if (!v) { pos = posicaoPorPrefixo(cep, tabelas); porPrefixo = !!pos; if (!pos) { r.foraDaTabela++; continue; } }
    else if (v[3] > P90_MAX_KM) { r.baixaPrecisao++; continue; }
    else pos = [v[0], v[1]];
    const i = hexagonoMaisPerto(indice, pos[0], pos[1]);
    if (i < 0) { r.semHexagono++; continue; }
    conta.set(i, (conta.get(i) ?? 0) + 1);
    r.comPosicao++;
    if (porPrefixo) r.porPrefixo++;
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
