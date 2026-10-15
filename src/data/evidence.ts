import { type MonthData, type UnitData } from "@/data/dashboardData";
import { type Alert, type AlertKind, sameMonthLastYear } from "@/data/alerts";

// Evidências tiradas da própria planilha para cada alerta (sem IA, sem chamada externa).
// Cruza os outros indicadores da mesma unidade/mês e compara com a rede. Tudo é fato calculado;
// as HIPÓTESES continuam sendo "a verificar" — aqui só se diz se os números dão ou não indício delas.

export type ProbeKey = "novos" | "cancel" | "base" | "ticket" | "renov" | "inad" | "conv" | "online" | "satisf" | "churn";

interface Probe {
  label: string;
  mode: "pct" | "pp";
  /** Valor do indicador numa visão de mês (unidade ou rede). */
  pick: (v: View) => number;
  fmt: (n: number) => string;
  /** Variação que conta como sinal de piora. */
  bad: (d: number) => boolean;
  /** Ignora a comparação se o valor-base for menor que isto (evita % sobre base minúscula). */
  minBase?: number;
}

interface View { total: UnitData; units: UnitData[] }

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dec = (n: number) => n.toFixed(1).replace(".", ",");
const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
const pctv = (n: number) => `${dec(n)}%`;
const sum = (v: View, f: (u: UnitData) => number) => v.units.reduce((s, u) => s + f(u), 0);

const PROBES: Record<ProbeKey, Probe> = {
  novos: { label: "Novos contratos", mode: "pct", pick: (v) => sum(v, (u) => u.novosContratos), fmt: int, bad: (d) => d <= -10, minBase: 10 },
  cancel: { label: "Cancelamentos", mode: "pct", pick: (v) => v.total.cancelados, fmt: int, bad: (d) => d >= 10, minBase: 10 },
  base: { label: "Adimplentes (base de alunos)", mode: "pct", pick: (v) => v.total.adimplentes, fmt: int, bad: (d) => d <= -2, minBase: 50 },
  ticket: { label: "Ticket médio", mode: "pct", pick: (v) => v.total.ticketMedio, fmt: brl, bad: (d) => d <= -3, minBase: 1 },
  renov: { label: "Renovação", mode: "pp", pick: (v) => v.total.renovacoes, fmt: pctv, bad: (d) => d <= -3 },
  inad: { label: "Inadimplência", mode: "pp", pick: (v) => v.total.inadimplenciaPerc, fmt: pctv, bad: (d) => d >= 1 },
  conv: { label: "Conversão", mode: "pp", pick: (v) => v.total.icv, fmt: pctv, bad: (d) => d <= -3 },
  online: { label: "Vendas online", mode: "pct", pick: (v) => v.total.vendasOnline, fmt: brl, bad: (d) => d <= -20, minBase: 500 },
  satisf: { label: "Nota do Google", mode: "pct", pick: (v) => v.total.notaGoogle, fmt: dec, bad: (d) => d <= -3, minBase: 1 },
  churn: { label: "Churn", mode: "pp", pick: (v) => v.total.churn, fmt: pctv, bad: (d) => d >= 1.5 },
};

/** Quais indicadores cruzar para cada tipo de alerta. */
const EVIDENCE_FOR: Partial<Record<AlertKind, ProbeKey[]>> = {
  faturamento: ["novos", "cancel", "base", "renov", "inad", "ticket"],
  yoyFaturamento: ["novos", "cancel", "base", "renov", "inad", "ticket"],
  churn: ["renov", "inad", "satisf", "cancel"],
  yoyChurn: ["renov", "inad", "satisf", "cancel"],
  inadimplencia: ["churn", "ticket"],
  yoyInadimplencia: ["churn", "ticket"],
  recebimento: ["inad"],
  yoyRenovacao: ["churn", "cancel"],
  yoyNovosContratos: ["conv", "ticket", "online"],
};

/** Indicador principal de cada alerta, para comparar unidade × rede e contar meses seguidos de piora. */
const PRIMARY: Partial<Record<AlertKind, { key: ProbeKey | "faturamento"; higherIsBetter: boolean }>> = {
  faturamento: { key: "faturamento", higherIsBetter: true },
  yoyFaturamento: { key: "faturamento", higherIsBetter: true },
  vendasOnline: { key: "online", higherIsBetter: true },
  yoyVendasOnline: { key: "online", higherIsBetter: true },
  churn: { key: "churn", higherIsBetter: false },
  yoyChurn: { key: "churn", higherIsBetter: false },
  inadimplencia: { key: "inad", higherIsBetter: false },
  yoyInadimplencia: { key: "inad", higherIsBetter: false },
  yoyRenovacao: { key: "renov", higherIsBetter: true },
  yoyNovosContratos: { key: "novos", higherIsBetter: true },
};

const FATURAMENTO: Probe = { label: "Faturamento", mode: "pct", pick: (v) => v.total.faturamento, fmt: brl, bad: () => false, minBase: 1 };
const probeOf = (k: ProbeKey | "faturamento"): Probe => (k === "faturamento" ? FATURAMENTO : PROBES[k]);

export interface ProbeResult { key: ProbeKey; text: string; supported: boolean }
export interface Evidence {
  /** Sinais de piora encontrados nos dados (o que os números mostram). */
  signals: ProbeResult[];
  /** Indicadores cruzados que não mostram sinal relevante. */
  quiet: string[];
  /** Leituras de contexto: unidade × rede e sequência de meses. */
  context: string[];
  /** Chaves cujos dados existem (permite dizer "sem indício" só quando houve o que olhar). */
  checked: Set<ProbeKey>;
  supported: Set<ProbeKey>;
}

const viewOf = (data: MonthData[], month: string, unit: string): View | undefined => {
  const m = data.find((d) => d.month === month);
  if (!m) return undefined;
  if (unit === "Rede") return m;
  const u = m.units.find((x) => x.name === unit);
  return u ? { total: u, units: [u] } : undefined;
};

/** Variação de um indicador entre duas visões; null se não dá para comparar. */
function change(p: Probe, cur: View, base: View): number | null {
  const a = p.pick(cur), b = p.pick(base);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (p.mode === "pp") return a - b;
  if (b <= 0 || (p.minBase !== undefined && b < p.minBase)) return null;
  return ((a - b) / b) * 100;
}

const sign = (d: number) => (d > 0 ? "+" : d < 0 ? "-" : "");
const fmtChange = (p: Probe, d: number) => `${sign(d)}${dec(Math.abs(d))}${p.mode === "pct" ? "%" : " p.p."}`;

const YOY: AlertKind[] = ["yoyFaturamento", "yoyChurn", "yoyInadimplencia", "yoyRenovacao", "yoyNovosContratos", "yoyVendasOnline"];

/** Evidências de um alerta a partir da planilha. `data` = todos os meses (ordem cronológica). */
export function buildEvidence(alert: Pick<Alert, "unit" | "kind" | "month">, data: MonthData[]): Evidence {
  const out: Evidence = { signals: [], quiet: [], context: [], checked: new Set(), supported: new Set() };
  const cur = viewOf(data, alert.month, alert.unit);
  if (!cur) return out;
  const yoy = YOY.includes(alert.kind);
  const baseMonth = yoy ? sameMonthLastYear(alert.month) : data[data.findIndex((d) => d.month === alert.month) - 1]?.month;
  const base = baseMonth ? viewOf(data, baseMonth, alert.unit) : undefined;
  const ref = yoy ? "o mesmo mês do ano anterior" : "o mês anterior";

  if (base) {
    for (const key of EVIDENCE_FOR[alert.kind] ?? []) {
      const p = PROBES[key];
      const d = change(p, cur, base);
      if (d === null) continue;
      out.checked.add(key);
      if (p.bad(d)) {
        out.supported.add(key);
        out.signals.push({ key, supported: true, text: `${p.label} ${fmtChange(p, d)} vs. ${ref} (${p.fmt(p.pick(base))} → ${p.fmt(p.pick(cur))})` });
      } else out.quiet.push(p.label);
    }
  }

  const primary = PRIMARY[alert.kind];
  if (primary) {
    const p = probeOf(primary.key);
    // Unidade × rede, no mesmo indicador e na mesma base de comparação.
    if (alert.unit !== "Rede" && base) {
      const net = viewOf(data, alert.month, "Rede"), netBase = baseMonth ? viewOf(data, baseMonth, "Rede") : undefined;
      const du = change(p, cur, base), dn = net && netBase ? change(p, net, netBase) : null;
      if (du !== null && dn !== null) {
        const worseBy = primary.higherIsBetter ? dn - du : du - dn; // quanto a unidade está pior que a rede
        const gap = p.mode === "pct" ? 5 : 1;
        const label = p.label.toLowerCase();
        const head = `${p.label}: unidade ${fmtChange(p, du)} e rede ${fmtChange(p, dn)} vs. ${ref}`;
        if (worseBy >= gap) out.context.push(`${head} — a piora é mais da unidade do que da rede (sinal de causa local).`);
        else if (worseBy > -gap) out.context.push(`${head} — a rede se move de forma parecida (sinal de movimento mais geral nesse ${label}).`);
        else out.context.push(`${head} — a unidade está melhor que a rede.`);
      }
    }
    // Sequência de meses seguidos de piora (mês a mês, até o mês do alerta).
    const idx = data.findIndex((d) => d.month === alert.month);
    let streak = 0;
    for (let i = idx; i > 0; i--) {
      const a = viewOf(data, data[i].month, alert.unit), b = viewOf(data, data[i - 1].month, alert.unit);
      if (!a || !b) break;
      const d = change(p, a, b);
      if (d === null || (primary.higherIsBetter ? d >= 0 : d <= 0)) break;
      streak++;
    }
    if (streak >= 2) out.context.push(`${p.label} piorou ${streak} meses seguidos (até ${data[idx].month.split("-").reverse().join("/")}).`);
    else if (streak === 1 && idx >= 2) {
      const prevOk = (() => {
        const a = viewOf(data, data[idx - 1].month, alert.unit), b = viewOf(data, data[idx - 2].month, alert.unit);
        const d = a && b ? change(p, a, b) : null;
        return d !== null && (primary.higherIsBetter ? d >= 0 : d <= 0);
      })();
      if (prevOk) out.context.push(`${p.label}: é a primeira piora após o mês anterior estável ou melhor.`);
    }
  }
  return out;
}
