// Despertador: a Vercel chama esta rota no horário marcado (vercel.json -> "crons") e ela manda o GitHub rodar a rotina
// na hora. Existe porque o agendador do próprio GitHub atrasa de 8 a 10 horas (novembro/2026), enquanto o "rodar agora"
// (workflow_dispatch) começa em segundos. O trabalho pesado continua no GitHub: leva horas, mais que uma função da Vercel.
//
// GET /api/despertador?rotina=evo-sync | meta-sync | resumo-diario
// Só a Vercel chama: ela manda "Authorization: Bearer <CRON_SECRET>". Variáveis (Vercel, produção):
//   CRON_SECRET            segredo que a própria Vercel envia nas chamadas agendadas
//   GITHUB_DISPATCH_TOKEN  chave do GitHub com permissão só de "Actions: leitura e escrita" neste repositório
import { timingSafeEqual } from "node:crypto";

const REPO = "welbertlucas/worldgym-dashboard";
export const ROTINAS = {
  "evo-sync": "evo-sync.yml",
  "meta-sync": "meta-sync.yml",
  "resumo-diario": "resumo-diario.yml",
};

function autorizado(header) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const a = Buffer.from(String(header ?? ""));
  const b = Buffer.from(`Bearer ${segredo}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!autorizado(req.headers.authorization)) return res.status(401).json({ error: "não autorizado" });
  const rotina = String(req.query.rotina ?? "");
  const arquivo = ROTINAS[rotina];
  if (!arquivo) return res.status(400).json({ error: `rotina desconhecida: ${rotina}` });
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return res.status(500).json({ error: "GITHUB_DISPATCH_TOKEN não configurado" });

  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${arquivo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "worldgym-atlas-despertador",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!r.ok) {
    const detalhe = (await r.text()).slice(0, 200);
    console.log(`despertador: ${rotina} falhou no GitHub (${r.status}) ${detalhe}`);
    return res.status(502).json({ error: `GitHub ${r.status}`, detalhe });
  }
  console.log(`despertador: ${rotina} disparada`);
  return res.status(200).json({ ok: true, rotina });
}
