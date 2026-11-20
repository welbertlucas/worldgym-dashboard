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

/**
 * Plano local da unidade. Fotos antigas separavam "2 a 9 unidades" (contratosParcial), e aí local + parcial + rede
 * fecham o total. Nas fotos novas isso já está no local, mas o campo antigo pode ter ficado gravado no mês: se
 * local + rede já fecham o total, o parcial é sobra da foto antiga e não entra (senão o local passa de 100%).
 */
const localDe = (u: Campos) => {
  const local = u.contratosLocal ?? 0, parcial = u.contratosParcial ?? 0;
  return parcial && local + parcial + (u.contratosRede ?? 0) === (u.contratosAtivos ?? 0) ? local + parcial : local;
};

export function contratosView(u: Campos): ContratosView | null {
  const total = u.contratosAtivos ?? 0;
  if (!total) return null;
  return {
    total,
    especiais: fatia(u.contratosEspeciais, total),
    personal: fatia(u.contratosPersonal, total),
    local: fatia(localDe(u), total),
    rede: fatia(u.contratosRede, total),
  };
}

/** Soma das unidades que têm a contagem. */
export function somaContratos(units: Campos[]): ContratosView | null {
  const com = units.filter((u) => (u.contratosAtivos ?? 0) > 0);
  const soma = (k: keyof Campos) => com.reduce((s, u) => s + (u[k] ?? 0), 0);
  return contratosView({
    contratosAtivos: soma("contratosAtivos"), contratosEspeciais: soma("contratosEspeciais"), contratosPersonal: soma("contratosPersonal"),
    contratosLocal: com.reduce((s, u) => s + localDe(u), 0), contratosRede: soma("contratosRede"),
  });
}

export const pctTexto = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

/**
 * Contratos ativos por plano, do maior para o menor. Com `foco`, só o plano daquela unidade; sem, a rede
 * (planos de mesmo nome somam entre unidades). `total` é o de contratos ativos das unidades usadas, para o percentual.
 */
export function planosDeContratos(units: Pick<UnitData, "name" | "contratosAtivos" | "contratosPlanos">[], foco: string | null = null): { planos: [string, number][]; total: number } | null {
  const usadas = (foco ? units.filter((u) => u.name === foco) : units).filter((u) => u.contratosPlanos && u.contratosPlanos.length > 0);
  if (usadas.length === 0) return null;
  const por = new Map<string, number>();
  for (const u of usadas) for (const [nome, q] of u.contratosPlanos ?? []) por.set(nome, (por.get(nome) ?? 0) + q);
  const planos = [...por].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  return { planos, total: usadas.reduce((s, u) => s + (u.contratosAtivos ?? 0), 0) };
}
