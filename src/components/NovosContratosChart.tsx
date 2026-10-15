import { dashboardData, getUnitData } from "@/data/dashboardData";
import { isPartialMonth, formatMonthLong } from "@/data/periods";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { TooltipCard } from "@/components/ChartTooltip";
import { splitPartial } from "@/components/chartData";
import { AXIS_TICK, GRID } from "@/components/chartTheme";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine } from "recharts";

interface NovosContratosChartProps {
  selectedUnit: string | null;
}

// Regra de cor do sistema: vermelho da marca na série principal (novos contratos); ardósia neutra na secundária.
const BRAND = "hsl(4 90% 50%)";
const SLATE = "hsl(222 14% 40%)";

export interface FlowRow {
  month: string;
  label: string;
  partial: boolean;
  /** Valores reais do mês (tooltip e cabeçalho). */
  novosReal: number;
  canceladosReal: number;
  /**
   * Valores para DESENHAR: novos acima do eixo e cancelamentos abaixo (sinal invertido só na plotagem; o valor
   * mostrado ao usuário é sempre o real). O mês em andamento vai para os campos *Parcial.
   */
  novos: number | null;
  novosParcial: number | null;
  cancelados: number | null;
  canceladosParcial: number | null;
}

function shortMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

const num = (v: number) => v.toLocaleString("pt-BR");

/** Últimos 12 meses (rede ou unidade). Só reorganiza valores existentes; nenhum saldo ou taxa é calculado. */
export function buildFlowRows(selectedUnit: string | null): FlowRow[] {
  return dashboardData.slice(-12).map((m) => {
    const novos = selectedUnit ? getUnitData(m.month, selectedUnit)?.novosContratos ?? 0 : m.units.reduce((s, u) => s + u.novosContratos, 0);
    const cancelados = selectedUnit ? getUnitData(m.month, selectedUnit)?.cancelados ?? 0 : m.total.cancelados;
    const partial = isPartialMonth(m.month);
    return {
      month: m.month,
      label: shortMonth(m.month) + (partial ? " (parc.)" : ""),
      partial, novosReal: novos, canceladosReal: cancelados,
      ...splitPartial("novos", partial, novos, "novosParcial"),
      ...splitPartial("cancelados", partial, -cancelados, "canceladosParcial"),
    };
  });
}

function FlowTooltip({ active, payload }: { active?: boolean; payload?: { payload: FlowRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipCard
      title={formatMonthLong(r.month)}
      rows={[{ label: "Novos contratos", value: num(r.novosReal), color: BRAND }, { label: "Cancelamentos", value: num(r.canceladosReal), color: SLATE }]}
      note={r.partial ? "Mês em andamento: valores parciais" : undefined}
    />
  );
}

const Swatch = ({ color }: { color: string }) => <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />;

export default function NovosContratosChart({ selectedUnit }: NovosContratosChartProps) {
  const rows = buildFlowRows(selectedUnit);
  const closed = rows.filter((r) => !r.partial);
  const last = closed[closed.length - 1];
  const empty = rows.every((r) => r.novosReal === 0 && r.canceladosReal === 0);
  const avgNovos = closed.reduce((s, r) => s + r.novosReal, 0) / (closed.length || 1);
  const partialRow = rows.find((r) => r.partial);

  return (
    <ChartCard
      title="Novos contratos × Cancelamentos"
      subtitle={<>Média de novos contratos nos últimos 12 meses fechados: {avgNovos.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</>}
      headline={
        last && !empty ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">Último mês fechado: <span className="first-letter:uppercase">{formatMonthLong(last.month)}</span></p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:gap-x-12">
              <HeadlineStat swatch={<Swatch color={BRAND} />} label="Novos contratos" value={num(last.novosReal)} />
              <HeadlineStat swatch={<Swatch color={SLATE} />} label="Cancelamentos" value={num(last.canceladosReal)} />
            </div>
          </>
        ) : undefined
      }
    >
      {empty ? (
        <ChartEmpty>{selectedUnit ? `Sem novos contratos nem cancelamentos de ${selectedUnit} nos últimos 12 meses.` : "Sem novos contratos nem cancelamentos nos últimos 12 meses."}</ChartEmpty>
      ) : (
        <>
          <div className="h-[260px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
                <defs>
                  {/* Mês em andamento: listrado, para não parecer um mês fechado. */}
                  {[["hatch-novos", BRAND], ["hatch-cancelados", SLATE]].map(([id, c]) => (
                    <pattern key={id} id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="6" height="6" fill="#fff" />
                      <rect width="2.5" height="6" fill={c} fillOpacity={0.7} />
                    </pattern>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} minTickGap={16} />
                {/* Eixo espelhado: cancelamentos abaixo do zero, na mesma escala dos novos contratos; rótulos sem sinal. */}
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => num(Math.abs(v))} />
                <Tooltip content={<FlowTooltip />} cursor={{ fill: "hsl(222 25% 14%)", fillOpacity: 0.04 }} />
                {partialRow && <ReferenceArea x1={partialRow.label} x2={partialRow.label} fill="hsl(32 92% 45%)" fillOpacity={0.08} />}
                <ReferenceLine y={0} stroke="hsl(222 14% 40%)" strokeWidth={1} />
                <Bar dataKey="novos" stackId="fluxo" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
                <Bar dataKey="novosParcial" stackId="fluxo" fill="url(#hatch-novos)" stroke={BRAND} strokeDasharray="3 2" radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
                <Bar dataKey="cancelados" stackId="fluxo" fill={SLATE} radius={[0, 0, 4, 4]} maxBarSize={16} isAnimationActive={false} />
                <Bar dataKey="canceladosParcial" stackId="fluxo" fill="url(#hatch-cancelados)" stroke={SLATE} strokeDasharray="3 2" radius={[0, 0, 4, 4]} maxBarSize={16} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Novos contratos acima do zero, cancelamentos abaixo, na mesma escala.
            {partialRow && <> Barras listradas e faixa âmbar: {formatMonthLong(partialRow.month)} em andamento (valores parciais).</>}
          </p>
        </>
      )}
    </ChartCard>
  );
}
