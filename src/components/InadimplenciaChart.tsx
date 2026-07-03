import { dashboardData, getUnitData } from "@/data/dashboardData";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

interface InadimplenciaChartProps {
  selectedUnit: string | null;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export default function InadimplenciaChart({ selectedUnit }: InadimplenciaChartProps) {
  const data = dashboardData.slice(-12).map((m) => ({
    month: formatMonth(m.month),
    inadimplencia: parseFloat((selectedUnit ? getUnitData(m.month, selectedUnit)?.inadimplenciaPerc ?? 0 : m.total.inadimplenciaPerc).toFixed(2)),
  }));
  const avgInadimplencia = data.reduce((s, d) => s + d.inadimplencia, 0) / (data.length || 1);

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Taxa de Inadimplência (%)</h3>
      <p className="text-xs text-muted-foreground mb-4">Média dos últimos 12 meses: {avgInadimplencia.toFixed(1)}%</p>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 91%)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} />
          <Tooltip
            contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 20% 91%)", borderRadius: 6, fontSize: 12 }}
            formatter={(v: number) => [`${v}%`, "Inadimplência"]}
          />
          <ReferenceLine y={5} stroke="hsl(38 92% 50%)" strokeDasharray="4 4" label={{ value: "5%", fill: "hsl(38 92% 50%)", fontSize: 10 }} />
          <ReferenceLine y={8} stroke="hsl(0 72% 51%)" strokeDasharray="4 4" label={{ value: "8%", fill: "hsl(0 72% 51%)", fontSize: 10 }} />
          <Line type="monotone" dataKey="inadimplencia" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
