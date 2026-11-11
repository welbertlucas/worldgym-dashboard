import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from "recharts";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { AXIS_TICK, GRID, PARTIAL_BAND } from "@/components/chartTheme";
import { TooltipCard } from "@/components/ChartTooltip";
import { partialDot } from "@/components/PartialDot";
import { splitPartial } from "@/components/chartData";
import { cn } from "@/lib/utils";
import { carregarCampanhas, mesAnoAnterior, mesAnterior, serieMensal, type FotoCampanhas, type PontoMeta } from "@/data/campanhas";
import { isPartialMonth } from "@/data/periods";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const curto = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(" de ", "/"); };
const longo = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };

/** "+12%" verde/vermelho conforme subir é bom ou ruim; null quando não dá para comparar. */
// A referência se chama "comparado" e não "ref": "ref" é reservado no React e nunca chegava aqui (sempre "sem comparação").
function Variacao({ atual, comparado, rotulo, melhorSeSobe }: { atual: number | null; comparado: PontoMeta | undefined; rotulo: string; melhorSeSobe: boolean; }) {
  const base = comparado ? (melhorSeSobe ? comparado.investimento : comparado.custo) : null;
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
        <Variacao atual={atual} comparado={anterior} rotulo={`vs ${curto(mesAnterior(ym))}`} melhorSeSobe={melhorSeSobe} />
        <Variacao atual={atual} comparado={anoAnterior} rotulo={`vs ${curto(mesAnoAnterior(ym))}`} melhorSeSobe={melhorSeSobe} />
      </p>
    </div>
  );
}

// Regra de cor do sistema (igual ao Faturamento × Recebimento): vermelho da marca na série; cinza tracejado no ano anterior.
const BRAND = "hsl(4 90% 50%)";
const ANO_ANTERIOR = "hsl(220 9% 62%)";

type Metrica = "investimento" | "custo";
const METRICAS: { id: Metrica; rotulo: string }[] = [{ id: "investimento", rotulo: "Investimento" }, { id: "custo", rotulo: "Custo por contato" }];

interface Linha { ym: string; mes: string; parcial: boolean; real: number | null; valor: number | null; valorParcial: number | null; anterior: number | null }

/** Investimento ou custo por contato do Meta nos últimos 12 meses fechados (e o mês em andamento), com o mesmo mês do ano anterior tracejado. */
export function EvolucaoMeta({ unit, month }: { unit: string | null; month: string }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  const [metrica, setMetrica] = useState<Metrica>("investimento");
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  const serie = useMemo(() => serieMensal(foto?.meses, unit), [foto, unit]);
  const titulo = "Evolução no Meta";
  const subtitle = <>{unit ?? "Rede"} • últimos 12 meses fechados • tracejado: mesmo mês do ano anterior</>;
  if (foto === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (serie.length < 2) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>É preciso pelo menos dois meses de investimento lido para mostrar a evolução.</ChartEmpty></ChartCard>;

  const por = new Map(serie.map((p) => [p.ym, p]));
  const atual = por.get(month);
  const valorDe = (p: PontoMeta | undefined) => (p ? (metrica === "investimento" ? p.investimento : p.custo) : null);
  const fmt = metrica === "investimento" ? reais : reais2;
  const eixo = metrica === "investimento" ? (v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v)) : (v: number) => `R$ ${v}`;
  const fechados = serie.filter((p) => !isPartialMonth(p.ym)).slice(-12);
  const andamento = serie.find((p) => isPartialMonth(p.ym));
  const dados: Linha[] = [...fechados, ...(andamento ? [andamento] : [])].map((p) => {
    const parcial = isPartialMonth(p.ym);
    const v = valorDe(p);
    return {
      ym: p.ym, mes: curto(p.ym) + (parcial ? " (parc.)" : ""), parcial, real: v, anterior: valorDe(por.get(mesAnoAnterior(p.ym))),
      ...(v === null ? { valor: null, valorParcial: null } : splitPartial("valor", parcial, v, "valorParcial")),
    };
  });
  const iParcial = dados.findIndex((d) => d.parcial);
  const faixaAte = iParcial >= 0 ? dados[iParcial].mes : undefined;
  const faixaDe = iParcial > 0 ? dados[iParcial - 1].mes : faixaAte;
  const nome = metrica === "investimento" ? "Investido" : "Custo por contato";

  const Dica = ({ active, payload }: { active?: boolean; payload?: { payload: Linha }[] }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <TooltipCard
        title={longo(d.ym)}
        rows={[
          { label: nome, value: d.real === null ? "—" : fmt(d.real), color: BRAND },
          ...(d.anterior !== null ? [{ label: `${curto(mesAnoAnterior(d.ym))}`, value: fmt(d.anterior), color: ANO_ANTERIOR }] : []),
        ]}
        note={d.parcial ? "Mês em andamento: valores parciais" : undefined}
      />
    );
  };

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      legend={
        <div role="group" aria-label="Indicador do gráfico" className="flex flex-wrap gap-1.5 text-xs">
          {METRICAS.map((m) => (
            <button key={m.id} type="button" aria-pressed={metrica === m.id} onClick={() => setMetrica(m.id)}
              className={cn("rounded-full border px-2.5 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", metrica === m.id ? "border-foreground bg-foreground text-background" : "border-border bg-white text-foreground hover:bg-secondary")}>
              {m.rotulo}
            </button>
          ))}
        </div>
      }
      headline={atual ? (
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <Destaque titulo={`Investido em ${longo(month)}`} valor={reais(atual.investimento)} atual={atual.investimento} anterior={por.get(mesAnterior(month))} anoAnterior={por.get(mesAnoAnterior(month))} ym={month} melhorSeSobe />
          <Destaque titulo="Custo por contato" valor={atual.custo === null ? "—" : reais2(atual.custo)} atual={atual.custo} anterior={por.get(mesAnterior(month))} anoAnterior={por.get(mesAnoAnterior(month))} ym={month} melhorSeSobe={false} />
        </div>
      ) : <p className="text-sm text-muted-foreground">Sem investimento lido em {longo(month)}.</p>}
    >
      <div className="h-[260px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="meta-evolucao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.16} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            {faixaAte && <ReferenceArea x1={faixaDe} x2={faixaAte} {...PARTIAL_BAND} />}
            <XAxis dataKey="mes" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} minTickGap={16} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} tickFormatter={eixo} domain={[0, "auto"]} />
            <Tooltip content={<Dica />} cursor={{ stroke: "hsl(222 14% 60%)", strokeWidth: 1, strokeDasharray: "3 3" }} />
            <Line type="monotone" dataKey="anterior" stroke={ANO_ANTERIOR} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} connectNulls isAnimationActive={false} />
            <Area type="monotone" dataKey="valor" stroke={BRAND} strokeWidth={2.5} fill="url(#meta-evolucao)" dot={false} activeDot={{ r: 5, fill: "#fff", stroke: BRAND, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="valorParcial" stroke="none" dot={partialDot(fmt, { field: "valorParcial", color: BRAND })} activeDot={false} legendType="none" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Verde = melhorou (mais investimento ou contato mais barato).{iParcial >= 0 && " Círculo vazado e faixa âmbar: mês em andamento (valores parciais, fora da linha)."}</p>
    </ChartCard>
  );
}
