// Foto de hoje de onde moram os alunos ativos, por bairro (só contagens), gravada no mês corrente.
// Uso: node --env-file=.env.local scripts/evo-bairros.mjs
import { hojeBR } from "../server/evo.js";
import { bairrosDaUnidade, chaveBairro, coordenadasDoBairro } from "../server/bairros.js";
import { UNIDADES } from "../server/ativos.js";
import { loadGeo, loadMonth, saveGeo, saveMonth } from "../server/store.js";

const hoje = hojeBR();
const ym = hoje.slice(0, 7);
const blob = await loadMonth(ym);
if (!blob) throw new Error(`Mês ${ym} ainda não foi calculado; rode evo-backfill antes.`);
const geo = await loadGeo();
for (const [id, nome] of Object.entries(UNIDADES)) {
  const u = blob.units.find((x) => x.name === nome);
  if (!u) continue;
  const { lista, semBairro } = await bairrosDaUnidade(Number(id), hoje);
  const bairros = [];
  for (const b of lista) {
    const k = chaveBairro(b.bairro, b.cidade);
    if (!(k in geo)) { geo[k] = await coordenadasDoBairro(b); await saveGeo(geo); }
    if (geo[k]) bairros.push([b.bairro, b.cidade, b.n, geo[k][0], geo[k][1]]);
  }
  u.bairros = bairros;
  u.semBairro = semBairro + lista.filter((b) => !geo[chaveBairro(b.bairro, b.cidade)]).reduce((s, b) => s + b.n, 0);
  console.log(nome, bairros.length, "bairros", u.semBairro, "sem localização");
}
blob.bairrosEm = new Date().toISOString();
await saveMonth(blob);
console.log(`Gravado: ${ym}`);
