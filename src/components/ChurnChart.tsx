import { dashboardData, getUnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";
import { priorYearValue, splitPartial } from "@/components/chartData";
import { partialDot } from "@/components/PartialDot";
import { ChartCard } from "@/components/ChartCard";
import { AXIS_TICK, GRID, TOOLTIP_STYLE, PARTIAL_BAND } from "@/components/chartTheme";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
} from "recharts";

interface ChurnChartProps {
  selectedUnit: string | null;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function ChurnChart({ selectedUnit }: ChurnChartProps) {
  const data = dashboardData.slice(-12).map((m) => ({
    month: formatMonth(m.month) + (isPartialMonth(m.month) ? " (parc.)" : ""), partial: isPartialMonth(m.month), anterior: priorYearValue(m.month, selectedUnit, (u) => u.churn),
    ...splitPartial("churn", isPartialMonth(m.month), parseFloat((selectedUnit ? getUnitData(m.month, selectedUnit)?.churn ?? 0 : m.total.churn).toFixed(2))),
  }));
  const partialIdx = data.findIndex((d) => d.partial);
  const partialLabel = partialIdx >= 0 ? data[partialIdx].month : undefined;
  // Eixo de pontos: sombreia o último trecho (do último mês fechado até o parcial).
  const partialFrom = partialIdx > 0 ? data[partialIdx - 1].month : partialLabel;
  const closedData = data.filter((d) => !d.partial);
  const avgChurn = closedData.reduce((s, d) => s + (d.churn ?? 0), 0) / (closedData.length || 1);

  return (
    <ChartCard title="Taxa de Churn (%)" subtitle={<>Média dos últimos 12 meses fechados: {avgChurn.toFixed(1)}% • tracejado: mesmo mês do ano anterior • círculo vazado: mês em andamento (parcial)</>}>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          {partialLabel && <ReferenceArea x1={partialFrom} x2={partialLabel} {...PARTIAL_BAND} />}
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number, n: string) => [`${v}%`, n === "parcial" ? "Em andamento (parcial)" : n === "anterior" ? "Ano anterior" : "Churn"]}
          />
          <ReferenceLine y={5} stroke="hsl(38 92% 50%)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "5%", fill: "hsl(38 92% 50%)", fontSize: 11, position: "insideTopRight" }} />
          <ReferenceLine y={8} stroke="hsl(0 72% 51%)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "8%", fill: "hsl(0 72% 51%)", fontSize: 11, position: "insideTopRight" }} />
          <Line type="monotone" dataKey="anterior" stroke="hsl(220 9% 62%)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="churn" stroke="hsl(222 25% 22%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="parcial" stroke="none" dot={partialDot((v) => `${v.toLocaleString("pt-BR")}%`)} activeDot={false} legendType="none" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
