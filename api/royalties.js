// Royalties (só dono, Master e quem o dono liberou).
// GET /api/royalties -> { disponivel: false } enquanto a rotina de royalties não enviou dados, ou { disponivel: true, ...modelo }.
// Dado financeiro da marca: sem cache no navegador e conferido a cada pedido.
import { lerRoyalties } from "../server/royalties.js";
import { cors, exigirLogin } from "./_auth.js";

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "método não permitido" });
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;
  if (!sessao.verRoyalties) return res.status(403).json({ error: "sem permissão" });
  try {
    const dados = await lerRoyalties();
    if (!dados) return res.status(200).json({ disponivel: false });
    return res.status(200).json({ disponivel: true, ...dados });
  } catch {
    return res.status(503).json({ error: "não consegui ler os royalties agora" });
  }
}
