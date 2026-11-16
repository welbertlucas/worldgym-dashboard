// Prints das telas da central de ajuda (gravados por scripts/ajuda-imagens.mjs, com números fictícios).
// GET /api/ajuda?imagem=<nome> -> PNG (só com login)
import { loadImagemAjuda } from "../server/store.js";
import { cors, exigirLogin } from "./_auth.js";

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;
  const nome = typeof req.query?.imagem === "string" ? req.query.imagem : "";
  if (!/^[a-z0-9-]{1,40}$/.test(nome)) return res.status(404).end();
  try {
    const stream = await loadImagemAjuda(nome);
    if (!stream) return res.status(404).end();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.status(200).send(Buffer.from(await new Response(stream).arrayBuffer()));
  } catch (e) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
