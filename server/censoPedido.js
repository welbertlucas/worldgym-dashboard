// Pedido do Censo de um município de fora da malha (botão "Buscar o Censo desta cidade" dos Estudos de ponto). O servidor descobre o estado do
// ponto (Mapbox), grava o pedido num arquivo PRIVADO do Blob com um código aleatório e manda o GitHub rodar a rotina censo-municipio.yml só
// com esse código: o repositório é público e as páginas das rotinas também, então a posição do ponto e o nome da cidade não podem ir no
// pedido (estudo de ponto é estratégia comercial). A rotina lê o pedido pelo código (scripts/censo-municipio-pedido.mjs), baixa os dados
// públicos do IBGE, gera a malha do município que contém o ponto e grava no Blob (scripts/censo-municipio.py e censo-municipio-gravar.mjs).
// Variáveis (Vercel): GITHUB_DISPATCH_TOKEN (a mesma do despertador) e MAPBOX_TOKEN.
import { randomBytes } from "node:crypto";
import { apagarCaminho, gravarJson, lerJson } from "./armazem.js";
import { ARQUIVO_INDICE_CENSO_MUN, pertoDosBlocos } from "./censoMunicipio.js";

export const REPO = "welbertlucas/worldgym-dashboard";
export const WORKFLOW_CENSO = "censo-municipio.yml";
export const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
export const ehCodigoDePedido = (c) => typeof c === "string" && /^[0-9a-f]{20}$/.test(c);
export const arquivoDoPedido = (id) => `estudos/censo-mun/pedidos/${id}.json`;
const ARQUIVO_ANDAMENTO = "estudos/censo-mun/em-andamento.json";
/** Um pedido para a mesma área não se repete enquanto o anterior pode estar rodando (a rotina leva uns 10 a 15 minutos). */
export const VALIDADE_PEDIDO_MIN = 45;
const BLOCO = 0.1;

export class ErroCensoPedido extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

/** Sigla do estado onde está a posição, pelo Mapbox (geocodificação reversa). */
export async function ufDaPosicao(c, { chave = process.env.MAPBOX_TOKEN, fetcher = fetch } = {}) {
  if (!chave) throw new ErroCensoPedido("A busca do estado ainda não foi configurada no servidor.", 503);
  const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${c[1]}&latitude=${c[0]}&language=pt&limit=1&types=place,locality,district,region&access_token=${encodeURIComponent(chave)}`;
  let j;
  try { j = await (await fetcher(url)).json(); } catch { throw new ErroCensoPedido("O Mapbox não respondeu agora.", 502); }
  const p = j?.features?.[0]?.properties;
  const uf = String(p?.context?.region?.region_code ?? p?.region_code ?? p?.short_code ?? "").replace(/^BR-/, "").toUpperCase();
  if (!UFS.includes(uf)) throw new ErroCensoPedido("Não consegui descobrir o estado desta posição.", 502);
  return uf;
}

/**
 * Pede o Censo do município do ponto. Devolve { estado }:
 *  "pronto"        o Atlas já tem o Censo desta área (a tela só precisa buscar de novo);
 *  "em-andamento"  já há um pedido recente para esta área;
 *  "pedido"        o pedido foi enviado (leva uns 10 a 15 minutos).
 */
export async function pedirCenso(pedido, { fetcher = fetch, agora = Date.now(), token = process.env.GITHUB_DISPATCH_TOKEN, chaveMapbox, id = randomBytes(10).toString("hex") } = {}) {
  const c = Array.isArray(pedido?.c) ? pedido.c.map(Number) : [];
  if (c.length !== 2 || !c.every(Number.isFinite) || c[0] < -34 || c[0] > 6 || c[1] < -75 || c[1] > -32) throw new ErroCensoPedido("Posição inválida.");
  const indice = await lerJson(ARQUIVO_INDICE_CENSO_MUN);
  if ((indice?.municipios ?? []).some((m) => Array.isArray(m.blocos) && pertoDosBlocos(c, m.blocos))) return { estado: "pronto" };
  const bloco = `${Math.floor(c[0] / BLOCO)},${Math.floor(c[1] / BLOCO)}`;
  const andamento = Object.fromEntries(Object.entries((await lerJson(ARQUIVO_ANDAMENTO)) ?? {}).filter(([, v]) => agora - v.em < VALIDADE_PEDIDO_MIN * 60e3));
  if (andamento[bloco]) return { estado: "em-andamento", desde: andamento[bloco].em };
  if (!token) throw new ErroCensoPedido("O pedido automático ainda não foi configurado no servidor (falta a chave do GitHub).", 503);
  const uf = await ufDaPosicao(c, { chave: chaveMapbox, fetcher });
  await gravarJson(arquivoDoPedido(id), { uf, c, em: agora });
  const r = await fetcher(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_CENSO}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "worldgym-atlas-censo" },
    body: JSON.stringify({ ref: "main", inputs: { pedido: id, gravar: "true" } }),
  });
  if (!r.ok) {
    await apagarCaminho(arquivoDoPedido(id)).catch(() => {});
    throw new ErroCensoPedido(`O GitHub não aceitou o pedido (${r.status}).`, 502);
  }
  andamento[bloco] = { em: agora, uf };
  await gravarJson(ARQUIVO_ANDAMENTO, andamento);
  return { estado: "pedido", uf };
}
