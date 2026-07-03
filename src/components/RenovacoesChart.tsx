import { dashboardData, getUnitData } from "@/data/dashboardData";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

interface RenovacoesChartProps {
  selectedUnit: string | null;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function RenovacoesChart({ selectedUnit }: RenovacoesChartProps) {
  const data = dashboardData.slice(-12).map((m) => ({
    month: formatMonth(m.month),
    renovacoes: parseFloat(((selectedUnit ? getUnitData(m.month, selectedUnit)?.renovacoes ?? 0 : m.total.renovacoes) * 100).toFixed(2)),
  }));

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">Taxa de Renovação (%)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 91%)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 20% 91%)", borderRadius: 6, fontSize: 12 }}
            formatter={(v: number) => [`${v}%`, "Renovação"]}
          />
          <ReferenceLine y={60} stroke="hsl(142 71% 45%)" strokeDasharray="4 4" label={{ value: "60%", fill: "hsl(142 71% 45%)", fontSize: 10 }} />
          <Line type="monotone" dataKey="renovacoes" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
