// Armazenamento dos totais mensais (Vercel Blob privado, um arquivo por mês).
import { put, get, list, del } from "@vercel/blob";

const path = (ym) => `indicadores/${ym}.json`;

export async function saveMonth(data) {
  await put(path(data.month), JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function loadMonth(ym) {
  const r = await get(path(ym), { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export async function listMonths() {
  const { blobs } = await list({ prefix: "indicadores/" });
  return blobs.map((b) => b.pathname.replace(/^indicadores\//, "").replace(/\.json$/, "")).sort();
}

// Cache das coordenadas dos bairros (chave "BAIRRO|CIDADE" -> [lat, lng] ou null se não achou).
const geoPath = "geo/bairros.json";

export async function loadGeo() {
  const r = await get(geoPath, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return {};
  return JSON.parse(await new Response(r.stream).text());
}

export async function saveGeo(cache) {
  await put(geoPath, JSON.stringify(cache), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
}

// Todos os meses num único arquivo: o painel lê 1 arquivo em vez de 1 listagem + ~36 leituras (o Blob cobra por operação).
const allPath = "consolidado/todos.json";

export async function saveAll(meses) {
  await put(allPath, JSON.stringify(meses), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
}

export async function loadAll() {
  const r = await get(allPath, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

// Campanhas de anúncio ativas (Meta), uma foto por dia: o painel lê só este arquivo.
const campanhasPath = "campanhas/atual.json";

export async function saveCampanhas(dados) {
  await put(campanhasPath, JSON.stringify(dados), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
}

export async function loadCampanhas() {
  const r = await get(campanhasPath, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

// Investimento e resultados do Meta por unidade e mês (todas as campanhas): { [AAAA-MM]: { geradoEm, unidades, erros } }.
const metaMesesPath = "campanhas/meses.json";

export async function loadMetaMeses() {
  const r = await get(metaMesesPath, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

/** Junta os meses novos aos já gravados (os outros meses ficam como estavam). */
export async function saveMetaMeses(novos) {
  const tudo = { ...((await loadMetaMeses()) ?? {}), ...novos };
  await put(metaMesesPath, JSON.stringify(tudo), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
  return tudo;
}

// Instagram das unidades: um arquivo com perfis, posts, stories e seguidores por dia (scripts/instagram-sync.mjs),
// e uma imagem pequena por post/story em instagram/midia/<id>.jpg (o link do Meta vence; a cópia fica).
const instagramPath = "instagram/dados.json";
const midiaPath = (id) => `instagram/midia/${id}.jpg`;

export async function loadInstagram() {
  const r = await get(instagramPath, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export async function saveInstagram(dados) {
  await put(instagramPath, JSON.stringify(dados), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
}

export async function saveMidiaInstagram(id, jpeg) {
  await put(midiaPath(id), jpeg, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
}

/** Stream da imagem guardada (ou null). */
export async function loadMidiaInstagram(id) {
  const r = await get(midiaPath(id), { access: "private" });
  return r && r.statusCode === 200 ? r.stream : null;
}

export async function apagarMidiasInstagram(ids) {
  if (ids.length) await del(ids.map(midiaPath));
}
