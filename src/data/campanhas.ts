import { authFetch, API_BASE } from "@/lib/auth";

const URL_CAMPANHAS = `${API_BASE}/campanhas`;

export interface Campanha {
  id: string;
  /** Unidade do painel; null = anúncio da rede toda. */
  unidade: string | null;
  conta: string;
  nome: string;
  objetivo: string | null;
  inicio: string | null;
  fim: string | null;
  orcamentoDiario: number | null;
  gasto7d: number;
  impressoes7d: number;
  cliques7d: number;
  leads7d: number;
  conversas7d: number;
}
export interface FotoCampanhas { geradoEm: string | null; campanhas: Campanha[]; erros: { conta: string; erro: string }[] }

export async function carregarCampanhas(): Promise<FotoCampanhas | null> {
  try {
    const res = await authFetch(URL_CAMPANHAS);
    return res.ok ? ((await res.json()) as FotoCampanhas) : null;
  } catch {
    return null;
  }
}

/** Campanhas de uma unidade (com as da rede toda) ou, sem unidade, de todas; as que mais gastam primeiro. */
export function campanhasDaUnidade(lista: Campanha[], unidade: string | null): Campanha[] {
  return lista.filter((c) => !unidade || c.unidade === unidade || c.unidade === null).sort((a, b) => b.gasto7d - a.gasto7d);
}

export const OBJETIVOS: Record<string, string> = {
  OUTCOME_LEADS: "Geração de leads",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_SALES: "Vendas",
  OUTCOME_APP_PROMOTION: "App",
};
export const nomeDoObjetivo = (o: string | null) => (o ? OBJETIVOS[o] ?? o.replace(/^OUTCOME_/, "").toLowerCase() : "—");

/** Custo por contato (lead ou conversa iniciada) nos últimos 7 dias; null se ainda não houve contato. */
export const custoPorContato = (c: Campanha): number | null => {
  const n = c.leads7d + c.conversas7d;
  return n > 0 ? c.gasto7d / n : null;
};
