// Grava os modelos de implantação (fases e tarefas) no Blob privado, em `obras/modelos.json`. A lista real nunca vai para o repositório.
//   node --env-file=.env.local scripts/obras-modelos.mjs <arquivo.json>            -> PRÉVIA: confere o arquivo e mostra o que seria gravado
//   node --env-file=.env.local scripts/obras-modelos.mjs <arquivo.json> --gravar   -> grava
// Formato do arquivo: { modelos: [{ id, nome, fases: [{ nome, marco, tarefas: [{ nome, dias }] }] }] } (campos a mais são ignorados).
import { readFileSync } from "node:fs";
import { limparModelos, lerModelos, gravarModelos } from "../server/obras.js";

const [arquivo, ...flags] = process.argv.slice(2);
if (!arquivo) { console.log("Informe o arquivo dos modelos."); process.exit(1); }
const modelos = limparModelos(JSON.parse(readFileSync(arquivo, "utf8")).modelos);
const atual = await lerModelos();
for (const m of modelos) console.log(`${m.id}: ${m.nome} | ${m.fases.length} fases | ${m.fases.reduce((a, f) => a + f.tarefas.length, 0)} tarefas`);
console.log(`Modelos gravados hoje: ${atual.length}.`);
if (!flags.includes("--gravar")) { console.log("PRÉVIA: nada foi gravado. Acrescente --gravar."); process.exit(0); }
await gravarModelos(modelos);
console.log("Modelos gravados.");
