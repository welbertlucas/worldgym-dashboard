// Taxa de cartão por unidade e adquirente: a taxa que o EVO registrou em cada cobrança paga em cartão, sobre o valor recebido.
// Não é a taxa do extrato da operadora; cobrança sem taxa registrada entra como zero (por isso a cobertura).
import type { UnitData } from "@/data/dashboardData";

/** Abaixo disso a taxa registrada cobre pouco das cobranças e o percentual fica abaixo do real. */
export const COBERTURA_MINIMA = 90;
/** Diferença para a média da rede, em pontos percentuais, a partir da qual a unidade é destacada. */
export const DIFERENCA_DESTAQUE_PP = 0.25;

export interface LinhaTaxa {
  unidade: string; gateway: string; recebido: number; cobrancas: number; taxas: number;
  /** Taxas registradas ÷ recebido (em %). */
  taxa: number;
  /** % das cobranças com taxa registrada; null nos meses lidos antes desse dado. */
  cobertura: number | null;
  incompleta: boolean;
  /** Taxa da unidade menos a média da rede no mesmo adquirente (p.p.); null se a unidade é a única com dado completo ou se a taxa dela está incompleta. */
  difMedia: number | null;
}
/** Média da rede por adquirente, só das unidades com a taxa completa. */
export interface MediaGateway { gateway: string; recebido: number; taxas: number; taxa: number; unidades: number }

/** Uma linha por unidade e adquirente (só com valor recebido), da taxa mais alta para a mais baixa, e a média da rede por adquirente. */
export function taxasPorUnidade(units: Pick<UnitData, "name" | "gatewaysCartao" | "gatewaysDet">[]): { linhas: LinhaTaxa[]; medias: MediaGateway[] } {
  const brutas: Omit<LinhaTaxa, "difMedia">[] = [];
  for (const u of units) {
    for (const [gateway, recebido] of Object.entries(u.gatewaysCartao ?? {})) {
      const det = u.gatewaysDet?.[gateway];
      if (!det || !(recebido > 0) || !(det[0] > 0)) continue;
      const cobertura = det[2] === undefined ? null : Math.round((det[2] / det[0]) * 100);
      brutas.push({ unidade: u.name, gateway, recebido, cobrancas: det[0], taxas: det[1], taxa: (det[1] / recebido) * 100, cobertura, incompleta: cobertura !== null && cobertura < COBERTURA_MINIMA });
    }
  }
  // A média da rede só usa as linhas completas (taxa registrada na maior parte das cobranças): as incompletas puxariam a média para baixo.
  const por = new Map<string, MediaGateway>();
  for (const l of brutas.filter((x) => !x.incompleta)) {
    const m = por.get(l.gateway) ?? { gateway: l.gateway, recebido: 0, taxas: 0, taxa: 0, unidades: 0 };
    m.recebido += l.recebido; m.taxas += l.taxas; m.unidades += 1;
    por.set(l.gateway, m);
  }
  const medias = [...por.values()].map((m) => ({ ...m, taxa: m.recebido > 0 ? (m.taxas / m.recebido) * 100 : 0 })).sort((a, b) => b.recebido - a.recebido);
  const mediaDe = new Map(medias.map((m) => [m.gateway, m]));
  const linhas = brutas
    .map((l) => {
      const m = mediaDe.get(l.gateway);
      return { ...l, difMedia: !l.incompleta && m && m.unidades > 1 ? l.taxa - m.taxa : null };
    })
    .sort((a, b) => b.taxa - a.taxa || b.recebido - a.recebido || a.unidade.localeCompare(b.unidade, "pt-BR"));
  return { linhas, medias };
}
