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
