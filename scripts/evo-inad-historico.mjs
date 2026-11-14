// Grava só `inadPerfil` (inadimplência por gênero e faixa de idade) nos meses já calculados, sem mexer em mais nada.
// A rotina diária faz isso para o mês atual e o anterior (evo-backfill.mjs deixa os pagadores, evo-alunos.mjs conta);
// aqui as duas partes rodam juntas, unidade por unidade: lê os alunos uma vez e, para cada mês, refaz a leitura dos
// títulos (a mesma do faturamento) só para saber quem pagou e quem ficou devendo. Os ids ficam na memória, nunca no Blob.
// Grava os meses a cada 6 unidades, para uma queda no meio não perder tudo.
// Uso: node --env-file=.env.local scripts/evo-inad-historico.mjs 2025-01 2025-02 ...
import { fetchAll, hojeBR, unitMonth } from "../server/evo.js";
import { resumoAluno, UNIDADES } from "../server/ativos.js";
import { inadimplenciaPorPerfil } from "../server/inadPerfil.js";
import { loadMonth, saveMonth } from "../server/store.js";

const meses = process.argv.slice(2);
if (!meses.length) throw new Error("Informe os meses AAAA-MM.");
const hoje = hojeBR();
const blobs = Object.fromEntries(await Promise.all(meses.map(async (ym) => [ym, await loadMonth(ym)])));
const faltam = meses.filter((ym) => !blobs[ym]);
if (faltam.length) console.log(`Sem cálculo (pulados): ${faltam.join(", ")}`);
const validos = meses.filter((ym) => blobs[ym]);

const gravar = async () => { for (const ym of validos) await saveMonth(blobs[ym]); };
const pct = (p) => { const [pg, dv] = p.g.reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]); return pg ? `${((dv / pg) * 100).toFixed(1)}%` : "-"; };

const unidades = Object.entries(UNIDADES);
for (let k = 0; k < unidades.length; k++) {
  const [id, nome] = unidades[k];
  const inicio = Date.now();
  const alunos = (await fetchAll(`/members?idBranch=${id}`)).map(resumoAluno);
  const linha = [];
  for (const ym of validos) {
    const u = blobs[ym].units.find((x) => x.name === nome);
    if (!u) continue;
    try {
      const { _pagadores } = await unitMonth(Number(id), ym, hoje);
      u.inadPerfil = inadimplenciaPorPerfil(alunos, _pagadores, ym);
      linha.push(`${ym} ${pct(u.inadPerfil)}`);
    } catch (e) {
      linha.push(`${ym} erro (${e.message})`); // o mês fica como estava
    }
  }
  console.log(`${nome} (${Math.round((Date.now() - inicio) / 1000)}s): ${linha.join(" | ")}`);
  if ((k + 1) % 6 === 0) { await gravar(); console.log(`Gravado parcial (${k + 1} de ${unidades.length} unidades)`); }
}
await gravar();
console.log(`Gravado: ${validos.join(", ")}`);
