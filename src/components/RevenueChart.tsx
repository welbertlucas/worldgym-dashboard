import { dashboardData, getUnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";
import { ChartCard } from "@/components/ChartCard";
import { AXIS_TICK, GRID, TOOLTIP_STYLE, PARTIAL_BAND } from "@/components/chartTheme";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea,
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
    return { month: formatMonth(m.month) + (isPartialMonth(m.month) ? " (parc.)" : ""), partial: isPartialMonth(m.month), faturamento: val, recebimento: rec };
  });
  const partialLabel = data.find((d) => d.partial)?.month;
  const closedData = data.filter((d) => !d.partial);
  const avgFaturamento = closedData.reduce((s, d) => s + d.faturamento, 0) / (closedData.length || 1);

  return (
    <ChartCard title="Faturamento x Recebimento" subtitle={<>Média dos últimos 12 meses fechados: {fmtCurrency(avgFaturamento)}</>}>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          {partialLabel && <ReferenceArea x1={partialLabel} x2={partialLabel} {...PARTIAL_BAND} />}
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={fmtCurrency} tick={AXIS_TICK} width={70} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number, name: string) => [fmtCurrency(v), name === "faturamento" ? "Faturamento" : "Recebimento"]}
          />
          <Legend formatter={(v) => v === "faturamento" ? "Faturamento" : "Recebimento"} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="faturamento" fill="hsl(4 90% 50%)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          <Bar dataKey="recebimento" fill="hsl(220 15% 78%)" radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
