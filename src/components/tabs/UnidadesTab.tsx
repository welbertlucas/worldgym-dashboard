import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/SectionTitle";
import { UnidadeDetalhe } from "@/components/tabs/UnidadeTab";
import { type Meta } from "@/data/metas";
import { getDataByMonth } from "@/data/dashboardData";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props {
  selectedMonth: string;
  /** Unidade do filtro do topo; null = nenhuma escolhida (mostra a grade para escolher). */
  unit: string | null;
  compareMonth: string | null;
  metas: Meta[];
  /** Escolhe uma unidade (vai para o filtro do topo). */
  onPick: (unit: string) => void;
  onOpenMetas?: () => void;
  /** Abre um menu temático já filtrado na unidade. */
  onOpenTab?: (id: string) => void;
}

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

/** Grade para escolher a unidade: faturamento do mês e variação contra o mês anterior. */
function EscolherUnidade({ selectedMonth, onPick }: { selectedMonth: string; onPick: (u: string) => void }) {
  const [y, m] = selectedMonth.split("-").map(Number);
  const anterior = getDataByMonth(new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7));
  const units = [...(getDataByMonth(selectedMonth)?.units ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const partial = isPartialMonth(selectedMonth);
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Escolha uma unidade">
      {units.map((u) => {
        const ant = anterior?.units.find((x) => x.name === u.name)?.faturamento;
        const varia = !partial && ant ? ((u.faturamento - ant) / ant) * 100 : null;
        return (
          <li key={u.name}>
            <button type="button" onClick={() => onPick(u.name)} className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-foreground/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block truncate font-semibold text-foreground">{u.name}</span>
              <span className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="tabular-nums text-foreground">{reais(u.faturamento)}<span className="text-xs text-muted-foreground"> faturamento{partial ? " (parcial)" : ""}</span></span>
                {varia !== null && <span className={`text-xs font-medium tabular-nums ${varia >= 0 ? "text-success" : "text-destructive"}`}>{varia >= 0 ? "+" : ""}{varia.toFixed(1).replace(".", ",")}%</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Unidades: o retrato de uma unidade. Sem unidade no filtro do topo, mostra a grade para escolher. */
export function UnidadesTab({ selectedMonth, unit, compareMonth, metas, onPick, onOpenMetas, onOpenTab }: Props) {
  if (!unit) {
    return (
      <div className="space-y-6">
        <SectionTitle hint={`Escolha uma unidade para ver o retrato dela em ${formatMonthLong(selectedMonth)}: resultado do mês, posição na rede, evolução e contratos. A variação é do faturamento contra o mês anterior. Para comparar todas as unidades entre si, use o menu Benchmark.`}>Unidades</SectionTitle>
        <EscolherUnidade selectedMonth={selectedMonth} onPick={onPick} />
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle hint={`Retrato da unidade em ${formatMonthLong(selectedMonth)}. Para escolher outra, use o filtro "Unidade" no topo; para comparar todas, o menu Benchmark.`}>{unit}</SectionTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print shrink-0 text-xs font-medium">
          <Printer className="w-4 h-4" aria-hidden />
          <span>Exportar PDF</span>
        </Button>
      </div>
      <p className="hidden print:block text-sm text-muted-foreground">{unit} · {formatMonthLong(selectedMonth)} · emitido em {new Date().toLocaleDateString("pt-BR")}</p>
      <UnidadeDetalhe unit={unit} selectedMonth={selectedMonth} compareMonth={compareMonth} metas={metas} onOpenMetas={onOpenMetas} onOpenTab={onOpenTab} />
    </div>
  );
}
