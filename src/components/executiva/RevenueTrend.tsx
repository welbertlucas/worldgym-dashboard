import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from "recharts";
import { type MonthData } from "@/data/dashboardData";
import { sameMonthLastYear } from "@/data/alerts";
import { formatRelative, relativeDiff } from "@/data/unitIndicators";
import { formatMonthLong } from "@/data/periods";
import { AXIS_TICK, GRID } from "@/components/chartTheme";

const BRAND = "hsl(4 90% 50%)";
const PRIOR = "hsl(220 9% 62%)";
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const compact = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(v);
const short = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };

interface Row { month: string; label: string; atual: number; anterior: number | null }

function TooltipBox({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground first-letter:uppercase">{formatMonthLong(r.month)}</p>
      <p className="mt-1 flex items-center gap-1.5"><span className="h-0.5 w-3 rounded" style={{ background: BRAND }} />Faturamento <b className="ml-auto pl-3 tabular-nums">{brl(r.atual)}</b></p>
      {r.anterior !== null && (
        <>
          <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground"><span className="h-0.5 w-3 rounded border-t border-dashed" style={{ borderColor: PRIOR }} />Ano anterior <b className="ml-auto pl-3 tabular-nums">{brl(r.anterior)}</b></p>
          <p className="mt-1 font-semibold tabular-nums">{formatRelative(relativeDiff(r.atual, r.anterior))} vs. ano anterior</p>
        </>
      )}
    </div>
  );
}

/** Faturamento da rede nos últimos meses fechados, com o mesmo mês do ano anterior em linha tracejada. */
export function RevenueTrend({ closed, all, partialMonth }: { closed: MonthData[]; all: MonthData[]; partialMonth?: MonthData }) {
  const toRow = (m: MonthData): Row => {
    const prior = all.find((d) => d.month === sameMonthLastYear(m.month));
    return { month: m.month, label: short(m.month), atual: m.total.faturamento, anterior: prior ? prior.total.faturamento : null };
  };
  const rows = closed.map(toRow);
  const partial = partialMonth ? toRow(partialMonth) : null;
  // O mês em andamento aparece separado (faixa), sem entrar na linha dos meses fechados.
  const data: (Row & { atualParcial?: number })[] = partial ? [...rows, { ...partial, atual: partial.atual, atualParcial: partial.atual }] : rows;
  const last = rows[rows.length - 1];

  return (
    <section className="card-surface p-5 sm:p-6 min-w-0" aria-labelledby="hero-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="hero-titulo" className="text-base font-semibold text-foreground">Faturamento da rede</h3>
          <p className="text-sm text-muted-foreground">Últimos {rows.length} meses fechados em relação ao mesmo mês do ano anterior</p>
        </div>
        <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legenda">
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: BRAND }} aria-hidden />Faturamento</li>
          <li className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: PRIOR }} aria-hidden />Mesmo mês do ano anterior</li>
        </ul>
      </div>
      <div className="mt-5 h-[290px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.14} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} tickFormatter={compact} domain={["auto", "auto"]} />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: GRID, strokeWidth: 1 }} />
            {partial && <ReferenceArea x1={rows[rows.length - 1]?.label} x2={partial.label} fill="hsl(32 92% 45%)" fillOpacity={0.08} />}
            <Line type="monotone" dataKey="anterior" stroke={PRIOR} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />
            <Area type="monotone" dataKey={(d: Row & { atualParcial?: number }) => (d.atualParcial === undefined ? d.atual : null)} stroke={BRAND} strokeWidth={2.25} fill="url(#hero-fill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {partial && <p className="mt-2 text-xs text-muted-foreground">Faixa âmbar: {formatMonthLong(partial.month)} em andamento (valor parcial, fora da linha de faturamento).</p>}
      {last && <p className="sr-only">Último mês fechado: {formatMonthLong(last.month)}, faturamento {brl(last.atual)}.</p>}
    </section>
  );
}
