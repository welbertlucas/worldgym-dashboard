import { TrendingUp, TrendingDown } from "lucide-react";
import { type UnitDelta, TREND_META, type TrendKey } from "@/data/unitMetrics";

const fmtDelta = (d: UnitDelta, k: TrendKey) => {
  const v = d.deltas[k];
  return `${TREND_META[k].label} ${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}${TREND_META[k].mode === "pct" ? "%" : " p.p."}`;
};

function Row({ d, good }: { d: UnitDelta; good: boolean }) {
  const keys = (Object.keys(TREND_META) as TrendKey[]).filter((k) => {
    const m = TREND_META[k];
    return Math.abs(d.deltas[k]) >= (m.mode === "pct" ? 0.5 : 0.1) && (d.deltas[k] > 0) === m.higherIsBetter === good;
  });
  return (
    <li className="flex flex-col gap-0.5 py-2 border-b border-border/30 last:border-0">
      <span className="font-bold text-sm">{d.unit}</span>
      <span className="text-xs text-muted-foreground">{keys.length ? keys.map((k) => fmtDelta(d, k)).join(" • ") : "sem variação relevante"}</span>
    </li>
  );
}

/** Melhores e piores unidades pelo saldo (indicadores que melhoraram − pioraram); desempate pela variação de faturamento. */
export function UnitHighlights({ deltas, limit = 3 }: { deltas: UnitDelta[]; limit?: number }) {
  const score = (d: UnitDelta) => d.improved - d.worsened + d.deltas.faturamento / 1000;
  const sorted = [...deltas].sort((a, b) => score(b) - score(a));
  const best = sorted.slice(0, limit);
  const worst = sorted.slice(-limit).reverse().filter((d) => !best.includes(d));
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-success mb-1"><TrendingUp className="w-4 h-4" /> Resultados positivos</h3>
        <ul>{best.map((d) => <Row key={d.unit} d={d} good />)}</ul>
      </div>
      <div className="card-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive mb-1"><TrendingDown className="w-4 h-4" /> Deterioração de indicadores</h3>
        <ul>{worst.map((d) => <Row key={d.unit} d={d} good={false} />)}</ul>
      </div>
    </div>
  );
}
