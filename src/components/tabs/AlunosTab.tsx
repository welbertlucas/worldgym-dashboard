import { SectionTitle } from "@/components/SectionTitle";
import { KpiGrid, type KpiContext } from "@/components/kpi/KpiGrid";
import { clientesSpecs } from "@/components/kpi/tabSpecs";
import { FluxoClientesChart } from "@/components/clientes/FluxoClientesChart";
import { PerfilAlunosCard } from "@/components/clientes/PerfilAlunosCard";
import { SaldoHeatmap } from "@/components/clientes/SaldoHeatmap";
import { Secao } from "@/components/unidades/Secao";
import { MapaAlunosTab } from "@/components/tabs/MapaAlunosTab";
import { ContratosAtivos } from "@/components/unidades/ContratosAtivos";
import { Abas, abaAtiva } from "@/components/Abas";
import { SUBMENUS } from "@/components/nav";
import { formatMonthLong, isPartialMonth } from "@/data/periods";
import { getDataByMonthRede } from "@/data/dashboardData";

interface Props { ctx: KpiContext; month: string; unit: string | null; aba?: string | null; onAba?: (id: string) => void }

const ABAS_ALUNOS = SUBMENUS.alunos;

/** Alunos: quantos são (base, entradas e saídas), quem são (perfil), onde moram e de que tipo são os contratos ativos. Tudo vem do EVO; a frequência fica em Acessos na catraca. */
export function AlunosTab({ ctx, month, unit, aba: pedida = null, onAba = () => {} }: Props) {
  const aba = abaAtiva(ABAS_ALUNOS, pedida);
  const total = ctx.cur.total;
  const monthLabel = formatMonthLong(month);
  const partial = isPartialMonth(month);
  const unitLabel = unit ?? "Rede";
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <SectionTitle hint={`${unitLabel} • ${monthLabel}${partial ? " (mês em andamento: valores parciais)" : ""}`}>Alunos</SectionTitle>
        <Abas tela="alunos" titulo="Alunos" abas={ABAS_ALUNOS} ativa={aba} onChange={onAba} />
      </div>

      {aba === "base" && <Secao id="al-base" titulo="Tamanho da base" descricao="Quantos alunos ativos há, quanto a base cresceu ou encolheu no mês, por quanto tempo os alunos ficam e quanto deixam em média (LTV).">
        <KpiGrid ctx={ctx} specs={clientesSpecs} />
        <FluxoClientesChart total={total} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} />
        <SaldoHeatmap selectedMonth={month} selectedUnit={unit} />
      </Secao>}

      {aba === "perfil" && <Secao id="al-perfil" titulo="Perfil" descricao="Quem são os alunos ativos: gênero e faixa de idade.">
        <PerfilAlunosCard total={total} monthLabel={monthLabel} unit={unit} />
      </Secao>}

      {aba === "onde-moram" && <Secao id="al-onde-moram" titulo="Onde moram" descricao="Foto de hoje do EVO: alunos ativos (ou que saíram nos últimos 12 meses) por bairro de residência e a localização das unidades. O mês do filtro não muda o mapa.">
        <MapaAlunosTab unit={unit} />
      </Secao>}

      {aba === "contratos" && <Secao id="al-contratos" titulo="Contratos" descricao="Foto de hoje do EVO: contratos ativos especiais/VIP, de personal e de plano local ou rede. Com uma unidade no filtro, o percentual da rede aparece ao lado.">
        {(() => {
          const units = getDataByMonthRede(month)?.units ?? [];
          const foco = unit && units.some((u) => u.name === unit) ? unit : null;
          return <>
            <ContratosAtivos units={units} foco={foco} />
            {!units.some((u) => u.contratosAtivos !== undefined) && <p className="text-sm text-muted-foreground">A foto de contratos só existe no mês em andamento. Escolha o mês atual no topo para ver.</p>}
          </>;
        })()}
      </Secao>}
    </div>
  );
}
