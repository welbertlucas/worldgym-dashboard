import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Abas, abaAtiva } from "@/components/Abas";
import { SUBMENUS } from "@/components/nav";
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

const ABAS_MARKETING = SUBMENUS.campanhas;

/**
 * Marketing: as campanhas no Meta (Facebook e Instagram) e os anúncios, com filtro próprio de unidade (inclui a conta
 * Institucional) e de mês do investimento; e os leads (oportunidades do EVO), que seguem o filtro do topo como as outras telas.
 */
export function CampanhasTab({ initialUnit, onUnitChange, month, aba: pedida = null, onAba = () => {}, leads }: {
  initialUnit: string | null; onUnitChange?: (unit: string | null) => void; month: string;
  aba?: string | null; onAba?: (id: string) => void; leads?: ReactNode;
}) {
  const aba = abaAtiva(ABAS_MARKETING, pedida);
  const units = useMemo(() => getAvailableUnits(), []);
  const veInstitucional = unidadesProprias() === null; // quem só vê as próprias unidades não recebe a conta da rede
  const [unit, setUnit] = useState<string | null>(initialUnit);
  const meses = useMemo(() => [...getAvailableMonths()].sort(), []);
  const [mes, setMes] = useState(month);
  // "Institucional" só existe nesta aba: para o resto do painel vale como rede
  useEffect(() => { onUnitChange?.(unit === INSTITUCIONAL ? null : unit); }, [unit, onUnitChange]);
  const dicas: Record<string, string> = {
    campanhas: "Alertas de melhoria das campanhas, quanto se investiu no Meta no mês e a evolução mês a mês. A conta Institucional fica separada das unidades",
    anuncios: "Os anúncios que trazem contato mais barato, os horários dos contatos e as campanhas que estão veiculando. A conta Institucional fica separada das unidades",
    leads: "De onde vêm os leads (oportunidades cadastradas no EVO) e o perfil deles, no mês e na unidade do filtro do topo",
  };
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionTitle hint={dicas[aba]}>Marketing</SectionTitle>
        <Abas tela="campanhas" titulo="Marketing" abas={ABAS_MARKETING} ativa={aba} onChange={onAba} />
        {aba !== "leads" && <div role="group" aria-label="Filtros do tráfego pago" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
          <div className="min-w-0 lg:w-72">
            <ChipUnidade id="trafego-unidade" value={unit} units={units} onChange={setUnit} extras={veInstitucional && <option value={INSTITUCIONAL}>Institucional (conta da rede)</option>} />
          </div>
          {aba === "campanhas" && <div className="min-w-0 lg:w-80">
            <ChipMes id="trafego-mes" rotulo="Mês do investimento" value={mes} months={meses} onChange={setMes} />
          </div>}
        </div>}
      </div>
      {aba === "campanhas" && <>
        <AlertasMeta unit={unit} />
        <InvestimentoMeta unit={unit} month={mes} />
        <EvolucaoMeta unit={unit} month={mes} />
      </>}
      {aba === "anuncios" && <>
        <RankingAnuncios unit={unit} />
        <ContatosPorHorario unit={unit} />
        <CampanhasNoAr unit={unit} />
      </>}
      {aba === "leads" && leads}
    </div>
  );
}
