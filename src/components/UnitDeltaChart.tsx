import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, LabelList } from "recharts";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chartTheme";
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
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis type="number" padding={{ left: 36, right: 36 }} tickFormatter={(v) => `${v}${meta.mode === "pct" ? "%" : ""}`} tick={AXIS_TICK} />
          <YAxis type="category" dataKey="unit" width={120} tick={AXIS_TICK} interval={0} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}${unitSuffix}`, meta.label]}
          />
          <ReferenceLine x={0} stroke="hsl(222 14% 28%)" strokeWidth={1.5} />
          <Bar dataKey="value" radius={[0, 2, 2, 0]}>
            {data.map((d) => <Cell key={d.unit} fill={(d.value > 0) === meta.higherIsBetter ? GOOD : BAD} />)}
            <LabelList
              dataKey="value"
              content={({ x, y, width, height, value }) => {
                const nx = Number(x), nw = Number(width), v = Number(value);
                const right = Math.max(nx, nx + nw), left = Math.min(nx, nx + nw);
                return (
                  <text x={v >= 0 ? right + 4 : left - 4} y={Number(y) + Number(height) / 2} dy={4} textAnchor={v >= 0 ? "start" : "end"} fontSize={11} fontWeight={600} fill="hsl(222 25% 14%)">
                    {`${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}${unitSuffix.trim()}`}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
