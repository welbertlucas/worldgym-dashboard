import { createContext, useContext, type ReactNode } from "react";
import { getAvailableUnits } from "@/data/dashboardData";

/** Abre a página "Detalhe da unidade" para o nome clicado. Fica no contexto para não passar função por todos os componentes. */
const UnitNav = createContext<((unit: string) => void) | null>(null);
export const UnitNavProvider = UnitNav.Provider;

/** Nome de unidade que vira link para o detalhe dela; texto comum quando não há navegação ou o nome não é de uma unidade (ex.: "Rede"). */
export function UnitLink({ name, children }: { name: string; children?: ReactNode }) {
  const open = useContext(UnitNav);
  if (!open || !getAvailableUnits().includes(name)) return <>{children ?? name}</>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); open(name); }}
      title={`Abrir o detalhe de ${name}`}
      className="rounded text-left underline-offset-4 hover:underline hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children ?? name}
    </button>
  );
}
