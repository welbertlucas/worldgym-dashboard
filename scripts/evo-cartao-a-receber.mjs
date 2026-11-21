// Grava por unidade, no mês em andamento, o cartão de crédito já cobrado que ainda vai cair na conta, por dia (a tela de Recebimento mostra o calendário).
// Só o mês atual importa (nos fechados tudo já caiu); os outros meses pedidos são ignorados.
// Uso: node --env-file=.env.local scripts/evo-cartao-a-receber.mjs 2026-11
import { UNIT_NAMES } from "../server/units.js";
import { cartaoAReceberDoMes } from "../server/pagamentos.js";
import { hojeBR } from "../server/evo.js";
import { loadMonth, saveMonth } from "../server/store.js";

const atual = hojeBR().slice(0, 7);
const falhas = [];
for (const ym of process.argv.slice(2).filter((m) => m === atual)) {
  const t0 = Date.now();
  try {
    const month = await loadMonth(ym);
    if (!month) throw new Error("mês ainda não foi calculado; rode evo-backfill antes");
    let n = 0;
    for (const [id, nome] of Object.entries(UNIT_NAMES)) {
      const u = month.units.find((x) => x.name === nome);
      if (!u) continue;
      u.cartaoAReceber = await cartaoAReceberDoMes(id, ym);
      n++;
    }
    await saveMonth(month);
    console.log(`${ym}: ${n} unidades | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } catch (e) {
    console.log(`${ym}: FALHOU — ${e.message}`);
    falhas.push(ym);
  }
}
if (falhas.length) { console.log(`Meses com falha: ${falhas.join(" ")}`); process.exitCode = 1; }
