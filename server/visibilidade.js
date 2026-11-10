// O que cada nível enxerga. Tudo é decidido AQUI, no servidor: esconder só na tela não protegeria nada,
// porque quem abre o navegador por dentro veria a resposta completa.
//
// Nível "unidades": as unidades dele vêm completas; as outras viram "Unidade 07" (só os números do benchmark).
// O rótulo depende só do nome e de um segredo do servidor, então é o mesmo na planilha, no EVO e nas metas.
import { createHmac } from "node:crypto";
import { UNIT_NAMES } from "./units.js";

const NOMES = Object.values(UNIT_NAMES);
const TOTAIS = new Set(["TOTAL", "REDE"]);

export const veTudo = (sessao) => sessao.papel !== "unidades";
const propria = (sessao, nome) => (sessao.unidades ?? []).includes(String(nome ?? "").trim());
const ehTotal = (nome) => TOTAIS.has(String(nome ?? "").trim().toUpperCase());

const chaveAnon = () => process.env.SESSAO_SEGREDO || process.env.DASHBOARD_PASSWORD || "";
const hash = (chave, nome) => createHmac("sha256", chave).update(`anon|${nome}`).digest("hex");

let ordemMemo = null;
function ordem() {
  const chave = chaveAnon();
  if (ordemMemo?.chave === chave) return ordemMemo.lista;
  // A numeração segue a ordem de um hash com segredo: não revela a ordem alfabética nem a do cadastro.
  const lista = [...NOMES].sort((a, b) => hash(chave, a).localeCompare(hash(chave, b)));
  ordemMemo = { chave, lista };
  return lista;
}

/** "Unidade 07": nome escondido de uma unidade. */
export function rotulo(nome) {
  const n = String(nome ?? "").trim();
  const i = ordem().indexOf(n);
  if (i >= 0) return `Unidade ${String(i + 1).padStart(2, "0")}`;
  return `Unidade ${hash(chaveAnon(), n).slice(0, 4).toUpperCase()}`; // nome fora da tabela: código curto
}

// Campos que identificam a unidade sem usar o nome: número no EVO, nome original, coordenadas e bairros dos alunos.
const IDENTIFICAM = new Set(["idBranch", "evoName", "latitude", "longitude", "local", "bairros", "semBairro", "bairrosInativos", "semBairroInativos"]);

/** Unidade de outra pessoa: só números, com o nome trocado. Qualquer texto solto sai (podia ser o nome verdadeiro). */
export function esconderUnidade(u) {
  const saida = {};
  for (const [k, v] of Object.entries(u)) {
    if (IDENTIFICAM.has(k) || typeof v === "string") continue;
    saida[k] = v;
  }
  saida.name = rotulo(u.name);
  return saida;
}

/** Um mês do EVO: unidades da pessoa completas, as outras escondidas. */
export function filtrarMes(mes, sessao) {
  if (veTudo(sessao) || !mes) return mes;
  return { ...mes, units: (mes.units ?? []).map((u) => (propria(sessao, u.name) ? u : esconderUnidade(u))) };
}

export const filtrarMeses = (meses, sessao) => (veTudo(sessao) ? meses : meses.map((m) => filtrarMes(m, sessao)));

const indiceDaColuna = (cabecalho, ...nomes) => cabecalho.findIndex((c) => nomes.includes(String(c ?? "").trim().toLowerCase()));

/** Linhas da planilha principal (cabeçalho + dados): troca o nome das unidades de outras pessoas. */
export function filtrarLinhasPlanilha(linhas, sessao) {
  if (veTudo(sessao) || linhas.length < 2) return linhas;
  const i = indiceDaColuna(linhas[0], "unidade");
  if (i < 0) return [linhas[0]]; // formato desconhecido: não arrisca mostrar nada
  return [linhas[0], ...linhas.slice(1).map((l) => {
    const nome = l[i];
    if (!nome || ehTotal(nome) || propria(sessao, nome)) return l;
    const c = [...l];
    c[i] = rotulo(nome);
    return c;
  })];
}

/** Aba Metas: só as metas da rede e das unidades da pessoa. */
export function filtrarLinhasMetas(linhas, sessao) {
  if (veTudo(sessao) || linhas.length < 2) return linhas;
  const i = indiceDaColuna(linhas[0], "unidade");
  if (i < 0) return [linhas[0]];
  return [linhas[0], ...linhas.slice(1).filter((l) => ehTotal(l[i]) || propria(sessao, l[i]))];
}

/** Campanhas (Meta): só as das unidades da pessoa; sem as da rede toda e sem os erros (citam contas). Vale também para os meses. */
export function filtrarCampanhas(foto, sessao) {
  if (veTudo(sessao) || !foto) return foto;
  const meses = Object.fromEntries(Object.entries(foto.meses ?? {}).map(([ym, m]) => [ym, {
    ...m, erros: [], unidades: Object.fromEntries(Object.entries(m.unidades ?? {}).filter(([u]) => propria(sessao, u))),
  }]));
  return { ...foto, campanhas: (foto.campanhas ?? []).filter((c) => c.unidade && propria(sessao, c.unidade)), erros: [], meses };
}
