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
export interface ResultadoMeta {
  investimento: number; impressoes: number; cliques: number; leads: number; conversas: number;
  /** Compras marcadas pelo pixel do Meta no site/checkout e o valor delas (meses lidos antes de 11/2026 não têm). */
  compras?: number; valorCompras?: number;
}
/** Unidades do mês; a chave "Rede" é a conta Institucional (anúncio da rede toda). */
export interface MesMeta { geradoEm: string; unidades: Record<string, ResultadoMeta>; erros: { conta: string; erro: string }[] }
/** Anúncio com gasto nos últimos 30 dias (ranking). `imagem` = miniatura do criativo no Meta (o link vence em alguns dias; a foto diária renova). */
export interface Anuncio {
  id: string;
  unidade: string | null;
  conta: string;
  nome: string;
  campanha: string;
  gasto30d: number;
  impressoes30d: number;
  cliques30d: number;
  leads30d: number;
  conversas30d: number;
  compras30d?: number;
  imagem: string | null;
}
export interface FotoCampanhas { geradoEm: string | null; campanhas: Campanha[]; erros: { conta: string; erro: string }[]; meses?: Record<string, MesMeta>; anuncios?: Anuncio[] }

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
  const out: Required<ResultadoMeta> = { investimento: 0, impressoes: 0, cliques: 0, leads: 0, conversas: 0, compras: 0, valorCompras: 0 };
  for (const u of us) for (const k of Object.keys(out) as (keyof ResultadoMeta)[]) out[k] += u[k] ?? 0;
  return out;
}

/** Investimento da conta Institucional no mês (0 se não houver). */
export const investimentoInstitucional = (mes: MesMeta | undefined) => mes?.unidades[CHAVE_INSTITUCIONAL]?.investimento ?? 0;

/** CTR: em quantas de cada 100 exibições alguém clicou (%); null sem exibição. */
export const ctr = (cliques: number, impressoes: number): number | null => (impressoes > 0 ? (cliques / impressoes) * 100 : null);
/** CPM: custo de mil exibições (R$); null sem exibição. */
export const cpm = (gasto: number, impressoes: number): number | null => (impressoes > 0 ? (gasto / impressoes) * 1000 : null);

/** Mês a mês do Meta para a escolha (unidade, Institucional ou rede sem a Institucional), do mais antigo ao mais novo. */
export interface PontoMeta { ym: string; investimento: number; contatos: number; custo: number | null; impressoes: number; cliques: number }
export function serieMensal(meses: Record<string, MesMeta> | undefined, unidade: string | null): PontoMeta[] {
  return Object.keys(meses ?? {}).sort().flatMap((ym) => {
    const r = investimentoDoMes(meses![ym], unidade);
    if (!r) return [];
    const contatos = r.leads + r.conversas;
    return [{ ym, investimento: r.investimento, contatos, custo: contatos > 0 ? r.investimento / contatos : null, impressoes: r.impressoes, cliques: r.cliques }];
  });
}

/** Mês anterior e mesmo mês do ano anterior ("AAAA-MM"). */
export const mesAnterior = (ym: string) => { const [a, m] = ym.split("-").map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`; };
export const mesAnoAnterior = (ym: string) => `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;

export const contatosDoAnuncio = (a: Anuncio) => a.leads30d + a.conversas30d;
/** Só os anúncios da escolha (mesma regra das campanhas). */
export function anunciosDaUnidade(lista: Anuncio[] | undefined, unidade: string | null): Anuncio[] {
  return (lista ?? []).filter((a) => (unidade === INSTITUCIONAL ? a.unidade === null : unidade ? a.unidade === unidade : a.unidade !== null));
}
/** Ranking: os mais baratos por contato (com pelo menos `minContatos`, para não premiar acaso) e os que gastaram sem trazer contato. */
export function rankingDeAnuncios(lista: Anuncio[], { minContatos = 5, gastoSemContato = 100, limite = 5 } = {}) {
  const comContato = lista.filter((a) => contatosDoAnuncio(a) >= minContatos)
    .map((a) => ({ ...a, custo: a.gasto30d / contatosDoAnuncio(a) }))
    .sort((a, b) => a.custo - b.custo);
  const semContato = lista.filter((a) => contatosDoAnuncio(a) === 0 && a.gasto30d >= gastoSemContato).sort((a, b) => b.gasto30d - a.gasto30d);
  return { melhores: comContato.slice(0, limite), semContato: semContato.slice(0, 3), avaliados: comContato.length, total: lista.length };
}

/**
 * Quanto do faturamento foi para o Meta (%): investido ÷ faturamento do mês no EVO.
 * Unidade: a dela. Rede: só as unidades com investimento lido (as sem conta lida não entram na conta). Institucional: null.
 */
export function pctDoFaturamento(mes: MesMeta | undefined, unidade: string | null, faturamentoDe: (nome: string) => number | undefined): number | null {
  if (!mes || unidade === INSTITUCIONAL) return null;
  const nomes = unidade ? [unidade] : Object.keys(mes.unidades).filter((k) => k !== CHAVE_INSTITUCIONAL && mes.unidades[k].investimento > 0);
  let inv = 0, fat = 0;
  for (const n of nomes) {
    const f = faturamentoDe(n);
    if (!mes.unidades[n] || !f) continue;
    inv += mes.unidades[n].investimento;
    fat += f;
  }
  return fat > 0 ? (inv / fat) * 100 : null;
}
