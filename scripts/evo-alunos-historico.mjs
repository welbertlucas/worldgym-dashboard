// Grava só `suspensosFim` (alunos ativos com contrato trancado no fim do mês) e `cancelPerfil` (cancelamentos por
// gênero e faixa de idade) nos meses já calculados. Serve para carregar o histórico sem recalcular mais nada;
// a rotina diária já grava os dois em evo-alunos.mjs.
// Uso: node --env-file=.env.local scripts/evo-alunos-historico.mjs 2025-01 2025-02 ...
import { cancelamentosPorPerfil, contarSuspensos, diaDeCorte, resumoAluno, UNIDADES } from "../server/ativos.js";
import { fetchAll, hojeBR } from "../server/evo.js";
import { loadMonth, saveMonth } from "../server/store.js";

const meses = process.argv.slice(2);
if (!meses.length) throw new Error("Informe os meses AAAA-MM.");
const hoje = hojeBR();
const blobs = Object.fromEntries(await Promise.all(meses.map(async (ym) => [ym, await loadMonth(ym)])));
const faltam = meses.filter((ym) => !blobs[ym]);
if (faltam.length) console.log(`Sem cálculo (pulados): ${faltam.join(", ")}`);

for (const [id, nome] of Object.entries(UNIDADES)) {
  const alunos = (await fetchAll(`/members?idBranch=${id}`)).map(resumoAluno);
  const por = {};
  for (const ym of meses) {
    if (!blobs[ym]) continue;
    const u = blobs[ym].units.find((x) => x.name === nome);
    if (!u) continue;
    u.suspensosFim = por[ym] = contarSuspensos(alunos, diaDeCorte(ym, hoje));
    u.cancelPerfil = cancelamentosPorPerfil(alunos, ym, hoje);
  }
  console.log(nome, JSON.stringify(por));
}
for (const ym of meses) if (blobs[ym]) await saveMonth(blobs[ym]);
console.log(`Gravado: ${meses.filter((ym) => blobs[ym]).join(", ")}`);
