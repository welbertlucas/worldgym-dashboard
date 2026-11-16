// Grava a série "mesmo dia" (server/mesmoDia.js) dos meses fechados. Sem argumentos: os 3 meses anteriores ao atual que
// ainda não têm série (na virada do mês, só o mês que acabou de fechar; nos outros dias não lê nada do EVO).
// Uso: node --env-file=.env.local scripts/evo-mesmo-dia.mjs [AAAA-MM ...] [--refazer]
import { hojeBR } from "../server/evo.js";
import { UNIDADES } from "../server/ativos.js";
import { lerSerie, gravarSerie, mesesAnteriores, serieDaUnidade } from "../server/mesmoDia.js";

const hoje = hojeBR();
const args = process.argv.slice(2);
const refazer = args.includes("--refazer");
let meses = args.filter((a) => /^\d{4}-\d{2}$/.test(a));
if (!meses.length) meses = mesesAnteriores(hoje.slice(0, 7), 3);
if (!refazer) {
  const ja = await Promise.all(meses.map(async (ym) => !!(await lerSerie(ym))));
  meses = meses.filter((_, i) => !ja[i]);
}
if (!meses.length) console.log("mesmo dia: nada a calcular");

let falhou = false;
for (const ym of meses) {
  const units = {};
  for (const [id, nome] of Object.entries(UNIDADES)) {
    try {
      units[nome] = await serieDaUnidade(Number(id), ym, hoje);
    } catch (e) {
      console.log(`${ym} ${nome}: FALHOU — ${e.message}`);
      falhou = true;
    }
  }
  // Só grava o mês completo: uma série pela metade daria uma base errada e não seria refeita depois.
  if (Object.keys(units).length === Object.keys(UNIDADES).length) {
    await gravarSerie(ym, units);
    console.log(`${ym}: série gravada (${Object.keys(units).length} unidades)`);
  } else console.log(`${ym}: não gravado (faltaram unidades); tenta de novo na próxima rodada`);
}
if (falhou) process.exitCode = 1;
