import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { SectionTitle } from "@/components/SectionTitle";
import { CampanhasNoAr } from "@/components/CampanhasNoAr";
import { getAvailableUnits } from "@/data/dashboardData";

/** Campanhas de anúncio ativas hoje no Meta (Facebook e Instagram), da rede toda ou de uma unidade. */
export function CampanhasTab({ initialUnit }: { initialUnit: string | null }) {
  const units = useMemo(() => getAvailableUnits(), []);
  const [unit, setUnit] = useState<string | null>(initialUnit);
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Foto de hoje do Meta: campanhas com status ativo em cada unidade, o que gastaram nos últimos 7 dias e quantos contatos trouxeram">Campanhas</SectionTitle>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Unidade
          <Select value={unit ?? ""} onChange={(e) => setUnit(e.target.value || null)} className="h-9 w-64 text-sm font-normal text-foreground">
            <option value="">Rede (todas as unidades)</option>
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </label>
      </div>
      <CampanhasNoAr unit={unit} />
    </div>
  );
}
