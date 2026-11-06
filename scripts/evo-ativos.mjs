// Grava `ativosFim` (alunos ativos no fim do mês) por unidade nos meses já calculados.
// Uso: node --env-file=.env.local scripts/evo-ativos.mjs 2026-10 2026-11
import { ativosDaUnidade, UNIDADES } from "../server/ativos.js";
import { hojeBR } from "../server/evo.js";
import { loadMonth, saveMonth } from "../server/store.js";

const meses = process.argv.slice(2);
if (!meses.length) throw new Error("Informe os meses AAAA-MM.");
const hoje = hojeBR();
const blobs = Object.fromEntries(await Promise.all(meses.map(async (ym) => [ym, await loadMonth(ym)])));
for (const ym of meses) if (!blobs[ym]) throw new Error(`Mês ${ym} ainda não foi calculado; rode evo-backfill antes.`);

for (const [id, nome] of Object.entries(UNIDADES)) {
  const por = await ativosDaUnidade(Number(id), meses, hoje);
  for (const ym of meses) {
    const u = blobs[ym].units.find((x) => x.name === nome);
    if (u) u.ativosFim = por[ym];
  }
  console.log(nome, JSON.stringify(por));
}
for (const ym of meses) {
  blobs[ym].ativosEm = new Date().toISOString();
  await saveMonth(blobs[ym]);
}
console.log(`Gravado: ${meses.join(", ")}`);
