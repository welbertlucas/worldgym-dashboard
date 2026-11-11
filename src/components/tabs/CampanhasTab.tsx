import { useEffect, useMemo, useState } from "react";
import { ChipMes, ChipUnidade } from "@/components/DateFilter";
import { SectionTitle } from "@/components/SectionTitle";
import { CampanhasNoAr } from "@/components/CampanhasNoAr";
import { InvestimentoMeta } from "@/components/InvestimentoMeta";
import { AlertasMeta } from "@/components/AlertasMeta";
import { EvolucaoMeta } from "@/components/EvolucaoMeta";
import { RankingAnuncios } from "@/components/RankingAnuncios";
import { ContatosPorHorario } from "@/components/ContatosPorHorario";
import { INSTITUCIONAL } from "@/data/campanhas";
import { unidadesProprias } from "@/lib/auth";
import { getAvailableMonths, getAvailableUnits } from "@/data/dashboardData";

/** Campanhas de anúncio ativas hoje no Meta (Facebook e Instagram), da rede toda ou de uma unidade. */
export function CampanhasTab({ initialUnit, onUnitChange, month }: { initialUnit: string | null; onUnitChange?: (unit: string | null) => void; month: string }) {
  const units = useMemo(() => getAvailableUnits(), []);
  const veInstitucional = unidadesProprias() === null; // quem só vê as próprias unidades não recebe a conta da rede
  const [unit, setUnit] = useState<string | null>(initialUnit);
  const meses = useMemo(() => [...getAvailableMonths()].sort(), []);
  const [mes, setMes] = useState(month);
  // "Institucional" só existe nesta aba: para o resto do painel vale como rede
  useEffect(() => { onUnitChange?.(unit === INSTITUCIONAL ? null : unit); }, [unit, onUnitChange]);
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Alertas de melhoria das campanhas, quanto se investiu no Meta no mês, a evolução mês a mês, os anúncios que trazem contato mais barato, os horários dos contatos e as campanhas que estão veiculando. A conta Institucional fica separada das unidades">Tráfego pago</SectionTitle>
        <div role="group" aria-label="Filtros do tráfego pago" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
          <div className="min-w-0 lg:w-72">
            <ChipUnidade id="trafego-unidade" value={unit} units={units} onChange={setUnit} extras={veInstitucional && <option value={INSTITUCIONAL}>Institucional (conta da rede)</option>} />
          </div>
          <div className="min-w-0 lg:w-80">
            <ChipMes id="trafego-mes" rotulo="Mês do investimento" value={mes} months={meses} onChange={setMes} />
          </div>
        </div>
      </div>
      <AlertasMeta unit={unit} />
      <InvestimentoMeta unit={unit} month={mes} />
      <EvolucaoMeta unit={unit} month={mes} />
      <RankingAnuncios unit={unit} />
      <ContatosPorHorario unit={unit} />
      <CampanhasNoAr unit={unit} />
    </div>
  );
}
