// Armazenamento dos totais mensais (Vercel Blob privado, um arquivo por mês).
import { put, get, list } from "@vercel/blob";

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
