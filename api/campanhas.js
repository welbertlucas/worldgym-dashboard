// Campanhas de anúncio ativas (foto diária gravada por scripts/meta-campanhas.mjs).
// GET /api/campanhas -> { geradoEm, campanhas: [...], erros: [...], meses: { [AAAA-MM]: { geradoEm, unidades, erros } } }
import { loadCampanhas, loadMetaMeses } from "../server/store.js";
import { cors, exigirLogin } from "./_auth.js";
import { filtrarCampanhas } from "../server/visibilidade.js";

const TTL_MS = 10 * 60 * 1000;
let memo = null;

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;
  // O dono (papelReal vale também no "Ver como") vê sempre o dado mais novo: sem cache no navegador e sem a memória da instância.
  const fresco = (sessao.papelReal ?? sessao.papel) === "dono";
  try {
    if (fresco || !memo || Date.now() - memo.em > TTL_MS) {
      const [foto, meses] = await Promise.all([loadCampanhas(), loadMetaMeses()]);
      memo = { em: Date.now(), dados: { ...(foto ?? { geradoEm: null, campanhas: [], erros: [] }), meses: meses ?? {} } };
    }
    res.setHeader("Cache-Control", fresco ? "no-store" : "private, max-age=300");
    return res.status(200).json(filtrarCampanhas(memo.dados, sessao));
  } catch (e) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
