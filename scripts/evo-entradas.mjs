// Grava nos meses já calculados as entradas na catraca por unidade: mapa de calor (dia da semana × hora), liberações manuais,
// entradas por dia e pessoas diferentes que vieram; com o mapa de origem da etapa dos alunos, quem treinou em outra unidade.
// Só contagens.
// Uso: node --env-file=.env.local scripts/evo-entradas.mjs 2026-10 2026-11
import { hojeBR } from "../server/evo.js";
import { entradasDoMes } from "../server/entradas.js";
import { loadMonth, saveMonth } from "../server/store.js";
import { lerMapa } from "../server/origem.js";

const hoje = hojeBR();
const origem = lerMapa();
console.log(origem ? `Mapa de origem: ${origem.size.toLocaleString("pt-BR")} alunos` : "Sem mapa de origem: alunos de outras unidades ficam de fora");
const falhas = [];
for (const ym of process.argv.slice(2)) {
  const t0 = Date.now();
  try {
    const month = await loadMonth(ym);
    if (!month) throw new Error("mês ainda não foi calculado; rode evo-backfill antes");
    const por = await entradasDoMes(ym, hoje, origem);
    for (const u of month.units) if (por[u.name]) Object.assign(u, por[u.name]);
    month.entradasEm = new Date().toISOString();
    await saveMonth(month);
    const total = Object.values(por).reduce((s, u) => s + u.entradas, 0);
    console.log(`${ym}: ${Object.keys(por).length} unidades, ${total.toLocaleString("pt-BR")} entradas | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } catch (e) {
    console.log(`${ym}: FALHOU — ${e.message}`);
    falhas.push(ym);
  }
}
if (falhas.length) { console.log(`Meses com falha: ${falhas.join(" ")}`); process.exitCode = 1; }
