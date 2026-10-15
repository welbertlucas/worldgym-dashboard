import { dashboardData, getUnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";
import { priorYearValue, splitPartial } from "@/components/chartData";
import { partialDot } from "@/components/PartialDot";
import { ChartCard } from "@/components/ChartCard";
import { AXIS_TICK, GRID, TOOLTIP_STYLE, PARTIAL_BAND } from "@/components/chartTheme";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea,
} from "recharts";

interface VendasOnlineChartProps {
  selectedUnit: string | null;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", compactDisplay: "short", minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(v);

export function VendasOnlineChart({ selectedUnit }: VendasOnlineChartProps) {
  const data = dashboardData.slice(-12).map((m) => ({
    month: formatMonth(m.month) + (isPartialMonth(m.month) ? " (parc.)" : ""), partial: isPartialMonth(m.month), anterior: priorYearValue(m.month, selectedUnit, (u) => u.vendasOnline),
    ...splitPartial("vendas", isPartialMonth(m.month), selectedUnit ? getUnitData(m.month, selectedUnit)?.vendasOnline ?? 0 : m.total.vendasOnline),
  }));
  const partialIdx = data.findIndex((d) => d.partial);
  const partialLabel = partialIdx >= 0 ? data[partialIdx].month : undefined;
  // Eixo de pontos: sombreia o último trecho (do último mês fechado até o parcial).
  const partialFrom = partialIdx > 0 ? data[partialIdx - 1].month : partialLabel;
  const closedData = data.filter((d) => !d.partial);
  const avgVendas = closedData.reduce((s, d) => s + (d.vendas ?? 0), 0) / (closedData.length || 1);

  return (
    <ChartCard title="Vendas Online" subtitle={<>Média dos últimos 12 meses fechados: {fmtCurrency(avgVendas)} • tracejado: mesmo mês do ano anterior • círculo vazado: mês em andamento (parcial)</>}>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vendasGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(222 25% 22%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(222 25% 22%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          {partialLabel && <ReferenceArea x1={partialFrom} x2={partialLabel} {...PARTIAL_BAND} />}
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={fmtCurrency} tick={AXIS_TICK} width={70} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number, n: string) => [fmtCurrency(v), n === "parcial" ? "Em andamento (parcial)" : n === "anterior" ? "Ano anterior" : "Vendas Online"]}
          />
          <Line type="monotone" dataKey="anterior" stroke="hsl(220 9% 62%)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />
          <Area type="monotone" dataKey="vendas" stroke="hsl(222 25% 22%)" fill="url(#vendasGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="parcial" stroke="none" dot={partialDot(fmtCurrency)} activeDot={false} legendType="none" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
