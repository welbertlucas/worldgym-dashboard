import type { ReactNode } from "react";
import { KpiGaugeCard } from "@/components/executiva/KpiGaugeCard";
import { type MetricDetail } from "@/components/MetricCard";
import { absoluteGauge, rateGauge, type GaugeModel } from "@/data/kpiGauge";
import { type MonthView, shortMonth } from "@/data/kpiView";
import { INDICATOR_BY_KEY } from "@/data/unitIndicators";
import { cn } from "@/lib/utils";

/**
 * flow  = acumula ao longo do mês (faturamento, contratos…): em mês parcial mostra quanto do mês anterior já foi alcançado.
 * level = fotografia (adimplentes, ticket, notas): compara direto com o mês anterior, de forma provisória se parcial.
 * rate  = taxa com faixas de leitura já existentes (churn, inadimplência, renovação, conversão).
 */
export type KpiKind = "flow" | "level" | "rate";

export interface KpiSpec {
  title: string;
  pick: (v: MonthView) => number;
  fmt: (n: number) => string;
  kind: KpiKind;
  /** Só para kind "rate": indicador cujas faixas e direção valem. */
  rateKey?: "churn" | "inadimplenciaPerc" | "renovacoes" | "icv";
  /** Favorável quando maior (padrão), menor, ou null = sem regra (cor neutra). */
  direction?: "higher" | "lower" | null;
  /** Informações fixas (sem direção) mostradas antes da comparação. */
  extra?: MetricDetail[] | ((v: MonthView) => MetricDetail[]);
  /** Zero significa "sem dado" (notas, NPS, receitas ainda não lançadas). */
  noDataIfZero?: boolean;
}

export interface KpiContext {
  cur: MonthView;
  prev?: MonthView;
  /** Mesmo mês do ano anterior (só para mês fechado). */
  ly?: MonthView;
  partial: boolean;
}

/** Variação vs. uma referência: direção (seta) e tom (favorável/desfavorável/neutro). */
export function variation(cur: number, base: number | undefined, mode: "pct" | "pp", higherIsBetter: boolean | null, ref: string): MetricDetail | undefined {
  if (base === undefined || !base || (mode === "pct" && base < 0)) return undefined;
  const d = mode === "pct" ? ((cur - base) / base) * 100 : cur - base;
  const flat = Math.abs(d) < 0.05;
  return {
    text: `${d > 0 ? "+" : ""}${d.toFixed(1).replace(".", ",")}${mode === "pct" ? "%" : " p.p."} vs. ${ref}`,
    direction: flat ? "flat" : d > 0 ? "up" : "down",
    tone: flat || higherIsBetter === null ? "neutral" : d > 0 === higherIsBetter ? "good" : "bad",
  };
}
const only = (...xs: (MetricDetail | undefined)[]) => xs.filter((x): x is MetricDetail => !!x);

export function KpiTile({ ctx, spec }: { ctx: KpiContext; spec: KpiSpec }) {
  const { cur: curV, prev: prevV, ly: lyV, partial } = ctx;
  const ind = spec.rateKey ? INDICATOR_BY_KEY[spec.rateKey] : undefined;
  const direction = spec.direction !== undefined ? spec.direction : ind ? ind.direction : "higher";
  const higher = direction === null ? null : direction === "higher";
  const cur = spec.pick(curV);
  const noBase = (v: number | undefined) => v === undefined || (spec.noDataIfZero && v === 0);
  const base = prevV && !noBase(spec.pick(prevV)) ? spec.pick(prevV) : undefined;
  const lyVal = !partial && lyV && !noBase(spec.pick(lyV)) ? spec.pick(lyV) : undefined;
  const extra = typeof spec.extra === "function" ? spec.extra(curV) : spec.extra ?? [];
  const prevLabel = prevV ? shortMonth(prevV.month) : "";
  const lyLabel = lyV ? shortMonth(lyV.month) : "";

  if (spec.noDataIfZero && cur === 0) {
    return <KpiGaugeCard title={spec.title} value="—" fill={0} marker={null} tone="neutral" partial={partial} details={[{ text: "Sem dado neste mês", tone: "neutral" }]} />;
  }

  let g: GaugeModel;
  if (ind) g = rateGauge(ind, cur, base);
  else {
    g = absoluteGauge(cur, base, spec.kind === "flow" && partial);
    if (higher === false && base && !(spec.kind === "flow" && partial)) g = { ...g, tone: cur <= base ? "good" : cur <= base * 1.05 ? "warn" : "bad" };
  }
  if (higher === null) g = { ...g, tone: "neutral" };

  const mode = ind ? "pp" : "pct";
  const details = spec.kind === "flow" && partial
    ? only(...extra, base && base > 0 ? { text: `${Math.floor((cur / base) * 100)}% de ${spec.fmt(base)} de ${prevLabel}`, tone: "neutral" } : undefined)
    : only(...extra, variation(cur, base, mode, higher, prevLabel), variation(cur, lyVal, mode, higher, lyLabel));

  return <KpiGaugeCard title={spec.title} value={spec.fmt(cur)} {...g} details={details} partial={partial} />;
}

/** Grade de indicadores: uma única superfície com linhas finas entre os cartões (sem células cinzas no fim da linha). */
export function KpiGrid({ ctx, specs, columns = "xl:grid-cols-4", children }: { ctx: KpiContext; specs: KpiSpec[]; columns?: string; children?: ReactNode }) {
  return (
    <div className="card-surface overflow-hidden">
      <div className={cn("-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2", columns)}>
        {specs.map((s) => <KpiTile key={s.title} ctx={ctx} spec={s} />)}
        {children}
      </div>
    </div>
  );
}
