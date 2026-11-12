// Grava por unidade, nos meses pedidos, quanto foi recebido por forma de pagamento (cartão de crédito, débito, Pix...) e, no cartão, por bandeira e por gateway (adquirente);
// e as notas fiscais do mês, com quanto do recebido ganhou nota (server/notas.js), usando a mesma leitura dos recebimentos.
// Uso: node --env-file=.env.local scripts/evo-formas-pagamento.mjs 2026-10 2026-11
import { UNIT_NAMES } from "../server/units.js";
import { pagamentosDoMes } from "../server/pagamentos.js";
import { notasDoMes } from "../server/notas.js";
import { hojeBR } from "../server/evo.js";
import { loadMonth, saveMonth } from "../server/store.js";

const falhas = [];
const hoje = hojeBR();
for (const ym of process.argv.slice(2)) {
  const t0 = Date.now();
  try {
    const month = await loadMonth(ym);
    if (!month) throw new Error("mês ainda não foi calculado; rode evo-backfill antes");
    let n = 0;
    for (const [id, nome] of Object.entries(UNIT_NAMES)) {
      const u = month.units.find((x) => x.name === nome);
      if (!u) continue;
      const { formas, bandeiras, gateways, titulos } = await pagamentosDoMes(id, ym);
      u.formasPagamento = formas;
      u.bandeirasCartao = bandeiras;
      u.gatewaysCartao = gateways;
      // Notas fiscais: se a leitura falhar, as formas de pagamento seguem gravadas (a próxima noite tenta de novo).
      try {
        u.notas = await notasDoMes(id, ym, titulos, hoje);
      } catch (e) {
        console.log(`  ${nome}: notas fiscais com erro: ${e.message}`);
      }
      // Confere com o recebimento já gravado: a soma das formas deve dar o recebimento do mês.
      const soma = Object.values(u.formasPagamento).reduce((s, v) => s + v, 0);
      if (u.recebimento && Math.abs(soma - u.recebimento) > 1) console.log(`  ${nome}: formas ${soma.toFixed(2)} × recebimento ${u.recebimento}`);
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
