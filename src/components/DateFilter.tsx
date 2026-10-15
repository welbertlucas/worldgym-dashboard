import { getAvailableMonths, getAvailableUnits } from "@/data/dashboardData";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface DateFilterProps {
  selectedMonth: string;
  compareMonth: string | null;
  selectedUnit: string | null;
  onMonthChange: (month: string) => void;
  onCompareMonthChange: (month: string | null) => void;
  onUnitChange: (unit: string | null) => void;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, (mo || 1) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function DateFilter({ selectedMonth, compareMonth, selectedUnit, onMonthChange, onCompareMonthChange, onUnitChange }: DateFilterProps) {
  const months = getAvailableMonths();
  const units = getAvailableUnits();

  const field = "flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 min-w-0";
  const label = "text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap";

  return (
    <div role="group" aria-label="Filtros do dashboard" className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 border-b border-border pb-4">
      <div className={field}>
        <label htmlFor="filtro-mes" className={label}>Mês de referência</label>
        <Select id="filtro-mes" value={selectedMonth} onChange={(e) => onMonthChange(e.target.value)} className="h-9 sm:w-48">
          {months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </Select>
      </div>

      <div className={field}>
        <label htmlFor="filtro-comparar" className={label}>Comparar com</label>
        <div className="flex gap-1">
          <Select
            id="filtro-comparar"
            value={compareMonth ?? ""}
            onChange={(e) => onCompareMonthChange(e.target.value || null)}
            className="h-9 sm:w-48"
          >
            <option value="">— sem comparação —</option>
            {months.filter((m) => m !== selectedMonth).map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </Select>
          {compareMonth && (
            <Button variant="ghost" size="icon" onClick={() => onCompareMonthChange(null)} title="Remover comparação" aria-label="Remover comparação">
              <X className="w-4 h-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <div className={`${field} col-span-2 sm:col-span-1`}>
        <label htmlFor="filtro-unidade" className={label}>Unidade</label>
        <div className="flex gap-1">
          <Select
            id="filtro-unidade"
            value={selectedUnit ?? ""}
            onChange={(e) => onUnitChange(e.target.value || null)}
            className="h-9 sm:w-48"
          >
            <option value="">Toda a rede</option>
            {units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
          {selectedUnit && (
            <Button variant="ghost" size="icon" onClick={() => onUnitChange(null)} title="Limpar filtro de unidade" aria-label="Limpar filtro de unidade">
              <X className="w-4 h-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
