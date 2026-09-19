// Função serverless (Vercel) que lê a planilha operacional autenticada com uma
// conta de serviço do Google e devolve o CSV pro dashboard — assim a planilha
// pode ficar restrita (não mais "qualquer pessoa com o link") sem quebrar o
// botão "Atualizar da planilha", que continua chamando um endpoint só que agora
// passa por aqui em vez de falar direto com o Google.
//
// Requer a env var GOOGLE_SERVICE_ACCOUNT_KEY (conteúdo JSON da chave da conta
// de serviço, como string) configurada no projeto Vercel.

import { GoogleAuth } from "google-auth-library";

const SPREADSHEET_ID = "1TGh4MEDDbuRgJMkfYltP6II2s42z7L2Gv6RV7X9K1kg";
const ALLOWED_ORIGINS = new Set([
  "https://welbertlucas.github.io",
  "http://localhost:5173",
]);

function escapeCsvField(value) {
  const s = value ?? "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não configurada");

    const credentials = JSON.parse(keyJson);
    const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    const sheetsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:Z2000?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!sheetsRes.ok) {
      throw new Error(`API do Sheets: HTTP ${sheetsRes.status} — ${await sheetsRes.text()}`);
    }
    const { values } = await sheetsRes.json();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(rowsToCsv(values ?? []));
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
}
