import { dashboardData, getUnitData } from "@/data/dashboardData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

interface RevenueChartProps {
  selectedUnit: string | null;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", compactDisplay: "short", minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(v);

export function RevenueChart({ selectedUnit }: RevenueChartProps) {
  const data = dashboardData.slice(-12).map((m) => {
    const val = selectedUnit ? getUnitData(m.month, selectedUnit)?.faturamento ?? 0 : m.total.faturamento;
    const rec = selectedUnit ? getUnitData(m.month, selectedUnit)?.recebimento ?? 0 : m.total.recebimento;
    return { month: formatMonth(m.month), faturamento: val, recebimento: rec };
  });
  const avgFaturamento = data.reduce((s, d) => s + d.faturamento, 0) / (data.length || 1);

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        <span className="text-muted-foreground font-normal">Média 12m: {fmtCurrency(avgFaturamento)} · </span>
        Faturamento vs Recebimento
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 91%)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} />
          <YAxis tickFormatter={fmtCurrency} tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} width={70} />
          <Tooltip
            contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 20% 91%)", borderRadius: 6, fontSize: 12 }}
            formatter={(v: number, name: string) => [fmtCurrency(v), name === "faturamento" ? "Faturamento" : "Recebimento"]}
          />
          <Legend formatter={(v) => v === "faturamento" ? "Faturamento" : "Recebimento"} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="faturamento" fill="hsl(4 90% 50%)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="recebimento" fill="hsl(220 15% 78%)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
