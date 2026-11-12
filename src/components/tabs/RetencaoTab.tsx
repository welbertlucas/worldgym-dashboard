import { SectionTitle } from "@/components/SectionTitle";
import { KpiGrid, type KpiContext } from "@/components/kpi/KpiGrid";
import { retencaoSpecs } from "@/components/kpi/tabSpecs";
import { ChurnChart } from "@/components/ChurnChart";
import { RenovacoesChart } from "@/components/RenovacoesChart";
import { MotivosCancelamento } from "@/components/clientes/MotivosCancelamento";
import { CancelPerfilCard } from "@/components/clientes/CancelPerfilCard";
import { NaoRenovados } from "@/components/clientes/NaoRenovados";
import { Secao } from "@/components/unidades/Secao";
import { Abas, abaAtiva } from "@/components/Abas";
import { SUBMENUS } from "@/components/nav";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props { ctx: KpiContext; month: string; unit: string | null; aba?: string | null; onAba?: (id: string) => void }

const ABAS_RETENCAO = SUBMENUS.retencao;

const so = (titulos: string[], withReclameAqui: boolean) => retencaoSpecs(withReclameAqui).filter((s) => titulos.includes(s.title));

/** Retenção: por que os alunos ficam e por que saem. Cada assunto traz o indicador e, logo abaixo, o gráfico dele. */
export function RetencaoTab({ ctx, month, unit, aba: pedida = null, onAba = () => {} }: Props) {
  const aba = abaAtiva(ABAS_RETENCAO, pedida);
  const monthLabel = formatMonthLong(month);
  const partial = isPartialMonth(month);
  const unitLabel = unit ?? "Rede";
  const total = ctx.cur.total;
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <SectionTitle hint={`${unitLabel} • ${monthLabel}${partial ? " (mês em andamento: valores parciais)" : ""}`}>Retenção</SectionTitle>
        <Abas tela="retencao" titulo="Retenção" abas={ABAS_RETENCAO} ativa={aba} onChange={onAba} />
      </div>

      {aba === "cancelamentos" && <Secao id="rt-cancelamentos" titulo="Cancelamentos" descricao="Quanto da base cancelou no mês (churn), a evolução nos últimos meses, quem cancela (gênero e idade), os motivos informados e quais contratos foram cancelados.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <KpiGrid ctx={ctx} specs={so(["Churn"], false)} columns="sm:grid-cols-1" />
          <ChurnChart selectedUnit={unit} />
        </div>
        <CancelPerfilCard total={total} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} />
        <MotivosCancelamento total={total} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} porTipo={!unit} />
      </Secao>}

      {aba === "renovacao" && <Secao id="rt-renovacao" titulo="Renovação" descricao="Dos contratos de prazo fixo que venceram no mês, quantos foram renovados e quais ficaram sem renovar.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <KpiGrid ctx={ctx} specs={so(["Renovação"], false)} columns="sm:grid-cols-1" />
          <RenovacoesChart selectedUnit={unit} />
        </div>
        <NaoRenovados total={total} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} porTipo={!unit} />
      </Secao>}

      {aba === "satisfacao" && <Secao id="rt-satisfacao" titulo="Satisfação" descricao="O que os alunos dizem: NPS (WeHelp), nota do Google e, na rede, nota do Reclame Aqui.">
        <KpiGrid ctx={ctx} specs={so(["NPS", "Nota do Google", "Nota Reclame Aqui"], !unit)} columns="xl:grid-cols-3" />
      </Secao>}
    </div>
  );
}
