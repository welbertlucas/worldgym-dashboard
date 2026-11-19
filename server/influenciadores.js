// Influenciadores da rede (Marketing > Influenciadores): quem são, de qual unidade e o que foi contratado por mês.
// Só o dono cadastra e altera. Dono e Master veem todos; quem tem acesso por unidades vê só os da sua unidade.
// Guarda apenas o @ do Instagram, o nome de exibição (opcional), a unidade e as metas do contrato: nada de dado pessoal.
// (Etapas seguintes: ler o feed e os reels pelo @ e os stories que marcam a unidade, para comparar com o contrato.)
import { randomUUID } from "node:crypto";
import { lerJson, gravarJson } from "./armazem.js";
import { UNIDADES_DA_REDE } from "./acesso.js";

const ARQUIVO = "influenciadores/cadastro.json";
const TTL_MS = 60 * 1000;
const MAX_ENTREGA = 999;
export const TIPOS_ENTREGA = ["stories", "feed", "reels"];

let memo = null;

export class ErroInfluenciador extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

/** Lista com cache de 1 minuto por instância (abrir a tela não lê o Blob toda vez). */
export async function listarInfluenciadores(agora = Date.now()) {
  if (memo && agora - memo.em < TTL_MS) return memo.lista;
  const lista = (await lerJson(ARQUIVO)) ?? [];
  memo = { em: agora, lista };
  return lista;
}
export const limparCacheInfluenciadores = () => { memo = null; };

async function lerFresco() {
  limparCacheInfluenciadores();
  return structuredClone(await listarInfluenciadores());
}
async function salvar(lista) {
  await gravarJson(ARQUIVO, lista);
  memo = { em: Date.now(), lista };
}

/** "@Fulano", "fulano" ou o endereço do perfil (instagram.com/fulano/) viram "fulano". Devolve null se não for um @ válido. */
export function normalizarUsuario(entrada) {
  let t = String(entrada ?? "").trim().toLowerCase();
  const prefixo = /^(https?:\/\/)?(www\.)?instagram\.com\//;
  if (prefixo.test(t)) t = t.replace(prefixo, "").split(/[/?#]/)[0]; // só endereço de perfil perde o que vem depois da barra
  t = t.replace(/^@/, "");
  return /^[a-z0-9._]{1,30}$/.test(t) && !/^\.|\.$/.test(t) ? t : null;
}

const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? "")) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

function lerEntregas(e) {
  const out = {};
  for (const t of TIPOS_ENTREGA) {
    const n = Number(e?.[t] ?? 0);
    if (!Number.isInteger(n) || n < 0 || n > MAX_ENTREGA) throw new ErroInfluenciador(`Quantidade de ${t === "feed" ? "posts no feed" : t} inválida: use um número inteiro de 0 a ${MAX_ENTREGA}.`);
    out[t] = n;
  }
  if (TIPOS_ENTREGA.every((t) => out[t] === 0)) throw new ErroInfluenciador("Informe ao menos uma entrega por mês (stories, feed ou reels).");
  return out;
}

/** Confere e normaliza os campos do cadastro. `base`: o registro atual, na edição (campos ausentes ficam como estão). */
function validar(campos, base = {}) {
  const c = { ...base, ...campos };
  const usuario = normalizarUsuario(c.usuario);
  if (!usuario) throw new ErroInfluenciador("Informe o @ do Instagram (letras, números, ponto e sublinhado).");
  const nome = String(c.nome ?? "").trim();
  if (nome.length > 80) throw new ErroInfluenciador("O nome pode ter no máximo 80 caracteres.");
  const unidade = c.unidade === null || c.unidade === "" || c.unidade === undefined ? null : String(c.unidade);
  if (unidade !== null && !UNIDADES_DA_REDE.includes(unidade)) throw new ErroInfluenciador(`Unidade desconhecida: ${unidade}.`);
  const vazia = (d) => d === null || d === "" || d === undefined;
  const inicio = vazia(c.inicio) ? null : c.inicio;
  const fim = vazia(c.fim) ? null : c.fim;
  if (inicio !== null && !dataValida(inicio)) throw new ErroInfluenciador("Data de início inválida.");
  if (fim !== null && !dataValida(fim)) throw new ErroInfluenciador("Data de fim inválida.");
  if (inicio !== null && fim !== null && fim < inicio) throw new ErroInfluenciador("O fim do contrato não pode ser antes do início.");
  const obs = String(c.obs ?? "").trim();
  if (obs.length > 200) throw new ErroInfluenciador("A observação pode ter no máximo 200 caracteres.");
  return { usuario, ...(nome ? { nome } : {}), unidade, inicio, fim, entregas: lerEntregas(c.entregas), ...(obs ? { obs } : {}), ativo: c.ativo !== false };
}

const mesmoContrato = (a, b) => a.usuario === b.usuario && (a.unidade ?? null) === (b.unidade ?? null);

export async function criarInfluenciador(campos) {
  const lista = await lerFresco();
  const dados = validar(campos);
  if (dados.ativo && lista.some((x) => x.ativo !== false && mesmoContrato(x, dados))) throw new ErroInfluenciador("Já existe um contrato ativo desse @ nessa unidade. Edite o que existe.", 409);
  const novo = { id: randomUUID(), ...dados, criadoEm: new Date().toISOString() };
  await salvar([...lista, novo]);
  return novo;
}

export async function atualizarInfluenciador(id, campos) {
  const lista = await lerFresco();
  const atual = lista.find((x) => x.id === id);
  if (!atual) throw new ErroInfluenciador("Influenciador não encontrado.", 404);
  const { id: _i, criadoEm, ...base } = atual;
  const dados = validar(campos, base);
  if (dados.ativo && lista.some((x) => x.id !== id && x.ativo !== false && mesmoContrato(x, dados))) throw new ErroInfluenciador("Já existe um contrato ativo desse @ nessa unidade.", 409);
  const novo = { id, ...dados, criadoEm };
  await salvar(lista.map((x) => (x.id === id ? novo : x)));
  return novo;
}

export async function removerInfluenciador(id) {
  const lista = await lerFresco();
  if (!lista.some((x) => x.id === id)) throw new ErroInfluenciador("Influenciador não encontrado.", 404);
  await salvar(lista.filter((x) => x.id !== id));
}

/**
 * Atende GET/POST de /api/instagram?influenciadores. `filtrar`: regra de visibilidade (server/visibilidade.js).
 *   GET  -> { influenciadores }  (todos para dono e Master; só os da unidade para quem tem acesso por unidades)
 *   POST { acao: "criar" | "atualizar" | "remover", ... } -> só o dono (na simulação "ver como" não vale: o papel é o simulado)
 */
export async function tratarInfluenciadores(req, res, sessao, filtrar) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") return res.status(200).json({ influenciadores: filtrar(await lerFresco(), sessao) });
    if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
    if (sessao.papel !== "dono" || sessao.papelReal) return res.status(403).json({ error: "Só o dono cadastra influenciadores." });
    const corpo = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body) ?? {}; } catch { return {}; } })() : req.body ?? {};
    const { acao, id, ...campos } = corpo;
    if (acao === "criar") return res.status(200).json({ influenciador: await criarInfluenciador(campos) });
    if (acao === "atualizar") return res.status(200).json({ influenciador: await atualizarInfluenciador(String(id ?? ""), campos) });
    if (acao === "remover") { await removerInfluenciador(String(id ?? "")); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ error: "ação desconhecida" });
  } catch (e) {
    if (e instanceof ErroInfluenciador) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: "não consegui concluir agora" });
  }
}
