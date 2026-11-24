// Pedido de Censo de um município feito pelo botão do Atlas (rotina censo-municipio.yml). O repositório é público e as páginas das rotinas
// também: por isso o pedido NÃO vai com a posição do ponto nem com o nome da cidade. O servidor grava o pedido (estado e posição) num arquivo
// privado do Blob com um código aleatório, e a rotina recebe só o código; este script lê o arquivo e passa estado e posição às etapas
// seguintes por variáveis de ambiente (que não aparecem no log), e no fim apaga o pedido.
//
//   node --env-file=.env.local scripts/censo-municipio-pedido.mjs ler <código>      -> grava UF e PONTO em $GITHUB_ENV (e mascara a posição)
//   node --env-file=.env.local scripts/censo-municipio-pedido.mjs concluir <código> -> apaga o pedido
import { appendFileSync } from "node:fs";
import { apagarCaminho, lerJson } from "../server/armazem.js";
import { arquivoDoPedido, ehCodigoDePedido } from "../server/censoPedido.js";

const [acao, codigo] = process.argv.slice(2);
if (!ehCodigoDePedido(codigo)) { console.error("Código de pedido inválido."); process.exit(1); }
if (acao === "ler") {
  const p = await lerJson(arquivoDoPedido(codigo));
  if (!p?.uf || !Array.isArray(p.c)) { console.error("Pedido não encontrado (ou já concluído)."); process.exit(1); }
  const ponto = `${p.c[0]},${p.c[1]}`;
  console.log(`::add-mask::${ponto}`);
  for (const v of p.c) console.log(`::add-mask::${v}`);
  appendFileSync(process.env.GITHUB_ENV, `UF=${p.uf}\nPONTO=${ponto}\n`);
  console.log("Pedido lido.");
} else if (acao === "concluir") {
  await apagarCaminho(arquivoDoPedido(codigo));
  console.log("Pedido apagado.");
} else { console.error("Uso: ler | concluir <código>"); process.exit(1); }
