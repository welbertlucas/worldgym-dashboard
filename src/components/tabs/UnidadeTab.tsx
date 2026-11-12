import { useMemo, useState } from "react";
import { Chip, Segmentos } from "@/components/DateFilter";
import { GitCompareArrows } from "lucide-react";
import { KpiGrid, type KpiContext, type KpiSpec } from "@/components/kpi/KpiGrid";
import { comercialSpecs, financeiroSpecs, retencaoSpecs } from "@/components/kpi/tabSpecs";
import { TrendCard } from "@/components/unidades/TrendCard";
import { ContratosTiles } from "@/components/unidades/ContratosTiles";
import { PosicoesNaRede } from "@/components/unidades/UnitsRanking";
import { ContratosVendidos } from "@/components/ContratosVendidos";
import { AtalhosSecoes, Secao } from "@/components/unidades/Secao";
import { UnitComparison } from "@/components/UnitComparison";
import { contratosView } from "@/data/contratosAtivos";
import { dashboardData, dashboardDataRede, getAvailableUnits } from "@/data/dashboardData";
import { INDICATOR_BY_KEY } from "@/data/unitIndicators";
import { PERIODOS, mesesNoIntervalo, serieDaRede, seriesPorMeses } from "@/data/unitSeries";
import { viewFor } from "@/data/kpiView";
import { sameMonthLastYear } from "@/data/alerts";
import { META_INDICATORS, TIER_LABEL, actualFor, getMeta, nextTier, tierReached, formatMetaValue, type Meta, type MetaKey } from "@/data/metas";
import { formatMonthLong, getLastClosedMonth, isPartialMonth } from "@/data/periods";

interface Props {
  unit: string;
  selectedMonth: string;
  /** Mês marcado em "Comparar com" no topo: os cartões passam a compará-lo com o mês exibido. */
  compareMonth: string | null;
  metas: Meta[];
  onOpenMetas?: () => void;
  /** Abre um menu temático (Comercial, Financeiro…) já filtrado nesta unidade. */
  onOpenTab?: (id: string) => void;
}

/** Menus temáticos que aceitam o filtro de unidade: atalhos do retrato para eles. */
export const MENUS_DA_UNIDADE = [
  { id: "comercial", rotulo: "Comercial" },
  { id: "financeiro", rotulo: "Financeiro" },
  { id: "alunos", rotulo: "Alunos" },
  { id: "catraca", rotulo: "Acessos na catraca" },
  { id: "retencao", rotulo: "Retenção" },
  { id: "metas", rotulo: "Metas" },
] as const;

const TREND_KEYS = ["faturamento", "recebimento", "inadimplenciaPerc", "churn", "renovacoes", "novosContratos"] as const;
const unitSpecs: KpiSpec[] = [
  financeiroSpecs[0], financeiroSpecs[1], financeiroSpecs[2], comercialSpecs[0],
  ...retencaoSpecs(false).filter((s) => ["Adimplentes", "Renovação", "Churn", "Inadimplência"].includes(s.title)),
];
const REDE = "__rede__";

/** Uma unidade: indicadores do mês, posição na rede (o ranking fica no Benchmark), metas, contratos e evolução contra a rede ou outra unidade. */
export function UnidadeDetalhe({ unit, selectedMonth, compareMonth, metas, onOpenMetas, onOpenTab }: Props) {
  const units = useMemo(() => getAvailableUnits(), []);
  const fechados = useMemo(() => dashboardData.filter((d) => !isPartialMonth(d.month)).map((d) => d.month), []);
  const [periodo, setPeriodo] = useState(12);
  const [comparar, setComparar] = useState(REDE);
  const mesesGrafico = mesesNoIntervalo(dashboardData, fechados[Math.max(0, fechados.length - periodo)] ?? "", fechados[fechados.length - 1] ?? "");

  const months = dashboardData.map((d) => d.month);
  const partial = isPartialMonth(selectedMonth);
  const idx = months.indexOf(selectedMonth);
  const prev = idx > 0 ? months[idx - 1] : undefined;
  const ctx: KpiContext = {
    cur: viewFor(selectedMonth, unit) ?? { month: selectedMonth, total: dashboardData[idx]?.total, units: [] },
    prev: viewFor(compareMonth && compareMonth !== selectedMonth ? compareMonth : prev, unit),
    ly: partial || compareMonth === sameMonthLastYear(selectedMonth) ? undefined : viewFor(sameMonthLastYear(selectedMonth), unit),
    partial,
  };

  // Posição na rede: no último mês fechado (o mês em andamento é parcial e distorceria o ranking).
  const rankMonth = partial ? getLastClosedMonth(months) : selectedMonth;
  // Rede inteira: para o perfil de unidades, as outras vêm com o nome escondido ("Unidade 07"), como no Benchmark.
  const rankUnits = dashboardDataRede.find((d) => d.month === rankMonth)?.units ?? [];
  const unitNow = dashboardData.find((d) => d.month === selectedMonth)?.units.find((u) => u.name === unit);
  const mesAtual = dashboardData.find((d) => d.month === selectedMonth);
  const metasDaUnidade = (Object.keys(META_INDICATORS) as MetaKey[]).flatMap((key) => {
    const meta = getMeta(metas, selectedMonth, unit, key);
    const actual = mesAtual ? actualFor(mesAtual, unit, key) : null;
    if (!meta || actual === null) return [];
    return [{ key, actual, nivel: tierReached(key, actual, meta), proximo: nextTier(key, actual, meta) }];
  });
  const ultimoComContratos = [...dashboardData].reverse().map((d) => d.units.find((u) => u.name === unit)).find((u) => u?.contratosAtivos !== undefined);
  const contratosDaUnidade = ultimoComContratos ? contratosView(ultimoComContratos) : null;
  const outra = comparar !== REDE && comparar !== "" && comparar !== unit ? comparar : null;

  const base = compareMonth && compareMonth !== selectedMonth ? compareMonth : prev;
  const ly = partial || compareMonth === sameMonthLastYear(selectedMonth) ? null : sameMonthLastYear(selectedMonth);
  const textoComparacao = [
    base ? `${formatMonthLong(base)}${compareMonth && compareMonth !== selectedMonth ? " (escolhido em “Comparar com”)" : " (mês anterior)"}` : null,
    ly && dashboardData.some((d) => d.month === ly) ? `${formatMonthLong(ly)} (mesmo mês do ano anterior)` : null,
  ].filter(Boolean);
  const nomeComp = comparar === REDE ? "a média da rede (nos percentuais, o resultado da rede)" : outra ?? null;
  const secoes = [
    { id: "ud-mes", rotulo: "Resultado do mês" },
    { id: "ud-posicao", rotulo: "Posição na rede" },
    { id: "ud-vendidos", rotulo: "Contratos mais vendidos" },
    { id: "ud-evolucao", rotulo: "Evolução" },
    ...(outra ? [{ id: "ud-comparacao", rotulo: `Comparação com ${outra}` }] : []),
    ...(contratosDaUnidade ? [{ id: "ud-contratos", rotulo: "Contratos ativos" }] : []),
    ...(onOpenTab ? [{ id: "ud-menus", rotulo: "Mais detalhes" }] : []),
  ];

  return (
    <div className="space-y-10">
      <AtalhosSecoes itens={secoes} />

      <Secao
        id="ud-mes"
        titulo={`Resultado de ${formatMonthLong(selectedMonth)}${partial ? " (parcial)" : ""}`}
        descricao={textoComparacao.length ? <>As setas de cada cartão comparam com {textoComparacao.join(" e com ")}. Para comparar com outro mês, use “Comparar com” no topo.</> : "Sem mês anterior para comparar."}
      >
        {unitNow ? <KpiGrid ctx={ctx} specs={unitSpecs} columns="xl:grid-cols-4" /> : <p className="text-sm text-muted-foreground">{unit} não tem dados em {formatMonthLong(selectedMonth)}.</p>}
        <div className="card-surface flex flex-wrap items-center justify-between gap-3 px-5 py-4" aria-label="Metas da unidade">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Metas:</span>{" "}
            {metasDaUnidade.length === 0 ? `nenhuma cadastrada para ${unit} neste mês.` : metasDaUnidade.map(({ key, actual, nivel, proximo }, i) => (
              <span key={key}>{i > 0 && " · "}{META_INDICATORS[key].label} {formatMetaValue(key, actual)}{partial && " (parcial)"}, {nivel === "abaixo" ? "abaixo da meta" : `atingiu ${TIER_LABEL[nivel]}`}{proximo && `, falta ${formatMetaValue(key, proximo.gap)} para ${TIER_LABEL[proximo.tier]}`}</span>
            ))}
          </p>
          {onOpenMetas && <button type="button" onClick={onOpenMetas} className="no-print rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">Ver em Metas</button>}
        </div>
      </Secao>

      <Secao id="ud-posicao" titulo="Posição na rede" descricao={<>Onde {unit} fica entre as unidades em {rankMonth ? formatMonthLong(rankMonth) : "—"}{partial ? " (último mês fechado)" : ""}. Para ver quem está acima e abaixo em cada indicador, abra o Ranking da rede: ele já vem centrado em {unit}.</>}>
        <PosicoesNaRede units={rankUnits} unidade={unit} monthLabel={rankMonth ? formatMonthLong(rankMonth) : ""} onVerNoBenchmark={onOpenTab ? () => onOpenTab("benchmark") : undefined} />
      </Secao>

      <Secao
        id="ud-vendidos"
        titulo="Contratos mais vendidos"
        descricao={`Os planos que ${unit} mais vendeu em ${formatMonthLong(selectedMonth)}${partial ? " (até hoje)" : ""} a alunos novos e a quem voltou, quem comprou e a duração dos planos.`}
        acoes={onOpenTab ? <button type="button" onClick={() => onOpenTab("comercial/vendas")} className="no-print rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">Ver o Comercial de {unit}</button> : undefined}
      >
        {unitNow ? <ContratosVendidos total={unitNow} monthLabel={formatMonthLong(selectedMonth)} partial={partial} unitLabel={unit} /> : <p className="text-sm text-muted-foreground">{unit} não tem dados em {formatMonthLong(selectedMonth)}.</p>}
      </Secao>

      <Secao
        id="ud-evolucao"
        titulo="Evolução"
        descricao={<>{mesesGrafico.length ? `${formatMonthLong(mesesGrafico[0])} a ${formatMonthLong(mesesGrafico[mesesGrafico.length - 1])}, só meses fechados. ` : ""}Linha vermelha: {unit}.{nomeComp ? <> Linha tracejada: {nomeComp}.</> : " Sem linha de comparação."}</>}
        acoes={
          <>
            <Segmentos rotulo="Período dos gráficos" opcoes={PERIODOS.map((p) => [p.n, p.label] as const)} valor={periodo} onChange={setPeriodo} />
            <div className="w-full min-w-0 sm:w-64">
              <Chip
                id="ud-comparar"
                rotulo="Linha de comparação"
                valor={comparar === REDE ? "Média da rede" : comparar || "Nenhuma"}
                icone={<GitCompareArrows className="h-4 w-4" />}
                ativo={!!comparar}
                value={comparar}
                onChange={setComparar}
                aoLimpar={comparar ? () => setComparar("") : undefined}
                rotuloLimpar="Tirar a linha de comparação"
              >
                <option value="">Nenhuma</option>
                <option value={REDE}>Média da rede</option>
                <optgroup label="Outra unidade">
                  {units.filter((u) => u !== unit).map((u) => <option key={u} value={u}>{u}</option>)}
                </optgroup>
              </Chip>
            </div>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {TREND_KEYS.map((k) => {
            const ind = INDICATOR_BY_KEY[k];
            const comp = comparar === REDE ? { label: ind.format === "percent" ? "Rede" : "Média da rede", rows: serieDaRede(dashboardDataRede, ind, mesesGrafico) }
              : outra ? { label: outra, rows: seriesPorMeses(dashboardData, outra, ind, mesesGrafico) } : undefined;
            return <TrendCard key={k} ind={ind} rows={seriesPorMeses(dashboardData, unit, ind, mesesGrafico)} unitLabel={unit} comp={comp} />;
          })}
        </div>
        <p className="text-xs text-muted-foreground">Meses sem dado lançado aparecem como lacuna. Inadimplência vem do EVO a partir de 11/2025; antes, da planilha.</p>
      </Secao>

      {outra && (
        <Secao id="ud-comparacao" titulo={`Comparação com ${outra}`} descricao={`As duas unidades lado a lado, indicador a indicador, em ${formatMonthLong(rankMonth ?? selectedMonth)}. Para trocar a unidade, use “Linha de comparação” em Evolução.`}>
          <UnitComparison key={`${unit}|${outra}`} selectedMonth={rankMonth ?? selectedMonth} inicialA={unit} inicialB={outra} />
        </Secao>
      )}

      {contratosDaUnidade && (
        <Secao id="ud-contratos" titulo="Contratos ativos hoje" descricao={<>Foto do EVO, sobre {contratosDaUnidade.total.toLocaleString("pt-BR")} contratos.</>}>
          <ContratosTiles v={contratosDaUnidade} />
        </Secao>
      )}
      {onOpenTab && (
        <Secao id="ud-menus" titulo={`Mais detalhes de ${unit}`} descricao={`Abre o menu já filtrado em ${unit}. Para voltar à rede, use “Voltar para a rede” na faixa do topo.`}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {MENUS_DA_UNIDADE.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onOpenTab(m.id)} className="no-print w-full rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-foreground/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="block text-xs text-muted-foreground">Ver</span>
                  <span className="block truncate text-sm font-semibold text-foreground">{m.rotulo} de {unit}</span>
                </button>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  );
}
