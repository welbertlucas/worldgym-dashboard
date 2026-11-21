import { useMemo, useState } from "react";
import { ChartCard } from "@/components/ChartCard";
import { Select } from "@/components/ui/select";
import { dashboardData, type UnitData } from "@/data/dashboardData";
import { BASE_PEQUENA_PONTO, faixaDoNps, nomeDoPonto, npsDoPonto, pontosPresentes, rankingDePontos, serieDoPonto } from "@/data/npsPontos";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chartTheme";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";

const COR = { otimo: "bg-emerald-100 text-emerald-900", bom: "bg-amber-100 text-amber-900", melhorar: "bg-red-100 text-red-900", sem: "bg-secondary text-muted-foreground" } as const;
const BARRA = { otimo: "bg-emerald-500", bom: "bg-amber-500", melhorar: "bg-red-500", sem: "bg-secondary" } as const;
const nps1 = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const mesCurto = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");

/**
 * NPS por ponto de contato (WeHelp): o ranking dos pontos da rede (ou da unidade escolhida), o mapa de unidades × pontos e a evolução mensal de um ponto.
 * Só totais: nenhum aluno aparece.
 */
export function NpsPontosDeContato({ units, unit, monthLabel }: { units: UnitData[]; unit: string | null; monthLabel: string }) {
  const ranking = useMemo(() => rankingDePontos(units), [units]);
  const pontos = useMemo(() => pontosPresentes(dashboardData.flatMap((m) => m.units)), []);
  const pior = [...ranking].reverse().find((r) => r.resp >= BASE_PEQUENA_PONTO && r.nps !== null)?.ponto ?? pontos[0] ?? "";
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const ponto = escolhido ?? pior;
  const serie = useMemo(() => serieDoPonto(dashboardData.slice(-13), unit, ponto), [unit, ponto]);
  if (!ranking.length) {
    return <ChartCard title="NPS por ponto de contato" subtitle={`${unit ?? "Rede"} · ${monthLabel}`}><p className="rounded-xl bg-secondary/40 px-4 py-6 text-sm text-muted-foreground">O WeHelp ainda não trouxe notas por ponto de contato neste mês.</p></ChartCard>;
  }
  const comNota = units.filter((u) => u.npsPontos && Object.keys(u.npsPontos).length);
  const grade = !unit && comNota.length > 1;
  return (
    <div className="space-y-6">
      <ChartCard title="NPS por ponto de contato" subtitle={`${unit ?? "Rede"} · ${monthLabel} · do melhor para o pior. Verde: 75 ou mais; amarelo: 50 a 74; vermelho: abaixo de 50.`}>
        <ul className="space-y-2" aria-label="NPS por ponto de contato">
          {ranking.map((r) => {
            const faixa = faixaDoNps(r.nps), pequena = r.resp < BASE_PEQUENA_PONTO;
            return (
              <li key={r.ponto} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[14rem_minmax(0,1fr)_16rem]">
                <span className={`text-sm font-medium ${pequena ? "text-muted-foreground" : "text-foreground"}`}>{r.nome}</span>
                <span className="hidden h-3 rounded-full bg-secondary sm:block" aria-hidden>
                  <span className={`block h-3 rounded-full ${pequena ? "bg-muted-foreground/30" : BARRA[faixa]}`} style={{ width: `${Math.max(2, Math.min(100, ((r.nps ?? 0) + 100) / 2))}%` }} />
                </span>
                <span className="text-right text-sm tabular-nums text-foreground">
                  <b>{nps1(r.nps)}</b> <span className="text-xs text-muted-foreground">· {r.resp.toLocaleString("pt-BR")} respostas · {r.det.toLocaleString("pt-BR")} detratores{pequena ? " · base pequena" : ""}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">NPS do ponto = promotores menos detratores, em % das respostas que citaram o ponto. Pontos com menos de {BASE_PEQUENA_PONTO} respostas aparecem apagados.</p>
      </ChartCard>

      {grade && (
        <ChartCard title="Unidades × pontos de contato" subtitle={`${monthLabel} · NPS de cada ponto em cada unidade. "—" quando a unidade teve menos de 10 respostas no ponto.`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-separate border-spacing-1 text-xs">
              <thead>
                <tr><th className="text-left font-semibold text-muted-foreground">Unidade</th>{ranking.map((r) => <th key={r.ponto} className="px-1 text-center font-semibold text-muted-foreground" title={r.nome}>{r.nome.split(" ").slice(0, 2).join(" ")}</th>)}</tr>
              </thead>
              <tbody>
                {[...comNota].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((u) => (
                  <tr key={u.name}>
                    <th scope="row" className="whitespace-nowrap pr-2 text-left font-medium text-foreground">{u.name}</th>
                    {ranking.map((r) => {
                      const [resp = 0, prom = 0, det = 0] = u.npsPontos?.[r.ponto] ?? [];
                      const v = resp >= 10 ? npsDoPonto({ resp, prom, det }) : null;
                      return <td key={r.ponto} title={`${u.name} · ${r.nome}: ${resp} respostas`} className={`rounded-md px-1 py-1.5 text-center tabular-nums ${COR[faixaDoNps(v)]}`}>{nps1(v)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      <ChartCard
        title="Evolução do NPS por ponto de contato"
        subtitle={`${unit ?? "Rede"} · últimos meses`}
        legend={
          <label className="flex items-center gap-2 text-sm text-foreground">Ponto de contato
            <Select value={ponto} onChange={(e) => setEscolhido(e.target.value)} aria-label="Ponto de contato">
              {pontos.map((p) => <option key={p} value={p}>{nomeDoPonto(p)}</option>)}
            </Select>
          </label>
        }
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={serie.map((s) => ({ ...s, rotulo: mesCurto(s.month) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="rotulo" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, _n, p) => [v === null || v === undefined ? "sem respostas" : `${nps1(Number(v))} (${(p.payload as { resp: number }).resp} respostas)`, "NPS"]} />
            <ReferenceLine y={75} stroke="hsl(152 55% 40%)" strokeDasharray="4 4" strokeWidth={1} />
            <ReferenceLine y={50} stroke="hsl(38 92% 50%)" strokeDasharray="4 4" strokeWidth={1} />
            <Line type="monotone" dataKey="nps" stroke="hsl(222 25% 22%)" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
