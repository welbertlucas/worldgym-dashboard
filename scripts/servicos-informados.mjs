// Grava as aulas que o dono pesquisou para unidades específicas de academias concorrentes (Estudos de ponto), no Blob privado.
//   node --env-file=.env.local scripts/servicos-informados.mjs <arquivo.json>            -> PRÉVIA: mostra o que seria gravado
//   node --env-file=.env.local scripts/servicos-informados.mjs <arquivo.json> --gravar   -> grava (soma às que já existem)
// Formato: { "places/<id do Google>": { "nome": "Academia …", "aulas": "FitDance, Zumba, …" } }. A lista real nunca vai para o repositório.
import { readFileSync } from "node:fs";
import { gravarInformados, lerInformados, servicosNoTexto } from "../server/servicosAcademias.js";

const [arquivo, ...flags] = process.argv.slice(2);
if (!arquivo) { console.log("Informe o arquivo."); process.exit(1); }
const dados = JSON.parse(readFileSync(arquivo, "utf8"));
for (const [id, v] of Object.entries(dados)) console.log(`${v.nome} (${id}): ${v.aulas} -> ${servicosNoTexto(v.aulas).filter((x) => x !== "musculacao").join(", ")}`);
console.log(`Já gravadas: ${Object.keys(await lerInformados()).length}.`);
if (!flags.includes("--gravar")) { console.log("PRÉVIA: nada foi gravado. Acrescente --gravar."); process.exit(0); }
await gravarInformados(dados);
console.log("Gravado.");
