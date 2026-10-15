import { dashboardData, getUnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";
import { ChartCard } from "@/components/ChartCard";
import { AXIS_TICK, GRID, TOOLTIP_STYLE, PARTIAL_BAND } from "@/components/chartTheme";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea,
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
    month: formatMonth(m.month) + (isPartialMonth(m.month) ? " (parc.)" : ""), partial: isPartialMonth(m.month),
    vendas: selectedUnit ? getUnitData(m.month, selectedUnit)?.vendasOnline ?? 0 : m.total.vendasOnline,
  }));
  const partialIdx = data.findIndex((d) => d.partial);
  const partialLabel = partialIdx >= 0 ? data[partialIdx].month : undefined;
  // Eixo de pontos: sombreia o último trecho (do último mês fechado até o parcial).
  const partialFrom = partialIdx > 0 ? data[partialIdx - 1].month : partialLabel;
  const closedData = data.filter((d) => !d.partial);
  const avgVendas = closedData.reduce((s, d) => s + d.vendas, 0) / (closedData.length || 1);

  return (
    <ChartCard title="Vendas Online" subtitle={<>Média dos últimos 12 meses fechados: {fmtCurrency(avgVendas)}</>}>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vendasGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(4 90% 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(4 90% 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          {partialLabel && <ReferenceArea x1={partialFrom} x2={partialLabel} {...PARTIAL_BAND} />}
          <XAxis dataKey="month" tick={AXIS_TICK} />
          <YAxis tickFormatter={fmtCurrency} tick={AXIS_TICK} width={70} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number) => [fmtCurrency(v), "Vendas Online"]}
          />
          <Area type="monotone" dataKey="vendas" stroke="hsl(4 90% 50%)" fill="url(#vendasGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
