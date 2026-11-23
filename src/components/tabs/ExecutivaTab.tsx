import { useState } from "react";
import { SectionTitle } from "@/components/SectionTitle";
import { KpiGrid, type KpiContext, type KpiSpec } from "@/components/kpi/KpiGrid";
import { conversaoSpec, faturamentoSpec, vendasOnlineSpec } from "@/components/kpi/tabSpecs";
import { MetasKpiCard, type RedeGoal } from "@/components/executiva/MetasKpiCard";
import { SeletorPeriodo, type Periodo } from "@/components/executiva/SeletorPeriodo";
import { agregarPeriodo, mesesDoPeriodo, periodoAnterior, rotuloPeriodo } from "@/data/periodo";
import { type MonthData, dashboardDataRede } from "@/data/dashboardData";
import { isSingleGoal, progressToNext, resolveGoal, tierReached, type Meta, type MetaKey } from "@/data/metas";
import { isPartialMonth } from "@/data/periods";
import { sameMonthLastYear } from "@/data/alerts";
import { formatAbbreviatedNumber } from "@/lib/utils";

interface Props {
  month: MonthData;
  prev?: MonthData;
  /** Há um mês marcado em "Comparar com": os velocímetros mostram só ele, sem o chip do ano anterior. */
  comparaMesEscolhido?: boolean;
  metas: Meta[];
  onOpenMetas?: () => void;
  /** Meses usados no gráfico e no mesmo mês do ano anterior: a rede, ou só as unidades da pessoa. */
  serie?: MonthData[];
  /** Perfil de unidades: as unidades da pessoa (a tela mostra só a soma delas, nada da rede). null = vê a rede. */
  unidades?: string[] | null;
}

const pctText = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

export function ExecutivaTab({ month, prev, comparaMesEscolhido, metas, onOpenMetas, serie = dashboardDataRede, unidades = null }: Props) {
  const umaUnidade = unidades?.length === 1 ? unidades[0] : null;
  const escopo = !unidades ? "da rede" : umaUnidade ? "da unidade" : "das suas unidades";
  // Meta de um indicador no mês: a da rede (linha TOTAL), a da unidade, ou a soma das metas das unidades da pessoa
  // (só para indicadores que somam; a meta TOTAL da rede não vale para quem vê só algumas unidades).
  const metaDe = (key: MetaKey) =>
    !unidades ? resolveGoal(metas, month, month.month, null, key)
    : umaUnidade ? resolveGoal(metas, month, month.month, umaUnidade, key)
    : resolveGoal(metas.filter((m) => m.unit !== "TOTAL" && m.unit !== "REDE"), month, month.month, null, key);
  const partial = isPartialMonth(month.month);
  // Overview por período: soma o que é soma e pondera o que é taxa (src/data/periodo.ts). Desligado, tudo segue como o mês escolhido no topo.
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const mesesDaSerie = serie.map((m) => m.month).sort();
  const idsPeriodo = periodo ? mesesDoPeriodo(serie, periodo.de, periodo.ate) : [];
  const idsAnterior = periodo ? periodoAnterior(serie, periodo.de, periodo.ate) : [];
  const dosMeses = (ids: string[]) => serie.filter((m) => ids.includes(m.month)).sort((a, b) => a.month.localeCompare(b.month));
  const noPeriodo = periodo !== null && idsPeriodo.length > 0;
  const periodoAtual = noPeriodo ? agregarPeriodo(dosMeses(idsPeriodo)) : null;
  const periodoPrev = noPeriodo && idsAnterior.length ? agregarPeriodo(dosMeses(idsAnterior)) : undefined;
  const parcialDoPeriodo = noPeriodo && isPartialMonth(idsPeriodo[idsPeriodo.length - 1]);
  const t = periodoAtual ? periodoAtual.total : month.total;
  // Metas no mês exibido (da rede ou das unidades da pessoa): progresso rumo ao próximo nível e nível atingido
  const chaves = [...new Set(metas.filter((m) => m.month === month.month && (unidades ? unidades.includes(m.unit) : m.unit === "TOTAL")).map((m) => m.key as MetaKey))];
  const redeGoals: RedeGoal[] = chaves
    .map((key) => {
      const g = metaDe(key);
      if (!g) return null;
      const { pct, next } = progressToNext(key, g.actual, g.meta);
      return { tier: tierReached(key, g.actual, g.meta), pct, done: next === null, single: isSingleGoal(g.meta) };
    })
    .filter((x): x is RedeGoal => x !== null);

  // Mesmo mês do ano anterior (só para mês fechado e se existir na planilha).
  const ly = partial || comparaMesEscolhido ? undefined : serie.find((d) => d.month === sameMonthLastYear(month.month));
  const ctx: KpiContext = periodoAtual
    ? { cur: periodoAtual, prev: periodoPrev, ly: undefined, partial: parcialDoPeriodo, prevLabel: rotuloPeriodo(idsAnterior[0] ?? periodo!.de, idsAnterior[idsAnterior.length - 1] ?? periodo!.de) }
    : { cur: month, prev, ly, partial };
  // Quanto do que foi cobrado (títulos) já foi pago: as duas pontas pela conta das cobranças. O Faturamento do cartão é o Total de Vendas, outra conta.
  const cobrado = t.faturamentoTitulos ?? t.faturamento;
  const recebRatio = cobrado ? (t.recebimento / cobrado) * 100 : 0;
  const specs: KpiSpec[] = [
    faturamentoSpec,
    { title: "Pagamentos dos clientes", kind: "flow", pick: (v) => v.total.recebimento, fmt: formatAbbreviatedNumber, extra: [{ text: `${pctText(recebRatio)} do que foi cobrado`, tone: "neutral" }] },
    vendasOnlineSpec,
    { title: "Churn", kind: "rate", rateKey: "churn", pick: (v) => v.total.churn, fmt: pctText },
    { title: "Inadimplência", kind: "rate", rateKey: "inadimplenciaPerc", pick: (v) => v.total.inadimplenciaPerc, fmt: pctText },
    { title: "Renovação", kind: "rate", rateKey: "renovacoes", pick: (v) => v.total.renovacoes, fmt: pctText },
    conversaoSpec,
  ];

  return (
    <div className="space-y-8 sm:space-y-10">
      <section aria-labelledby="indicadores-titulo">
        <SectionTitle level="page" hint={`${umaUnidade ? `Números de ${umaUnidade}` : unidades ? `Soma das suas ${unidades.length} unidades` : "Totais da rede"} ${noPeriodo ? `no período de ${rotuloPeriodo(periodo!.de, periodo!.ate)} (${idsPeriodo.length} ${idsPeriodo.length === 1 ? "mês" : "meses"}): valores somados e taxas em média ponderada pela base de cada mês.${idsAnterior.length ? ` A marca no arco é o período anterior (${rotuloPeriodo(idsAnterior[0], idsAnterior[idsAnterior.length - 1])}).` : " Não há meses antes dele para comparar."}${parcialDoPeriodo ? " Inclui o mês em andamento, com o que ele tem até hoje." : ""}` : "no mês selecionado. A marca no arco é o mês anterior."}`}>
          <span id="indicadores-titulo">Overview</span>
        </SectionTitle>
        <div className="mb-4"><SeletorPeriodo meses={mesesDaSerie} periodo={periodo} aoMudar={setPeriodo} ate={month.month} /></div>
        <KpiGrid ctx={ctx} specs={specs}>
          {!noPeriodo && <MetasKpiCard goals={redeGoals} partial={partial} onOpen={onOpenMetas ?? (() => {})} escopo={escopo} />}
        </KpiGrid>
      </section>
    </div>
  );
}
