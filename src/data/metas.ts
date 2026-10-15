import { type UnitData, type MonthData } from "@/data/dashboardData";

// Aba "Metas" da planilha — colunas: Mês | Unidade | Indicador | Bronze | Prata | Ouro
// Unidade "TOTAL" (ou "Rede") = meta da rede. Mês no formato aaaa-mm.
const METAS_URL = "https://worldgym-dashboard-sigma.vercel.app/api/sheet-data?sheet=Metas";

export type MetaKey = keyof Pick<
  UnitData,
  "faturamento" | "recebimento" | "vendasOnline" | "novosContratos" | "churn" | "inadimplenciaPerc" | "renovacoes" | "icv"
>;

export type Tier = "bronze" | "prata" | "ouro";
export type TierResult = Tier | "abaixo";
export const TIERS: Tier[] = ["bronze", "prata", "ouro"];
export const TIER_LABEL: Record<TierResult, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro", abaixo: "Abaixo do bronze" };

/** Uma linha da aba Metas: os três níveis são opcionais, mas pelo menos um precisa existir. */
export interface Meta {
  month: string;
  unit: string; // nome da unidade ou "TOTAL"
  key: MetaKey;
  bronze?: number;
  prata?: number;
  ouro?: number;
}

export const META_INDICATORS: Record<MetaKey, { label: string; lowerIsBetter: boolean; format: "currency" | "number" | "percent" }> = {
  faturamento: { label: "Faturamento", lowerIsBetter: false, format: "currency" },
  recebimento: { label: "Recebimento", lowerIsBetter: false, format: "currency" },
  vendasOnline: { label: "Vendas Online", lowerIsBetter: false, format: "currency" },
  novosContratos: { label: "Novos Contratos", lowerIsBetter: false, format: "number" },
  churn: { label: "Churn", lowerIsBetter: true, format: "percent" },
  inadimplenciaPerc: { label: "Inadimplência %", lowerIsBetter: true, format: "percent" },
  renovacoes: { label: "Renovação", lowerIsBetter: false, format: "percent" },
  icv: { label: "Conversão", lowerIsBetter: false, format: "percent" },
};

const INDICATOR_ALIASES: Record<string, MetaKey> = {
  faturamento: "faturamento",
  recebimento: "recebimento",
  "vendas online": "vendasOnline",
  "novos contratos": "novosContratos",
  churn: "churn",
  "inadimplência %": "inadimplenciaPerc",
  "inadimplencia %": "inadimplenciaPerc",
  inadimplência: "inadimplenciaPerc",
  inadimplencia: "inadimplenciaPerc",
  renovações: "renovacoes",
  renovacoes: "renovacoes",
  renovação: "renovacoes",
  icv: "icv",
  conversão: "icv",
  conversao: "icv",
};

export let metasData: Meta[] = [];

function parseBR(s: string | undefined): number {
  if (!s) return NaN;
  const c = s.replace(/"/g, "").trim().replace(/^R\$\s*/, "").replace(/%\s*$/, "").trim().replace(/\./g, "").replace(",", ".");
  return c === "" ? NaN : Number(c);
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Devolve [] se o CSV não tiver o formato da aba Metas (ex.: endpoint ainda devolve a aba principal). */
export function parseMetasCSV(csv: string): Meta[] {
  const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const iM = header.findIndex((h) => h === "mês" || h === "mes");
  const iU = header.indexOf("unidade");
  const iI = header.indexOf("indicador");
  const iT = { bronze: header.indexOf("bronze"), prata: header.indexOf("prata"), ouro: header.indexOf("ouro") };
  if (iM < 0 || iU < 0 || iI < 0 || Object.values(iT).every((i) => i < 0)) return [];
  const out: Meta[] = [];
  for (const line of lines.slice(1)) {
    const c = splitLine(line);
    const month = (c[iM] ?? "").trim().replace(/^(\d{4})-(\d)$/, "$1-0$2");
    const unitRaw = (c[iU] ?? "").trim();
    const key = INDICATOR_ALIASES[(c[iI] ?? "").trim().toLowerCase()];
    if (!/^\d{4}-\d{2}$/.test(month) || !unitRaw || !key) continue;
    const meta: Meta = { month, key, unit: ["REDE", "TOTAL"].includes(unitRaw.toUpperCase()) ? "TOTAL" : unitRaw };
    for (const tier of TIERS) {
      const v = iT[tier] >= 0 ? parseBR(c[iT[tier]]) : NaN;
      if (Number.isFinite(v)) meta[tier] = v;
    }
    if (TIERS.some((tier) => meta[tier] !== undefined)) out.push(meta);
  }
  return out;
}

export async function syncMetasFromSheets(): Promise<{ ok: boolean; count: number }> {
  try {
    const res = await fetch(METAS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseMetasCSV(await res.text());
    metasData = parsed;
    return { ok: true, count: parsed.length };
  } catch {
    metasData = [];
    return { ok: false, count: 0 };
  }
}

/** Atingimento em %: realizado/alvo (maior é melhor) ou alvo/realizado (menor é melhor). null se não calculável. */
export function attainment(key: MetaKey, actual: number, target: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  if (META_INDICATORS[key].lowerIsBetter) return actual <= 0 ? 100 : (target / actual) * 100;
  return (actual / target) * 100;
}

export function actualFor(m: MonthData, unit: string, key: MetaKey): number | null {
  if (unit === "TOTAL") {
    if (key === "novosContratos") return m.units.reduce((s, u) => s + u.novosContratos, 0);
    return m.total[key];
  }
  const u = m.units.find((x) => x.name === unit);
  return u ? u[key] : null;
}

export function getMeta(metas: Meta[], month: string, unit: string, key: MetaKey): Meta | undefined {
  return metas.find((x) => x.month === month && x.unit === unit && x.key === key);
}

const meets = (key: MetaKey, actual: number, target: number) => (META_INDICATORS[key].lowerIsBetter ? actual <= target : actual >= target);

/** Maior nível atingido entre os definidos; "abaixo" se nenhum. */
export function tierReached(key: MetaKey, actual: number, meta: Meta): TierResult {
  for (const tier of [...TIERS].reverse()) {
    const v = meta[tier];
    if (v !== undefined && meets(key, actual, v)) return tier;
  }
  return "abaixo";
}

/** Nível mais baixo definido (referência do "mínimo aceitável"). */
export function lowestTier(meta: Meta): { tier: Tier; value: number } | null {
  for (const tier of TIERS) if (meta[tier] !== undefined) return { tier, value: meta[tier]! };
  return null;
}

/** Nível mais alto definido (referência de 100% nos gráficos). */
export function highestTier(meta: Meta): { tier: Tier; value: number } | null {
  for (const tier of [...TIERS].reverse()) if (meta[tier] !== undefined) return { tier, value: meta[tier]! };
  return null;
}

/** Próximo nível ainda não atingido (o mais baixo que falta) e quanto falta. */
export function nextTier(key: MetaKey, actual: number, meta: Meta): { tier: Tier; value: number; gap: number } | null {
  for (const tier of TIERS) {
    const v = meta[tier];
    if (v !== undefined && !meets(key, actual, v)) return { tier, value: v, gap: Math.abs(v - actual) };
  }
  return null;
}

/** Avisos de cadastro: níveis fora de ordem (bronze deveria ser o mais fácil e ouro o mais difícil). */
export function metaWarnings(metas: Meta[]): string[] {
  const out: string[] = [];
  for (const m of metas) {
    const vals = TIERS.map((t) => m[t]).filter((v): v is number => v !== undefined);
    const asc = META_INDICATORS[m.key].lowerIsBetter ? [...vals].sort((a, b) => b - a) : [...vals].sort((a, b) => a - b);
    if (vals.some((v, i) => v !== asc[i])) out.push(`${m.unit === "TOTAL" ? "Rede" : m.unit} • ${META_INDICATORS[m.key].label} • ${m.month}: bronze, prata e ouro fora de ordem.`);
  }
  return out;
}

export function formatMetaValue(key: MetaKey, v: number): string {
  const f = META_INDICATORS[key].format;
  if (f === "currency") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
  if (f === "percent") return `${v.toFixed(1).replace(".", ",")}%`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
