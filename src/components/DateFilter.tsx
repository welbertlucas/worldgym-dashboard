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
  const months = getAvailableMonths().slice().reverse();
  const units = getAvailableUnits();

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase font-semibold tracking-widest text-muted-foreground">Mês de referência</label>
        <Select value={selectedMonth} onChange={(e) => onMonthChange(e.target.value)} className="w-48">
          {months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase font-semibold tracking-widest text-muted-foreground">Comparar com</label>
        <div className="flex gap-1">
          <Select
            value={compareMonth ?? ""}
            onChange={(e) => onCompareMonthChange(e.target.value || null)}
            className="w-48"
          >
            <option value="">— sem comparação —</option>
            {months.filter((m) => m !== selectedMonth).map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </Select>
          {compareMonth && (
            <Button variant="ghost" size="icon" onClick={() => onCompareMonthChange(null)} title="Remover comparação">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase font-semibold tracking-widest text-muted-foreground">Unidade</label>
        <div className="flex gap-1">
          <Select
            value={selectedUnit ?? ""}
            onChange={(e) => onUnitChange(e.target.value || null)}
            className="w-48"
          >
            <option value="">Toda a rede</option>
            {units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
          {selectedUnit && (
            <Button variant="ghost" size="icon" onClick={() => onUnitChange(null)} title="Limpar filtro de unidade">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
