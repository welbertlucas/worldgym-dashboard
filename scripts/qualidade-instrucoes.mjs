// Preenche o "Como avaliar" nos itens do roteiro salvo que ainda não têm, casando pelo texto com os roteiros sugeridos.
// Uso: node --env-file=.env.local scripts/qualidade-instrucoes.mjs [--gravar]
import { MODELO_SUGERIDO, MODELO_ABERTURA } from "../src/data/qualidade.ts";
import { lerModelos } from "../server/qualidade.js";
import { gravarJson } from "../server/armazem.js";
import { ARQUIVO_MODELOS } from "../server/qualidade.js";

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const mapa = new Map();
for (const m of [MODELO_SUGERIDO, MODELO_ABERTURA]) for (const i of m.itens) if (i.instrucao) mapa.set(norm(i.texto), i.instrucao);
const modelos = await lerModelos();
let n = 0;
for (const m of modelos) for (const i of m.itens ?? []) {
  if (i.instrucao) continue;
  const ins = mapa.get(norm(i.texto));
  if (ins) { i.instrucao = ins; n++; console.log(`+ [${m.nome}] ${i.texto.slice(0, 60)}`); }
}
console.log(`${n} itens preenchidos em ${modelos.length} checklists.`);
if (process.argv.includes("--gravar") && n) { await gravarJson(ARQUIVO_MODELOS, modelos); console.log("Gravado."); }
