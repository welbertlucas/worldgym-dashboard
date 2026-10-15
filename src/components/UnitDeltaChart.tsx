import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from "recharts";
import { type UnitDelta, type TrendKey, TREND_META } from "@/data/unitMetrics";
import { Select } from "@/components/ui/select";
import { formatMonthLong } from "@/data/periods";

const GOOD = "hsl(142 71% 45%)";
const BAD = "hsl(0 72% 51%)";

export function UnitDeltaChart({ deltas, curMonth, prevMonth }: { deltas: UnitDelta[]; curMonth: string; prevMonth: string }) {
  const [key, setKey] = useState<TrendKey>("faturamento");
  const meta = TREND_META[key];
  const unitSuffix = meta.mode === "pct" ? "%" : " p.p.";
  const data = deltas
    .map((d) => ({ unit: d.unit, value: Number(d.deltas[key].toFixed(1)) }))
    .sort((a, b) => (meta.higherIsBetter ? b.value - a.value : a.value - b.value));

  return (
    <div className="card-surface p-5">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h3 className="text-sm font-semibold text-foreground flex-1">Variação por unidade</h3>
        <Select value={key} onChange={(e) => setKey(e.target.value as TrendKey)} className="w-44">
          {(Object.keys(TREND_META) as TrendKey[]).map((k) => <option key={k} value={k}>{TREND_META[k].label}</option>)}
        </Select>
      </div>
      <p className="text-xs font-semibold text-muted-foreground mb-4">
        {formatMonthLong(curMonth)} vs. {formatMonthLong(prevMonth)} — verde = melhora, vermelho = piora
      </p>
      <ResponsiveContainer width="100%" height={Math.max(260, data.length * 26)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 91%)" />
          <XAxis type="number" tickFormatter={(v) => `${v}${meta.mode === "pct" ? "%" : ""}`} tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} />
          <YAxis type="category" dataKey="unit" width={120} tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} interval={0} />
          <Tooltip
            contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 20% 91%)", borderRadius: 6, fontSize: 12 }}
            formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}${unitSuffix}`, meta.label]}
          />
          <ReferenceLine x={0} stroke="hsl(220 10% 46%)" />
          <Bar dataKey="value" radius={[0, 2, 2, 0]}>
            {data.map((d) => <Cell key={d.unit} fill={(d.value > 0) === meta.higherIsBetter ? GOOD : BAD} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
