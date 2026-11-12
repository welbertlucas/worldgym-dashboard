import { useMemo } from "react";
import { OndeMoramAlunos } from "@/components/unidades/OndeMoramAlunos";
import { getAvailableUnits } from "@/data/dashboardData";
import { dadosDoMapa } from "@/data/mapaAlunos";

/**
 * Alunos → Onde moram: onde moram os alunos ativos hoje (bolhas por bairro) e onde ficam as unidades (pinos), da rede
 * toda ou da unidade do filtro do topo. É uma foto de hoje do EVO: o mês do filtro não muda o mapa.
 */
export function MapaAlunosTab({ unit }: { unit: string | null }) {
  const units = useMemo(() => getAvailableUnits(), []);
  const dados = useMemo(() => dadosDoMapa(unit, units), [unit, units]);
  return <OndeMoramAlunos unit={unit ?? "Rede"} dados={dados} />;
}
