// "Esqueci minha senha": a pessoa pede pelo e-mail, recebe um link de uso único (30 minutos) e escolhe a nova senha.
//
// Segurança:
//  - quem pede nunca descobre se o e-mail tem acesso (a resposta é sempre a mesma; ver api/login.js);
//  - a senha antiga continua valendo até o link ser usado (digitar o e-mail de outra pessoa não a tranca fora);
//  - o código do link não é guardado, só uma versão embaralhada (sha256); um pedido novo invalida o anterior;
//  - no máximo 3 pedidos por hora por pessoa; o limite por endereço fica em api/login.js (freio.js);
//  - ao redefinir, as sessões abertas dessa pessoa caem (`senhaEm`, ver api/_auth.js) e ela recebe o aviso "senha alterada".
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { lerJson, gravarJson } from "./armazem.js";
import { listarUsuarios, normalizarEmail, definirSenhaPorRedefinicao, registrarAcesso, ErroAcesso } from "./acesso.js";
import { avisarRedefinicao, avisarSenhaAlterada, VALIDADE_LINK_MIN } from "./avisos.js";

export const VALIDADE_MS = VALIDADE_LINK_MIN * 60_000;
export const MAX_PEDIDOS_POR_HORA = 3;
const HORA_MS = 3600_000;

/** Link que não confere, venceu ou já foi usado (conta como erro no freio do endereço). */
export class ErroLink extends ErroAcesso {
  constructor() {
    super("Este link venceu ou já foi usado. Peça um novo em “Esqueci minha senha”.", 400);
  }
}

const arquivoDe = (id) => `acessos/redefinicao/${String(id).replace(/[^a-z0-9-]/gi, "")}.json`;
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const iguais = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Gera o link e manda por e-mail, se o e-mail tem um acesso ativo. Não devolve nada que diga se tinha ou não:
 * quem chama responde sempre a mesma coisa. `enviado` existe para os testes.
 */
export async function pedirRedefinicao(email, ctx = {}, { agora = Date.now(), ...opc } = {}) {
  const alvo = normalizarEmail(email);
  const u = (await listarUsuarios()).find((x) => x.email === alvo && x.ativo !== false);
  if (!u) return { enviado: false };
  const arq = arquivoDe(u.id);
  const reg = (await lerJson(arq).catch(() => null)) ?? {};
  const pedidos = (reg.pedidos ?? []).filter((t) => agora - t < HORA_MS);
  if (pedidos.length >= MAX_PEDIDOS_POR_HORA) return { enviado: false, limitado: true };
  const segredo = randomBytes(32).toString("base64url");
  await gravarJson(arq, { hash: sha(segredo), exp: agora + VALIDADE_MS, pedidos: [...pedidos, agora] });
  const { enviados } = await avisarRedefinicao(u, `${u.id}.${segredo}`, ctx, { agora, ...opc });
  await registrarAcesso({ email: u.email, usuarioId: u.id, nome: u.nome, ok: false, evento: "redefinicao-pedida" }, agora).catch(() => {});
  return { enviado: enviados > 0 };
}

/**
 * Confere o link e grava a nova senha. Senha fraca (400) NÃO gasta o link: a pessoa tenta outra.
 * Link errado, vencido ou já usado lança ErroLink.
 */
export async function redefinirComToken(token, nova, ctx = {}, { agora = Date.now(), ...opc } = {}) {
  const partes = String(token ?? "").split(".");
  const [id, segredo] = partes;
  if (partes.length !== 2 || !/^[a-z0-9-]{8,64}$/i.test(id) || segredo.length < 20 || segredo.length > 100) throw new ErroLink();
  const arq = arquivoDe(id);
  const reg = await lerJson(arq).catch(() => null);
  if (!reg?.hash || !(reg.exp > agora) || !iguais(sha(segredo), reg.hash)) throw new ErroLink();
  const u = await definirSenhaPorRedefinicao(id, nova, agora); // senha fraca ou conta desativada lançam aqui, antes de gastar o link
  await gravarJson(arq, { pedidos: reg.pedidos ?? [] }); // o link morre; o histórico de pedidos continua para o limite por hora
  await registrarAcesso({ email: u.email, usuarioId: u.id, nome: u.nome, ok: false, evento: "senha-redefinida" }, agora).catch(() => {});
  await avisarSenhaAlterada(u, ctx, { agora, ...opc }).catch(() => {});
  return u;
}
