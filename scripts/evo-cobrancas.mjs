// Grava por unidade, nos meses indicados: `cobrancas` (títulos que falharam no vencimento: recuperados e em aberto)
// e `recusaMotivos` (motivo da última recusa do cartão).
// Uso: node --env-file=.env.local scripts/evo-cobrancas.mjs 2026-10 2026-11
import { hojeBR } from "../server/evo.js";
import { devedoresDaUnidade } from "../server/cobrancas.js";
import { UNIDADES } from "../server/ativos.js";
import { loadMonth, saveMonth } from "../server/store.js";

const hoje = hojeBR();
const falhas = [];
for (const ym of process.argv.slice(2)) {
  try {
    const blob = await loadMonth(ym);
    if (!blob) throw new Error("mês ainda não foi calculado; rode evo-backfill antes");
    let n = 0;
    for (const [id, nome] of Object.entries(UNIDADES)) {
      const u = blob.units.find((x) => x.name === nome);
      if (!u) continue;
      const { motivos, ...resumo } = await devedoresDaUnidade(Number(id), ym, hoje);
      u.cobrancas = resumo;
      u.recusaMotivos = motivos;
      n++;
    }
    blob.cobrancasEm = new Date().toISOString();
    await saveMonth(blob);
    console.log(`${ym}: ${n} unidades`);
  } catch (e) {
    console.log(`${ym}: FALHOU — ${e.message}`);
    falhas.push(ym);
  }
}
if (falhas.length) { console.log(`Meses com falha: ${falhas.join(" ")}`); process.exitCode = 1; }
