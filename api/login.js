// GET  /api/login          -> { protegido: boolean, logado: boolean }
// POST /api/login {senha}  -> { token, expiraEm } ou 401
import { protegido, senhaCorreta, criarToken, tokenValido, tokenDaRequisicao, cors } from "./_auth.js";

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({ protegido: protegido(), logado: !protegido() || tokenValido(tokenDaRequisicao(req)) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  const senha = typeof req.body === "string" ? safeJson(req.body).senha : req.body?.senha;
  if (!senhaCorreta(senha)) {
    await new Promise((r) => setTimeout(r, 1000)); // freia tentativa em série
    return res.status(401).json({ error: "senha incorreta" });
  }
  return res.status(200).json(criarToken());
}

function safeJson(s) {
  try { return JSON.parse(s) ?? {}; } catch { return {}; }
}
