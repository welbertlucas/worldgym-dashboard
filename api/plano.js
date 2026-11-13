// "Feito" do Plano de ação.
// GET  /api/plano?mes=AAAA-MM                      -> { feitos: { "Unidade|tipo": { por, em } } } (só unidades visíveis)
// POST /api/plano { mes, unidade, tipo, feito }     -> { item: { por, em } | null }
import { cors, exigirLogin } from "./_auth.js";
import { ErroPlano, feitosDoMes, marcarItem } from "../server/planoFeitos.js";

const corpo = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {});

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") return res.status(200).json({ feitos: await feitosDoMes(String(req.query?.mes ?? ""), sessao) });
    if (req.method === "POST") {
      const { mes, unidade, tipo, feito } = corpo(req);
      return res.status(200).json({ item: await marcarItem({ mes, unidade, tipo, feito: Boolean(feito) }, sessao) });
    }
    return res.status(405).json({ error: "método não aceito" });
  } catch (e) {
    if (e instanceof ErroPlano) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
