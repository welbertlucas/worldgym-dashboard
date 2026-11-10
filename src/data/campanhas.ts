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
/** Investimento e resultados do Meta de uma unidade num mês (todas as campanhas, inclusive as pausadas). */
export interface ResultadoMeta { investimento: number; impressoes: number; cliques: number; leads: number; conversas: number }
/** Unidades do mês; "Rede" = conta Institucional (anúncio da rede toda). */
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

/** Origem do cadastro no EVO que conta como vinda do Meta (Instagram, Facebook, anúncio pago). */
export const ORIGEM_META = /insta|face|\bfb\b|\bmeta\b|an[uú]ncio|tr[aá]fego pago|patrocinad/i;

/** Oportunidades do mês com origem no Meta: [cadastradas, convertidas] e quais nomes de origem entraram na conta. */
export function origemMeta(origens: Record<string, [number, number]> | undefined) {
  const nomes = Object.keys(origens ?? {}).filter((o) => ORIGEM_META.test(o)).sort();
  const cadastradas = nomes.reduce((s, o) => s + origens![o][0], 0);
  const convertidas = nomes.reduce((s, o) => s + origens![o][1], 0);
  return { nomes, cadastradas, convertidas };
}

/** Investimento do Meta no mês: da unidade ou, sem unidade, de todas (inclui a conta Institucional). */
export function investimentoDoMes(mes: MesMeta | undefined, unidade: string | null): ResultadoMeta | null {
  if (!mes) return null;
  const us = unidade ? [mes.unidades[unidade]].filter(Boolean) : Object.values(mes.unidades);
  if (!us.length) return null;
  const out: ResultadoMeta = { investimento: 0, impressoes: 0, cliques: 0, leads: 0, conversas: 0 };
  for (const u of us) for (const k of Object.keys(out) as (keyof ResultadoMeta)[]) out[k] += u[k];
  return out;
}

/**
 * CAC = investimento ÷ alunos vindos do Meta (oportunidades com origem Instagram/Facebook convertidas no mês).
 * ROI = (alunos × LTV − investimento) ÷ investimento; LTV = ticket médio × permanência média da unidade.
 * null quando falta o dado (sem aluno convertido, sem LTV ou sem investimento).
 */
export function retornoDoMeta(investimento: number, alunos: number, ltv: number) {
  const cac = alunos > 0 && investimento > 0 ? investimento / alunos : null;
  const retorno = alunos * ltv;
  const roi = investimento > 0 && ltv > 0 && alunos > 0 ? (retorno - investimento) / investimento : null;
  return { cac, retorno, roi };
}
