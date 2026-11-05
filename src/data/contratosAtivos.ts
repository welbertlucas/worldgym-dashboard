import { type UnitData } from "@/data/dashboardData";

export interface Fatia { n: number; pct: number }
/**
 * Contratos ativos de uma unidade (ou da rede) em fatias.
 * Local (planos que liberam até 9 unidades) + rede (10 ou mais; nas unidades Pro, todos) somam 100% dos contratos; especiais/VIP e personal são recortes dentro deles.
 * Todo percentual é sobre o total de contratos ativos.
 */
export interface ContratosView { total: number; especiais: Fatia; personal: Fatia; local: Fatia; rede: Fatia }

type Campos = Pick<UnitData, "contratosAtivos" | "contratosEspeciais" | "contratosPersonal" | "contratosLocal" | "contratosParcial" | "contratosRede">;

const fatia = (n: number | undefined, total: number): Fatia => ({ n: n ?? 0, pct: total ? ((n ?? 0) / total) * 100 : 0 });

export function contratosView(u: Campos): ContratosView | null {
  const total = u.contratosAtivos ?? 0;
  if (!total) return null;
  return {
    total,
    especiais: fatia(u.contratosEspeciais, total),
    personal: fatia(u.contratosPersonal, total),
    // Fotos antigas separavam "2 a 9 unidades"; agora isso também é plano local.
    local: fatia((u.contratosLocal ?? 0) + (u.contratosParcial ?? 0), total),
    rede: fatia(u.contratosRede, total),
  };
}

/** Soma das unidades que têm a contagem. */
export function somaContratos(units: Campos[]): ContratosView | null {
  const com = units.filter((u) => (u.contratosAtivos ?? 0) > 0);
  const soma = (k: keyof Campos) => com.reduce((s, u) => s + (u[k] ?? 0), 0);
  return contratosView({
    contratosAtivos: soma("contratosAtivos"), contratosEspeciais: soma("contratosEspeciais"), contratosPersonal: soma("contratosPersonal"),
    contratosLocal: soma("contratosLocal"), contratosParcial: soma("contratosParcial"), contratosRede: soma("contratosRede"),
  });
}

export const pctTexto = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
