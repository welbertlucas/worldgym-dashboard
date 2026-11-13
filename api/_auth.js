// Autenticação do dashboard. O prefixo "_" faz a Vercel NÃO expor este arquivo como rota.
//
// Como funciona: quem entra em /api/login (e-mail + senha) recebe um token assinado (HMAC) que só diz QUEM é a pessoa
// e vence após 12 horas SEM USO: cada pedido aceito devolve um token novo no cabeçalho X-Atlas-Token (no máximo a cada
// 5 minutos), e o navegador troca o seu. Quem fica 12 horas sem mexer no Atlas precisa entrar de novo. O nível e as unidades vêm da lista de usuários a cada pedido, então desativar um acesso ou
// trocar o nível vale na hora (até 1 minuto por instância, por causa do cache).
//
// Transição: enquanto NÃO existe nenhum usuário, continua valendo a senha única (DASHBOARD_PASSWORD) e os tokens
// antigos, que contam como dono. Criado o dono, a senha única e os tokens antigos deixam de valer.
//
// Segredo de assinatura: SESSAO_SEGREDO (Vercel); se não existir, deriva de DASHBOARD_PASSWORD. Sem nenhum dos dois a
// proteção fica desligada, MAS se já existem usuários o servidor recusa tudo (nunca abre por esquecimento de variável).
import { createHmac, timingSafeEqual } from "node:crypto";
import { listarUsuarios, gerenciaAcessos } from "../server/acesso.js";
import { UNIT_NAMES } from "../server/units.js";

/** Tempo sem uso até o login cair. */
export const INATIVIDADE_MS = 12 * 3600 * 1000;
/** Só troca o token se o atual tiver mais que isto (evita gerar um token a cada pedido). */
const RENOVAR_APOS_MS = 5 * 60 * 1000;
export const CABECALHO_TOKEN = "X-Atlas-Token";

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
  const exp = agora + INATIVIDADE_MS;
  const corpo = String(exp);
  return { token: `${corpo}.${assinar(chaveLegado(), corpo)}`, expiraEm: exp };
}

/** Token de uma pessoa: só guarda quem é (id) e quando vence. */
export function criarTokenUsuario(usuarioId, agora = Date.now()) {
  const exp = agora + INATIVIDADE_MS;
  const corpo = Buffer.from(JSON.stringify({ u: usuarioId, e: exp })).toString("base64url");
  return { token: `v2.${corpo}.${assinar(chaveUsuario(), corpo)}`, expiraEm: exp };
}

/** { tipo: "legado" } | { tipo: "usuario", uid, exp } | null (assinatura errada, vencido ou lixo). */
export function lerToken(token, agora = Date.now()) {
  if (typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes[0] === "v2") {
    const [, corpo, assinatura] = partes;
    if (!corpo || !assinatura || !segredo() || !iguais(assinatura, assinar(chaveUsuario(), corpo))) return null;
    try {
      const { u, e } = JSON.parse(Buffer.from(corpo, "base64url").toString());
      return u && Number(e) > agora ? { tipo: "usuario", uid: u, exp: Number(e) } : null;
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

export const sessaoDe = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, unidades: u.unidades ?? [], gerenciaAcessos: gerenciaAcessos(u), legado: false });

/**
 * "Ver como": o dono pode olhar o painel como Master ou como o acesso de algumas unidades, para conferir o que cada
 * nível enxerga. O pedido vem no cabeçalho X-Atlas-Ver-Como ("master" ou "unidades:<nomes separados por |>", com
 * encodeURIComponent). Só vale para quem É dono; para qualquer outro nível o cabeçalho é ignorado. Durante a simulação
 * a sessão é a do nível escolhido (os filtros do servidor valem de verdade) e leva papelReal = "dono" para o painel
 * mostrar o aviso e o botão de voltar.
 */
export const CABECALHO_VER_COMO = "X-Atlas-Ver-Como";
export function aplicarVerComo(sessao, pedido, nomesValidos = Object.values(UNIT_NAMES)) {
  if (!sessao || sessao.papel !== "dono" || typeof pedido !== "string" || !pedido) return sessao;
  if (pedido === "master") return { ...sessao, papel: "master", unidades: [], gerenciaAcessos: false, papelReal: "dono" };
  if (!pedido.startsWith("unidades:")) return sessao;
  let nomes = [];
  try { nomes = decodeURIComponent(pedido.slice(9)).split("|").map((n) => n.trim()); } catch { return sessao; }
  const unidades = [...new Set(nomes.filter((n) => nomesValidos.includes(n)))];
  return unidades.length ? { ...sessao, papel: "unidades", unidades, gerenciaAcessos: false, papelReal: "dono" } : sessao;
}
const pedidoVerComo = (req) => req.headers?.[CABECALHO_VER_COMO.toLowerCase()];

/** Quem está fazendo o pedido, ou null. Confere o usuário na lista a cada vez (desativado = fora).
 *  Com `res`, renova o login (mais 12 horas a partir de agora) mandando o token novo no cabeçalho X-Atlas-Token. */
export async function sessaoDaRequisicao(req, res = null, agora = Date.now()) {
  const t = lerToken(tokenDaRequisicao(req), agora);
  if (!t) return null;
  const lista = await listarUsuarios();
  if (t.tipo === "legado") return lista.length === 0 ? SESSAO_LEGADO : null;
  const u = lista.find((x) => x.id === t.uid && x.ativo !== false);
  if (!u) return null;
  // Renova quando o token tem mais de 5 minutos. Tokens antigos de 30 dias (resta mais que 12 horas) viram de 12 horas no primeiro uso.
  const resta = t.exp - agora;
  if (res && (resta <= INATIVIDADE_MS - RENOVAR_APOS_MS || resta > INATIVIDADE_MS)) res.setHeader(CABECALHO_TOKEN, criarTokenUsuario(u.id, agora).token);
  return aplicarVerComo(sessaoDe(u), pedidoVerComo(req));
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
    const sessao = await sessaoDaRequisicao(req, res);
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

const ORIGENS = new Set(["https://welbertlucas.github.io", "https://atlas.worldgymacademia.com.br", "http://localhost:5173"]);
export function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGENS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", `Origin, Authorization, ${CABECALHO_VER_COMO}`);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", `Authorization, Content-Type, ${CABECALHO_VER_COMO}`);
  res.setHeader("Access-Control-Expose-Headers", CABECALHO_TOKEN);
}
