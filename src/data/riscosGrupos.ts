import { type Recommendation } from "@/data/recommendations";

export interface GrupoRisco {
  unit: string;
  itens: Recommendation[];
  criticos: number;
  atencao: number;
  informativos: number;
}

/**
 * Agrupa os itens por unidade. Ordem: "Rede" primeiro (é o retrato geral), depois as unidades com mais itens críticos;
 * desempate por atenção, informativos e nome. Dentro do grupo, a ordem original dos itens é mantida.
 */
export function agruparPorUnidade(recs: Recommendation[]): GrupoRisco[] {
  const mapa = new Map<string, GrupoRisco>();
  for (const r of recs) {
    const g = mapa.get(r.unit) ?? { unit: r.unit, itens: [], criticos: 0, atencao: 0, informativos: 0 };
    g.itens.push(r);
    if (r.severity === "critical") g.criticos++;
    else if (r.severity === "attention") g.atencao++;
    else g.informativos++;
    mapa.set(r.unit, g);
  }
  return [...mapa.values()].sort((a, b) =>
    (a.unit === "Rede" ? -1 : 0) - (b.unit === "Rede" ? -1 : 0) ||
    b.criticos - a.criticos || b.atencao - a.atencao || b.informativos - a.informativos || a.unit.localeCompare(b.unit, "pt-BR"));
}
