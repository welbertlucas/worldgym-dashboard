import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { SectionTitle } from "@/components/SectionTitle";
import { OndeMoramAlunos } from "@/components/unidades/OndeMoramAlunos";
import { getAvailableUnits } from "@/data/dashboardData";
import { dadosDoMapa } from "@/data/mapaAlunos";

/** Mapa dos alunos: onde moram os alunos ativos hoje (bolhas por bairro) e onde ficam as unidades (pinos), da rede toda ou de uma unidade. */
export function MapaAlunosTab({ initialUnit }: { initialUnit: string | null }) {
  const units = useMemo(() => getAvailableUnits(), []);
  const [unit, setUnit] = useState<string | null>(initialUnit);
  const dados = useMemo(() => dadosDoMapa(unit, units), [unit, units]);
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Foto de hoje do EVO: alunos ativos por bairro de residência e a localização das unidades">Mapa dos alunos</SectionTitle>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Unidade
          <Select value={unit ?? ""} onChange={(e) => setUnit(e.target.value || null)} className="h-9 w-64 text-sm font-normal text-foreground">
            <option value="">Rede (todas as unidades)</option>
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </label>
      </div>
      <OndeMoramAlunos unit={unit ?? "Rede"} bairros={dados.bairros} semBairro={dados.semBairro} pinos={dados.pinos} />
    </div>
  );
}
