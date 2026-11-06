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
