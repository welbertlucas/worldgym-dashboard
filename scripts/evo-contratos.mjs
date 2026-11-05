// Atualiza, no mês corrente já gravado, a contagem de contratos ativos / especiais / personal.
// Uso: node --env-file=.env.local scripts/evo-contratos.mjs [AAAA-MM]
import { contratosTodas } from "../server/contratos.js";
import { loadMonth, saveMonth } from "../server/store.js";

const ym = process.argv[2] ?? new Date().toISOString().slice(0, 7);
const month = await loadMonth(ym);
if (!month) throw new Error(`Mês ${ym} ainda não foi calculado; rode evo-backfill antes.`);
const por = await contratosTodas((n, r) => console.log(n, JSON.stringify(r)));
for (const u of month.units) if (por[u.name]) Object.assign(u, por[u.name]);
month.contratosEm = new Date().toISOString();
await saveMonth(month);
console.log(`${ym}: contratos gravados para ${month.units.filter((u) => por[u.name]).length} unidades`);
