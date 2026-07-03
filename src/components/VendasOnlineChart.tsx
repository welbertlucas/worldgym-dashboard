import { dashboardData, getUnitData } from "@/data/dashboardData";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

interface VendasOnlineChartProps {
  selectedUnit: string | null;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", compactDisplay: "short", minimumFractionDigits: 0 }).format(v);

export function VendasOnlineChart({ selectedUnit }: VendasOnlineChartProps) {
  const data = dashboardData.slice(-12).map((m) => ({
    month: formatMonth(m.month),
    vendas: selectedUnit ? getUnitData(m.month, selectedUnit)?.vendasOnline ?? 0 : m.total.vendasOnline,
  }));

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">Vendas Online</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vendasGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(4 90% 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(4 90% 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 91%)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} />
          <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} width={70} />
          <Tooltip
            contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 20% 91%)", borderRadius: 6, fontSize: 12 }}
            formatter={(v: number) => [fmtCurrency(v), "Vendas Online"]}
          />
          <Area type="monotone" dataKey="vendas" stroke="hsl(4 90% 50%)" fill="url(#vendasGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
