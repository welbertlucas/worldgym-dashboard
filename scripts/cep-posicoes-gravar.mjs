// Grava no Blob privado a tabela CEP -> posição de um estado (gerada por scripts/cep-posicoes.py): estudos/cep/<UF>.json.
// É dado público do IBGE (CNEFE 2022); fica no Blob só para a rotina noturna dos alunos não baixar tudo de novo.
// Só grava com a confirmação do dono (regra: gravação no Blob é caso a caso).
//
// Uso: node --env-file=.env.local scripts/cep-posicoes-gravar.mjs [--simular] cep_DF.json [cep_GO.json ...]
import { readFileSync } from "node:fs";
import { gravarJson } from "../server/armazem.js";
import { arquivoCep, tabelaCepValida } from "../server/alunosHex.js";

const args = process.argv.slice(2);
const simular = args.includes("--simular");
const arquivos = args.filter((a) => !a.startsWith("--"));
if (!arquivos.length) { console.error("Uso: node --env-file=.env.local scripts/cep-posicoes-gravar.mjs [--simular] cep_UF.json [...]"); process.exit(1); }

for (const arq of arquivos) {
  const t = JSON.parse(readFileSync(arq, "utf8"));
  if (!tabelaCepValida(t)) { console.error(`${arq}: tabela inválida (falta uf, ceps ou a posição de algum CEP); pulei.`); continue; }
  console.log(`${simular ? "[simulação] " : ""}${t.uf}: ${Object.keys(t.ceps).length.toLocaleString("pt-BR")} CEPs (${t.fonte}, gerado em ${t.gerado})`);
  if (!simular) await gravarJson(arquivoCep(t.uf), t);
}
