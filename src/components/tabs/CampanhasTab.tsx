import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { SectionTitle } from "@/components/SectionTitle";
import { CampanhasNoAr } from "@/components/CampanhasNoAr";
import { RetornoMeta } from "@/components/RetornoMeta";
import { AlertasMeta } from "@/components/AlertasMeta";
import { INSTITUCIONAL } from "@/data/campanhas";
import { unidadesProprias } from "@/lib/auth";
import { getAvailableMonths, getAvailableUnits } from "@/data/dashboardData";

/** Campanhas de anúncio ativas hoje no Meta (Facebook e Instagram), da rede toda ou de uma unidade. */
export function CampanhasTab({ initialUnit, onUnitChange, month }: { initialUnit: string | null; onUnitChange?: (unit: string | null) => void; month: string }) {
  const units = useMemo(() => getAvailableUnits(), []);
  const veInstitucional = unidadesProprias() === null; // quem só vê as próprias unidades não recebe a conta da rede
  const [unit, setUnit] = useState<string | null>(initialUnit);
  const meses = useMemo(() => [...getAvailableMonths()].sort().reverse(), []);
  const [mes, setMes] = useState(month);
  // "Institucional" só existe nesta aba: para o resto do painel vale como rede
  useEffect(() => { onUnitChange?.(unit === INSTITUCIONAL ? null : unit); }, [unit, onUnitChange]);
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Alertas de melhoria das campanhas; quanto se investiu no Meta no mês, quanto custou cada aluno (CAC) e o retorno (ROI); embaixo, as campanhas que estão veiculando. A conta Institucional fica separada das unidades">Tráfego pago</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Unidade
            <Select value={unit ?? ""} onChange={(e) => setUnit(e.target.value || null)} className="h-9 w-64 text-sm font-normal text-foreground">
              <option value="">Rede (todas as unidades)</option>
              {veInstitucional && <option value={INSTITUCIONAL}>Institucional (conta da rede)</option>}
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
      <AlertasMeta unit={unit} />
      <RetornoMeta unit={unit} month={mes} />
      <CampanhasNoAr unit={unit} />
    </div>
  );
}
