import { UnitLink } from "@/components/UnitLink";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { type UnitDelta, TREND_META, type TrendKey } from "@/data/unitMetrics";
import { cn } from "@/lib/utils";

const KEYS = Object.keys(TREND_META) as TrendKey[];

/** Variação desprezível (mesmos limites usados no cálculo de melhorou/piorou). */
const isFlat = (k: TrendKey, d: number) => Math.abs(d) < (TREND_META[k].mode === "pct" ? 0.5 : 0.1);

function fmt(k: TrendKey, d: number) {
  return `${d > 0 ? "+" : ""}${d.toFixed(1).replace(".", ",")}${TREND_META[k].mode === "pct" ? "%" : " p.p."}`;
}

/** Um chip por indicador, no mesmo estilo dos cartões de velocímetro. A cor depende da direção favorável do indicador, não do sinal. */
function Chip({ k, d }: { k: TrendKey; d: number }) {
  const flat = isFlat(k, d);
  const good = (d > 0) === TREND_META[k].higherIsBetter;
  const Arrow = flat ? Minus : d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <li className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums", flat ? "bg-secondary text-muted-foreground" : good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
      <Arrow className="h-3 w-3 shrink-0" aria-hidden />
      <span className="font-normal opacity-80">{TREND_META[k].label}</span>
      {fmt(k, d)}
      <span className="sr-only">{flat ? " (sem variação relevante)" : good ? " (melhora)" : " (piora)"}</span>
    </li>
  );
}

function UnitTile({ d }: { d: UnitDelta }) {
  return (
    <li className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="truncate text-sm font-semibold text-foreground"><UnitLink name={d.unit} /></h4>
        <p className="shrink-0 text-xs text-muted-foreground">
          <span className={d.improved ? "font-medium text-success" : ""}>{d.improved} melhor{d.improved === 1 ? "ou" : "aram"}</span>
          {" · "}
          <span className={d.worsened ? "font-medium text-destructive" : ""}>{d.worsened} pior{d.worsened === 1 ? "ou" : "aram"}</span>
        </p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">{KEYS.map((k) => <Chip key={k} k={k} d={d.deltas[k]} />)}</ul>
    </li>
  );
}

function Panel({ title, icon: Icon, tone, units }: { title: string; icon: typeof TrendingUp; tone: "good" | "bad"; units: UnitDelta[] }) {
  return (
    <section className="card-surface p-5" data-tone={tone}>
      <h3 className={cn("mb-4 flex items-center gap-2 text-sm font-semibold", tone === "good" ? "text-success" : "text-destructive")}>
        <Icon className="h-4 w-4" aria-hidden /> {title}
      </h3>
      <ul className="space-y-3">{units.map((d) => <UnitTile key={d.unit} d={d} />)}</ul>
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
