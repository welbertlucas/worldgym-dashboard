// Público do Meta em volta de cada unidade: quem mora (home) x quem esteve recentemente (recent), em 1 e 2 km.
// Só leitura (estimativa de alcance); nenhum anúncio é criado. O resultado vai para o Blob privado (estudos/meta-fluxo.json),
// nunca para o log: o repositório é público. Roda à mão pelo workflow "Fluxo do Meta nas unidades".
import { put } from "@vercel/blob";
import { COORDENADAS_UNIDADES, UNIT_NAMES } from "../server/units.js";

const TOKEN = process.env.META_TOKEN_DFGO;
if (!TOKEN) throw new Error("META_TOKEN_DFGO ausente.");
const VERSAO = process.env.META_API_VERSION || "v24.0";
const CONTA = "act_264340275445545"; // qualquer conta do portfólio DF&GO serve para a estimativa

async function estimar([lat, lng], km, tipo) {
  const spec = { geo_locations: { custom_locations: [{ latitude: lat, longitude: lng, radius: km, distance_unit: "kilometer" }], location_types: [tipo] }, age_min: 18 };
  const url = `https://graph.facebook.com/${VERSAO}/${CONTA}/reachestimate?targeting_spec=${encodeURIComponent(JSON.stringify(spec))}`;
  const j = await (await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  if (j.error) return { erro: `${j.error.code ?? ""} ${j.error.message ?? ""}`.slice(0, 160) };
  const d = j.data ?? j;
  return { min: d.users_lower_bound ?? null, max: d.users_upper_bound ?? null };
}

const unidades = [];
let erros = 0;
for (const [id, nome] of Object.entries(UNIT_NAMES)) {
  const c = COORDENADAS_UNIDADES[id];
  if (!c) continue;
  const r = { id: Number(id), nome };
  for (const km of [1, 2]) for (const tipo of ["home", "recent"]) {
    r[`${tipo}${km}`] = await estimar(c, km, tipo);
    if (r[`${tipo}${km}`].erro) erros++;
    await new Promise((s) => setTimeout(s, 800));
  }
  unidades.push(r);
}
await put("estudos/meta-fluxo.json", JSON.stringify({ em: new Date().toISOString(), unidades }), {
  access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
});
console.log(`${unidades.length} unidades consultadas, ${erros} consultas com erro. Resultado no Blob (estudos/meta-fluxo.json).`);
