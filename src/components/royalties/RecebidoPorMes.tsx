import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from "recharts";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { TooltipCard } from "@/components/ChartTooltip";
import { AXIS_TICK, GRID, PARTIAL_BAND } from "@/components/chartTheme";
import { COR_FIXA, COR_ROYALTIES } from "@/components/royalties/cores";
import { type ContextoRoyalties, type FiltroRoyalties, type PontoMensal, brl, periodo, serieMensal } from "@/data/royalties";

const mil = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil` : `R$ ${Math.round(v)}`);

/** Recebido por mês no período (mês do recebimento no extrato), em barras empilhadas de taxa fixa e royalties. */
export function RecebidoPorMes({ c, f }: { c: ContextoRoyalties; f: FiltroRoyalties }) {
  const ks = periodo(c, f);
  const dados = serieMensal(c, f);
  const mostrarFixa = f.tipo !== "royalties" && dados.some((d) => d.fixa !== 0);
  const mostrarRoy = f.tipo !== "fixa" && dados.some((d) => d.royalties !== 0);
  const parciais = dados.filter((d) => d.parcial);
  return (
    <ChartCard
      title="Recebido por mês"
      subtitle={`Mês do recebimento no extrato, de ${c.rotulo[ks[0]]} a ${c.rotulo[ks[ks.length - 1]]}`}
      legend={
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {mostrarFixa && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COR_FIXA }} aria-hidden />Taxa fixa</span>}
          {mostrarRoy && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COR_ROYALTIES }} aria-hidden />Royalties</span>}
        </div>
      }
    >
      {!mostrarFixa && !mostrarRoy ? (
        <ChartEmpty>Sem recebimentos no período e nos filtros escolhidos.</ChartEmpty>
      ) : (
        <div className="h-[280px] w-full" role="img" aria-label="Gráfico de barras do recebido por mês, separado em taxa fixa e royalties">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={64} tickFormatter={mil} />
              {parciais.map((p) => <ReferenceArea key={p.key} x1={p.label} x2={p.label} {...PARTIAL_BAND} />)}
              <Tooltip
                cursor={{ fill: "hsl(222 16% 91% / 0.5)" }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as PontoMensal | undefined;
                  if (!active || !p) return null;
                  const linhas = [
                    ...(mostrarFixa ? [{ label: "Taxa fixa", value: brl(p.fixa), color: COR_FIXA }] : []),
                    ...(mostrarRoy ? [{ label: "Royalties", value: brl(p.royalties), color: COR_ROYALTIES }] : []),
                    ...(mostrarFixa && mostrarRoy ? [{ label: "Total recebido", value: brl(p.total), color: "hsl(222 14% 85%)" }] : []),
                  ];
                  const nota = [p.parcial ? "Mês parcial" : "", p.naoMapeado ? `Inclui ${brl(p.naoMapeado)} sem unidade` : ""].filter(Boolean).join(" · ");
                  return <TooltipCard title={`${p.label}${p.parcial ? " (parcial)" : ""}`} rows={linhas} note={nota || undefined} />;
                }}
              />
              {mostrarFixa && <Bar dataKey="fixa" stackId="r" fill={COR_FIXA} maxBarSize={36} radius={mostrarRoy ? 0 : [3, 3, 0, 0]} isAnimationActive={false} />}
              {mostrarRoy && <Bar dataKey="royalties" stackId="r" fill={COR_ROYALTIES} maxBarSize={36} radius={[3, 3, 0, 0]} isAnimationActive={false} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
