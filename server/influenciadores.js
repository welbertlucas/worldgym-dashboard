// Influenciadores da rede (Marketing > Influenciadores): quem são, de qual unidade e o que foi contratado por mês.
// Dono e Master cadastram, editam e removem em qualquer unidade (inclusive a rede toda) e veem todos. Quem tem acesso por unidades
// cadastra, edita e remove os da sua unidade (e vê só esses).
// Guarda apenas o @ do Instagram, o nome de exibição (opcional), a unidade e as metas do contrato: nada de dado pessoal.
// (Etapas seguintes: ler o feed e os reels pelo @ e os stories que marcam a unidade, para comparar com o contrato.)
import { randomUUID } from "node:crypto";
import { lerJson, gravarJson } from "./armazem.js";
import { UNIDADES_DA_REDE } from "./acesso.js";
import { CONTAS_IG } from "./instagram.js";
import { idDaFoto, lerPerfis } from "./perfisInfluenciadores.js";
import { lerPostsGuardados } from "./postsInfluenciadores.js";

const ARQUIVO = "influenciadores/cadastro.json";
const TTL_MS = 60 * 1000;
const MAX_ENTREGA = 999;
export const TIPOS_ENTREGA = ["stories", "feed", "reels"];
/** O que conta como entrega: "marcando" = só o post (feed ou reels) que cita ou marca a unidade/a marca; "qualquer" = qualquer post do perfil. */
export const REGRAS_DE_CONTAGEM = ["marcando", "qualquer"];

let memo = null;

export class ErroInfluenciador extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

/** Contas do Instagram da rede (públicas): a da marca e a de cada unidade, para saber qual citação ou marcação vale para cada contrato. */
export function contasDaRede() {
  const porUnidade = {};
  let marca = null;
  for (const [usuario, unidade] of Object.entries(CONTAS_IG)) { if (unidade === null) marca = usuario; else porUnidade[unidade] = usuario; }
  return { marca, porUnidade };
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
  if (c.contagem !== undefined && !REGRAS_DE_CONTAGEM.includes(c.contagem)) throw new ErroInfluenciador("Regra de contagem inválida.");
  const contagem = c.contagem ?? "marcando";
  const obs = String(c.obs ?? "").trim();
  if (obs.length > 200) throw new ErroInfluenciador("A observação pode ter no máximo 200 caracteres.");
  return { usuario, ...(nome ? { nome } : {}), unidade, inicio, fim, entregas: lerEntregas(c.entregas), contagem, ...(obs ? { obs } : {}), ativo: c.ativo !== false };
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

const corpoDe = (req) => (typeof req.body === "string" ? (() => { try { return JSON.parse(req.body) ?? {}; } catch { return {}; } })() : req.body ?? {});

/**
 * Atende GET/POST de /api/instagram?influenciadores. `filtrar`: regra de visibilidade (server/visibilidade.js); `imagem`: lê a foto guardada.
 *   GET  -> { influenciadores, perfis, posts, contas }  (todos para dono e Master; só os da unidade para quem tem acesso por unidades)
 *   GET ?perfil=<@> -> a foto pequena do perfil (JPEG), só de influenciador que a pessoa vê
 *   POST { acao: "criar" | "atualizar" | "remover", ... }
 *     dono e Master: tudo, em qualquer unidade e na rede toda;
 *     acesso por unidades: cadastra, edita, desativa, reativa e remove só contratos das SUAS unidades (nunca a rede toda).
 *     Na simulação "ver como" vale o nível simulado.
 */
export async function tratarInfluenciadores(req, res, sessao, filtrar, { imagem } = {}) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const visiveis = filtrar(await lerFresco(), sessao);
      const usuarios = new Set(visiveis.map((i) => i.usuario));
      const perfis = await lerPerfis();
      // Foto de perfil (/api/instagram?perfil=<@>): só de quem a pessoa pode ver na lista.
      if (req.query?.perfil !== undefined) {
        const u = String(req.query.perfil);
        const stream = usuarios.has(u) && perfis[u]?.foto && imagem ? await imagem(idDaFoto(u)) : null;
        if (!stream) return res.status(404).end();
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "private, max-age=86400");
        return res.status(200).send(Buffer.from(await new Response(stream).arrayBuffer()));
      }
      // O que o perfil já mostra a qualquer pessoa (seguidores, se há foto) e o aviso quando o perfil não pôde ser lido.
      const doPerfil = Object.fromEntries(Object.entries(perfis).filter(([u]) => usuarios.has(u)).map(([u, p]) => [u, { seguidores: p.seguidores ?? null, publicacoes: p.publicacoes ?? null, foto: Boolean(p.foto), erro: p.erro ?? null }]));
      const guardados = await lerPostsGuardados();
      const posts = Object.fromEntries(Object.entries(guardados).filter(([u]) => usuarios.has(u)));
      return res.status(200).json({ influenciadores: visiveis, perfis: doPerfil, posts, contas: contasDaRede() });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
    const dono = sessao.papel === "dono";
    const master = sessao.papel === "master";
    const unidades = sessao.papel === "unidades" ? sessao.unidades ?? [] : null;
    if (!dono && !master && !unidades) return res.status(403).json({ error: "Sem permissão para cadastrar influenciadores." });
    const { acao, id, ...campos } = corpoDe(req);
    if (unidades) {
      if (acao === "criar" && !unidades.includes(campos.unidade)) return res.status(403).json({ error: "Escolha uma das suas unidades." });
      if (acao === "atualizar" || acao === "remover") {
        const atual = (await lerFresco()).find((x) => x.id === String(id ?? ""));
        if (!atual || !unidades.includes(atual.unidade)) return res.status(404).json({ error: "Influenciador não encontrado." }); // de outra unidade: nem existe para ela
        if (acao === "atualizar" && campos.unidade !== undefined && !unidades.includes(campos.unidade)) return res.status(403).json({ error: "Escolha uma das suas unidades." });
      }
    }
    if (acao === "criar") return res.status(200).json({ influenciador: await criarInfluenciador(campos) });
    if (acao === "atualizar") return res.status(200).json({ influenciador: await atualizarInfluenciador(String(id ?? ""), campos) });
    if (acao === "remover") { await removerInfluenciador(String(id ?? "")); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ error: "ação desconhecida" });
  } catch (e) {
    if (e instanceof ErroInfluenciador) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: "não consegui concluir agora" });
  }
}
