// Gestão de acessos: só o dono.
// GET  /api/usuarios            -> { usuarios, unidades, legado }   (legado: true = ainda sem nenhum usuário, só a senha única)
// GET  /api/usuarios?registro=1 -> { registro: [...] }              (entradas e tentativas erradas, mais novas primeiro)
// POST /api/usuarios { acao: "primeiro-dono" | "criar" | "atualizar" | "redefinir", ... }
//   criar/redefinir -> { usuario, senhaProvisoria, email: { enviado, para, erro? } }
import { cors, exigirLogin } from "./_auth.js";
import {
  listarUsuarios, criarDono, criarUsuario, atualizarUsuario, redefinirSenha, lerRegistro, publico, UNIDADES_DA_REDE, ErroAcesso,
} from "../server/acesso.js";
import { enviarAcesso } from "../server/boasVindas.js";

const doCorpo = (req) => (typeof req.body === "string" ? safeJson(req.body) : req.body ?? {});

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  const sessao = await exigirLogin(req, res, { papeis: ["dono"] });
  if (!sessao) return;

  try {
    if (req.method === "GET") {
      if (req.query?.registro) return res.status(200).json({ registro: await lerRegistro() });
      const lista = await listarUsuarios();
      return res.status(200).json({ usuarios: lista.map(publico), unidades: UNIDADES_DA_REDE, legado: lista.length === 0 });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

    const { acao, ...campos } = doCorpo(req);
    if (acao === "primeiro-dono") {
      if (sessao.id === "aberto") return res.status(409).json({ error: "Configure a senha do servidor antes de criar o dono." });
      return res.status(200).json({ usuario: await criarDono(campos) });
    }
    if (sessao.legado) return res.status(409).json({ error: "Crie primeiro a sua conta de dono." });
    // Criar e "Nova senha" também mandam a senha por e-mail (Zoho). Se o e-mail falhar, a senha continua na tela.
    if (acao === "criar" || acao === "redefinir") {
      const r = acao === "criar" ? await criarUsuario(campos) : await redefinirSenha(campos.id);
      const email = await enviarAcesso(r.usuario, r.senhaProvisoria, { novo: acao === "criar" });
      return res.status(200).json({ ...r, email });
    }
    if (acao === "atualizar") {
      const { id, ...resto } = campos;
      return res.status(200).json({ usuario: await atualizarUsuario(id, resto) });
    }
    return res.status(400).json({ error: "ação desconhecida" });
  } catch (e) {
    if (e instanceof ErroAcesso) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: "não consegui concluir agora" });
  }
}

function safeJson(s) {
  try { return JSON.parse(s) ?? {}; } catch { return {}; }
}
