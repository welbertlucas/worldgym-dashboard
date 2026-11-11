import { useEffect, useMemo, useState } from "react";
import { ChipUnidade } from "@/components/DateFilter";
import { SectionTitle } from "@/components/SectionTitle";
import { OndeMoramAlunos } from "@/components/unidades/OndeMoramAlunos";
import { getAvailableUnits } from "@/data/dashboardData";
import { dadosDoMapa } from "@/data/mapaAlunos";

/** Mapa dos alunos: onde moram os alunos ativos hoje (bolhas por bairro) e onde ficam as unidades (pinos), da rede toda ou de uma unidade. */
export function MapaAlunosTab({ initialUnit, onUnitChange }: { initialUnit: string | null; onUnitChange?: (unit: string | null) => void }) {
  const units = useMemo(() => getAvailableUnits(), []);
  const [unit, setUnit] = useState<string | null>(initialUnit);
  useEffect(() => { onUnitChange?.(unit); }, [unit, onUnitChange]);
  const dados = useMemo(() => dadosDoMapa(unit, units), [unit, units]);
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Foto de hoje do EVO: alunos ativos (ou que saíram nos últimos 12 meses) por bairro de residência e a localização das unidades">Mapa dos alunos</SectionTitle>
        <div className="min-w-0 sm:w-72">
          <ChipUnidade id="mapa-unidade" value={unit} units={units} onChange={setUnit} />
        </div>
      </div>
      <OndeMoramAlunos unit={unit ?? "Rede"} dados={dados} />
    </div>
  );
}
