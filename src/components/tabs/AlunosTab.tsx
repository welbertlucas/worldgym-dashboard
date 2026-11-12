import { SectionTitle } from "@/components/SectionTitle";
import { KpiGrid, type KpiContext } from "@/components/kpi/KpiGrid";
import { clientesSpecs } from "@/components/kpi/tabSpecs";
import { FluxoClientesChart } from "@/components/clientes/FluxoClientesChart";
import { PerfilAlunosCard } from "@/components/clientes/PerfilAlunosCard";
import { AcessosCard } from "@/components/clientes/AcessosCard";
import { SaldoHeatmap } from "@/components/clientes/SaldoHeatmap";
import { MapaCalorEntradas } from "@/components/clientes/MapaCalorEntradas";
import { LiberacoesCard } from "@/components/clientes/LiberacoesCard";
import { OutrasUnidadesCard } from "@/components/clientes/OutrasUnidadesCard";
import { Secao } from "@/components/unidades/Secao";
import { Abas, abaAtiva } from "@/components/Abas";
import { SUBMENUS } from "@/components/nav";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props { ctx: KpiContext; month: string; unit: string | null; aba?: string | null; onAba?: (id: string) => void }

const ABAS_ALUNOS = SUBMENUS.alunos;

/** Base de alunos: quantos são (base, entradas e saídas), quem são (perfil) e como frequentam (check-in). Tudo vem do EVO. */
export function AlunosTab({ ctx, month, unit, aba: pedida = null, onAba = () => {} }: Props) {
  const aba = abaAtiva(ABAS_ALUNOS, pedida);
  const total = ctx.cur.total;
  const monthLabel = formatMonthLong(month);
  const partial = isPartialMonth(month);
  const unitLabel = unit ?? "Rede";
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <SectionTitle hint={`${unitLabel} • ${monthLabel}${partial ? " (mês em andamento: valores parciais)" : ""}`}>Base de alunos</SectionTitle>
        <Abas tela="alunos" titulo="Base de alunos" abas={ABAS_ALUNOS} ativa={aba} onChange={onAba} />
      </div>

      {aba === "base" && <Secao id="al-base" titulo="Tamanho da base" descricao="Quantos alunos ativos há, quanto a base cresceu ou encolheu no mês, por quanto tempo os alunos ficam e quanto deixam em média (LTV).">
        <KpiGrid ctx={ctx} specs={clientesSpecs} />
        <FluxoClientesChart total={total} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} />
        <SaldoHeatmap selectedMonth={month} selectedUnit={unit} />
      </Secao>}

      {aba === "perfil" && <Secao id="al-perfil" titulo="Perfil" descricao="Quem são os alunos ativos: gênero e faixa de idade.">
        <PerfilAlunosCard total={total} monthLabel={monthLabel} unit={unit} />
      </Secao>}

      {aba === "frequencia" && <Secao id="al-frequencia" titulo="Frequência" descricao="Em que dias e horários os alunos treinam, quando vieram pela última vez e quantas vezes a recepção liberou a catraca na mão e quem treina em outra unidade. Quem some costuma cancelar depois.">
        <MapaCalorEntradas total={total} month={month} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} />
        <AcessosCard total={total} month={month} monthLabel={monthLabel} unit={unit} />
        <LiberacoesCard total={total} month={month} monthLabel={monthLabel} partial={partial} unit={unit} />
        <OutrasUnidadesCard total={total} month={month} monthLabel={monthLabel} partial={partial} unit={unit} />
      </Secao>}
    </div>
  );
}
