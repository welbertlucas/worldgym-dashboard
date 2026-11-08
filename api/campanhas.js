// Campanhas de anúncio ativas (foto diária gravada por scripts/meta-campanhas.mjs).
// GET /api/campanhas -> { geradoEm, campanhas: [...], erros: [...] }
import { loadCampanhas } from "../server/store.js";
import { cors, exigirLogin } from "./_auth.js";

const TTL_MS = 10 * 60 * 1000;
let memo = null;

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!exigirLogin(req, res)) return;
  try {
    if (!memo || Date.now() - memo.em > TTL_MS) memo = { em: Date.now(), dados: (await loadCampanhas()) ?? { geradoEm: null, campanhas: [], erros: [] } };
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).json(memo.dados);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
