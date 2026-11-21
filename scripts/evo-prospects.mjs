// Grava por unidade, nos meses já calculados: `oportunidades` (cadastrados) `conversoes` (convertidos no mês), `visitantes` e `convertidos` (como no cartão do Dashboard do EVO), `origens`, `consultores` (quem converteu) e `tempoConversao`.
// No mês em andamento grava também `ritmoConversao`: a conversão até ontem contra o mesmo dia dos 3 meses anteriores (alerta do mês).
// Uso: node --env-file=.env.local scripts/evo-prospects.mjs 2026-10 2026-11
import { hojeBR } from "../server/evo.js";
import { diaAnterior } from "../server/ativos.js";
import { linhasDoMes, prospectsDoMes, ritmoConversao } from "../server/prospects.js";
import { mesesAnteriores } from "../server/mesmoDia.js";
import { UNIT_NAMES } from "../server/units.js";
import { loadMonth, saveMonth } from "../server/store.js";
import { mesclarSemanas } from "../server/semanas.js";

const hoje = hojeBR();
const falhas = [];
for (const ym of process.argv.slice(2)) {
  try {
    const blob = await loadMonth(ym);
    if (!blob) throw new Error("mês ainda não foi calculado; rode evo-backfill antes");
    const por = await prospectsDoMes(ym, hoje);
    // Ritmo da conversão: só no mês em andamento e a partir do dia 2 (no dia 1, "até ontem" é o mês anterior).
    let ritmo = null;
    const ontem = diaAnterior(hoje);
    if (ym === hoje.slice(0, 7) && ontem.slice(0, 7) === ym) {
      try {
        const fim = (m) => { const [a, b] = m.split("-").map(Number); return new Date(Date.UTC(a, b, 0)).toISOString().slice(0, 10); };
        const anteriores = [];
        for (const m of mesesAnteriores(ym, 3)) anteriores.push([m, await linhasDoMes(m, fim(m))]);
        ritmo = ritmoConversao(ym, await linhasDoMes(ym, ontem), anteriores, Number(ontem.slice(8)));
      } catch (e) {
        console.log(`${ym}: ritmo da conversão com erro — ${e.message}`);
      }
    }
    let n = 0;
    for (const u of blob.units) {
      const a = por[u.name];
      if (!a || !Object.values(UNIT_NAMES).includes(u.name)) continue;
      u.oportunidades = a.oportunidades; u.conversoes = a.conversoes; u.conversoesAntigas = a.conversoesAntigas; u.origens = a.origens; u.consultores = a.consultores; u.tempoConversao = a.tempoConversao; u.semanas = mesclarSemanas(u.semanas, a.semanas); if (a.visitantes !== undefined) { u.visitantes = a.visitantes; u.convertidos = a.convertidos; } n++;
      if (ritmo?.[u.name]) u.ritmoConversao = ritmo[u.name];
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
