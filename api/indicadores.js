// Totais mensais por unidade calculados a partir do EVO (gravados por /api/evo-sync).
// GET /api/indicadores            -> lista de meses disponíveis
// GET /api/indicadores?month=AAAA-MM -> unidades daquele mês
import { loadMonth, listMonths, loadAll } from "../server/store.js";
import { cors, exigirLogin } from "./_auth.js";
import { filtrarMes, filtrarMeses } from "../server/visibilidade.js";

// Memória da instância: enquanto ela estiver quente, abrir o painel não gasta nenhuma operação no Blob.
const TTL_MS = 10 * 60 * 1000;
let memo = null;

async function todosOsMeses() {
  if (memo && Date.now() - memo.em < TTL_MS) return memo.dados;
  // 1 leitura do arquivo consolidado; se ainda não existir, cai no caminho antigo (listagem + 1 leitura por mês).
  let dados = await loadAll();
  if (!dados) {
    const meses = await listMonths();
    dados = (await Promise.all(meses.map((m) => loadMonth(m)))).filter(Boolean);
  }
  memo = { em: Date.now(), dados };
  return dados;
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;

  try {
    const { month, all } = req.query;
    // ?all=1: todos os meses numa só resposta (o painel abre com uma consulta em vez de 36).
    if (all) {
      const dados = await todosOsMeses();
      res.setHeader("Cache-Control", "private, max-age=300");
      return res.status(200).json({ months: filtrarMeses(dados, sessao) });
    }
    if (!month) return res.status(200).json({ months: await listMonths() });
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "month deve ser AAAA-MM" });
    const data = await loadMonth(month);
    if (!data) return res.status(404).json({ error: "mês ainda não calculado" });
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).json(filtrarMes(data, sessao));
  } catch (err) {
    return res.status(500).json({ error: String(err.message ?? err) });
  }
}
