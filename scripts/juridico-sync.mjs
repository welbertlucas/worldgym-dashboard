// Lê a planilha do jurídico (Google Planilhas, só leitura), descarta o que é dado pessoal e grava o modelo no Blob privado.
// Também guarda os totais do mês em juridico/historico/AAAA-MM.json (a foto do mês: a última leitura do mês vale).
// Local: node --env-file=.env.local scripts/juridico-sync.mjs [--matriz arquivo.json]  (a matriz é {ativos:[[...]], arquivados:[[...]]}).
import { readFileSync } from "node:fs";
import { gravarJson } from "../server/armazem.js";
import { ARQUIVO_JURIDICO, PASTA_HISTORICO_JURIDICO, lerJuridicoPlanilha, montarJuridico, resumoDoMes } from "../server/juridico.js";

const i = process.argv.indexOf("--matriz");
const modelo = i > 0 ? montarJuridico(JSON.parse(readFileSync(process.argv[i + 1], "utf8"))) : await lerJuridicoPlanilha();
const ativos = modelo.processos.filter((p) => !p.arquivado).length;
// Leitura vazia nunca apaga o que já está gravado (planilha fora do ar, aba renomeada...).
if (!ativos) { console.error("Nenhum processo ativo na leitura: nada foi gravado."); process.exit(1); }
await gravarJson(ARQUIVO_JURIDICO, modelo);
const resumo = resumoDoMes(modelo);
await gravarJson(`${PASTA_HISTORICO_JURIDICO}/${resumo.mes}.json`, resumo);
console.log(`Jurídico: ${ativos} ativos, ${modelo.processos.length - ativos} arquivados (${resumo.mes}).`);
