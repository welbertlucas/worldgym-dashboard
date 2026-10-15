import { dashboardData, getUnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";
import { ChartCard } from "@/components/ChartCard";
import { AXIS_TICK, GRID, TOOLTIP_STYLE, PARTIAL_BAND } from "@/components/chartTheme";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
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
    month: formatMonth(m.month) + (isPartialMonth(m.month) ? " (parc.)" : ""), partial: isPartialMonth(m.month),
    renovacoes: parseFloat((selectedUnit ? getUnitData(m.month, selectedUnit)?.renovacoes ?? 0 : m.total.renovacoes).toFixed(2)),
  }));
  const partialIdx = data.findIndex((d) => d.partial);
  const partialLabel = partialIdx >= 0 ? data[partialIdx].month : undefined;
  // Eixo de pontos: sombreia o último trecho (do último mês fechado até o parcial).
  const partialFrom = partialIdx > 0 ? data[partialIdx - 1].month : partialLabel;
  const closedData = data.filter((d) => !d.partial);
  const avgRenovacoes = closedData.reduce((s, d) => s + d.renovacoes, 0) / (closedData.length || 1);

  return (
    <ChartCard title="Taxa de Renovação (%)" subtitle={<>Média dos últimos 12 meses fechados: {avgRenovacoes.toFixed(1)}%</>}>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          {partialLabel && <ReferenceArea x1={partialFrom} x2={partialLabel} {...PARTIAL_BAND} />}
          <XAxis dataKey="month" tick={AXIS_TICK} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} domain={[0, 100]} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number) => [`${v}%`, "Renovação"]}
          />
          <ReferenceLine y={60} stroke="hsl(142 71% 45%)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "60%", fill: "hsl(142 71% 45%)", fontSize: 11, position: "insideTopRight" }} />
          <Line type="monotone" dataKey="renovacoes" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
