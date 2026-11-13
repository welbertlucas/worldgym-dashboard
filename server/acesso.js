// Usuários do dashboard: quem pode entrar, com que nível e em quais unidades.
//
// Níveis:
//   dono      -> tudo, inclusive criar e mexer em acessos (só existe um, criado uma vez)
//   master    -> todos os dados, sem a tela de acessos
//   unidades  -> só as unidades escolhidas; o benchmark da rede vem com os nomes escondidos
//
// As senhas nunca são guardadas: só uma versão embaralhada (scrypt) que não dá para desfazer.
import { randomBytes, randomInt, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import { lerJson, gravarJson } from "./armazem.js";
import { UNIT_NAMES } from "./units.js";

export const PAPEIS = ["dono", "master", "unidades"];
export const UNIDADES_DA_REDE = Object.values(UNIT_NAMES);

const ARQUIVO = "acesso/usuarios.json";
const TTL_MS = 60 * 1000;
let memo = null;

export class ErroAcesso extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

export const normalizarEmail = (e) => String(e ?? "").trim().toLowerCase();
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;

/** Lista de usuários (com cache de 1 minuto por instância: abrir o painel não lê o Blob toda vez). */
export async function listarUsuarios(agora = Date.now()) {
  if (memo && agora - memo.em < TTL_MS) return memo.lista;
  const lista = (await lerJson(ARQUIVO)) ?? [];
  memo = { em: agora, lista };
  return lista;
}

async function salvar(lista) {
  await gravarJson(ARQUIVO, lista);
  memo = { em: Date.now(), lista };
}

export const limparCache = () => { memo = null; };

/** O que sai para a tela: nunca o hash da senha. */
/** `resumo`: recebe o resumo diário por e-mail (quem foi criado antes da opção recebe, como sempre recebeu). */
export const recebeResumo = (u) => u.ativo !== false && u.resumo !== false;
export const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, unidades: u.unidades ?? [], ativo: u.ativo !== false, resumo: u.resumo !== false, criadoEm: u.criadoEm });

export function hashSenha(senha) {
  const sal = randomBytes(16);
  const h = scryptSync(String(senha), sal, 64);
  return `scrypt$${sal.toString("base64url")}$${h.toString("base64url")}`;
}

export function conferirSenha(senha, guardado) {
  const [tipo, sal, h] = String(guardado ?? "").split("$");
  if (tipo !== "scrypt" || !sal || !h) return false;
  const esperado = Buffer.from(h, "base64url");
  const obtido = scryptSync(String(senha ?? ""), Buffer.from(sal, "base64url"), esperado.length);
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}

// Sem caracteres que se confundem (0/O, 1/l/I) para a senha provisória ser fácil de ditar.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export const gerarSenhaProvisoria = () => Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

function validarBasico({ nome, email }, lista, ignorarId) {
  const n = String(nome ?? "").trim();
  const e = normalizarEmail(email);
  if (n.length < 2 || n.length > 80) throw new ErroAcesso("Informe o nome da pessoa.");
  if (!emailValido(e)) throw new ErroAcesso("E-mail inválido.");
  if (lista.some((u) => u.email === e && u.id !== ignorarId)) throw new ErroAcesso("Já existe um acesso com esse e-mail.", 409);
  return { nome: n, email: e };
}

function validarUnidades(unidades) {
  const lista = Array.isArray(unidades) ? [...new Set(unidades.map((x) => String(x).trim()))] : [];
  if (lista.length === 0) throw new ErroAcesso("Escolha ao menos uma unidade.");
  const fora = lista.find((n) => !UNIDADES_DA_REDE.includes(n));
  if (fora) throw new ErroAcesso(`Unidade desconhecida: ${fora}.`);
  return lista;
}

/** Primeira conta do sistema: o dono. Só vale enquanto não existe nenhum usuário. */
export async function criarDono({ nome, email, senha }) {
  const lista = await lerFresco();
  if (lista.length > 0) throw new ErroAcesso("O dono já foi criado.", 409);
  const dados = validarBasico({ nome, email }, lista);
  if (String(senha ?? "").length < 10) throw new ErroAcesso("A senha precisa ter pelo menos 10 caracteres.");
  const u = { id: randomUUID(), ...dados, papel: "dono", unidades: [], ativo: true, hash: hashSenha(senha), criadoEm: new Date().toISOString() };
  await salvar([u]);
  return publico(u);
}

/** Cria um acesso com senha provisória (mostrada uma única vez ao dono). */
export async function criarUsuario({ nome, email, papel, unidades, resumo = true }) {
  const lista = await lerFresco();
  if (papel === "dono" || !PAPEIS.includes(papel)) throw new ErroAcesso("Nível inválido.");
  const dados = validarBasico({ nome, email }, lista);
  const senhaProvisoria = gerarSenhaProvisoria();
  const u = {
    id: randomUUID(), ...dados, papel,
    unidades: papel === "unidades" ? validarUnidades(unidades) : [],
    ativo: true, resumo: resumo !== false, hash: hashSenha(senhaProvisoria), criadoEm: new Date().toISOString(),
  };
  await salvar([...lista, u]);
  return { usuario: publico(u), senhaProvisoria };
}

export async function redefinirSenha(id) {
  const lista = await lerFresco();
  const u = lista.find((x) => x.id === id);
  if (!u) throw new ErroAcesso("Acesso não encontrado.", 404);
  const senhaProvisoria = gerarSenhaProvisoria();
  u.hash = hashSenha(senhaProvisoria);
  await salvar(lista);
  return { usuario: publico(u), senhaProvisoria };
}

/** Muda nome, nível, unidades, se recebe o resumo diário, ou desativa/reativa. O dono não pode ser rebaixado nem desativado. */
export async function atualizarUsuario(id, campos) {
  const lista = await lerFresco();
  const u = lista.find((x) => x.id === id);
  if (!u) throw new ErroAcesso("Acesso não encontrado.", 404);
  if (u.papel === "dono" && (campos.papel !== undefined && campos.papel !== "dono" || campos.ativo === false)) {
    throw new ErroAcesso("O dono não pode ser rebaixado nem desativado.", 403);
  }
  if (campos.nome !== undefined || campos.email !== undefined) {
    const d = validarBasico({ nome: campos.nome ?? u.nome, email: campos.email ?? u.email }, lista, u.id);
    u.nome = d.nome;
    u.email = d.email;
  }
  if (campos.papel !== undefined) {
    if (u.papel !== "dono") {
      if (campos.papel === "dono" || !PAPEIS.includes(campos.papel)) throw new ErroAcesso("Nível inválido.");
      u.papel = campos.papel;
    }
  }
  if (u.papel === "unidades") u.unidades = validarUnidades(campos.unidades ?? u.unidades);
  else u.unidades = [];
  if (campos.ativo !== undefined) u.ativo = Boolean(campos.ativo);
  if (campos.resumo !== undefined) u.resumo = Boolean(campos.resumo);
  await salvar(lista);
  return publico(u);
}

/** Confere e-mail e senha. Devolve o usuário ativo ou null (sem dizer qual dos dois errou). */
export async function autenticar(email, senha) {
  const lista = await listarUsuarios();
  const u = lista.find((x) => x.email === normalizarEmail(email));
  // Gasta o mesmo tempo quando o e-mail não existe, para não revelar quem tem acesso.
  const ok = conferirSenha(senha, u?.hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA");
  return u && ok && u.ativo !== false ? u : null;
}

// Antes de gravar, relê do Blob (ignora o cache) para não sobrescrever uma mudança feita por outra instância.
async function lerFresco() {
  limparCache();
  return structuredClone(await listarUsuarios());
}

// ----- Registro de acessos (um arquivo por mês) -----
const arquivoLog = (ym) => `acesso/log-${ym}.json`;
const LIMITE_LOG = 3000;
const ultimaFalha = new Map();
export const limparFreio = () => ultimaFalha.clear();

const mesDe = (d) => new Date(d).toISOString().slice(0, 7);

/** Anota uma entrada (ok) ou tentativa errada de um e-mail que existe. Falhas de e-mails que não existem não são gravadas. */
export async function registrarAcesso({ email, usuarioId = null, nome = null, ok }, agora = Date.now()) {
  if (!ok) {
    const chave = normalizarEmail(email);
    if (agora - (ultimaFalha.get(chave) ?? 0) < 60_000) return; // freia quem insiste: no máximo 1 registro por minuto
    ultimaFalha.set(chave, agora);
  }
  const arq = arquivoLog(mesDe(agora));
  const atual = (await lerJson(arq)) ?? [];
  atual.push({ em: new Date(agora).toISOString(), email: normalizarEmail(email), usuarioId, nome, ok });
  await gravarJson(arq, atual.slice(-LIMITE_LOG));
}

/** Entradas mais recentes primeiro (mês atual e o anterior). */
export async function lerRegistro(agora = Date.now(), limite = 200) {
  const d = new Date(agora);
  const anterior = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const [a, b] = await Promise.all([lerJson(arquivoLog(mesDe(agora))), lerJson(arquivoLog(mesDe(anterior)))]);
  return [...(b ?? []), ...(a ?? [])].reverse().slice(0, limite);
}
