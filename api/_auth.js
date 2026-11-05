// Senha única do dashboard. O prefixo "_" faz a Vercel NÃO expor este arquivo como rota.
//
// Como funciona: quem acerta a senha em /api/login recebe um token assinado (HMAC) que vale por 30 dias.
// As rotas de dados (sheet-data, indicadores) exigem esse token. Quem só tem o link vê a tela de senha e nenhum dado.
// A senha vem da env var DASHBOARD_PASSWORD (Vercel). Sem ela a proteção fica desligada (útil só para
// publicar o código antes de configurar a senha).
import { createHmac, timingSafeEqual } from "node:crypto";

const DIAS = 30;

export const protegido = () => Boolean(process.env.DASHBOARD_PASSWORD);

// A chave derivada da senha faz todos os tokens antigos morrerem quando a senha é trocada.
const chave = () => createHmac("sha256", "worldgym-dashboard").update(process.env.DASHBOARD_PASSWORD ?? "").digest();
const assinar = (corpo) => createHmac("sha256", chave()).update(corpo).digest("base64url");

const iguais = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export const senhaCorreta = (senha) => protegido() && typeof senha === "string" && iguais(senha, process.env.DASHBOARD_PASSWORD);

export function criarToken(agora = Date.now()) {
  const exp = agora + DIAS * 24 * 3600 * 1000;
  const corpo = String(exp);
  return { token: `${corpo}.${assinar(corpo)}`, expiraEm: exp };
}

export function tokenValido(token, agora = Date.now()) {
  if (typeof token !== "string") return false;
  const [corpo, assinatura] = token.split(".");
  if (!corpo || !assinatura || !iguais(assinatura, assinar(corpo))) return false;
  return Number(corpo) > agora;
}

export const tokenDaRequisicao = (req) => String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");

/** Barra a requisição (401) quando a senha está ligada e o token não vale. Devolve true se pode seguir. */
export function exigirLogin(req, res) {
  if (!protegido() || tokenValido(tokenDaRequisicao(req))) return true;
  res.setHeader("Cache-Control", "no-store");
  res.status(401).json({ error: "login necessário" });
  return false;
}

const ORIGENS = new Set(["https://welbertlucas.github.io", "http://localhost:5173"]);
export function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGENS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}
