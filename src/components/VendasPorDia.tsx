import { useState } from "react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { getDataByMonth, getUnitData, type UnitData } from "@/data/dashboardData";
import { nextTier, resolveGoal, TIERS, TIER_LABEL, tierReached, type Meta } from "@/data/metas";
import { formatMonthLong } from "@/data/periods";
import { DIAS_MINIMOS, diaDaSemana, diasFechados, diasNoMes, mediaPorDiaDaSemana, projetarMes } from "@/data/vendasDia";

const SEMANA = [
  { sem: 1, nome: "Seg" }, { sem: 2, nome: "Ter" }, { sem: 3, nome: "Qua" }, { sem: 4, nome: "Qui" },
  { sem: 5, nome: "Sex" }, { sem: 6, nome: "Sáb" }, { sem: 0, nome: "Dom" },
];
const NOME_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dec = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Meses de referência: os `n` anteriores ao mês mostrado que têm vendas por dia (para a projeção e a média por dia da semana). */
export function mesesDeReferencia(month: string, unit: string | null, n = 3): [string, number[]][] {
  const out: [string, number[]][] = [];
  let [y, m] = month.split("-").map(Number);
  for (let k = 0; k < 12 && out.length < n; k++) {
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    const v = (unit ? getUnitData(ym, unit) : getDataByMonth(ym)?.total)?.vendasDia;
    if (v?.length) out.push([ym, v]);
  }
  return out.reverse();
}

const curto = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
};

/**
 * Novos contratos por dia do mês num calendário (mapa de calor), a média por dia da semana nos 3 meses anteriores
 * e, no mês em andamento, a projeção de fechamento contra a meta de novos contratos.
 */
export function VendasPorDia({ total, month, partial, unit, atualizadoEm, metas }: {
  total: UnitData; month: string; partial: boolean; unit: string | null; atualizadoEm: string | null; metas: Meta[];
}) {
  const [sel, setSel] = useState<number | null>(null);
  const monthLabel = formatMonthLong(month);
  const titulo = "Vendas por dia do mês";
  const v = total.vendasDia;
  const dias = diasFechados(month, partial, atualizadoEm);
  const subtitle = <>{unit ?? "Rede"} • {monthLabel}{partial && (dias ? ` (até ${dias}/${month.slice(5)})` : " (mês em andamento)")}</>;
  if (!v?.length) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>As vendas por dia ainda não foram carregadas para este mês.</ChartEmpty></ChartCard>;

  const n = diasNoMes(month);
  const hist = mesesDeReferencia(month, unit);
  const media = mediaPorDiaDaSemana(hist);
  const melhorSem = hist.length ? media.indexOf(Math.max(...media)) : null;
  const maiorMedia = Math.max(...media, 0.1);
  const realizado = v.reduce((a, b) => a + b, 0);
  const visiveis = v.slice(0, partial ? dias : n);
  const maior = Math.max(...visiveis, 1);
  const melhorDia = visiveis.indexOf(Math.max(...visiveis));
  const proj = partial ? projetarMes(v, month, dias, hist) : null;
  const md = getDataByMonth(month);
  // Meta da rede somada só de algumas unidades não compara com o realizado de todas: aí fica sem o nível.
  const goalBruto = proj && md ? resolveGoal(metas, md, month, unit, "novosContratos") : null;
  const goal = goalBruto && (!goalBruto.units || goalBruto.units === md!.units.length) ? goalBruto : null;
  const nivel = goal && proj ? tierReached("novosContratos", proj.valor, goal.meta) : null;
  const prox = goal && proj ? nextTier("novosContratos", proj.valor, goal.meta) : null;
  const marcas = goal ? TIERS.filter((t) => goal.meta[t] !== undefined).map((t) => ({ t, v: goal.meta[t]! })) : [];
  const escala = Math.max(proj?.valor ?? 0, realizado, ...marcas.map((x) => x.v), 1) * 1.05;

  // Calendário: semanas de segunda a domingo.
  const offset = (diaDaSemana(month, 1) + 6) % 7;
  const celulas: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);
  const semanas = Array.from({ length: celulas.length / 7 }, (_, k) => celulas.slice(k * 7, k * 7 + 7));
  const foco = sel ?? (visiveis.length ? melhorDia + 1 : null);

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label={partial ? "Novos contratos até agora" : "Novos contratos no mês"} value={int(realizado)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          {proj && <HeadlineStat label="Projeção para o fechamento" value={`≈ ${int(proj.valor)}`} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />}
          {nivel && <HeadlineStat label="No ritmo, a meta fecha em" value={TIER_LABEL[nivel]} swatch={<span className={`h-2 w-2 rounded-full ${nivel === "abaixo" ? "bg-destructive" : "bg-primary/60"}`} />} />}
          {melhorSem !== null && <HeadlineStat label={`Dia que mais vende (${curto(hist[0][0])}–${curto(hist[hist.length - 1][0])})`} value={`${NOME_LONGO[melhorSem][0].toUpperCase()}${NOME_LONGO[melhorSem].slice(1)}`} swatch={<span className="h-2 w-2 rounded-full bg-foreground/40" />} />}
        </div>
      }
    >
      {proj && (
        <div className="mb-6">
          <div className="relative h-3 rounded-full bg-secondary" role="img" aria-label={`Realizado ${int(realizado)}, projeção ${int(proj.valor)}`}>
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary/25" style={{ width: `${(proj.valor / escala) * 100}%` }} />
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(realizado / escala) * 100}%` }} />
            {marcas.map((x) => (
              <span key={x.t} className="absolute -top-1 h-5 w-0.5 bg-foreground/70" style={{ left: `${(x.v / escala) * 100}%` }} title={`${TIER_LABEL[x.t]}: ${int(x.v)}`} />
            ))}
          </div>
          {marcas.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              Meta de novos contratos (traços na barra): {marcas.map((x) => `${TIER_LABEL[x.t]} ${int(x.v)}`).join(" · ")}
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Em {dias} dias saíram {int(proj.realizado)} novos contratos. {hist.length ? `Em ${hist.map(([m]) => curto(m)).join(", ")}, até o dia ${dias} tinham saído` : "Sem meses anteriores para comparar: no ritmo linear, esses dias são"} {dec(proj.fatia * 100)}% das vendas do mês
            {prox && prox.value > realizado && n > dias && <>; para o {TIER_LABEL[prox.tier]} faltam {int(prox.value - realizado)}, cerca de {dec((prox.value - realizado) / (n - dias))} por dia</>}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <table className="w-full table-fixed border-separate border-spacing-1 text-xs" aria-label={`Novos contratos por dia em ${monthLabel}`}>
            <thead>
              <tr>{SEMANA.map((d) => <th key={d.sem} scope="col" className="pb-1 font-medium text-muted-foreground">{d.nome}</th>)}</tr>
            </thead>
            <tbody>
              {semanas.map((s, k) => (
                <tr key={k}>
                  {s.map((d, j) => {
                    if (d === null) return <td key={j} />;
                    const aberto = partial && d > dias;
                    const q = v[d - 1] ?? 0;
                    const i = q / maior;
                    return (
                      <td
                        key={j}
                        onMouseEnter={() => !aberto && setSel(d)}
                        onClick={() => !aberto && setSel(d)}
                        className={`h-11 cursor-default rounded-md p-1 align-top ${aberto ? "border border-dashed border-border" : ""} ${foco === d ? "ring-2 ring-primary ring-inset" : ""}`}
                        style={aberto ? undefined : { background: q > 0 ? `hsl(4 90% 50% / ${0.06 + i * 0.84})` : "hsl(var(--secondary))" }}
                      >
                        <span className={`block text-[10px] ${i > 0.55 && !aberto ? "text-white/85" : "text-muted-foreground"}`}>{d}</span>
                        {!aberto && <span className={`block text-center text-sm font-semibold tabular-nums ${i > 0.55 ? "text-white" : "text-foreground"}`}>{q}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 min-h-[1.25rem] text-sm text-foreground" aria-live="polite" onMouseLeave={() => setSel(null)}>
            {foco !== null && (
              <>{sel === null && <span className="text-muted-foreground">Maior dia: </span>}<span className="font-semibold">{foco}/{month.slice(5)}</span> ({NOME_LONGO[diaDaSemana(month, foco)]}): <span className="font-semibold tabular-nums">{int(v[foco - 1] ?? 0)}</span> novos contratos</>
            )}
          </p>
        </div>

        {hist.length > 0 && (
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Média por dia da semana ({curto(hist[0][0])}–{curto(hist[hist.length - 1][0])})</h4>
            <ul className="space-y-2" aria-label="Média de novos contratos por dia da semana">
              {SEMANA.map((d) => (
                <li key={d.sem} className="grid grid-cols-[2.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{d.nome}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <span className={`block h-full rounded-full ${d.sem === melhorSem ? "bg-primary" : "bg-foreground/55"}`} style={{ width: `${(media[d.sem] / maiorMedia) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{dec(media[d.sem])}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Novos contratos (matrícula e rematrícula, sem renovação automática e sem diária) pelo dia da venda no EVO; o horário da venda não é confiável no EVO, por isso o mapa é por dia.
        {partial && " Dias tracejados ainda não fecharam (o EVO é lido de madrugada, então o dia de hoje entra amanhã)."}
        {partial && ` A projeção aparece a partir do dia ${DIAS_MINIMOS}: divide o realizado pela parte das vendas que os 3 meses anteriores tinham feito até o mesmo dia. Nos testes com jul–out/2026, errou em média 2% a 8% na rede e 12% a 15% numa unidade entre os dias 10 e 15, menos perto do fim do mês; é uma estimativa, não uma promessa.`}
      </p>
    </ChartCard>
  );
}
