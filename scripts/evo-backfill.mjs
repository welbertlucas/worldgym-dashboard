// Uso: node --env-file=.env.local scripts/evo-backfill.mjs 2026-09 [2026-10 ...]
// (EVO_DNS e EVO_TOKEN no ambiente; BLOB_READ_WRITE_TOKEN vem do .env.local)
import { computeMonth } from "../server/evo.js";
import { saveMonth } from "../server/store.js";

const falhas = [];
for (const ym of process.argv.slice(2)) {
  const t0 = Date.now();
  let data;
  try {
    data = await computeMonth(ym);
  } catch (e) {
    console.log(`${ym}: FALHOU — ${e.message}`);
    falhas.push(ym);
    continue;
  }
  await saveMonth(data);
  const fat = data.units.reduce((s, u) => s + u.faturamento, 0);
  const rec = data.units.reduce((s, u) => s + u.recebimento, 0);
  console.log(`${ym}: ${data.units.length} unidades | faturamento ${fat.toFixed(0)} | recebimento ${rec.toFixed(0)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

if (falhas.length) {
  console.log(`Meses com falha (rodar de novo): ${falhas.join(" ")}`);
  process.exitCode = 1;
}
