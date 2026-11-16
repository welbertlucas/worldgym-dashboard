// Grava no Blob os prints da central de ajuda: node --env-file=.env.local scripts/ajuda-imagens.mjs <pasta com <nome>.png>
// Os prints devem ser feitos com números fictícios (nunca dados reais: todos os níveis de acesso veem as mesmas imagens).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { saveImagemAjuda } from "../server/store.js";

const pasta = process.argv[2];
if (!pasta) { console.error("uso: scripts/ajuda-imagens.mjs <pasta>"); process.exit(1); }
for (const arq of (await readdir(pasta)).filter((a) => /^[a-z0-9-]{1,40}\.png$/.test(a))) {
  await saveImagemAjuda(arq.replace(/\.png$/, ""), await readFile(join(pasta, arq)));
  console.log(`gravada: ${arq}`);
}
