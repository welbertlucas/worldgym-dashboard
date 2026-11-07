// Grava por unidade, nos meses pedidos, o perfil das oportunidades cadastradas: gênero e faixa etária, com [cadastradas, convertidas].
// Uso: node --env-file=.env.local scripts/evo-perfil-oportunidades.mjs 2026-10 2026-11
import { fetchAll, hojeBR } from "../server/evo.js";
import { diaDeCorte, UNIDADES } from "../server/ativos.js";
import { perfilDasOportunidades } from "../server/perfil.js";
import { loadMonth, saveMonth } from "../server/store.js";

const hoje = hojeBR();
const falhas = [];
for (const ym of process.argv.slice(2)) {
  try {
    const blob = await loadMonth(ym);
    if (!blob) throw new Error("mês ainda não foi calculado; rode evo-backfill antes");
    const de = `${ym}-01`, ate = diaDeCorte(ym, hoje);
    let n = 0;
    for (const [id, nome] of Object.entries(UNIDADES)) {
      const u = blob.units.find((x) => x.name === nome);
      if (!u) continue;
      const prospects = await fetchAll(`/prospects?idBranch=${id}&registerDateStart=${de}&registerDateEnd=${ate}`);
      u.perfilOport = perfilDasOportunidades(prospects, de, ate, hoje);
      n++;
    }
    await saveMonth(blob);
    console.log(`${ym}: ${n} unidades`);
  } catch (e) {
    console.log(`${ym}: FALHOU — ${e.message}`);
    falhas.push(ym);
  }
}
if (falhas.length) { console.log(`Meses com falha: ${falhas.join(" ")}`); process.exitCode = 1; }
