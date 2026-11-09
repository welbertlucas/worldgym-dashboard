// Grava por unidade, nos meses já calculados: `ativosFim` (alunos ativos no fim do mês), `ativosIni` (no início) e `cancelados`, e a renovação (`aVencer` e `naoRenovados`).
// Uso: node --env-file=.env.local scripts/evo-ativos.mjs 2026-10 2026-11
import { ativosDaUnidade, UNIDADES } from "../server/ativos.js";
import { hojeBR } from "../server/evo.js";
import { relatorioNaoRenovados } from "../server/renovacao.js";
import { loadMonth, saveMonth } from "../server/store.js";

const meses = process.argv.slice(2);
if (!meses.length) throw new Error("Informe os meses AAAA-MM.");
const hoje = hojeBR();
const blobs = Object.fromEntries(await Promise.all(meses.map(async (ym) => [ym, await loadMonth(ym)])));
for (const ym of meses) if (!blobs[ym]) throw new Error(`Mês ${ym} ainda não foi calculado; rode evo-backfill antes.`);

// Não renovados: um relatório do EVO por mês, com todas as unidades.
const naoRenov = Object.fromEntries(await Promise.all(meses.map(async (ym) => [ym, await relatorioNaoRenovados(ym, hoje)])));

for (const [id, nome] of Object.entries(UNIDADES)) {
  const por = await ativosDaUnidade(Number(id), meses, hoje);
  for (const ym of meses) {
    const u = blobs[ym].units.find((x) => x.name === nome);
    const r = naoRenov[ym].get(Number(id));
    if (u) Object.assign(u, por[ym], { naoRenovados: r?.n ?? 0, naoRenovadosTipos: r?.tipos ?? {}, naoRenovadosPlanos: r?.planos ?? [] });
  }
  console.log(nome, JSON.stringify(por));
}
for (const ym of meses) {
  blobs[ym].ativosEm = new Date().toISOString();
  await saveMonth(blobs[ym]);
}
console.log(`Gravado: ${meses.join(", ")}`);
