import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { type Indicator, formatIndicator } from "@/data/unitIndicators";
import { type SeriesRow } from "@/data/unitSeries";
import { formatMonthLong } from "@/data/periods";
import { AXIS_TICK, GRID } from "@/components/chartTheme";

const BRAND = "hsl(4 90% 50%)";
const REF = "hsl(220 9% 55%)";
const short = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };
const compact = (ind: Indicator) => (v: number) =>
  ind.format === "currency" ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(v)
  : ind.format === "percent" ? `${v.toFixed(0)}%` : v.toLocaleString("pt-BR", { notation: "compact" });

interface Props { ind: Indicator; rows: SeriesRow[]; unitLabel: string; refLabel: string }

/** Evolução de um indicador da unidade ao longo do período, contra a média da rede ou outra unidade. */
export function TrendCard({ ind, rows, unitLabel, refLabel }: Props) {
  const data = rows.map((r) => ({ ...r, label: short(r.month) }));
  const withData = rows.filter((r) => r.unit !== null);
  const last = withData[withData.length - 1];
  const first = withData[0];
  const change = first && last && first !== last && first.unit! !== 0 && ind.format !== "percent" ? ((last.unit! - first.unit!) / Math.abs(first.unit!)) * 100 : null;
  const changePp = first && last && first !== last && ind.format === "percent" ? last.unit! - first.unit! : null;

  return (
    <div className="card-surface p-5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{ind.label}</h4>
          <p className="text-xs text-muted-foreground">
            {last ? <>Último mês fechado: <b className="text-foreground tabular-nums">{formatIndicator(ind, last.unit!)}</b></> : "Sem dado no período"}
            {change !== null && <> · {change > 0 ? "+" : ""}{change.toFixed(1).replace(".", ",")}% no período</>}
            {changePp !== null && <> · {changePp > 0 ? "+" : ""}{changePp.toFixed(1).replace(".", ",")} p.p. no período</>}
          </p>
        </div>
      </div>
      {withData.length === 0 ? (
        <p className="mt-6 mb-6 text-sm text-muted-foreground">Sem dado lançado neste período.</p>
      ) : (
        <div className="mt-3 h-[190px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={6} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} tickFormatter={compact(ind)} domain={["auto", "auto"]} />
              <Tooltip
                cursor={{ stroke: GRID }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as SeriesRow;
                  return (
                    <div className="rounded-xl border border-border bg-white px-3 py-2 text-xs shadow-md">
                      <p className="font-semibold text-foreground first-letter:uppercase">{formatMonthLong(r.month)}</p>
                      <p className="mt-1 flex items-center gap-1.5"><span className="h-0.5 w-3 rounded" style={{ background: BRAND }} />{unitLabel}<b className="ml-auto pl-3 tabular-nums">{r.unit === null ? "—" : formatIndicator(ind, r.unit)}</b></p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground"><span className="h-0.5 w-3 rounded" style={{ background: REF }} />{refLabel}<b className="ml-auto pl-3 tabular-nums">{r.ref === null ? "—" : formatIndicator(ind, r.ref)}</b></p>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="ref" stroke={REF} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls />
              <Line type="monotone" dataKey="unit" stroke={BRAND} strokeWidth={2.25} dot={rows.length <= 12 ? { r: 2.5 } : false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
