import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { KpiGrid, type KpiContext, type KpiSpec } from "@/components/kpi/KpiGrid";
import { comercialSpecs, financeiroSpecs, retencaoSpecs } from "@/components/kpi/tabSpecs";
import { TrendCard } from "@/components/unidades/TrendCard";
import { dashboardData, getAvailableUnits, type UnitData } from "@/data/dashboardData";
import { INDICATOR_BY_KEY, formatIndicator } from "@/data/unitIndicators";
import { PERIODOS, posicaoNaRede, seriesFor } from "@/data/unitSeries";
import { viewFor } from "@/data/kpiView";
import { sameMonthLastYear } from "@/data/alerts";
import { formatMonthLong, getLastClosedMonth, isPartialMonth } from "@/data/periods";
import { cn } from "@/lib/utils";

interface Props {
  selectedMonth: string;
  /** Unidade escolhida no filtro geral; vira a unidade inicial da página. */
  initialUnit: string | null;
}

const n = (v: number | undefined) => (v ?? 0).toLocaleString("pt-BR");
const TREND_KEYS = ["faturamento", "recebimento", "inadimplenciaPerc", "churn", "renovacoes", "novosContratos"] as const;
const RANK_KEYS = ["faturamento", "recebimento", "ticketMedio", "novosContratos", "renovacoes", "churn", "inadimplenciaPerc"] as const;
const unitSpecs: KpiSpec[] = [
  financeiroSpecs[0], financeiroSpecs[1], financeiroSpecs[2], comercialSpecs[0],
  ...retencaoSpecs(false).filter((s) => ["Adimplentes", "Renovação", "Churn", "Inadimplência"].includes(s.title)),
];

/** Página de uma unidade: indicadores do mês, posição na rede, contratos ativos e evolução no tempo contra a rede ou outra unidade. */
export function UnidadeTab({ selectedMonth, initialUnit }: Props) {
  const units = useMemo(() => getAvailableUnits(), []);
  const [unit, setUnit] = useState(initialUnit ?? units[0] ?? "");
  const [refUnit, setRefUnit] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<number>(12);
  useEffect(() => { if (initialUnit) setUnit(initialUnit); }, [initialUnit]);
  useEffect(() => { if (refUnit === unit) setRefUnit(null); }, [unit, refUnit]);

  const months = dashboardData.map((d) => d.month);
  const partial = isPartialMonth(selectedMonth);
  const idx = months.indexOf(selectedMonth);
  const prev = idx > 0 ? months[idx - 1] : undefined;
  const ctx: KpiContext = {
    cur: viewFor(selectedMonth, unit) ?? { month: selectedMonth, total: dashboardData[idx]?.total, units: [] },
    prev: viewFor(prev, unit),
    ly: partial ? undefined : viewFor(sameMonthLastYear(selectedMonth), unit),
    partial,
  };

  // Posição na rede: no último mês fechado (o mês em andamento é parcial e distorceria o ranking).
  const rankMonth = partial ? getLastClosedMonth(months) : selectedMonth;
  const rankData = dashboardData.find((d) => d.month === rankMonth);
  const posicoes = RANK_KEYS.map((k) => ({ ind: INDICATOR_BY_KEY[k], pos: posicaoNaRede(rankData, unit, INDICATOR_BY_KEY[k]) }));
  const unitNow: UnitData | undefined = dashboardData.find((d) => d.month === selectedMonth)?.units.find((u) => u.name === unit);
  const contratos = [...dashboardData].reverse().map((d) => d.units.find((u) => u.name === unit)).find((u) => u?.alunosAtivos !== undefined);

  const refLabel = refUnit ?? "Média das unidades";
  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <SectionTitle hint={`${formatMonthLong(selectedMonth)}${partial ? " (em andamento)" : ""}`}>Detalhe da unidade</SectionTitle>
        <div role="group" aria-label="Filtros da unidade" className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Unidade
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="h-9 w-56 text-sm font-normal text-foreground">
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Comparar com
            <Select value={refUnit ?? ""} onChange={(e) => setRefUnit(e.target.value || null)} className="h-9 w-56 text-sm font-normal text-foreground">
              <option value="">Média das unidades</option>
              {units.filter((u) => u !== unit).map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </label>
          <div role="group" aria-label="Período dos gráficos" className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Período dos gráficos
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              {PERIODOS.map((p) => (
                <button
                  key={p.n}
                  type="button"
                  aria-pressed={periodo === p.n}
                  onClick={() => setPeriodo(p.n)}
                  className={cn("h-9 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", periodo === p.n ? "bg-foreground text-background" : "bg-white text-foreground hover:bg-secondary")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {partial && <div className="mt-4"><Notice>{formatMonthLong(selectedMonth)} está em andamento: os cartões são parciais. Posição na rede e gráficos usam só meses fechados.</Notice></div>}
      </div>

      <section aria-label={`Indicadores de ${unit}`}>
        {unitNow ? <KpiGrid ctx={ctx} specs={unitSpecs} columns="xl:grid-cols-4" /> : <p className="text-sm text-muted-foreground">{unit} não tem dados em {formatMonthLong(selectedMonth)}.</p>}
      </section>

      <section aria-labelledby="posicao-titulo" className="card-surface p-5 sm:p-6">
        <h3 id="posicao-titulo" className="text-base font-semibold text-foreground">Posição na rede</h3>
        <p className="text-sm text-muted-foreground mb-4">{rankMonth ? `${formatMonthLong(rankMonth)}, entre as unidades com dado. 1º = melhor resultado.` : "Sem mês fechado."}</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {posicoes.map(({ ind, pos }) => (
            <li key={ind.key} className="rounded-xl border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{ind.label}</p>
              <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-foreground">{pos ? `${pos.posicao}º` : "—"} <span className="text-xs font-sans font-normal text-muted-foreground">{pos ? `de ${pos.de}` : "sem dado"}</span></p>
            </li>
          ))}
        </ul>
      </section>

      {contratos && (
        <section aria-labelledby="contratos-un-titulo" className="card-surface p-5 sm:p-6">
          <h3 id="contratos-un-titulo" className="text-base font-semibold text-foreground">Contratos ativos hoje</h3>
          <p className="text-sm text-muted-foreground mb-4">Foto do EVO. Alcance do plano: local = 1 unidade; 2 a 9 = a própria e algumas vizinhas; rede = 10 ou mais.</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ["Alunos ativos", contratos.alunosAtivos], ["Especiais/VIP", contratos.contratosEspeciais], ["Personal", contratos.contratosPersonal],
              ["Plano local", contratos.contratosLocal], ["2 a 9 unidades", contratos.contratosParcial], ["Plano rede (10+)", contratos.contratosRede],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-xl border border-border px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{label as string}</dt>
                <dd className="mt-0.5 font-display text-xl font-semibold tabular-nums text-foreground">{n(v as number | undefined)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-labelledby="evolucao-un-titulo">
        <h3 id="evolucao-un-titulo" className="text-base font-semibold text-foreground">Evolução nos últimos {periodo} meses fechados</h3>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-medium text-[hsl(4_90%_50%)]">{unit}</span> contra <span className="font-medium">{refLabel.toLowerCase() === "média das unidades" ? "a média das unidades" : refLabel}</span> (linha tracejada).
        </p>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {TREND_KEYS.map((k) => (
            <TrendCard key={k} ind={INDICATOR_BY_KEY[k]} rows={seriesFor(dashboardData, unit, INDICATOR_BY_KEY[k], periodo, refUnit)} unitLabel={unit} refLabel={refLabel} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Meses sem dado lançado aparecem como lacuna. Inadimplência vem do EVO a partir de 11/2025; antes, da planilha.</p>
      </section>
    </div>
  );
}
