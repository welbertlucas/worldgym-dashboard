// Foto de hoje da situação dos treinos (ativo, vencido, começa no futuro), gravada no mês corrente.
// A rota só mostra o estado atual, então o histórico se forma dia a dia a partir daqui.
// Uso: node --env-file=.env.local scripts/evo-treinos.mjs
import { hojeBR } from "../server/evo.js";
import { treinosDaUnidade } from "../server/treinos.js";
import { UNIDADES } from "../server/ativos.js";
import { loadMonth, saveMonth } from "../server/store.js";

const ym = hojeBR().slice(0, 7);
const blob = await loadMonth(ym);
if (!blob) throw new Error(`Mês ${ym} ainda não foi calculado; rode evo-backfill antes.`);
for (const [id, nome] of Object.entries(UNIDADES)) {
  const u = blob.units.find((x) => x.name === nome);
  if (!u) continue;
  Object.assign(u, await treinosDaUnidade(Number(id)));
  console.log(nome, u.treinoAtivo, u.treinoVencido, u.treinoFuturo);
}
blob.treinosEm = new Date().toISOString();
await saveMonth(blob);
console.log(`Gravado: ${ym}`);
