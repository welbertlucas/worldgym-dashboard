// POST /api/atividade { eventos: [{ tela, evento, unidade?, mes?, em? }] } -> { ok: true, gravados }   (até 50 por pedido)
// O painel avisa qual tela a pessoa abriu ("tela") ou se ela exportou/imprimiu ("exportar"). Só para quem está logado com e-mail.
// O dono simulando outro nível ("ver como") não entra no registro. Quem lê é o dono, em GET /api/usuarios?atividade=1.
import { cors, sessaoDaRequisicao } from "./_auth.js";
import { registrarAtividade } from "../server/acesso.js";

const doCorpo = (req) => {
  if (typeof req.body !== "string") return req.body ?? {};
  try { return JSON.parse(req.body) ?? {}; } catch { return {}; }
};

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
  try {
    const sessao = await sessaoDaRequisicao(req, res);
    if (!sessao) return res.status(401).json({ error: "login necessário" });
    const { eventos } = doCorpo(req);
    if (!Array.isArray(eventos)) return res.status(400).json({ error: "pedido inválido" });
    const gravados = sessao.papelReal ? 0 : await registrarAtividade({ usuario: sessao, eventos });
    return res.status(200).json({ ok: true, gravados });
  } catch {
    return res.status(500).json({ error: "não consegui registrar agora" });
  }
}
