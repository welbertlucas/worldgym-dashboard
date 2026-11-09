import { SectionTitle } from "@/components/SectionTitle";
import { KpiGrid, type KpiContext } from "@/components/kpi/KpiGrid";
import { clientesSpecs } from "@/components/kpi/tabSpecs";
import { FluxoClientesChart } from "@/components/clientes/FluxoClientesChart";
import { PerfilAlunosCard } from "@/components/clientes/PerfilAlunosCard";
import { AcessosCard } from "@/components/clientes/AcessosCard";
import { SaldoHeatmap } from "@/components/clientes/SaldoHeatmap";
import { MapaCalorEntradas } from "@/components/clientes/MapaCalorEntradas";
import { AtalhosSecoes, Secao } from "@/components/unidades/Secao";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props { ctx: KpiContext; month: string; unit: string | null }

/** Base de alunos: quantos são (base, entradas e saídas), quem são (perfil) e como frequentam (check-in). Tudo vem do EVO. */
export function AlunosTab({ ctx, month, unit }: Props) {
  const total = ctx.cur.total;
  const monthLabel = formatMonthLong(month);
  const partial = isPartialMonth(month);
  const unitLabel = unit ?? "Rede";
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <SectionTitle hint={`${unitLabel} • ${monthLabel}${partial ? " (mês em andamento: valores parciais)" : ""}`}>Base de alunos</SectionTitle>
        <AtalhosSecoes itens={[{ id: "al-base", rotulo: "Tamanho da base" }, { id: "al-perfil", rotulo: "Perfil" }, { id: "al-frequencia", rotulo: "Frequência" }]} />
      </div>

      <Secao id="al-base" titulo="Tamanho da base" descricao="Quantos alunos ativos há, quanto a base cresceu ou encolheu no mês, por quanto tempo os alunos ficam e quanto deixam em média (LTV).">
        <KpiGrid ctx={ctx} specs={clientesSpecs} />
        <FluxoClientesChart total={total} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} />
        <SaldoHeatmap selectedMonth={month} selectedUnit={unit} />
      </Secao>

      <Secao id="al-perfil" titulo="Perfil" descricao="Quem são os alunos ativos: gênero e faixa de idade.">
        <PerfilAlunosCard total={total} monthLabel={monthLabel} unit={unit} />
      </Secao>

      <Secao id="al-frequencia" titulo="Frequência" descricao="Em que dias e horários os alunos treinam e quando vieram pela última vez. Quem some costuma cancelar depois.">
        <MapaCalorEntradas total={total} month={month} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} />
        <AcessosCard total={total} month={month} monthLabel={monthLabel} unit={unit} />
      </Secao>
    </div>
  );
}
