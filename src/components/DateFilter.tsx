import type { ReactNode } from "react";
import { Building2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, GitCompareArrows, X } from "lucide-react";
import { getAvailableMonths, getAvailableUnits } from "@/data/dashboardData";
import { cn } from "@/lib/utils";

interface DateFilterProps {
  selectedMonth: string;
  compareMonth: string | null;
  selectedUnit: string | null;
  onMonthChange: (month: string) => void;
  onCompareMonthChange: (month: string | null) => void;
  onUnitChange: (unit: string | null) => void;
  /** Páginas que têm filtro próprio de unidade e de comparação escondem os do topo. */
  hideUnit?: boolean;
  hideCompare?: boolean;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const s = new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Um filtro em forma de "chip": ícone, rótulo pequeno e o valor escolhido em destaque. O select nativo fica por cima,
 * invisível, então o clique abre o seletor do próprio sistema (bom no celular) e leitores de tela leem o select de verdade.
 */
function Chip({ id, rotulo, valor, icone, ativo, children, value, onChange, aoLimpar, rotuloLimpar, antes, depois }: {
  id: string; rotulo: string; valor: string; icone: ReactNode; ativo?: boolean; children: ReactNode;
  value: string; onChange: (v: string) => void; aoLimpar?: () => void; rotuloLimpar?: string; antes?: ReactNode; depois?: ReactNode;
}) {
  return (
    <div className={cn(
      "group relative flex h-12 min-w-0 items-center rounded-2xl border bg-card shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
      ativo ? "border-primary/40 bg-primary/5" : "border-border hover:border-foreground/25",
    )}>
      {antes}
      <div className="relative flex min-w-0 flex-1 items-center gap-2.5 px-3">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", ativo ? "bg-primary/10 text-primary-ink" : "bg-secondary text-muted-foreground")} aria-hidden>{icone}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</span>
          <span className="block truncate text-sm font-semibold text-foreground">{valor}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-y-px" aria-hidden />
        <label htmlFor={id} className="sr-only">{rotulo}</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
          {children}
        </select>
      </div>
      {depois}
      {aoLimpar && (
        <button type="button" onClick={aoLimpar} title={rotuloLimpar} aria-label={rotuloLimpar} className="relative z-10 mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

const seta = "relative z-10 flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

export function DateFilter({ selectedMonth, compareMonth, selectedUnit, onMonthChange, onCompareMonthChange, onUnitChange, hideUnit, hideCompare }: DateFilterProps) {
  const months = getAvailableMonths();
  const units = getAvailableUnits();
  const i = months.indexOf(selectedMonth);
  const anterior = i > 0 ? months[i - 1] : null;
  const proximo = i >= 0 && i < months.length - 1 ? months[i + 1] : null;

  return (
    <div role="group" aria-label="Filtros do dashboard" className="grid grid-cols-1 gap-2.5 border-b border-border pb-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
      <div className="min-w-0 lg:w-72">
        <Chip
          id="filtro-mes"
          rotulo="Mês de referência"
          valor={formatMonth(selectedMonth)}
          icone={<CalendarDays className="h-4 w-4" />}
          value={selectedMonth}
          onChange={onMonthChange}
          antes={<button type="button" className={cn(seta, "rounded-l-2xl border-r border-border")} disabled={!anterior} onClick={() => anterior && onMonthChange(anterior)} aria-label="Mês anterior" title="Mês anterior"><ChevronLeft className="h-4 w-4" aria-hidden /></button>}
          depois={<button type="button" className={cn(seta, "rounded-r-2xl border-l border-border")} disabled={!proximo} onClick={() => proximo && onMonthChange(proximo)} aria-label="Próximo mês" title="Próximo mês"><ChevronRight className="h-4 w-4" aria-hidden /></button>}
        >
          {[...months].reverse().map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </Chip>
      </div>

      {!hideCompare && (
        <div className="min-w-0 lg:w-64">
          <Chip
            id="filtro-comparar"
            rotulo="Comparar com"
            valor={compareMonth ? formatMonth(compareMonth) : "Sem comparação"}
            icone={<GitCompareArrows className="h-4 w-4" />}
            ativo={!!compareMonth}
            value={compareMonth ?? ""}
            onChange={(v) => onCompareMonthChange(v || null)}
            aoLimpar={compareMonth ? () => onCompareMonthChange(null) : undefined}
            rotuloLimpar="Remover comparação"
          >
            <option value="">Sem comparação</option>
            {[...months].reverse().filter((m) => m !== selectedMonth).map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </Chip>
        </div>
      )}

      {!hideUnit && (
        <div className="min-w-0 sm:col-span-2 lg:w-64">
          <Chip
            id="filtro-unidade"
            rotulo="Unidade"
            valor={selectedUnit ?? "Toda a rede"}
            icone={<Building2 className="h-4 w-4" />}
            ativo={!!selectedUnit}
            value={selectedUnit ?? ""}
            onChange={(v) => onUnitChange(v || null)}
            aoLimpar={selectedUnit ? () => onUnitChange(null) : undefined}
            rotuloLimpar="Limpar filtro de unidade"
          >
            <option value="">Toda a rede</option>
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </Chip>
        </div>
      )}
    </div>
  );
}
