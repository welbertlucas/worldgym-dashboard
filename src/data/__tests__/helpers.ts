import { type MonthData, type UnitData } from "@/data/dashboardData";

export function unit(name: string, over: Partial<UnitData> = {}): UnitData {
  return {
    name, faturamento: 100000, recebimento: 95000, ticketMedio: 130, novosContratos: 100, adimplentes: 1000,
    inadimplentes: 50, inadimplenciaPerc: 4, churn: 4, renovacoes: 60, icv: 60, vendasOnline: 2000, cancelados: 50,
    cac: 0, lifetime: 0, oportunidades: 0, conversoes: 0, diarias: 0, personal: 0, camisetas: 0, coqueteleiras: 0,
    notaGoogle: 0, nps: 0, reclameAqui: 0, ...over,
  };
}

export function month(m: string, units: UnitData[]): MonthData {
  const sum = (k: keyof UnitData) => units.reduce((s, u) => s + (u[k] as number), 0);
  return { month: m, units, total: unit("TOTAL", { faturamento: sum("faturamento"), recebimento: sum("recebimento"), vendasOnline: sum("vendasOnline"), cancelados: sum("cancelados") }) };
}
