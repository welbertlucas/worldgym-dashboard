// Recebimentos da marca (taxa fixa e royalties): o modelo de dados vem pronto de outro projeto (repositório privado de royalties),
// que lê a planilha do Google, confere e grava o JSON no Blob privado do Atlas. Aqui só se lê. Nada disso entra no repositório.
import { lerJson } from "./armazem.js";

export const ARQUIVO_ROYALTIES = "royalties/dados.json";

/** O modelo gravado pela rotina de royalties, ou null enquanto ela ainda não enviou nada. */
export async function lerRoyalties() {
  const dados = await lerJson(ARQUIVO_ROYALTIES);
  return dados && typeof dados === "object" ? dados : null;
}
