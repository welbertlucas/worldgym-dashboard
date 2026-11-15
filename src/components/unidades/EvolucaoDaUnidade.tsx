import { useMemo, useState } from "react";
import { Chip, Segmentos } from "@/components/DateFilter";
import { ArrowLeftRight } from "lucide-react";
import { TrendCard } from "@/components/unidades/TrendCard";
import { Secao } from "@/components/unidades/Secao";
import { dashboardData, dashboardDataRede, getAvailableUnits } from "@/data/dashboardData";
import { INDICATOR_BY_KEY } from "@/data/unitIndicators";
import { PERIODOS, mesesNoIntervalo, serieDaRede, seriesPorMeses } from "@/data/unitSeries";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

const TREND_KEYS = ["faturamento", "recebimento", "inadimplenciaPerc", "churn", "renovacoes", "novosContratos"] as const;
const REDE = "__rede__";

/** Evolução de uma unidade mês a mês (faturamento, recebimento, inadimplência, churn, renovação e novos contratos), contra a rede ou outra unidade. */
export function EvolucaoDaUnidade({ unit }: { unit: string }) {
  const units = useMemo(() => getAvailableUnits(), []);
  const fechados = useMemo(() => dashboardData.filter((d) => !isPartialMonth(d.month)).map((d) => d.month), []);
  const [periodo, setPeriodo] = useState(12);
  const [comparar, setComparar] = useState(REDE);
  const mesesGrafico = mesesNoIntervalo(dashboardData, fechados[Math.max(0, fechados.length - periodo)] ?? "", fechados[fechados.length - 1] ?? "");
  const outra = comparar !== REDE && comparar !== "" && comparar !== unit ? comparar : null;
  const nomeComp = comparar === REDE ? "a média da rede (nos percentuais, o resultado da rede)" : outra ?? null;

  return (
    <Secao
      id="bm-evolucao"
      titulo={`Evolução de ${unit}`}
      descricao={<>{mesesGrafico.length ? `${formatMonthLong(mesesGrafico[0])} a ${formatMonthLong(mesesGrafico[mesesGrafico.length - 1])}, só meses fechados. ` : ""}Linha vermelha: {unit}.{nomeComp ? <> Linha tracejada: {nomeComp}.</> : " Sem linha de comparação."}</>}
      acoes={
        <>
          <Segmentos rotulo="Período dos gráficos" opcoes={PERIODOS.map((p) => [p.n, p.label] as const)} valor={periodo} onChange={setPeriodo} />
          <div className="min-w-0">
            <Chip
              id="ud-comparar"
              rotulo="Comparar com"
              valor={comparar === REDE ? "Média da rede" : comparar || "Nenhuma"}
              icone={<ArrowLeftRight className="h-4 w-4" />}
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
  );
}
