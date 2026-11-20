// Royalties e Jurídico (as duas telas passam por aqui para caber no limite de funções da Vercel; /api/juridico é um rewrite).
//   GET /api/royalties -> { disponivel: false } enquanto a rotina de royalties não enviar dados, ou { disponivel: true, ...modelo }. Só dono, Master e liberados.
//   GET /api/juridico  -> { disponivel: false } ou { disponivel: true, ...modelo }. Só o dono e quem ele liberou (modelo sem nome de parte contrária).
// Dado sensível: sem cache no navegador e permissão conferida a cada pedido.
import { lerRoyalties } from "../server/royalties.js";
import { lerJuridico } from "../server/juridico.js";
import { cors, exigirLogin } from "./_auth.js";

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "método não permitido" });
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;
  const juridico = req.query?.modulo === "juridico";
  if (!(juridico ? sessao.verJuridico : sessao.verRoyalties)) return res.status(403).json({ error: "sem permissão" });
  try {
    const dados = await (juridico ? lerJuridico() : lerRoyalties());
    if (!dados) return res.status(200).json({ disponivel: false });
    return res.status(200).json({ disponivel: true, ...dados });
  } catch {
    return res.status(503).json({ error: `não consegui ler ${juridico ? "o jurídico" : "os royalties"} agora` });
  }
}
