// Grava por unidade, nos meses já calculados: `npsPromotores`, `npsDetratores` e `npsRespostas` (do WeHelp).
// Uso: node --env-file=.env.local scripts/wehelp-nps.mjs 2026-09 2026-10
// (WEHELP_CLIENT_ID e WEHELP_CLIENT_SECRET no ambiente)
import { hojeBR } from "../server/evo.js";
import { abrirSessao, npsDoMes, npsPontosDoMes } from "../server/wehelp.js";
import { loadMonth, saveMonth } from "../server/store.js";

const meses = process.argv.slice(2);
if (!meses.length) throw new Error("Informe os meses AAAA-MM.");
const hoje = hojeBR();
const sessao = await abrirSessao();
for (const ym of meses) {
  const blob = await loadMonth(ym);
  if (!blob) { console.log(`${ym}: mês ainda não calculado; rode evo-backfill antes.`); continue; }
  const por = await npsDoMes(sessao, ym, hoje);
  let pontos = {};
  try { pontos = await npsPontosDoMes(sessao, ym, hoje); } catch (e) { console.log(`${ym}: NPS por ponto de contato indisponível — ${e.message}`); }
  let com = 0;
  for (const u of blob.units) {
    const a = por[u.name];
    if (a && a.respostas > 0) {
      u.npsPromotores = a.promotores; u.npsDetratores = a.detratores; u.npsRespostas = a.respostas; com++;
      if (pontos[u.name] && Object.keys(pontos[u.name]).length) u.npsPontos = pontos[u.name]; else delete u.npsPontos;
    } else {
      delete u.npsPromotores; delete u.npsDetratores; delete u.npsRespostas; delete u.npsPontos;
    }
  }
  blob.npsEm = new Date().toISOString();
  await saveMonth(blob);
  console.log(`${ym}: ${com} unidades com NPS`);
}
