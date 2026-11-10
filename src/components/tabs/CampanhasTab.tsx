import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { SectionTitle } from "@/components/SectionTitle";
import { CampanhasNoAr } from "@/components/CampanhasNoAr";
import { RetornoMeta } from "@/components/RetornoMeta";
import { getAvailableMonths, getAvailableUnits } from "@/data/dashboardData";

/** Campanhas de anúncio ativas hoje no Meta (Facebook e Instagram), da rede toda ou de uma unidade. */
export function CampanhasTab({ initialUnit, onUnitChange, month }: { initialUnit: string | null; onUnitChange?: (unit: string | null) => void; month: string }) {
  const units = useMemo(() => getAvailableUnits(), []);
  const [unit, setUnit] = useState<string | null>(initialUnit);
  const meses = useMemo(() => [...getAvailableMonths()].sort().reverse(), []);
  const [mes, setMes] = useState(month);
  useEffect(() => { onUnitChange?.(unit); }, [unit, onUnitChange]);
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Quanto se investiu no Meta no mês, quanto custou cada aluno (CAC) e o retorno (ROI); embaixo, a foto de hoje das campanhas ativas">Tráfego pago</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Unidade
            <Select value={unit ?? ""} onChange={(e) => setUnit(e.target.value || null)} className="h-9 w-64 text-sm font-normal text-foreground">
              <option value="">Rede (todas as unidades)</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Mês do CAC e ROI
            <Select value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 w-48 text-sm font-normal text-foreground">
              {meses.map((m) => { const [a, n] = m.split("-").map(Number); return <option key={m} value={m}>{new Date(a, n - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</option>; })}
            </Select>
          </label>
        </div>
      </div>
      <RetornoMeta unit={unit} month={mes} />
      <CampanhasNoAr unit={unit} />
    </div>
  );
}
