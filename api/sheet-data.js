// Função serverless (Vercel) que lê a planilha operacional autenticada com uma
// conta de serviço do Google e devolve o CSV pro dashboard — assim a planilha
// pode ficar restrita (não mais "qualquer pessoa com o link") sem quebrar o
// botão "Atualizar da planilha", que continua chamando um endpoint só que agora
// passa por aqui em vez de falar direto com o Google.
//
// Requer a env var GOOGLE_SERVICE_ACCOUNT_KEY (conteúdo JSON da chave da conta
// de serviço, como string) configurada no projeto Vercel.

import { GoogleAuth } from "google-auth-library";
import { cors, exigirLogin } from "./_auth.js";
import { filtrarLinhasPlanilha, filtrarLinhasMetas } from "../server/visibilidade.js";

const SPREADSHEET_ID = "1TGh4MEDDbuRgJMkfYltP6II2s42z7L2Gv6RV7X9K1kg";

// Abas que o endpoint aceita via ?sheet=... (lista fechada). Sem o parâmetro lê a primeira aba.
const ALLOWED_SHEETS = new Set(["Metas"]);

function escapeCsvField(value) {
  const s = value ?? "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;

  try {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não configurada");

    const credentials = JSON.parse(keyJson);
    const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    const sheet = typeof req.query?.sheet === "string" ? req.query.sheet : "";
    if (sheet && !ALLOWED_SHEETS.has(sheet)) {
      res.status(400).json({ error: "Aba não permitida" });
      return;
    }
    const range = sheet ? `${encodeURIComponent(`'${sheet}'`)}!A1:Z2000` : "A1:Z2000";

    const sheetsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!sheetsRes.ok) {
      throw new Error(`API do Sheets: HTTP ${sheetsRes.status} — ${await sheetsRes.text()}`);
    }
    const { values } = await sheetsRes.json();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const linhas = values ?? [];
    res.status(200).send(rowsToCsv(sheet === "Metas" ? filtrarLinhasMetas(linhas, sessao) : filtrarLinhasPlanilha(linhas, sessao)));
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
}
