import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chartTheme";
import { carregarCampanhas, mesAnoAnterior, mesAnterior, serieMensal, type FotoCampanhas, type PontoMeta } from "@/data/campanhas";
import { isPartialMonth } from "@/data/periods";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const curto = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(" de ", "/"); };
const longo = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };

/** "+12%" verde/vermelho conforme subir é bom ou ruim; null quando não dá para comparar. */
function Variacao({ atual, ref, rotulo, melhorSeSobe }: { atual: number | null; ref: PontoMeta | undefined; rotulo: string; melhorSeSobe: boolean; }) {
  const base = ref ? (melhorSeSobe ? ref.investimento : ref.custo) : null;
  if (atual === null || !base) return <span className="text-muted-foreground">{rotulo}: sem comparação</span>;
  const v = (atual / base - 1) * 100;
  const bom = melhorSeSobe ? v >= 0 : v <= 0;
  const cor = Math.abs(v) < 0.5 ? "text-muted-foreground" : bom ? "text-success" : "text-destructive";
  return <span className="text-muted-foreground">{rotulo}: <span className={`font-medium ${cor}`}>{v > 0 ? "+" : ""}{v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%</span></span>;
}

function Destaque({ titulo, valor, atual, anterior, anoAnterior, ym, melhorSeSobe }: { titulo: string; valor: string; atual: number | null; anterior?: PontoMeta; anoAnterior?: PontoMeta; ym: string; melhorSeSobe: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-[2rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">{valor}</p>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        <Variacao atual={atual} ref={anterior} rotulo={`vs ${curto(mesAnterior(ym))}`} melhorSeSobe={melhorSeSobe} />
        <Variacao atual={atual} ref={anoAnterior} rotulo={`vs ${curto(mesAnoAnterior(ym))}`} melhorSeSobe={melhorSeSobe} />
      </p>
    </div>
  );
}

/** Investimento e custo por contato do Meta mês a mês, com o mês escolhido comparado ao anterior e ao mesmo mês do ano passado. */
export function EvolucaoMeta({ unit, month }: { unit: string | null; month: string }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  const serie = useMemo(() => serieMensal(foto?.meses, unit), [foto, unit]);
  const titulo = "Evolução no Meta";
  const subtitle = <>{unit ?? "Rede"} • investimento e custo por contato mês a mês</>;
  if (foto === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (serie.length < 2) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>É preciso pelo menos dois meses de investimento lido para mostrar a evolução.</ChartEmpty></ChartCard>;

  const por = new Map(serie.map((p) => [p.ym, p]));
  const atual = por.get(month);
  const dados = serie.map((p) => ({ ...p, mes: curto(p.ym) + (isPartialMonth(p.ym) ? "*" : "") }));

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={atual ? (
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <Destaque titulo={`Investido em ${longo(month)}`} valor={reais(atual.investimento)} atual={atual.investimento} anterior={por.get(mesAnterior(month))} anoAnterior={por.get(mesAnoAnterior(month))} ym={month} melhorSeSobe />
          <Destaque titulo="Custo por contato" valor={atual.custo === null ? "—" : reais2(atual.custo)} atual={atual.custo} anterior={por.get(mesAnterior(month))} anoAnterior={por.get(mesAnoAnterior(month))} ym={month} melhorSeSobe={false} />
        </div>
      ) : <p className="text-sm text-muted-foreground">Sem investimento lido em {longo(month)}.</p>}
    >
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={dados} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="mes" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={8} />
          <YAxis yAxisId="r" axisLine={false} tickLine={false} tick={AXIS_TICK} width={56} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))} />
          <YAxis yAxisId="c" orientation="right" axisLine={false} tickLine={false} tick={AXIS_TICK} width={44} tickFormatter={(v) => `R$ ${v}`} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number, n: string) => (n === "investimento" ? [reais(v), "Investido"] : [reais2(v), "Custo por contato"])}
            labelFormatter={(l: string) => (l.endsWith("*") ? `${l.slice(0, -1)} (em andamento)` : l)}
          />
          <Bar yAxisId="r" dataKey="investimento" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {dados.map((d) => <Cell key={d.ym} fill={d.ym === month ? "hsl(222 25% 22%)" : "hsl(222 16% 78%)"} fillOpacity={isPartialMonth(d.ym) ? 0.55 : 1} />)}
          </Bar>
          <Line yAxisId="c" type="monotone" dataKey="custo" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-3 text-xs text-muted-foreground">Barras: investido no mês (a escura é o mês escolhido). Linha azul: custo por contato. * mês em andamento, valores parciais. Verde = melhorou (mais investimento ou contato mais barato).</p>
    </ChartCard>
  );
}
