// Documentos das unidades (menu "Documentos"): contrato social, contrato de locação, alvarás e o que mais a unidade guardar, em pastas.
// Quem vê: o dono e todo Master, todas as unidades; quem tem acesso a unidades, só com a permissão "acessar documentos" e só as suas. Quem vê
// pode também enviar, baixar e criar pastas; apagar é só do dono. Tudo no Blob privado (`documentos/<id da unidade>/...`), nunca no repositório
// (que é público). Os limites de tamanho existem para o armazenamento não crescer sem controle.
import { randomUUID } from "node:crypto";
import { apagarCaminho, gravarBytes, gravarJson, lerBytes, lerJson } from "./armazem.js";
import { UNIT_NAMES } from "./units.js";

const MB = 1024 * 1024;
/** `arquivo` fica abaixo do teto de 4,5 MB por pedido das funções da Vercel (vale para enviar e para baixar). */
export const LIMITES = Object.freeze({ arquivo: 4 * MB, unidade: 50 * MB, rede: 1024 * MB, pastasPorUnidade: 100, arquivosPorUnidade: 300, niveis: 3 });
export const PASTA_DOCUMENTOS = "documentos";

export class ErroDocumentos extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

const ID_DA_UNIDADE = Object.fromEntries(Object.entries(UNIT_NAMES).map(([id, nome]) => [nome, id]));
const indiceDe = (nome) => `${PASTA_DOCUMENTOS}/${ID_DA_UNIDADE[nome]}/indice.json`;
const caminhoDe = (nome, id) => `${PASTA_DOCUMENTOS}/${ID_DA_UNIDADE[nome]}/arquivos/${id}`;

/** As unidades cujos documentos a pessoa enxerga. */
export function unidadesDosDocumentos(sessao) {
  if (sessao?.verDocumentos !== true) return [];
  const todas = Object.values(UNIT_NAMES);
  if (sessao.papel === "dono" || sessao.papel === "master") return todas;
  return todas.filter((n) => (sessao.unidades ?? []).includes(n));
}

function exigirUnidade(sessao, nome) {
  if (!unidadesDosDocumentos(sessao).includes(nome)) throw new ErroDocumentos("sem permissão para os documentos dessa unidade", 403);
}

async function lerIndice(nome) {
  const d = await lerJson(indiceDe(nome));
  return { pastas: Array.isArray(d?.pastas) ? d.pastas : [], arquivos: Array.isArray(d?.arquivos) ? d.arquivos : [] };
}
const usoDe = (indice) => indice.arquivos.reduce((t, a) => t + (a.tamanho || 0), 0);

export async function lerDocumentos(sessao) {
  const nomes = unidadesDosDocumentos(sessao);
  const unidades = await Promise.all(nomes.map(async (nome) => { const i = await lerIndice(nome); return { nome, ...i, usado: usoDe(i) }; }));
  return { unidades, limites: LIMITES, podeApagar: sessao?.papel === "dono" };
}

/** Nome de pasta ou arquivo: sem barras nem caracteres de controle. */
function limparNome(nome, maximo = 120) {
  const n = String(nome ?? "").replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, "").replace(/[\\/]/g, "-").replace(/\s+/g, " ").trim();
  if (!n || n === "." || n === "..") throw new ErroDocumentos("informe um nome");
  if (n.length > maximo) throw new ErroDocumentos(`o nome pode ter até ${maximo} letras`);
  return n;
}

const comeca = (bytes, assinatura) => assinatura.every((b, i) => bytes[i] === b);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
/** Só estes tipos entram; o começo do arquivo precisa bater com a extensão (um executável renomeado não passa). */
export const TIPOS = {
  pdf: { mime: "application/pdf", assinatura: [0x25, 0x50, 0x44, 0x46] },
  jpg: { mime: "image/jpeg", assinatura: [0xff, 0xd8, 0xff] },
  jpeg: { mime: "image/jpeg", assinatura: [0xff, 0xd8, 0xff] },
  png: { mime: "image/png", assinatura: [0x89, 0x50, 0x4e, 0x47] },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", assinatura: ZIP },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", assinatura: ZIP },
};
const extensaoDe = (nome) => (nome.includes(".") ? nome.split(".").pop().toLowerCase() : "");

/** Nível de uma pasta (a raiz da unidade é 0). */
function nivelDe(pastas, id) {
  let n = 0;
  for (let atual = id; atual && n <= LIMITES.niveis + 1; n += 1) atual = pastas.find((p) => p.id === atual)?.paiId ?? null;
  return n;
}
function exigirPasta(indice, id) {
  if (id && !indice.pastas.some((p) => p.id === id)) throw new ErroDocumentos("essa pasta não existe mais", 404);
}

export async function criarPasta(sessao, { unidade, nome, pastaId }, { agora = new Date() } = {}) {
  exigirUnidade(sessao, unidade);
  const n = limparNome(nome, 60);
  const indice = await lerIndice(unidade);
  const paiId = pastaId || null;
  exigirPasta(indice, paiId);
  if (nivelDe(indice.pastas, paiId) >= LIMITES.niveis) throw new ErroDocumentos(`dá para criar pastas até ${LIMITES.niveis} níveis`);
  if (indice.pastas.length >= LIMITES.pastasPorUnidade) throw new ErroDocumentos(`cada unidade aceita até ${LIMITES.pastasPorUnidade} pastas`);
  if (indice.pastas.some((p) => p.paiId === paiId && p.nome.toLocaleLowerCase("pt-BR") === n.toLocaleLowerCase("pt-BR"))) throw new ErroDocumentos("já existe uma pasta com esse nome aqui", 409);
  const pasta = { id: randomUUID(), nome: n, paiId, criadoPor: sessao.nome, criadoEm: agora.toISOString() };
  await gravarJson(indiceDe(unidade), { ...indice, pastas: [...indice.pastas, pasta] });
  return pasta;
}

export async function enviarArquivo(sessao, { unidade, nome, pastaId }, bytes, { agora = new Date() } = {}) {
  exigirUnidade(sessao, unidade);
  const n = limparNome(nome);
  const tipo = TIPOS[extensaoDe(n)];
  if (!tipo) throw new ErroDocumentos("só entram PDF, imagem (JPG ou PNG), Word (.docx) e Excel (.xlsx)");
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new ErroDocumentos("o arquivo chegou vazio; tente de novo");
  if (bytes.length > LIMITES.arquivo) throw new ErroDocumentos(`cada arquivo pode ter até ${LIMITES.arquivo / MB} MB`, 413);
  if (!comeca(bytes, tipo.assinatura)) throw new ErroDocumentos("o conteúdo não é do tipo que o nome diz");

  // O que cada unidade já ocupa, para os limites da unidade e da rede
  const indices = await Promise.all(Object.values(UNIT_NAMES).map(async (u) => [u, await lerIndice(u)]));
  const indice = indices.find(([u]) => u === unidade)[1];
  if (usoDe(indice) + bytes.length > LIMITES.unidade) throw new ErroDocumentos(`o espaço da unidade (${LIMITES.unidade / MB} MB) acabou; fale com o dono do Atlas`, 413);
  if (indices.reduce((t, [, i]) => t + usoDe(i), 0) + bytes.length > LIMITES.rede) throw new ErroDocumentos("o espaço total de documentos do Atlas acabou; fale com o dono do Atlas", 413);
  if (indice.arquivos.length >= LIMITES.arquivosPorUnidade) throw new ErroDocumentos(`cada unidade aceita até ${LIMITES.arquivosPorUnidade} arquivos`);

  const arquivo = { id: randomUUID(), nome: n, pastaId: pastaId || null, tamanho: bytes.length, tipo: tipo.mime, enviadoPor: sessao.nome, enviadoEm: agora.toISOString() };
  exigirPasta(indice, arquivo.pastaId);
  await gravarBytes(caminhoDe(unidade, arquivo.id), bytes, tipo.mime);
  // Lê de novo logo antes de gravar: outro envio pode ter terminado enquanto este subia
  const fresco = await lerIndice(unidade);
  await gravarJson(indiceDe(unidade), { ...fresco, arquivos: [...fresco.arquivos, arquivo] });
  return arquivo;
}

export async function baixarArquivo(sessao, { unidade, id }) {
  exigirUnidade(sessao, unidade);
  const arquivo = (await lerIndice(unidade)).arquivos.find((a) => a.id === id);
  const bytes = arquivo ? await lerBytes(caminhoDe(unidade, arquivo.id)) : null;
  if (!bytes) throw new ErroDocumentos("arquivo não encontrado", 404);
  return { nome: arquivo.nome, tipo: arquivo.tipo, bytes };
}

/** Apaga um arquivo ou uma pasta vazia. Só o dono. */
export async function apagarDocumento(sessao, { unidade, id }) {
  exigirUnidade(sessao, unidade);
  if (sessao.papel !== "dono") throw new ErroDocumentos("só o dono apaga documentos e pastas", 403);
  const indice = await lerIndice(unidade);
  if (indice.arquivos.some((a) => a.id === id)) {
    await gravarJson(indiceDe(unidade), { ...indice, arquivos: indice.arquivos.filter((a) => a.id !== id) });
    await apagarCaminho(caminhoDe(unidade, id));
    return;
  }
  if (!indice.pastas.some((p) => p.id === id)) throw new ErroDocumentos("não encontrado", 404);
  if (indice.pastas.some((p) => p.paiId === id) || indice.arquivos.some((a) => a.pastaId === id)) throw new ErroDocumentos("a pasta precisa estar vazia para ser apagada");
  await gravarJson(indiceDe(unidade), { ...indice, pastas: indice.pastas.filter((p) => p.id !== id) });
}
