// POST /api/senha { atual, nova } -> { ok: true, usuario }   (a pessoa escolhe a própria senha; a atual é a provisória na primeira vez)
// Só quem está logado com e-mail e senha. Errar a senha atual conta no freio de tentativas (como no login).
import { cors, sessaoDaRequisicao } from "./_auth.js";
import { definirNovaSenha, publico, listarUsuarios, ErroAcesso } from "../server/acesso.js";
import { bloqueadoPor, anotarErro, zerarErros, enderecoDe } from "../server/freio.js";
import { avisarSenhaAlterada } from "../server/avisos.js";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const doCorpo = (req) => (typeof req.body === "string" ? safeJson(req.body) : req.body ?? {});

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
  try {
    const sessao = await sessaoDaRequisicao(req, res);
    if (!sessao) return res.status(401).json({ error: "login necessário" });
    if (sessao.legado) return res.status(409).json({ error: "Crie primeiro a sua conta de dono." });
    const chaveUsuario = `senha:${sessao.id}`, chaveIp = `ip:${enderecoDe(req)}`;
    const espera = Math.max(await bloqueadoPor(chaveUsuario), await bloqueadoPor(chaveIp));
    if (espera > 0) {
      res.setHeader("Retry-After", String(espera * 60));
      return res.status(429).json({ error: "muitas tentativas", minutos: espera });
    }
    const { atual, nova } = doCorpo(req);
    try {
      const u = await definirNovaSenha(sessao.id, atual, nova);
      await zerarErros(chaveUsuario);
      await avisarSenhaAlterada(u, { ua: req.headers?.["user-agent"], ip: enderecoDe(req), headers: req.headers ?? {} });
      return res.status(200).json({ ok: true, usuario: u });
    } catch (e) {
      if (e instanceof ErroAcesso && e.status === 401) {
        await anotarErro(chaveUsuario, "email");
        await anotarErro(chaveIp, "ip");
        await esperar(1000);
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof ErroAcesso) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: "não consegui trocar a senha agora" });
  }
}

function safeJson(s) {
  try { return JSON.parse(s) ?? {}; } catch { return {}; }
}
