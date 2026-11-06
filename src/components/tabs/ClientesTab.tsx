import { SectionTitle } from "@/components/SectionTitle";
import { KpiGrid, type KpiContext } from "@/components/kpi/KpiGrid";
import { clientesSpecs } from "@/components/kpi/tabSpecs";
import { FluxoClientesChart } from "@/components/clientes/FluxoClientesChart";
import { MotivosCancelamento } from "@/components/clientes/MotivosCancelamento";
import { SaldoHeatmap } from "@/components/clientes/SaldoHeatmap";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props { ctx: KpiContext; month: string; unit: string | null }

/** Clientes: base de alunos, entradas e saídas, motivos de cancelamento e saldo por unidade. Tudo vem do EVO. */
export function ClientesTab({ ctx, month, unit }: Props) {
  const total = ctx.cur.total;
  const monthLabel = formatMonthLong(month);
  const partial = isPartialMonth(month);
  const unitLabel = unit ?? "Rede";
  return (
    <section>
      <SectionTitle hint={`${unitLabel} • ${monthLabel}${partial ? " (mês em andamento: valores parciais)" : ""}`}>Clientes</SectionTitle>
      <div className="mb-6"><KpiGrid ctx={ctx} specs={clientesSpecs} /></div>
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <FluxoClientesChart total={total} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} />
        <MotivosCancelamento total={total} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} />
      </div>
      <SaldoHeatmap selectedMonth={month} selectedUnit={unit} />
    </section>
  );
}
