import { ArrowDownRight, ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { type UnitDelta, TREND_META, type TrendKey } from "@/data/unitMetrics";
import { cn } from "@/lib/utils";

const KEYS = Object.keys(TREND_META) as TrendKey[];

/** Variação desprezível (mesmos limites usados no cálculo de melhorou/piorou). */
const isFlat = (k: TrendKey, d: number) => Math.abs(d) < (TREND_META[k].mode === "pct" ? 0.5 : 0.1);

function fmt(k: TrendKey, d: number) {
  return `${d > 0 ? "+" : ""}${d.toFixed(1).replace(".", ",")}${TREND_META[k].mode === "pct" ? "%" : " p.p."}`;
}

/** Uma célula por indicador. A cor depende da direção favorável do indicador, não do sinal da variação. */
function Cell({ k, d }: { k: TrendKey; d: number }) {
  const flat = isFlat(k, d);
  const good = (d > 0) === TREND_META[k].higherIsBetter;
  const Arrow = flat ? Minus : d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground truncate">{TREND_META[k].label}</dt>
      <dd className={cn("flex items-center gap-0.5 text-sm font-semibold tabular-nums", flat ? "text-muted-foreground" : good ? "text-success" : "text-destructive")}>
        <Arrow className="w-3.5 h-3.5 shrink-0" aria-hidden />
        {fmt(k, d)}
        <span className="sr-only">{flat ? " (sem variação relevante)" : good ? " (melhora)" : " (piora)"}</span>
      </dd>
    </div>
  );
}

function UnitRow({ d, tone }: { d: UnitDelta; tone: "good" | "bad" }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h4 className="text-sm font-semibold text-foreground truncate">{d.unit}</h4>
        <p className="text-xs text-muted-foreground shrink-0">
          <span className={d.improved ? "text-success font-medium" : ""}>{d.improved} melhor{d.improved === 1 ? "ou" : "aram"}</span>
          {" · "}
          <span className={d.worsened ? "text-destructive font-medium" : ""}>{d.worsened} pior{d.worsened === 1 ? "ou" : "aram"}</span>
        </p>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-2" data-tone={tone}>
        {KEYS.map((k) => <Cell key={k} k={k} d={d.deltas[k]} />)}
      </dl>
    </li>
  );
}

function Panel({ title, icon: Icon, tone, units }: { title: string; icon: typeof TrendingUp; tone: "good" | "bad"; units: UnitDelta[] }) {
  return (
    <section className="card-surface p-5">
      <h3 className={cn("flex items-center gap-2 text-sm font-semibold mb-4", tone === "good" ? "text-success" : "text-destructive")}>
        <Icon className="w-4 h-4" aria-hidden /> {title}
      </h3>
      <ul className="divide-y divide-border">{units.map((d) => <UnitRow key={d.unit} d={d} tone={tone} />)}</ul>
    </section>
  );
}

/**
 * Melhores resultados e pontos de atenção. Critério (inalterado): saldo entre indicadores que melhoraram e que
 * pioraram vs. o mês anterior, com desempate pela variação de faturamento.
 */
export function UnitHighlights({ deltas, limit = 3 }: { deltas: UnitDelta[]; limit?: number }) {
  const score = (d: UnitDelta) => d.improved - d.worsened + d.deltas.faturamento / 1000;
  const sorted = [...deltas].sort((a, b) => score(b) - score(a));
  const best = sorted.slice(0, limit);
  const worst = sorted.slice(-limit).reverse().filter((d) => !best.includes(d));
  return (
    <div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Resultados positivos" icon={TrendingUp} tone="good" units={best} />
        <Panel title="Deterioração de indicadores" icon={TrendingDown} tone="bad" units={worst} />
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Critério: unidades ordenadas pelo saldo entre indicadores que melhoraram e que pioraram em relação ao mês anterior
        (faturamento, vendas online, churn, inadimplência e renovação); empate decidido pela variação de faturamento.
        Em churn e inadimplência, queda é melhora.
      </p>
    </div>
  );
}
