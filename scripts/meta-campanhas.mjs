// Lê as campanhas ativas do Meta (só leitura) e grava a foto do dia no Blob.
// Uso: META_TOKEN_DFGO=... node --env-file=.env.local scripts/meta-campanhas.mjs
import { campanhasDaRede } from "../server/meta.js";
import { saveCampanhas } from "../server/store.js";

const tokens = { DFGO: process.env.META_TOKEN_DFGO, BR01: process.env.META_TOKEN_BR01 };
if (!tokens.DFGO && !tokens.BR01) throw new Error("Nenhum token do Meta configurado (META_TOKEN_DFGO / META_TOKEN_BR01).");
const { campanhas, erros } = await campanhasDaRede(tokens);
for (const e of erros) console.log(`ERRO ${e.conta}: ${e.erro}`);
const contasLidas = new Set(campanhas.map((c) => c.conta)).size;
console.log(`${campanhas.length} campanhas ativas em ${contasLidas} contas; ${erros.length} contas com erro`);
if (!campanhas.length && erros.length) throw new Error("Nada foi lido; a foto anterior foi mantida.");
await saveCampanhas({ geradoEm: new Date().toISOString(), campanhas, erros });
console.log("Gravado: campanhas/atual.json");
