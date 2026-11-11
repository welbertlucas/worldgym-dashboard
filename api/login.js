// GET  /api/login                   -> { protegido, logado, comEmail, usuario? }
// POST /api/login {email, senha}    -> { token, expiraEm, usuario } ou 401
// POST /api/login {senha}           -> só na transição (enquanto não existe nenhum usuário): senha única de antes
import {
  protegido, temSegredo, senhaCorreta, criarToken, criarTokenUsuario, sessaoDaRequisicao, cors,
} from "./_auth.js";
import { listarUsuarios, autenticar, publico, registrarAcesso, normalizarEmail } from "../server/acesso.js";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const doCorpo = (req) => (typeof req.body === "string" ? safeJson(req.body) : req.body ?? {});

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const lista = await listarUsuarios();
    const comEmail = lista.length > 0;
    const protege = comEmail || protegido() || temSegredo();

    if (req.method === "GET") {
      const sessao = protege ? await sessaoDaRequisicao(req, res) : null; // abrir o Atlas também renova o login
      const logado = !protege || Boolean(sessao);
      const usuario = sessao ? { nome: sessao.nome, email: sessao.email, papel: sessao.papel, unidades: sessao.unidades, legado: sessao.legado } : null;
      return res.status(200).json({ protegido: protege, logado, comEmail, usuario });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

    const { email, senha } = doCorpo(req);

    if (!comEmail) {
      // Transição: ainda não existe nenhum usuário, vale a senha única.
      if (!senhaCorreta(senha)) {
        await esperar(1000); // freia tentativa em série
        return res.status(401).json({ error: "senha incorreta" });
      }
      return res.status(200).json(criarToken());
    }

    if (!temSegredo()) return res.status(503).json({ error: "servidor sem a chave de acesso configurada" });
    const u = await autenticar(email, senha);
    if (!u) {
      const existe = lista.some((x) => x.email === normalizarEmail(email));
      if (existe) await registrarAcesso({ email, ok: false }).catch(() => {});
      await esperar(1000);
      return res.status(401).json({ error: "e-mail ou senha incorretos" });
    }
    await registrarAcesso({ email: u.email, usuarioId: u.id, nome: u.nome, ok: true }).catch(() => {}); // o registro não derruba o login
    return res.status(200).json({ ...criarTokenUsuario(u.id), usuario: publico(u) });
  } catch (e) {
    return res.status(500).json({ error: "não consegui entrar agora" });
  }
}

function safeJson(s) {
  try { return JSON.parse(s) ?? {}; } catch { return {}; }
}
