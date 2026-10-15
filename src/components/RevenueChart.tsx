import { dashboardData, getUnitData } from "@/data/dashboardData";
import { isPartialMonth, formatMonthLong } from "@/data/periods";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { TooltipCard } from "@/components/ChartTooltip";
import { partialDot } from "@/components/PartialDot";
import { splitPartial } from "@/components/chartData";
import { AXIS_TICK, GRID } from "@/components/chartTheme";
import { formatAbbreviatedNumber } from "@/lib/utils";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from "recharts";

interface RevenueChartProps {
  selectedUnit: string | null;
}

// Regra de cor do sistema: vermelho da marca na série principal; ardósia neutra na secundária.
const BRAND = "hsl(4 90% 50%)";
const SLATE = "hsl(222 14% 40%)";

export interface RevenueRow {
  month: string;
  label: string;
  partial: boolean;
  /** Valores reais do mês (tooltip e cabeçalho). */
  fat: number;
  rec: number;
  /** Séries da linha: só meses fechados. O mês em andamento vai para os campos *Parcial (marcador isolado). */
  faturamento: number | null;
  recebimento: number | null;
  faturamentoParcial: number | null;
  recebimentoParcial: number | null;
}

function shortMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

const brlCompact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", compactDisplay: "short", minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(v);
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

/** Últimos 12 meses (rede ou unidade). Só reorganiza valores existentes; nada é recalculado. */
export function buildRevenueRows(selectedUnit: string | null): RevenueRow[] {
  return dashboardData.slice(-12).map((m) => {
    const u = selectedUnit ? getUnitData(m.month, selectedUnit) : undefined;
    const fat = selectedUnit ? u?.faturamento ?? 0 : m.total.faturamento;
    const rec = selectedUnit ? u?.recebimento ?? 0 : m.total.recebimento;
    const partial = isPartialMonth(m.month);
    return {
      month: m.month,
      label: shortMonth(m.month) + (partial ? " (parc.)" : ""),
      partial, fat, rec,
      ...splitPartial("faturamento", partial, fat, "faturamentoParcial"),
      ...splitPartial("recebimento", partial, rec, "recebimentoParcial"),
    };
  });
}

function RevenueTooltip({ active, payload }: { active?: boolean; payload?: { payload: RevenueRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipCard
      title={formatMonthLong(r.month)}
      rows={[{ label: "Faturamento", value: brl(r.fat), color: BRAND }, { label: "Recebimento", value: brl(r.rec), color: SLATE }]}
      note={r.partial ? "Mês em andamento: valores parciais" : undefined}
    />
  );
}

const Swatch = ({ color, thin }: { color: string; thin?: boolean }) => <span className="w-4 rounded" style={{ height: thin ? 2 : 3, background: color }} aria-hidden />;

export function RevenueChart({ selectedUnit }: RevenueChartProps) {
  const rows = buildRevenueRows(selectedUnit);
  const closed = rows.filter((r) => !r.partial);
  const last = closed[closed.length - 1];
  const empty = rows.every((r) => r.fat === 0 && r.rec === 0);
  const avgFaturamento = closed.reduce((s, r) => s + r.fat, 0) / (closed.length || 1);
  const partialIdx = rows.findIndex((r) => r.partial);
  const partialRow = partialIdx >= 0 ? rows[partialIdx] : undefined;
  // Eixo de pontos: sombreia o último trecho (do último mês fechado até o parcial).
  const partialFrom = partialIdx > 0 ? rows[partialIdx - 1].label : partialRow?.label;

  return (
    <ChartCard
      title="Faturamento × Recebimento"
      subtitle={<>Média de faturamento dos últimos 12 meses fechados: {brlCompact(avgFaturamento)}</>}
      headline={
        last && !empty ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">Último mês fechado: <span className="first-letter:uppercase">{formatMonthLong(last.month)}</span></p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:gap-x-12">
              <HeadlineStat swatch={<Swatch color={BRAND} />} label="Faturamento" value={formatAbbreviatedNumber(last.fat)} />
              <HeadlineStat swatch={<Swatch color={SLATE} thin />} label="Recebimento" value={formatAbbreviatedNumber(last.rec)} />
            </div>
          </>
        ) : undefined
      }
    >
      {empty ? (
        <ChartEmpty>{selectedUnit ? `Sem faturamento nem recebimento de ${selectedUnit} nos últimos 12 meses.` : "Sem faturamento nem recebimento nos últimos 12 meses."}</ChartEmpty>
      ) : (
        <>
          <div className="h-[260px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-fat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rev-rec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SLATE} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={SLATE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} minTickGap={16} />
                {/* Eixo a partir do zero: as duas séries ficam na mesma escala, sem exagerar a diferença. */}
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} tickFormatter={brlCompact} domain={[0, "auto"]} />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "hsl(222 14% 60%)", strokeWidth: 1, strokeDasharray: "3 3" }} />
                {partialRow && <ReferenceArea x1={partialFrom} x2={partialRow.label} fill="hsl(32 92% 45%)" fillOpacity={0.08} />}
                <Area type="monotone" dataKey="recebimento" stroke={SLATE} strokeWidth={1.75} fill="url(#rev-rec)" dot={false} activeDot={{ r: 4, fill: "#fff", stroke: SLATE, strokeWidth: 2 }} isAnimationActive={false} />
                <Area type="monotone" dataKey="faturamento" stroke={BRAND} strokeWidth={2.5} fill="url(#rev-fat)" dot={false} activeDot={{ r: 5, fill: "#fff", stroke: BRAND, strokeWidth: 2 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="recebimentoParcial" stroke="none" dot={partialDot(brlCompact, { field: "recebimentoParcial", color: SLATE, label: false, secondary: true })} activeDot={false} legendType="none" isAnimationActive={false} />
                <Line type="monotone" dataKey="faturamentoParcial" stroke="none" dot={partialDot(brlCompact, { field: "faturamentoParcial", color: BRAND })} activeDot={false} legendType="none" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {partialRow && <p className="mt-2 text-xs text-muted-foreground">Círculo vazado e faixa âmbar: {formatMonthLong(partialRow.month)} em andamento (valores parciais, fora das linhas).</p>}
        </>
      )}
    </ChartCard>
  );
}
