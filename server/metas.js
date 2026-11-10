// Metas da aba "Metas" da planilha (Mês | Unidade | Indicador | Bronze | Prata | Ouro), usadas no resumo diário.
// Mesma regra do painel (src/data/metas.ts): maior é melhor, exceto churn e inadimplência; "TOTAL"/"Rede" = meta da rede.
import { GoogleAuth } from "google-auth-library";

const SPREADSHEET_ID = "1TGh4MEDDbuRgJMkfYltP6II2s42z7L2Gv6RV7X9K1kg";
export const TIERS = ["bronze", "prata", "ouro"];

export const INDICADORES_META = {
  faturamento: { rotulo: "Faturamento", menorMelhor: false, formato: "moeda" },
  recebimento: { rotulo: "Recebimento", menorMelhor: false, formato: "moeda" },
  vendasOnline: { rotulo: "Vendas online", menorMelhor: false, formato: "moeda" },
  novosContratos: { rotulo: "Novos contratos", menorMelhor: false, formato: "numero" },
  churn: { rotulo: "Churn", menorMelhor: true, formato: "percentual" },
  inadimplenciaPerc: { rotulo: "Inadimplência", menorMelhor: true, formato: "percentual" },
  renovacoes: { rotulo: "Renovação", menorMelhor: false, formato: "percentual" },
  icv: { rotulo: "Conversão", menorMelhor: false, formato: "percentual" },
};

const APELIDOS = {
  faturamento: "faturamento", recebimento: "recebimento", "vendas online": "vendasOnline", "novos contratos": "novosContratos", churn: "churn",
  "inadimplência %": "inadimplenciaPerc", "inadimplencia %": "inadimplenciaPerc", inadimplência: "inadimplenciaPerc", inadimplencia: "inadimplenciaPerc",
  renovações: "renovacoes", renovacoes: "renovacoes", renovação: "renovacoes", icv: "icv", conversão: "icv", conversao: "icv",
};

const NOMES_MES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const numeroBR = (s) => {
  const c = String(s ?? "").replace(/"/g, "").trim().replace(/^R\$\s*/, "").replace(/%\s*$/, "").trim().replace(/\./g, "").replace(",", ".");
  return c === "" ? NaN : Number(c);
};

/** "Outubro", "out/2026", "10/2026" ou "2026-10" -> "2026-10" (sem ano, vale `anoPadrao`). */
export function mesDaMeta(bruto, anoPadrao) {
  const t = String(bruto ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let m = t.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${m[2].padStart(2, "0")}` : null;
  m = t.match(/^(\d{1,2})[\/.-](\d{4})$/);
  if (m) return +m[1] >= 1 && +m[1] <= 12 ? `${m[2]}-${m[1].padStart(2, "0")}` : null;
  m = t.match(/^([a-z]+)\.?(?:\s*(?:de|\/|-)?\s*(\d{2}|\d{4}))?$/);
  if (!m) return null;
  const i = NOMES_MES.findIndex((n) => n === m[1] || (m[1].length >= 3 && n.startsWith(m[1])));
  if (i < 0) return null;
  const ano = m[2] ? (m[2].length === 2 ? 2000 + +m[2] : +m[2]) : anoPadrao;
  return `${ano}-${String(i + 1).padStart(2, "0")}`;
}

/** Linhas da aba (matriz de textos) -> metas. Devolve [] se o cabeçalho não for o da aba Metas. */
export function parseMetas(linhas, anoPadrao = new Date().getUTCFullYear()) {
  if (!linhas || linhas.length < 2) return [];
  const cab = linhas[0].map((h) => String(h ?? "").trim().toLowerCase());
  const iM = cab.findIndex((h) => h === "mês" || h === "mes"), iU = cab.indexOf("unidade"), iI = cab.indexOf("indicador");
  const iT = Object.fromEntries(TIERS.map((t) => [t, cab.indexOf(t)]));
  if (iM < 0 || iU < 0 || iI < 0 || Object.values(iT).every((i) => i < 0)) return [];
  const out = [];
  for (const c of linhas.slice(1)) {
    const mes = mesDaMeta(c[iM], anoPadrao);
    const un = String(c[iU] ?? "").trim();
    const chave = APELIDOS[String(c[iI] ?? "").trim().toLowerCase()];
    if (!mes || !un || !chave) continue;
    const meta = { mes, chave, unidade: ["REDE", "TOTAL"].includes(un.toUpperCase()) ? "TOTAL" : un };
    for (const t of TIERS) { const v = iT[t] >= 0 ? numeroBR(c[iT[t]]) : NaN; if (Number.isFinite(v)) meta[t] = v; }
    if (TIERS.some((t) => meta[t] !== undefined)) out.push(meta);
  }
  return out;
}

/** Lê a aba Metas pela conta de serviço (GOOGLE_SERVICE_ACCOUNT_KEY). Lança erro se faltar a chave ou o acesso. */
export async function lerMetasPlanilha(chave = process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  if (!chave) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não configurada");
  const auth = new GoogleAuth({ credentials: JSON.parse(chave), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const { token } = await (await auth.getClient()).getAccessToken();
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent("'Metas'")}!A1:Z2000?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`API do Sheets: HTTP ${r.status}`);
  return parseMetas((await r.json()).values ?? []);
}

const atinge = (chave, atual, alvo) => (INDICADORES_META[chave].menorMelhor ? atual <= alvo : atual >= alvo);
const atingimento = (chave, atual, alvo) => {
  if (!Number.isFinite(atual) || !(alvo > 0)) return null;
  if (INDICADORES_META[chave].menorMelhor) return atual <= 0 ? 100 : (alvo / atual) * 100;
  return (atual / alvo) * 100;
};

/** Situação de um indicador diante da meta: nível atingido, próximo nível, quanto falta e % rumo a ele. */
export function situacaoMeta(chave, atual, meta) {
  let nivel = "abaixo";
  for (const t of [...TIERS].reverse()) if (meta[t] !== undefined && atinge(chave, atual, meta[t])) { nivel = t; break; }
  let proximo = null;
  for (const t of TIERS) if (meta[t] !== undefined && !atinge(chave, atual, meta[t])) { proximo = { nivel: t, alvo: meta[t], falta: Math.abs(meta[t] - atual), pct: Math.round(Math.max(0, Math.min(100, atingimento(chave, atual, meta[t]) ?? 0))) }; break; }
  // Topo = o nível mais alto cadastrado (em geral o ouro) e quanto falta para chegar nele.
  const topoNivel = [...TIERS].reverse().find((t) => meta[t] !== undefined);
  const topo = topoNivel ? { nivel: topoNivel, alvo: meta[topoNivel], falta: atinge(chave, atual, meta[topoNivel]) ? 0 : Math.abs(meta[topoNivel] - atual) } : null;
  return { nivel, proximo, topo };
}

export function formatarMeta(chave, v) {
  const f = INDICADORES_META[chave].formato;
  if (f === "moeda") return "R$ " + Math.round(v).toLocaleString("pt-BR");
  if (f === "percentual") return `${(Math.round(v * 10) / 10).toString().replace(".", ",")}%`;
  return Math.round(v).toLocaleString("pt-BR");
}
