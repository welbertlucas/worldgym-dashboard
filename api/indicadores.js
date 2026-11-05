// Totais mensais por unidade calculados a partir do EVO (gravados por /api/evo-sync).
// GET /api/indicadores            -> lista de meses disponíveis
// GET /api/indicadores?month=AAAA-MM -> unidades daquele mês
import { loadMonth, listMonths } from "../server/store.js";

const ALLOWED_ORIGINS = new Set(["https://welbertlucas.github.io", "http://localhost:5173"]);

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { month } = req.query;
    if (!month) return res.status(200).json({ months: await listMonths() });
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "month deve ser AAAA-MM" });
    const data = await loadMonth(month);
    if (!data) return res.status(404).json({ error: "mês ainda não calculado" });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err.message ?? err) });
  }
}
