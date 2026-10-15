import { dashboardData, getUnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";
import { ChartCard } from "@/components/ChartCard";
import { AXIS_TICK, GRID, TOOLTIP_STYLE, PARTIAL_BAND } from "@/components/chartTheme";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea,
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
    return { month: formatMonth(m.month) + (isPartialMonth(m.month) ? " (parc.)" : ""), partial: isPartialMonth(m.month), novos, cancelados, saldo: novos - cancelados };
  });
  const partialLabel = data.find((d) => d.partial)?.month;
  const closedData = data.filter((d) => !d.partial);
  const avgNovos = closedData.reduce((s, d) => s + d.novos, 0) / (closedData.length || 1);

  return (
    <ChartCard title="Novos Contratos x Cancelamentos" subtitle={<>Média dos últimos 12 meses fechados: {avgNovos.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</>}>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          {partialLabel && <ReferenceArea x1={partialLabel} x2={partialLabel} {...PARTIAL_BAND} />}
          <XAxis dataKey="month" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="novos" name="Novos" fill="hsl(142 71% 45%)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="cancelados" name="Cancelados" fill="hsl(0 72% 51%)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
