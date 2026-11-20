import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from "recharts";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { TooltipCard } from "@/components/ChartTooltip";
import { AXIS_TICK, GRID, PARTIAL_BAND } from "@/components/chartTheme";
import { corDaUnidade } from "@/components/royalties/cores";
import { cn } from "@/lib/utils";
import { type ContextoRoyalties, type FiltroRoyalties, brl, brl0, periodo, recebidoDe } from "@/data/royalties";
import {
  type PontoRoyalties, type TomMarcacao, alertasDeRoyalties, descricaoDeRoyalties, marcacoesDeRoyalties, mostraRoyalties, primeiroRecebimento, serieDeRoyalties,
  textoDaMarcacao, unidadesDeRoyalties, unidadesDeRoyaltiesNoFiltro,
} from "@/data/royaltiesUnidades";

const mil = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil` : `R$ ${Math.round(v)}`);
const VERMELHO = "hsl(4 90% 50%)";
const TINTA = "hsl(222 14% 25%)";
const PILULA: Record<TomMarcacao, string> = { bad: "bg-red-100 text-red-800", peak: "bg-amber-100 text-amber-800", drop: "bg-orange-100 text-orange-800", open: "bg-sky-100 text-sky-800" };

/** Royalties por unidade: quanto cada unidade de royalties pagou em cada mês, com as marcações de mês sem pagamento, queda forte, pico e abertura. */
export function RoyaltiesPorUnidade({ c, f, onUnidade }: { c: ContextoRoyalties; f: FiltroRoyalties; onUnidade?: (u: string) => void }) {
  const [todosAlertas, setTodosAlertas] = useState(false);
  if (!mostraRoyalties(c, f)) return null;
  const ks = periodo(c, f);
  const todas = unidadesDeRoyalties(c);
  const noFiltro = unidadesDeRoyaltiesNoFiltro(c, f);
  const { pontos, unidades } = serieDeRoyalties(c, f);
  const marcas = marcacoesDeRoyalties(c);
  const alertas = alertasDeRoyalties(c, f);
  const parciais = pontos.filter((p) => p.parcial);

  return (
    <ChartCard title="Royalties por unidade" subtitle={descricaoDeRoyalties(c, f)}>
      {noFiltro.length === 0 ? (
        <ChartEmpty>Nenhuma unidade de royalties no filtro atual.</ChartEmpty>
      ) : (
        <div className="space-y-5">
          <ul className="flex flex-wrap gap-2" aria-label="Royalties recebidos no período, por unidade">
            {noFiltro.map((u) => (
              <li key={u}>
                <button type="button" onClick={() => onUnidade?.(u)} className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-left text-xs hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="h-2 w-2 rounded-full" style={{ background: corDaUnidade(todas, u) }} aria-hidden />
                  <span className="font-medium text-foreground">{u}</span>
                  <span className="tabular-nums text-muted-foreground">{brl0(recebidoDe(c, u, ks))}</span>
                </button>
              </li>
            ))}
          </ul>

          {unidades.length === 0 ? (
            <ChartEmpty>Essas unidades ainda não receberam royalties.</ChartEmpty>
          ) : (
            <div className="h-[300px] w-full" role="img" aria-label="Gráfico de linhas dos royalties recebidos por mês, uma linha por unidade">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pontos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={64} tickFormatter={mil} />
                  {parciais.map((p) => <ReferenceArea key={p.key} x1={p.label} x2={p.label} {...PARTIAL_BAND} />)}
                  <Tooltip
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as PontoRoyalties | undefined;
                      if (!active || !p) return null;
                      const linhas = unidades
                        .filter((u) => typeof p[u] === "number")
                        .sort((a, b) => (p[b] as number) - (p[a] as number))
                        .map((u) => {
                          const m = marcas[u]?.[p.key];
                          return { label: u, value: `${brl(p[u] as number)}${m ? `, ${textoDaMarcacao(c, u, m)}` : ""}`, color: corDaUnidade(todas, u) };
                        });
                      return <TooltipCard title={`${p.label}${p.parcial ? " (parcial)" : ""}`} rows={linhas} />;
                    }}
                  />
                  {unidades.map((u) => {
                    const cor = corDaUnidade(todas, u);
                    const abertura = primeiroRecebimento(c, u);
                    return (
                      <Line
                        key={u}
                        type="monotone"
                        dataKey={u}
                        stroke={cor}
                        strokeWidth={2}
                        isAnimationActive={false}
                        connectNulls={false}
                        activeDot={{ r: 4 }}
                        dot={(props: { cx?: number; cy?: number; index?: number; payload?: PontoRoyalties }) => {
                          const { cx, cy, payload } = props;
                          const chave = `${u}-${payload?.key ?? props.index}`;
                          if (cx == null || cy == null || !payload || typeof payload[u] !== "number") return <g key={chave} />;
                          const m = marcas[u]?.[payload.key];
                          if (m) return <circle key={chave} cx={cx} cy={cy} r={6} fill="white" stroke={m.t === "pico" ? TINTA : VERMELHO} strokeWidth={2.5} />;
                          if (c.keys.indexOf(payload.key) === abertura && abertura > 0) return <rect key={chave} x={cx - 5} y={cy - 5} width={10} height={10} transform={`rotate(45 ${cx} ${cy})`} fill={cor} />;
                          return <g key={chave} />;
                        }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {alertas.length > 0 && (
            <ul className="space-y-1.5 text-sm" aria-label="Marcações dos royalties no período">
              {(todosAlertas ? alertas : alertas.slice(0, 5)).map((a, i) => (
                <li key={`${a.unidade}-${a.ordem}-${i}`} className="flex items-start gap-2">
                  <span className={cn("mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium", PILULA[a.tom])}>{a.rotulo}</span>
                  <span className="text-muted-foreground"><b className="font-semibold text-foreground">{a.unidade}</b>: {a.texto}</span>
                </li>
              ))}
            </ul>
          )}
          {alertas.length > 5 && (
            <button type="button" onClick={() => setTodosAlertas((v) => !v)} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {todosAlertas ? "Mostrar só os 5 mais recentes" : `Ver os ${alertas.length} alertas`}
            </button>
          )}
        </div>
      )}
    </ChartCard>
  );
}
