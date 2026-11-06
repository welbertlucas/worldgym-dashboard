// Grava por unidade, nos meses já calculados: `oportunidades` (cadastrados) e `conversoes` (convertidos no mês).
// Uso: node --env-file=.env.local scripts/evo-prospects.mjs 2026-10 2026-11
import { hojeBR } from "../server/evo.js";
import { prospectsDoMes } from "../server/prospects.js";
import { UNIT_NAMES } from "../server/units.js";
import { loadMonth, saveMonth } from "../server/store.js";

const hoje = hojeBR();
const falhas = [];
for (const ym of process.argv.slice(2)) {
  try {
    const blob = await loadMonth(ym);
    if (!blob) throw new Error("mês ainda não foi calculado; rode evo-backfill antes");
    const por = await prospectsDoMes(ym, hoje);
    let n = 0;
    for (const u of blob.units) {
      const a = por[u.name];
      if (!a || !Object.values(UNIT_NAMES).includes(u.name)) continue;
      u.oportunidades = a.oportunidades; u.conversoes = a.conversoes; n++;
    }
    blob.prospectsEm = new Date().toISOString();
    await saveMonth(blob);
    console.log(`${ym}: ${n} unidades`);
  } catch (e) {
    console.log(`${ym}: FALHOU — ${e.message}`);
    falhas.push(ym);
  }
}
if (falhas.length) { console.log(`Meses com falha: ${falhas.join(" ")}`); process.exitCode = 1; }
