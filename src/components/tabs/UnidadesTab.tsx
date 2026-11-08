import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/SectionTitle";
import { UnitHighlights } from "@/components/UnitHighlights";
import { UnitDeltaChart } from "@/components/UnitDeltaChart";
import { ContratosAtivos } from "@/components/unidades/ContratosAtivos";
import { UnitsRanking } from "@/components/unidades/UnitsRanking";
import { TopUnitsTable } from "@/components/TopUnitsTable";
import { AtalhosSecoes, Secao } from "@/components/unidades/Secao";
import { UnidadeDetalhe } from "@/components/tabs/UnidadeTab";
import { type UnitDelta } from "@/data/unitMetrics";
import { type Meta } from "@/data/metas";
import { getDataByMonth } from "@/data/dashboardData";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props {
  selectedMonth: string;
  /** Último mês fechado e o anterior: base das variações (cálculo existente). */
  evalMonth: string | null;
  prevEvalMonth: string | null;
  deltas: UnitDelta[];
  /** Unidade do filtro do topo; null = rede (compara todas). */
  unit: string | null;
  compareMonth: string | null;
  metas: Meta[];
  onOpenMetas?: () => void;
}

/** Unidades: sem unidade no filtro, compara todas; com uma unidade no filtro, mostra o retrato dela. */
export function UnidadesTab({ selectedMonth, evalMonth, prevEvalMonth, deltas, unit, compareMonth, metas, onOpenMetas }: Props) {
  const partial = isPartialMonth(selectedMonth);
  const units = getDataByMonth(selectedMonth)?.units ?? [];
  const hasDeltas = deltas.length > 0 && !!evalMonth && !!prevEvalMonth;

  if (unit) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle hint={`Retrato da unidade em ${formatMonthLong(selectedMonth)}. Para voltar à comparação entre todas as unidades, limpe o filtro "Unidade" no topo.`}>{unit}</SectionTitle>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print shrink-0 text-xs font-medium">
            <Printer className="w-4 h-4" aria-hidden />
            <span>Exportar PDF</span>
          </Button>
        </div>
        <p className="hidden print:block text-sm text-muted-foreground">{unit} · {formatMonthLong(selectedMonth)} · emitido em {new Date().toLocaleDateString("pt-BR")}</p>
        <UnidadeDetalhe unit={unit} selectedMonth={selectedMonth} compareMonth={compareMonth} metas={metas} deltas={deltas} evalMonth={evalMonth} prevEvalMonth={prevEvalMonth} onOpenMetas={onOpenMetas} />
      </div>
    );
  }

  const secoes = [
    ...(hasDeltas ? [{ id: "un-destaques", rotulo: "Quem melhorou e quem piorou" }] : []),
    { id: "un-ranking", rotulo: "Ranking" },
    { id: "un-contratos", rotulo: "Contratos ativos" },
    { id: "un-tabela", rotulo: "Tabela completa" },
  ];
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <SectionTitle hint={`Todas as ${units.length} unidades em ${formatMonthLong(selectedMonth)}${partial ? " (mês em andamento: valores parciais)" : ""}. Para ver uma unidade sozinha, escolha-a no filtro "Unidade" no topo ou clique no nome dela.`}>Unidades</SectionTitle>
        <AtalhosSecoes itens={secoes} />
      </div>

      {hasDeltas && (
        <Secao id="un-destaques" titulo="Quem melhorou e quem piorou" descricao={<>Variação de {formatMonthLong(evalMonth!)} em relação a {formatMonthLong(prevEvalMonth!)} (último mês fechado contra o anterior).</>}>
          <UnitHighlights deltas={deltas} />
        </Secao>
      )}

      <Secao id="un-ranking" titulo="Ranking" descricao="Posição de cada unidade no indicador escolhido. Em “Variação”, quanto cada uma mudou do penúltimo para o último mês fechado.">
        <UnitsRanking units={units} monthLabel={formatMonthLong(selectedMonth)} partial={partial} variationView={hasDeltas ? <UnitDeltaChart deltas={deltas} curMonth={evalMonth!} prevMonth={prevEvalMonth!} /> : undefined} />
      </Secao>

      <Secao id="un-contratos" titulo="Contratos ativos" descricao="Foto de hoje do EVO: especiais/VIP, personal e plano local ou rede, por unidade.">
        <ContratosAtivos units={units} />
        {!units.some((u) => u.contratosAtivos !== undefined) && <p className="text-sm text-muted-foreground">A foto de contratos só existe no mês em andamento. Escolha o mês atual no topo para ver.</p>}
      </Secao>

      <Secao id="un-tabela" titulo="Tabela completa" descricao="Todos os indicadores de todas as unidades no mês, com busca e escolha de colunas.">
        <details className="card-surface p-5">
          <summary className="cursor-pointer text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Abrir tabela</summary>
          <div className="mt-4"><TopUnitsTable selectedMonth={selectedMonth} /></div>
        </details>
      </Secao>
    </div>
  );
}
