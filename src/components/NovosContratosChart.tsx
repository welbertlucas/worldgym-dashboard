import { dashboardData, getUnitData } from "@/data/dashboardData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

interface NovosContratosChartProps {
  selectedUnit: string | null;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export default function NovosContratosChart({ selectedUnit }: NovosContratosChartProps) {
  const data = dashboardData.slice(-12).map((m) => {
    const novos = selectedUnit
      ? getUnitData(m.month, selectedUnit)?.novosContratos ?? 0
      : m.units.reduce((s, u) => s + u.novosContratos, 0);
    const cancelados = selectedUnit
      ? getUnitData(m.month, selectedUnit)?.cancelados ?? 0
      : m.total.cancelados;
    return { month: formatMonth(m.month), novos, cancelados, saldo: novos - cancelados };
  });

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">Novos Contratos vs Cancelamentos</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 91%)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(220 10% 46%)" }} />
          <Tooltip
            contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 20% 91%)", borderRadius: 6, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="novos" name="Novos" fill="hsl(142 71% 45%)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="cancelados" name="Cancelados" fill="hsl(0 72% 51%)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
