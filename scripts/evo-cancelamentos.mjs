// Grava por unidade, nos meses já calculados: `motivosCancel` (alunos que cancelaram, por motivo).
// Uso: node --env-file=.env.local scripts/evo-cancelamentos.mjs 2026-10 2026-11
import { hojeBR } from "../server/evo.js";
import { motivosDoMes } from "../server/cancelamentos.js";
import { UNIDADES } from "../server/ativos.js";
import { loadMonth, saveMonth } from "../server/store.js";

const hoje = hojeBR();
const falhas = [];
for (const ym of process.argv.slice(2)) {
  try {
    const blob = await loadMonth(ym);
    if (!blob) throw new Error("mês ainda não foi calculado; rode evo-backfill antes");
    const por = await motivosDoMes(ym, hoje);
    let n = 0;
    for (const u of blob.units) {
      if (!Object.values(UNIDADES).includes(u.name)) continue;
      u.motivosCancel = por[u.name] ?? {};
      n++;
    }
    blob.cancelEm = new Date().toISOString();
    await saveMonth(blob);
    console.log(`${ym}: ${n} unidades`);
  } catch (e) {
    console.log(`${ym}: FALHOU — ${e.message}`);
    falhas.push(ym);
  }
}
if (falhas.length) { console.log(`Meses com falha: ${falhas.join(" ")}`); process.exitCode = 1; }
