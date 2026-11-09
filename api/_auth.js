// Autenticação do dashboard. O prefixo "_" faz a Vercel NÃO expor este arquivo como rota.
//
// Como funciona: quem entra em /api/login (e-mail + senha) recebe um token assinado (HMAC) que vale por 30 dias e só
// diz QUEM é a pessoa. O nível e as unidades vêm da lista de usuários a cada pedido, então desativar um acesso ou
// trocar o nível vale na hora (até 1 minuto por instância, por causa do cache).
//
// Transição: enquanto NÃO existe nenhum usuário, continua valendo a senha única (DASHBOARD_PASSWORD) e os tokens
// antigos, que contam como dono. Criado o dono, a senha única e os tokens antigos deixam de valer.
//
// Segredo de assinatura: SESSAO_SEGREDO (Vercel); se não existir, deriva de DASHBOARD_PASSWORD. Sem nenhum dos dois a
// proteção fica desligada, MAS se já existem usuários o servidor recusa tudo (nunca abre por esquecimento de variável).
import { createHmac, timingSafeEqual } from "node:crypto";
import { listarUsuarios } from "../server/acesso.js";

const DIAS = 30;

export const protegido = () => Boolean(process.env.DASHBOARD_PASSWORD);
const segredo = () => process.env.SESSAO_SEGREDO || process.env.DASHBOARD_PASSWORD || "";
export const temSegredo = () => Boolean(segredo());

// A chave derivada do segredo faz todos os tokens morrerem quando ele é trocado.
const chaveLegado = () => createHmac("sha256", "worldgym-dashboard").update(process.env.DASHBOARD_PASSWORD ?? "").digest();
const chaveUsuario = () => createHmac("sha256", "worldgym-dashboard-v2").update(segredo()).digest();
const assinar = (chave, corpo) => createHmac("sha256", chave).update(corpo).digest("base64url");

const iguais = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export const senhaCorreta = (senha) => protegido() && typeof senha === "string" && iguais(senha, process.env.DASHBOARD_PASSWORD);

/** Token da senha única (transição). */
export function criarToken(agora = Date.now()) {
  const exp = agora + DIAS * 24 * 3600 * 1000;
  const corpo = String(exp);
  return { token: `${corpo}.${assinar(chaveLegado(), corpo)}`, expiraEm: exp };
}

/** Token de uma pessoa: só guarda quem é (id) e quando vence. */
export function criarTokenUsuario(usuarioId, agora = Date.now()) {
  const exp = agora + DIAS * 24 * 3600 * 1000;
  const corpo = Buffer.from(JSON.stringify({ u: usuarioId, e: exp })).toString("base64url");
  return { token: `v2.${corpo}.${assinar(chaveUsuario(), corpo)}`, expiraEm: exp };
}

/** { tipo: "legado" } | { tipo: "usuario", uid } | null (assinatura errada, vencido ou lixo). */
export function lerToken(token, agora = Date.now()) {
  if (typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes[0] === "v2") {
    const [, corpo, assinatura] = partes;
    if (!corpo || !assinatura || !segredo() || !iguais(assinatura, assinar(chaveUsuario(), corpo))) return null;
    try {
      const { u, e } = JSON.parse(Buffer.from(corpo, "base64url").toString());
      return u && Number(e) > agora ? { tipo: "usuario", uid: u } : null;
    } catch {
      return null;
    }
  }
  const [corpo, assinatura] = partes;
  if (!corpo || !assinatura || !protegido() || !iguais(assinatura, assinar(chaveLegado(), corpo))) return null;
  return Number(corpo) > agora ? { tipo: "legado" } : null;
}

export const tokenValido = (token, agora = Date.now()) => lerToken(token, agora) !== null;

export const tokenDaRequisicao = (req) => String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");

const SESSAO_LEGADO = Object.freeze({ id: "legado", nome: "Senha única", email: "", papel: "dono", unidades: [], legado: true });
const SESSAO_ABERTA = Object.freeze({ id: "aberto", nome: "Sem proteção", email: "", papel: "dono", unidades: [], legado: true });

export const sessaoDe = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, unidades: u.unidades ?? [], legado: false });

/** Quem está fazendo o pedido, ou null. Confere o usuário na lista a cada vez (desativado = fora). */
export async function sessaoDaRequisicao(req) {
  const t = lerToken(tokenDaRequisicao(req));
  if (!t) return null;
  const lista = await listarUsuarios();
  if (t.tipo === "legado") return lista.length === 0 ? SESSAO_LEGADO : null;
  const u = lista.find((x) => x.id === t.uid && x.ativo !== false);
  return u ? sessaoDe(u) : null;
}

/**
 * Barra o pedido (401 sem login, 403 sem permissão) e devolve a sessão quando pode seguir; false quando já respondeu.
 * `papeis`: níveis aceitos (padrão: todos).
 */
export async function exigirLogin(req, res, { papeis } = {}) {
  try {
    if (!segredo()) {
      if ((await listarUsuarios()).length > 0) {
        res.setHeader("Cache-Control", "no-store");
        res.status(503).json({ error: "servidor sem a chave de acesso configurada" });
        return false;
      }
      return SESSAO_ABERTA;
    }
    const sessao = await sessaoDaRequisicao(req);
    if (!sessao) {
      res.setHeader("Cache-Control", "no-store");
      res.status(401).json({ error: "login necessário" });
      return false;
    }
    if (papeis && !papeis.includes(sessao.papel)) {
      res.setHeader("Cache-Control", "no-store");
      res.status(403).json({ error: "sem permissão" });
      return false;
    }
    return sessao;
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ error: "não consegui conferir o acesso agora" });
    return false;
  }
}

const ORIGENS = new Set(["https://welbertlucas.github.io", "http://localhost:5173"]);
export function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGENS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}
