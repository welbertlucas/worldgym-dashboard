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
  /** Vezes, em média, que a mesma pessoa viu o anúncio na semana (fotos antigas não têm). */
  frequencia7d?: number;
  leads7d: number;
  conversas7d: number;
}
/** Investimento e resultados do Meta de uma unidade num mês (todas as campanhas, inclusive as pausadas). */
export interface ResultadoMeta { investimento: number; impressoes: number; cliques: number; leads: number; conversas: number }
/** Unidades do mês; a chave "Rede" é a conta Institucional (anúncio da rede toda). */
export interface MesMeta { geradoEm: string; unidades: Record<string, ResultadoMeta>; erros: { conta: string; erro: string }[] }
export interface FotoCampanhas { geradoEm: string | null; campanhas: Campanha[]; erros: { conta: string; erro: string }[]; meses?: Record<string, MesMeta> }

let pedido: Promise<FotoCampanhas | null> | null = null;

/** Lê as campanhas uma vez por visita (os cartões da aba dividem a mesma leitura); falha não fica guardada. */
export function carregarCampanhas(): Promise<FotoCampanhas | null> {
  pedido ??= (async () => {
    try {
      const res = await authFetch(URL_CAMPANHAS);
      return res.ok ? ((await res.json()) as FotoCampanhas) : null;
    } catch {
      return null;
    }
  })().then((f) => { if (!f) pedido = null; return f; });
  return pedido;
}

/** Escolha "Institucional" na aba: a conta Institucional fica separada das unidades e da soma da rede. */
export const INSTITUCIONAL = "Institucional";
/** Chave da conta Institucional nos meses gravados. */
const CHAVE_INSTITUCIONAL = "Rede";

/** Só as campanhas da escolha: a unidade, a conta Institucional ou, sem escolha, todas as unidades (sem a Institucional). */
export function campanhasDaUnidade(lista: Campanha[], unidade: string | null): Campanha[] {
  const ok = (c: Campanha) => (unidade === INSTITUCIONAL ? c.unidade === null : unidade ? c.unidade === unidade : c.unidade !== null);
  return lista.filter(ok).sort((a, b) => b.gasto7d - a.gasto7d);
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

/** Investimento do Meta no mês: da unidade, da conta Institucional ou, sem escolha, a soma das unidades (sem a Institucional). */
export function investimentoDoMes(mes: MesMeta | undefined, unidade: string | null): ResultadoMeta | null {
  if (!mes) return null;
  const chave = unidade === INSTITUCIONAL ? CHAVE_INSTITUCIONAL : unidade;
  const us = chave ? [mes.unidades[chave]].filter(Boolean) : Object.entries(mes.unidades).filter(([k]) => k !== CHAVE_INSTITUCIONAL).map(([, v]) => v);
  if (!us.length) return null;
  const out: ResultadoMeta = { investimento: 0, impressoes: 0, cliques: 0, leads: 0, conversas: 0 };
  for (const u of us) for (const k of Object.keys(out) as (keyof ResultadoMeta)[]) out[k] += u[k];
  return out;
}

/** Investimento da conta Institucional no mês (0 se não houver). */
export const investimentoInstitucional = (mes: MesMeta | undefined) => mes?.unidades[CHAVE_INSTITUCIONAL]?.investimento ?? 0;
