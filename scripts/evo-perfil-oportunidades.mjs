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
      // Quem converte vira aluno e sai da lista por data de cadastro: junta as duas consultas (cadastro e conversão) sem repetir.
      const abertos = await fetchAll(`/prospects?idBranch=${id}&registerDateStart=${de}&registerDateEnd=${ate}`);
      const convertidos = await fetchAll(`/prospects?idBranch=${id}&conversionDateStart=${de}&conversionDateEnd=${ate}`);
      const por = new Map([...abertos, ...convertidos].map((p) => [p.idProspect, p]));
      u.perfilOport = perfilDasOportunidades([...por.values()], de, ate, hoje);
      // Confere com o relatório do EVO já gravado (oportunidades e conversões da unidade): deve bater ou ficar muito perto.
      const cad = u.perfilOport.g.reduce((t, [c]) => t + c, 0), conv = u.perfilOport.g.reduce((t, [, v]) => t + v, 0);
      if (u.oportunidades !== undefined && (cad !== u.oportunidades || conv !== u.conversoes)) console.log(`  ${nome}: perfil ${cad}/${conv} × relatório ${u.oportunidades}/${u.conversoes}`);
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
