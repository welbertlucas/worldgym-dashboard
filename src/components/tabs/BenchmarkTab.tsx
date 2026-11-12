import { useState } from "react";
import { SectionTitle } from "@/components/SectionTitle";
import { UnitHighlights } from "@/components/UnitHighlights";
import { UnitDeltaChart } from "@/components/UnitDeltaChart";
import { ContratosAtivos } from "@/components/unidades/ContratosAtivos";
import { UnitsRanking } from "@/components/unidades/UnitsRanking";
import { TopUnitsTable } from "@/components/TopUnitsTable";
import { Secao } from "@/components/unidades/Secao";
import { Abas, abaAtiva } from "@/components/Abas";
import { SUBMENUS } from "@/components/nav";
import { type UnitDelta } from "@/data/unitMetrics";
import { getDataByMonthRede } from "@/data/dashboardData";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props {
  selectedMonth: string;
  /** Último mês fechado e o anterior: base das variações. */
  evalMonth: string | null;
  prevEvalMonth: string | null;
  deltas: UnitDelta[];
  /** Unidade do filtro do topo: o ranking abre nela (posições + vizinhas), com a opção de ver todas. */
  unit?: string | null;
  aba?: string | null;
  onAba?: (id: string) => void;
}

const ABAS_BENCHMARK = SUBMENUS.benchmark;

/** Benchmark: as unidades comparadas entre si (sempre todas). Com uma unidade no filtro, o ranking abre centrado nela. */
export function BenchmarkTab({ selectedMonth, evalMonth, prevEvalMonth, deltas, unit = null, aba: pedida = null, onAba = () => {} }: Props) {
  const aba = abaAtiva(ABAS_BENCHMARK, pedida);
  const [verTodas, setVerTodas] = useState<string | null>(null); // unidade para a qual o usuário pediu "ver todas"
  const partial = isPartialMonth(selectedMonth);
  const units = getDataByMonthRede(selectedMonth)?.units ?? [];
  const foco = unit && units.some((u) => u.name === unit) ? unit : null;
  const todas = !foco || verTodas === foco;
  const hasDeltas = deltas.length > 0 && !!evalMonth && !!prevEvalMonth;
  const destaques = hasDeltas && (
      <Secao id="bm-destaques" titulo="Quem melhorou e quem piorou" descricao={<>Variação de {formatMonthLong(evalMonth!)} em relação a {formatMonthLong(prevEvalMonth!)} (último mês fechado contra o anterior).</>}>
        <UnitHighlights deltas={deltas} />
      </Secao>
  );
  const ranking = (
    <Secao
      id="bm-ranking"
      titulo={foco ? `Posição de ${foco} na rede` : "Ranking"}
      descricao={foco
        ? <>Onde {foco} fica em cada indicador (clique numa posição para trocar) e, abaixo, {todas ? "todas as unidades, com ela destacada" : "ela com as duas unidades acima e as duas abaixo, e o 1º lugar como referência"}. Para comparar sem destaque, tire a unidade no filtro do topo.</>
        : "Posição de cada unidade no indicador escolhido. Em “Variação”, quanto cada uma mudou do penúltimo para o último mês fechado."}
    >
      <UnitsRanking
        key={foco ?? "rede"}
        units={units}
        monthLabel={formatMonthLong(selectedMonth)}
        partial={partial}
        variationView={hasDeltas ? <UnitDeltaChart deltas={deltas} curMonth={evalMonth!} prevMonth={prevEvalMonth!} /> : undefined}
        destaque={foco ?? undefined}
        compacto={!todas}
        onVerCompleto={foco ? () => setVerTodas(todas ? null : foco) : undefined}
        rotuloVerCompleto={todas ? `Mostrar só as unidades perto de ${foco}` : "Ver todas as unidades"}
      />
    </Secao>
  );

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <SectionTitle hint={`As ${units.length} unidades comparadas entre si em ${formatMonthLong(selectedMonth)}${partial ? " (mês em andamento: valores parciais)" : ""}. Clique no nome de uma unidade para abrir o retrato dela em Unidades.`}>Benchmark</SectionTitle>
        <Abas tela="benchmark" titulo="Benchmark" abas={ABAS_BENCHMARK} ativa={aba} onChange={onAba} />
      </div>

      {aba === "posicao" && <>{!foco && destaques}{ranking}{foco && destaques}</>}

      {aba === "contratos" && <Secao id="bm-contratos" titulo="Contratos ativos" descricao="Foto de hoje do EVO: especiais/VIP, personal e plano local ou rede, por unidade.">
        <ContratosAtivos units={units} />
        {!units.some((u) => u.contratosAtivos !== undefined) && <p className="text-sm text-muted-foreground">A foto de contratos só existe no mês em andamento. Escolha o mês atual no topo para ver.</p>}
      </Secao>}

      {aba === "tabela" && <Secao id="bm-tabela" titulo="Tabela completa" descricao="Todos os indicadores de todas as unidades no mês, com busca e escolha de colunas.">
        <details className="card-surface p-5">
          <summary className="cursor-pointer text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Abrir tabela</summary>
          <div className="mt-4"><TopUnitsTable selectedMonth={selectedMonth} /></div>
        </details>
      </Secao>}
    </div>
  );
}
