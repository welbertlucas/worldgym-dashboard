// Cartão de crédito já cobrado que ainda vai cair na conta no mês em andamento, por dia (data de recebimento do EVO). Só totais, valor bruto.
import type { UnitData } from "@/data/dashboardData";

export interface DiaCartao { dia: string; valor: number; n: number; /** Hoje ou depois: o dinheiro ainda não caiu. */ aReceber: boolean }
export interface ResumoCartao { dias: DiaCartao[]; aReceber: number; jaCaiu: number; total: number; cobrancas: number; proximo: DiaCartao | null; maior: DiaCartao | null }

/** Separa o mês entre o que já caiu (antes de hoje) e o que ainda vai cair (hoje em diante). */
export function resumoCartaoAReceber(mapa: UnitData["cartaoAReceber"], hoje: string): ResumoCartao {
  const dias: DiaCartao[] = Object.entries(mapa ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([dia, [valor, n]]) => ({ dia, valor, n, aReceber: dia >= hoje }));
  const soma = (l: DiaCartao[]) => Math.round(l.reduce((s, d) => s + d.valor, 0) * 100) / 100;
  const futuros = dias.filter((d) => d.aReceber);
  return {
    dias, aReceber: soma(futuros), jaCaiu: soma(dias.filter((d) => !d.aReceber)), total: soma(dias), cobrancas: futuros.reduce((s, d) => s + d.n, 0),
    proximo: futuros[0] ?? null, maior: futuros.reduce<DiaCartao | null>((m, d) => (!m || d.valor > m.valor ? d : m), null),
  };
}

export interface LinhaUnidadeCartao { unidade: string; aReceber: number; cobrancas: number }
/** Quanto cada unidade ainda tem a receber, da maior para a menor; unidades sem nada a receber ficam de fora. */
export function cartaoAReceberPorUnidade(units: Pick<UnitData, "name" | "cartaoAReceber">[], hoje: string): LinhaUnidadeCartao[] {
  return units
    .map((u) => { const r = resumoCartaoAReceber(u.cartaoAReceber, hoje); return { unidade: u.name, aReceber: r.aReceber, cobrancas: r.cobrancas }; })
    .filter((l) => l.aReceber > 0)
    .sort((a, b) => b.aReceber - a.aReceber);
}
