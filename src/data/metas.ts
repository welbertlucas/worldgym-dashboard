import { type UnitData, type MonthData, dashboardData } from "@/data/dashboardData";

// Aba "Metas" da planilha — colunas: Mês | Unidade | Indicador | Bronze | Prata | Ouro
// Unidade "TOTAL" (ou "Rede") = meta da rede. Mês: aaaa-mm, ou por nome ("Outubro", "out/2026", "10/2026"); sem ano, vale o ano do último mês da planilha.
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

function defaultMetaYear(): number {
  const last = dashboardData[dashboardData.length - 1]?.month;
  return last ? Number(last.slice(0, 4)) : new Date().getFullYear();
}

const MONTH_NAMES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Converte o texto da coluna Mês em "aaaa-mm". Aceita aaaa-mm, "Outubro", "out/2026", "10/2026". null se não reconhecer. */
export function parseMetaMonth(raw: string, defaultYear: number): string | null {
  const t = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let m = t.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${m[2].padStart(2, "0")}` : null;
  m = t.match(/^(\d{1,2})[\/.-](\d{4})$/);
  if (m) return +m[1] >= 1 && +m[1] <= 12 ? `${m[2]}-${m[1].padStart(2, "0")}` : null;
  m = t.match(/^([a-z]+)\.?(?:\s*(?:de|\/|-)?\s*(\d{2}|\d{4}))?$/);
  if (!m) return null;
  const idx = MONTH_NAMES.findIndex((n) => n === m![1] || (m![1].length >= 3 && n.startsWith(m![1])));
  if (idx < 0) return null;
  const year = m[2] ? (m[2].length === 2 ? 2000 + +m[2] : +m[2]) : defaultYear;
  return `${year}-${String(idx + 1).padStart(2, "0")}`;
}

/** Devolve [] se o CSV não tiver o formato da aba Metas (ex.: endpoint ainda devolve a aba principal). */
export function parseMetasCSV(csv: string, defaultYear: number = defaultMetaYear()): Meta[] {
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
    const month = parseMetaMonth(c[iM] ?? "", defaultYear);
    const unitRaw = (c[iU] ?? "").trim();
    const key = INDICATOR_ALIASES[(c[iI] ?? "").trim().toLowerCase()];
    if (!month || !unitRaw || !key) continue;
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

/** Meta de nível único (só uma das colunas Bronze/Prata/Ouro preenchida): a tela a chama de "Meta". */
export function isSingleGoal(meta: Meta): boolean {
  return TIERS.filter((t) => meta[t] !== undefined).length === 1;
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

// ---------------------------------------------------------------------------------------------
// Geometria de apresentação do acompanhamento de metas (anel e barra de faixas).
// Não cria regra nova: usa tierReached/nextTier/attainment já existentes.

/** Progresso rumo ao próximo nível ainda não atingido (0–100). `next` nulo = todos os níveis atingidos. */
export function progressToNext(key: MetaKey, actual: number, meta: Meta): { pct: number; next: { tier: Tier; value: number; gap: number } | null } {
  const next = nextTier(key, actual, meta);
  if (!next) return { pct: 100, next: null };
  const a = attainment(key, actual, next.value);
  return { pct: a === null ? 0 : Math.max(0, Math.min(100, a)), next };
}

export interface BulletZone { from: number; to: number; tier: TierResult }
export interface BulletScale {
  max: number;
  zones: BulletZone[];
  /** Posição (0–100) de cada marco e do realizado ao longo da barra. */
  markers: { tier: Tier; value: number; pos: number }[];
  actualPos: number;
}

/**
 * Barra de faixas: eixo em unidades reais do indicador, de 0 até um pouco além do maior valor relevante.
 * Maior é melhor: abaixo → bronze → prata → ouro (da esquerda para a direita).
 * Menor é melhor: ouro → prata → bronze → abaixo (o ouro é o menor valor).
 */
export function bulletScale(key: MetaKey, actual: number, meta: Meta): BulletScale | null {
  const pts = TIERS.filter((t) => meta[t] !== undefined).map((t) => ({ tier: t, value: meta[t]! })).sort((a, b) => a.value - b.value);
  if (!pts.length || !Number.isFinite(actual)) return null;
  const lower = META_INDICATORS[key].lowerIsBetter;
  const top = pts[pts.length - 1].value;
  const max = Math.max(top * (lower ? 1.25 : 1.15), Math.max(actual, 0) * 1.05);
  if (!(max > 0)) return null;
  const zones: BulletZone[] = [];
  if (lower) {
    zones.push({ from: 0, to: pts[0].value, tier: pts[0].tier });
    for (let i = 0; i < pts.length - 1; i++) zones.push({ from: pts[i].value, to: pts[i + 1].value, tier: pts[i + 1].tier });
    zones.push({ from: top, to: max, tier: "abaixo" });
  } else {
    zones.push({ from: 0, to: pts[0].value, tier: "abaixo" });
    for (let i = 0; i < pts.length - 1; i++) zones.push({ from: pts[i].value, to: pts[i + 1].value, tier: pts[i].tier });
    zones.push({ from: top, to: max, tier: pts[pts.length - 1].tier });
  }
  const pos = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  return { max, zones, markers: pts.map((p) => ({ ...p, pos: pos(p.value) })), actualPos: pos(actual) };
}

/** Indicadores em valor absoluto que podem ser somados entre unidades. */
const ADDITIVE: MetaKey[] = ["faturamento", "recebimento", "vendasOnline", "novosContratos"];

export interface GoalTarget {
  meta: Meta;
  actual: number;
  /** Quantas unidades compõem a meta (só na soma da rede). */
  units?: number;
}

/**
 * Meta e realizado de uma unidade ou da rede no mês.
 * Rede sem meta própria ("TOTAL"): para indicadores somáveis, usa a soma das unidades que têm meta
 * (realizado também só dessas unidades, para a conta fechar). Percentuais não são somados.
 */
export function resolveGoal(metas: Meta[], md: MonthData, month: string, unit: string | null, key: MetaKey): GoalTarget | null {
  const own = getMeta(metas, month, unit ?? "TOTAL", key);
  if (own) {
    const actual = actualFor(md, unit ?? "TOTAL", key);
    return actual === null ? null : { meta: own, actual };
  }
  if (unit !== null || !ADDITIVE.includes(key)) return null;
  const rows = md.units.map((u) => ({ u, m: getMeta(metas, month, u.name, key) })).filter((r): r is { u: UnitData; m: Meta } => !!r.m);
  if (!rows.length) return null;
  const meta: Meta = { month, key, unit: "TOTAL" };
  for (const t of TIERS) if (rows.every((r) => r.m[t] !== undefined)) meta[t] = rows.reduce((s, r) => s + r.m[t]!, 0);
  if (!TIERS.some((t) => meta[t] !== undefined)) return null;
  return { meta, actual: rows.reduce((s, r) => s + r.u[key], 0), units: rows.length };
}
