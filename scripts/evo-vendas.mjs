// Grava nos meses já calculados: novosContratos, vendasOnline, diarias, camisetas e coqueteleiras (vindos das vendas do EVO).
// Uso: node --env-file=.env.local scripts/evo-vendas.mjs 2026-10 2026-11
import { vendasDoMes } from "../server/vendas.js";
import { loadMonth, saveMonth } from "../server/store.js";

const falhas = [];
for (const ym of process.argv.slice(2)) {
  const t0 = Date.now();
  try {
    const month = await loadMonth(ym);
    if (!month) throw new Error("mês ainda não foi calculado; rode evo-backfill antes");
    const por = await vendasDoMes(ym);
    for (const u of month.units) if (por[u.name]) Object.assign(u, por[u.name]);
    month.vendasEm = new Date().toISOString();
    await saveMonth(month);
    console.log(`${ym}: ${month.units.filter((u) => por[u.name]).length} unidades | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } catch (e) {
    console.log(`${ym}: FALHOU — ${e.message}`);
    falhas.push(ym);
  }
}
if (falhas.length) { console.log(`Meses com falha: ${falhas.join(" ")}`); process.exitCode = 1; }
