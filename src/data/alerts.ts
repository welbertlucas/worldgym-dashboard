import { type MonthData, type UnitData } from "@/data/dashboardData";
import { ALERT_CONFIG as C } from "@/data/alertConfig";
import { getLastClosedMonth, formatMonthLong } from "@/data/periods";
import { META_INDICATORS, TIER_LABEL, attainment, actualFor, formatMetaValue, isSingleGoal, lowestTier, tierReached, type Meta } from "@/data/metas";

export type AlertKind =
  | "faturamento" | "vendasOnline" | "churn" | "inadimplencia" | "recebimento" | "meta" | "dado"
  | "yoyFaturamento" | "yoyChurn" | "yoyInadimplencia" | "yoyRenovacao" | "yoyNovosContratos" | "yoyVendasOnline";

/** Leitura combinada com o mesmo mês do ano anterior (hipótese de interpretação, não causa confirmada). */
export interface YoyReading {
  reading: "confirmed" | "seasonal" | "context";
  fact: string;
}
export type Severity = "critical" | "attention" | "info";

export interface Alert {
  id: string;
  unit: string;
  kind: AlertKind;
  severity: Severity;
  month: string;
  /** Fato observado nos dados (nunca contém hipótese). */
  fact: string;
  /** Regra que disparou, para auditoria. */
  rule: string;
  /** Participação da unidade no faturamento da rede no mês (0–1), usada na priorização. */
  weight: number;
  metaKey?: string;
  yoy?: YoyReading;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const pp = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")} p.p.`;
const chg = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;

function unitIn(m: MonthData | undefined, name: string): UnitData | undefined {
  return m?.units.find((u) => u.name === name);
}

function mean(xs: number[]) { return xs.reduce((s, x) => s + x, 0) / xs.length; }
function stdev(xs: number[]) { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length); }

const rank: Record<Severity, number> = { critical: 0, attention: 1, info: 2 };

/**
 * Avalia o último mês FECHADO contra o mês anterior da série. O mês em andamento nunca entra.
 * `now` é injetável para teste.
 */
export function computeAlerts(data: MonthData[], metas: Meta[] = [], now: Date = new Date()): Alert[] {
  const months = data.map((d) => d.month);
  const evalMonth = getLastClosedMonth(months, now);
  if (!evalMonth) return [];
  const idx = months.indexOf(evalMonth);
  const cur = data[idx];
  const prev = idx > 0 ? data[idx - 1] : undefined;
  const totalFat = cur.units.reduce((s, u) => s + u.faturamento, 0) || 1;
  const alerts: Alert[] = [];
  const push = (a: Omit<Alert, "id" | "month">) =>
    alerts.push({ ...a, id: `${a.unit}|${a.kind}${a.metaKey ? `:${a.metaKey}` : ""}|${evalMonth}`, month: evalMonth });

  for (const u of cur.units) {
    const weight = u.faturamento / totalFat;
    // Meses fechados anteriores em que a unidade existia (com faturamento).
    const hist = data.slice(0, idx).map((d) => unitIn(d, u.name)).filter((x): x is UnitData => !!x && x.faturamento > 0);
    const enoughHistory = hist.length >= C.minHistoryMonths;
    const p = unitIn(prev, u.name);

    if (enoughHistory && p && p.faturamento > 0) {
      // Faturamento
      const d = ((u.faturamento - p.faturamento) / p.faturamento) * 100;
      const series: number[] = [];
      for (let i = Math.max(1, idx - 6); i < idx; i++) {
        const a = unitIn(data[i], u.name), b = unitIn(data[i - 1], u.name);
        if (a && b && a.faturamento > 0 && b.faturamento > 0) series.push(((a.faturamento - b.faturamento) / b.faturamento) * 100);
      }
      const z = series.length >= C.faturamento.zMinSamples ? stdev(series) : 0;
      const zLimit = z > 0 ? mean(series) - C.faturamento.zScore * z : -Infinity;
      if (d <= C.faturamento.criticalPct) {
        push({ unit: u.name, kind: "faturamento", severity: "critical", weight, rule: `queda ≤ ${C.faturamento.criticalPct}% vs. mês anterior`,
          fact: `Faturamento ${chg(d)} (${fmtBRL(p.faturamento)} → ${fmtBRL(u.faturamento)}).` });
      } else if (d <= C.faturamento.attentionPct || (d <= C.faturamento.zMinDropPct && d < zLimit)) {
        push({ unit: u.name, kind: "faturamento", severity: "attention",
          rule: d <= C.faturamento.attentionPct ? `queda ≤ ${C.faturamento.attentionPct}% vs. mês anterior` : `queda abaixo de ${C.faturamento.zScore} desvios da variação típica da unidade`,
          weight, fact: `Faturamento ${chg(d)} (${fmtBRL(p.faturamento)} → ${fmtBRL(u.faturamento)}).` });
      }

      // Vendas online: base = média dos N meses anteriores
      const base = data.slice(Math.max(0, idx - C.vendasOnline.baselineMonths), idx)
        .map((m) => unitIn(m, u.name)?.vendasOnline).filter((x): x is number => x !== undefined);
      if (base.length >= C.vendasOnline.baselineMonths) {
        const avg = mean(base);
        if (avg >= C.vendasOnline.minBaseline) {
          const dv = ((u.vendasOnline - avg) / avg) * 100;
          if (dv <= C.vendasOnline.dropPct) {
            push({ unit: u.name, kind: "vendasOnline", severity: "attention", weight,
              rule: `queda ≤ ${C.vendasOnline.dropPct}% vs. média de ${C.vendasOnline.baselineMonths} meses`,
              fact: `Vendas online ${chg(dv)} vs. média dos ${C.vendasOnline.baselineMonths} meses anteriores (${fmtBRL(avg)} → ${fmtBRL(u.vendasOnline)}).` });
          }
        }
      }

      // Churn e inadimplência: variação em p.p. ou nível
      for (const [kind, key, cfg, label] of [
        ["churn", "churn", C.churn, "Churn"],
        ["inadimplencia", "inadimplenciaPerc", C.inadimplencia, "Inadimplência"],
      ] as const) {
        const delta = u[key] - p[key];
        const high = u[key] > cfg.criticalLevel;
        const rising = delta >= cfg.deltaPp;
        if (high || rising) {
          // Crítico só quando está acima do limite E piorando; acima do limite sem piora é atenção.
          const severity: Severity = high && delta > 0 && rising ? "critical" : "attention";
          const trend = `${pp(delta)} vs. mês anterior ${pct(p[key])}`;
          push({ unit: u.name, kind, weight, severity,
            rule: [high && `nível > ${cfg.criticalLevel}%`, rising && `alta ≥ ${cfg.deltaPp} p.p.`].filter(Boolean).join(" e "),
            fact: rising ? `${label} em alta: ${pct(u[key])} (${trend}).` : `${label} acima de ${cfg.criticalLevel}%: ${pct(u[key])} (${trend}).` });
        }
      }
    }

    // Recebimento / faturamento
    if (u.faturamento > 0 && u.recebimento > 0 && u.recebimento / u.faturamento < C.recebimento.minRatio) {
      push({ unit: u.name, kind: "recebimento", severity: "attention", weight,
        rule: `recebimento < ${C.recebimento.minRatio * 100}% do faturamento`,
        fact: `Recebimento equivale a ${pct((u.recebimento / u.faturamento) * 100)} do faturamento (${fmtBRL(u.recebimento)} de ${fmtBRL(u.faturamento)}).` });
    }
  }

  applyYearOverYear(data, idx, cur, alerts);

  // Dado suspeito: unidade presente no mês anterior e ausente no mês avaliado
  for (const p of prev?.units ?? []) {
    if (!unitIn(cur, p.name)) {
      push({ unit: p.name, kind: "dado", severity: "info", weight: 0, rule: "unidade sem linha no mês",
        fact: `A unidade tinha dados no mês anterior e não aparece na planilha neste mês.` });
    }
  }

  // Metas (bronze/prata/ouro): alerta quando o realizado fica abaixo do nível mais baixo cadastrado.
  for (const mt of metas.filter((x) => x.month === evalMonth)) {
    const actual = actualFor(cur, mt.unit, mt.key);
    const low = lowestTier(mt);
    if (actual === null || !low) continue;
    if (tierReached(mt.key, actual, mt) !== "abaixo") continue;
    const att = attainment(mt.key, actual, low.value);
    if (att === null) continue;
    const unitRow = mt.unit === "TOTAL" ? null : unitIn(cur, mt.unit);
    push({ unit: mt.unit === "TOTAL" ? "Rede" : mt.unit, kind: "meta", metaKey: mt.key,
      severity: att < C.meta.criticalPct ? "critical" : "attention",
      weight: unitRow ? unitRow.faturamento / totalFat : 1,
      rule: `abaixo ${isSingleGoal(mt) ? "da meta" : `do nível ${TIER_LABEL[low.tier].toLowerCase()}`}${att < C.meta.criticalPct ? ` e menos de ${C.meta.criticalPct}% dela` : ""}`,
      fact: `${META_INDICATORS[mt.key].label} abaixo da meta${isSingleGoal(mt) ? "" : ` ${TIER_LABEL[low.tier].toLowerCase()}`}: ${formatMetaValue(mt.key, actual)} vs. ${formatMetaValue(mt.key, low.value)} (${pct(att)} ${isSingleGoal(mt) ? "da meta" : "do nível"}).` });
  }

  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || b.weight - a.weight);
}

// ---------------------------------------------------------------------------------------------
// Comparativo com o mesmo mês do ano anterior

const lower: Record<Severity, Severity> = { critical: "attention", attention: "info", info: "info" };
const higher: Record<Severity, Severity> = { critical: "critical", attention: "critical", info: "attention" };

export function sameMonthLastYear(month: string): string {
  const [y, m] = month.split("-");
  return `${Number(y) - 1}-${m}`;
}

function pctChange(cur: number, base: number): number { return ((cur - base) / base) * 100; }

function applyYearOverYear(data: MonthData[], idx: number, cur: MonthData, alerts: Alert[]) {
  const baseMonth = sameMonthLastYear(cur.month);
  const baseIdx = data.findIndex((d) => d.month === baseMonth);
  if (baseIdx < 0) return;
  const base = data[baseIdx];
  const Y = C.yoy;
  const totalFat = cur.units.reduce((s, u) => s + u.faturamento, 0) || 1;
  const label = formatMonthLong(baseMonth);
  const evalMonth = cur.month;

  // Unidades comparáveis: existem nos dois meses e já tinham histórico antes do mês-base.
  const comparable = cur.units
    .map((u) => ({ u, b: unitIn(base, u.name) }))
    .filter((x): x is { u: UnitData; b: UnitData } => {
      if (!x.b || x.b.faturamento <= 0 || x.u.faturamento <= 0) return false;
      const before = data.slice(0, baseIdx).filter((d) => (unitIn(d, x.u.name)?.faturamento ?? 0) > 0).length;
      return before >= Y.minHistoryBeforeBase;
    });

  const push = (a: Omit<Alert, "id" | "month">) => alerts.push({ ...a, id: `${a.unit}|${a.kind}|${evalMonth}`, month: evalMonth });

  // 1) Faturamento, churn e inadimplência: se já há alerta vs. mês anterior, combina; senão, alerta próprio.
  for (const { u, b } of comparable) {
    const weight = u.faturamento / totalFat;
    const checks = [
      { mom: "faturamento" as const, own: "yoyFaturamento" as const, label: "Faturamento",
        delta: pctChange(u.faturamento, b.faturamento), better: u.faturamento >= b.faturamento, highLevel: false,
        sev: (d: number): Severity | null => (d <= Y.faturamento.criticalPct ? "critical" : d <= Y.faturamento.attentionPct ? "attention" : null),
        text: (d: number) => `Faturamento ${chg(d)} vs. ${label} (${fmtBRL(b.faturamento)} → ${fmtBRL(u.faturamento)})`,
        rule: `faturamento ≤ ${Y.faturamento.attentionPct}% vs. mesmo mês do ano anterior` },
      { mom: "churn" as const, own: "yoyChurn" as const, label: "Churn",
        delta: u.churn - b.churn, better: u.churn <= b.churn, highLevel: u.churn > C.churn.criticalLevel,
        sev: (d: number): Severity | null => (d >= Y.churn.deltaPp ? "attention" : null),
        text: (d: number) => `Churn em ${pct(u.churn)} (${pp(d)} vs. ${label}: ${pct(b.churn)})`,
        rule: `churn ≥ ${Y.churn.deltaPp} p.p. acima do mesmo mês do ano anterior` },
      { mom: "inadimplencia" as const, own: "yoyInadimplencia" as const, label: "Inadimplência",
        delta: u.inadimplenciaPerc - b.inadimplenciaPerc, better: u.inadimplenciaPerc <= b.inadimplenciaPerc, highLevel: u.inadimplenciaPerc > C.inadimplencia.criticalLevel,
        sev: (d: number): Severity | null => (d >= Y.inadimplencia.deltaPp ? "attention" : null),
        text: (d: number) => `Inadimplência em ${pct(u.inadimplenciaPerc)} (${pp(d)} vs. ${label}: ${pct(b.inadimplenciaPerc)})`,
        rule: `inadimplência ≥ ${Y.inadimplencia.deltaPp} p.p. acima do mesmo mês do ano anterior` },
    ];
    for (const c of checks) {
      const yoySev = c.sev(c.delta);
      const mom = alerts.find((a) => a.unit === u.name && a.kind === c.mom);
      if (mom) {
        if (yoySev) {
          mom.severity = higher[mom.severity];
          mom.yoy = { reading: "confirmed", fact: `${c.text(c.delta)} — também pior que no ano anterior.` };
        } else if (c.better && c.highLevel) {
          // Nível alto que já existia no ano anterior: problema persistente, não sazonal — não rebaixa.
          mom.yoy = { reading: "context", fact: `${c.text(c.delta)} — patamar alto também no ano anterior (problema persistente, não novidade).` };
        } else if (c.better) {
          mom.severity = lower[mom.severity];
          mom.yoy = { reading: "seasonal", fact: `${c.text(c.delta)} — igual ou melhor que no ano anterior.` };
        } else {
          mom.yoy = { reading: "context", fact: `${c.text(c.delta)}.` };
        }
      } else if (yoySev) {
        push({ unit: u.name, kind: c.own, severity: yoySev, weight, rule: c.rule,
          fact: `${c.text(c.delta)}. Sem queda relevante vs. o mês anterior.` });
      }
    }
    // Renovação (sem alerta mensal equivalente)
    const dr = u.renovacoes - b.renovacoes;
    if (b.renovacoes > 0 && dr <= Y.renovacoes.dropPp) {
      push({ unit: u.name, kind: "yoyRenovacao", severity: "attention", weight, rule: `renovação ≤ ${Y.renovacoes.dropPp} p.p. vs. mesmo mês do ano anterior`,
        fact: `Renovação em ${pct(u.renovacoes)} (${pp(dr)} vs. ${label}: ${pct(b.renovacoes)}).` });
    }
  }

  // 2) Novos contratos e vendas online: alerta da rede (unidades comparáveis) + unidades pior que a rede.
  const V = Y.volume;
  for (const spec of [
    { key: "novosContratos" as const, kind: "yoyNovosContratos" as const, name: "Novos contratos", min: 0 },
    { key: "vendasOnline" as const, kind: "yoyVendasOnline" as const, name: "Vendas online", min: V.minBaseVendasOnline },
  ]) {
    const rows = comparable.filter((x) => x.b[spec.key] > spec.min);
    const sumB = rows.reduce((s, x) => s + x.b[spec.key], 0);
    if (!rows.length || sumB <= 0) continue;
    const sumU = rows.reduce((s, x) => s + x.u[spec.key], 0);
    const net = pctChange(sumU, sumB);
    const fmtV = (v: number) => (spec.key === "vendasOnline" ? fmtBRL(v) : v.toLocaleString("pt-BR"));
    if (net <= V.networkAttentionPct) {
      push({ unit: "Rede", kind: spec.kind, severity: net <= V.networkCriticalPct ? "critical" : "attention", weight: 1,
        rule: `rede (unidades comparáveis) ≤ ${V.networkAttentionPct}% vs. mesmo mês do ano anterior`,
        fact: `${spec.name} da rede ${chg(net)} vs. ${label} (${fmtV(sumB)} → ${fmtV(sumU)}, ${rows.length} unidades comparáveis).` });
    }
    for (const { u, b } of rows) {
      const d = pctChange(u[spec.key], b[spec.key]);
      if (d <= V.unitMinDropPct && d <= net - V.belowNetworkPp) {
        const mom = spec.key === "vendasOnline" ? alerts.find((a) => a.unit === u.name && a.kind === "vendasOnline") : undefined;
        if (mom) {
          mom.severity = higher[mom.severity];
          mom.yoy = { reading: "confirmed", fact: `Vendas online ${chg(d)} vs. ${label} (${fmtV(b[spec.key])} → ${fmtV(u[spec.key])}), pior que a rede (${chg(net)}) — também pior que no ano anterior.` };
          continue;
        }
        push({ unit: u.name, kind: spec.kind, severity: "attention", weight: u.faturamento / totalFat,
          rule: `queda ≤ ${V.unitMinDropPct}% e ${V.belowNetworkPp} p.p. pior que a rede vs. mesmo mês do ano anterior`,
          fact: `${spec.name} ${chg(d)} vs. ${label} (${fmtV(b[spec.key])} → ${fmtV(u[spec.key])}), pior que a rede (${chg(net)}).` });
      }
    }
  }
}
