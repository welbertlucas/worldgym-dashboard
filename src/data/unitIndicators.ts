import { type UnitData } from "@/data/dashboardData";

// Configuração de APRESENTAÇÃO dos indicadores por unidade. Não calcula nada novo: reaproveita as regras
// que já existiam (direção favorável do comparativo antigo e faixas de cor da tabela de desempenho).

export type Category = "financeiro" | "comercial" | "retencao" | "complementares";
export type Format = "currency" | "percent" | "number" | "decimal";
export type Tone = "good" | "warn" | "bad";
/** higher = maior é melhor; lower = menor é melhor; null = sem regra de interpretação (só mostra os valores). */
export type Direction = "higher" | "lower" | null;

export interface Indicator {
  key: string;
  label: string;
  category: Category;
  format: Format;
  direction: Direction;
  value: (u: UnitData) => number;
  /** Valor 0 significa "sem dado" (campo em branco na planilha) para este indicador. */
  zeroMeansNoData?: boolean;
  /** Faixas de cor já usadas na tabela de desempenho. */
  tone?: (v: number) => Tone;
  toneHint?: string;
  /** Limites numéricos das mesmas faixas de `tone` ([atenção, crítico/bom]); usados só para desenhar o velocímetro. */
  toneStops?: [number, number];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  financeiro: "Financeiro",
  comercial: "Comercial",
  retencao: "Retenção",
  complementares: "Receitas complementares",
};

const field = (key: keyof UnitData) => (u: UnitData) => u[key] as number;

// Direção: mesma regra do comparativo antigo (maior é melhor, exceto churn, cancelados e inadimplência).
// Receitas complementares ficam SEM regra: não há critério definido de "melhor" entre unidades.
export const INDICATORS: Indicator[] = [
  { key: "faturamento", label: "Faturamento", category: "financeiro", format: "currency", direction: "higher", value: field("faturamento") },
  { key: "recebimento", label: "Recebimento", category: "financeiro", format: "currency", direction: "higher", value: field("recebimento") },
  { key: "ticketMedio", label: "Ticket médio", category: "financeiro", format: "currency", direction: "higher", value: field("ticketMedio") },
  { key: "novosContratos", label: "Novos contratos", category: "comercial", format: "number", direction: "higher", value: field("novosContratos") },
  { key: "vendasOnline", label: "Vendas online", category: "comercial", format: "currency", direction: "higher", value: field("vendasOnline") },
  {
    key: "icv", label: "Taxa de conversão", category: "comercial", format: "percent", direction: "higher", value: field("icv"),
    tone: (v) => (v > 60 ? "good" : v > 40 ? "warn" : "bad"), toneHint: "verde acima de 60%, vermelho abaixo de 40%", toneStops: [40, 60],
  },
  { key: "adimplentes", label: "Adimplentes", category: "retencao", format: "number", direction: "higher", value: field("adimplentes") },
  { key: "cancelados", label: "Cancelados", category: "retencao", format: "number", direction: "lower", value: field("cancelados") },
  { key: "saldo", label: "Saldo de clientes", category: "retencao", format: "number", direction: "higher", value: (u) => u.novosContratos - u.cancelados },
  {
    key: "churn", label: "Churn", category: "retencao", format: "percent", direction: "lower", value: field("churn"),
    tone: (v) => (v > 8 ? "bad" : v > 5 ? "warn" : "good"), toneHint: "vermelho acima de 8%, verde até 5%", toneStops: [5, 8],
  },
  {
    key: "renovacoes", label: "Renovação", category: "retencao", format: "percent", direction: "higher", value: field("renovacoes"),
    tone: (v) => (v < 40 ? "bad" : v < 60 ? "warn" : "good"), toneHint: "vermelho abaixo de 40%, verde a partir de 60%", toneStops: [40, 60],
  },
  {
    key: "inadimplenciaPerc", label: "Inadimplência", category: "retencao", format: "percent", direction: "lower", value: field("inadimplenciaPerc"),
    tone: (v) => (v > 8 ? "bad" : v > 5 ? "warn" : "good"), toneHint: "vermelho acima de 8%, verde até 5%", toneStops: [5, 8],
  },
  { key: "notaGoogle", label: "Nota do Google", category: "retencao", format: "decimal", direction: "higher", value: field("notaGoogle"), zeroMeansNoData: true },
  { key: "nps", label: "NPS", category: "retencao", format: "decimal", direction: "higher", value: field("nps"), zeroMeansNoData: true },
  { key: "diarias", label: "Diárias", category: "complementares", format: "currency", direction: null, value: field("diarias") },
  { key: "personal", label: "Taxa de personal", category: "complementares", format: "currency", direction: null, value: field("personal") },
  { key: "camisetas", label: "Camisetas", category: "complementares", format: "currency", direction: null, value: field("camisetas") },
  { key: "coqueteleiras", label: "Coqueteleiras", category: "complementares", format: "currency", direction: null, value: field("coqueteleiras") },
];

export const INDICATOR_BY_KEY: Record<string, Indicator> = Object.fromEntries(INDICATORS.map((i) => [i.key, i]));

export function hasData(ind: Indicator, v: number): boolean {
  return !(ind.zeroMeansNoData && v === 0);
}

export function formatIndicator(ind: Indicator, v: number): string {
  if (!hasData(ind, v)) return "—";
  switch (ind.format) {
    case "currency": return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
    case "percent": return `${v.toFixed(1).replace(".", ",")}%`;
    case "decimal": return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    default: return v.toLocaleString("pt-BR");
  }
}

export const isPercentIndicator = (ind: Indicator) => ind.format === "percent";

/** Diferença absoluta com sinal: "p.p." nos percentuais (nunca "%"), unidade do indicador nos demais. */
export function formatDelta(ind: Indicator, d: number): string {
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  const abs = Math.abs(d);
  if (ind.format === "percent") return `${sign}${abs.toFixed(abs < 0.1 && abs > 0 ? 2 : 1).replace(".", ",")} p.p.`;
  return `${sign}${formatIndicator(ind, abs)}`;
}

/** Variação relativa com sinal, sempre em "%". */
export function formatRelative(d: number): string {
  return `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1).replace(".", ",")}%`;
}

/** Diferença relativa de A sobre B, em %. Fórmula idêntica à do comparativo anterior (0 quando B é zero). */
export function relativeDiff(a: number, b: number): number {
  return b !== 0 ? ((a - b) / Math.abs(b)) * 100 : 0;
}

/** Abaixo disto (em %), a diferença é tratada como equivalente — mesmo limite do comparativo anterior. */
export const EQUAL_BELOW_PCT = 0.5;

export type CompareState =
  | "ok" // há diferença calculável e regra de interpretação: existe um lado favorável
  | "equal" // diferença desprezível
  | "neutral" // há diferença, mas o indicador não tem regra de interpretação
  | "nodata" // um dos lados não tem dado
  | "uncomputable"; // base zero: a diferença não é calculável

export interface Comparison {
  a: number;
  b: number;
  /** Diferença relativa em % (fórmula existente). */
  diff: number | null;
  /** Diferença absoluta A − B, na unidade do indicador (p.p. nos percentuais). Complementar à relativa. */
  delta: number | null;
  winner: "a" | "b" | null;
  state: CompareState;
}

export function compareIndicator(ind: Indicator, ua: UnitData, ub: UnitData): Comparison {
  const a = ind.value(ua);
  const b = ind.value(ub);
  if (!hasData(ind, a) || !hasData(ind, b)) return { a, b, diff: null, delta: null, winner: null, state: "nodata" };
  if (b === 0) return { a, b, diff: null, delta: null, winner: null, state: "uncomputable" };
  const diff = relativeDiff(a, b);
  const delta = a - b;
  if (Math.abs(diff) < EQUAL_BELOW_PCT) return { a, b, diff, delta, winner: null, state: "equal" };
  if (!ind.direction) return { a, b, diff, delta, winner: null, state: "neutral" };
  const aIsFavorable = (diff > 0) === (ind.direction === "higher");
  return { a, b, diff, delta, winner: aIsFavorable ? "a" : "b", state: "ok" };
}

export interface CompareSummary {
  winsA: number;
  winsB: number;
  equal: number;
  neutral: number;
  /** Sem comparação possível (sem dado ou base zero): precisam de análise adicional. */
  needsReview: { indicator: Indicator; comparison: Comparison }[];
  /** Maiores diferenças relativas entre os indicadores comparáveis. */
  biggest: { indicator: Indicator; comparison: Comparison }[];
}

export function summarizeComparison(ua: UnitData, ub: UnitData, biggestCount = 3): CompareSummary {
  const out: CompareSummary = { winsA: 0, winsB: 0, equal: 0, neutral: 0, needsReview: [], biggest: [] };
  const comparable: { indicator: Indicator; comparison: Comparison }[] = [];
  for (const indicator of INDICATORS) {
    const comparison = compareIndicator(indicator, ua, ub);
    if (comparison.state === "ok") { comparison.winner === "a" ? out.winsA++ : out.winsB++; }
    else if (comparison.state === "equal") out.equal++;
    else if (comparison.state === "neutral") out.neutral++;
    else out.needsReview.push({ indicator, comparison });
    if (comparison.diff !== null && comparison.state !== "equal") comparable.push({ indicator, comparison });
  }
  out.biggest = comparable.sort((x, y) => Math.abs(y.comparison.diff!) - Math.abs(x.comparison.diff!)).slice(0, biggestCount);
  return out;
}

/** Por que o indicador não pôde ser comparado (texto para o usuário). */
export function reviewReason(ind: Indicator, c: Comparison): string {
  if (c.state === "uncomputable") return "segunda unidade com valor zero: base de comparação zero";
  const missA = !hasData(ind, c.a);
  const missB = !hasData(ind, c.b);
  if (missA && missB) return "sem dado nas duas unidades";
  return missA ? "sem dado na primeira unidade" : "sem dado na segunda unidade";
}

export interface ToneZone { from: number; to: number; tone: Tone }

/**
 * Faixas verde/âmbar/vermelho do indicador como intervalos numéricos (0 → max), para o velocímetro.
 * Usa os mesmos limites de `tone`: menor é melhor = bom, atenção, crítico; maior é melhor = crítico, atenção, bom.
 */
export function toneZones(ind: Indicator, max: number): ToneZone[] | null {
  if (!ind.toneStops || !ind.direction) return null;
  const [a, b] = ind.toneStops;
  return ind.direction === "lower"
    ? [{ from: 0, to: a, tone: "good" }, { from: a, to: b, tone: "warn" }, { from: b, to: max, tone: "bad" }]
    : [{ from: 0, to: a, tone: "bad" }, { from: a, to: b, tone: "warn" }, { from: b, to: max, tone: "good" }];
}

/** Fim da escala do velocímetro: percentuais "maior é melhor" vão a 100; "menor é melhor", 1,5× o limite crítico (ou o valor, se maior). */
export function gaugeMax(ind: Indicator, value: number): number {
  if (ind.direction === "higher") return 100;
  const stop = ind.toneStops?.[1] ?? 10;
  return Math.max(stop * 1.5, Math.ceil(value * 1.1));
}
