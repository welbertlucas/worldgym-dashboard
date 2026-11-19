// Cálculos da aba Marketing › Instagram (faixa de números, melhor dia e horário, posts em destaque, stories por dia).
// Só regras puras sobre os dados que o servidor já entrega (src/data/instagram.ts); nada de rede aqui.
import { instante, NOME_DO_TIPO, type ContaInstagram, type DadosInstagram, type PostInstagram, type ResumoConta, type StoryInstagram } from "@/data/instagram";

const DIA = 86400000;
const BRASILIA = 3 * 3600000;

/** Curtidas + comentários + salvos + compartilhamentos (o total que o Meta informa, ou a soma das partes). */
export const interacoesDe = (p: PostInstagram): number => p.interacoes ?? ((p.curtidas ?? 0) + (p.comentarios ?? 0) + (p.salvos ?? 0) + (p.compartilhamentos ?? 0));

const soma = (xs: (number | null | undefined)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);

export function postsDesde<T extends { data: string | null }>(itens: T[], dias: number, agora = new Date()): T[] {
  const desde = agora.getTime() - dias * DIA;
  return itens.filter((p) => p.data && instante(p.data) >= desde);
}

// ----- Seguidores ao longo do tempo -----
export interface PontoSeguidores { dia: string; total: number }

/**
 * Soma de seguidores por dia nos últimos `dias` dias. Só entram as contas que já tinham leitura no primeiro dia da janela
 * (conta que começou a ser lida depois faria o total "pular" e pareceria ganho de seguidores). Dia sem leitura repete o anterior.
 */
export function serieDeSeguidores(d: DadosInstagram, contas: ContaInstagram[], dias = 30, agora = new Date()): PontoSeguidores[] {
  const corte = new Date(agora.getTime() - dias * DIA).toISOString().slice(0, 10);
  const hist = contas.map((c) => Object.entries(d.seguidores[c.usuario] ?? {}).sort(([a], [b]) => a.localeCompare(b))).filter((h) => h.length > 0);
  const todos = [...new Set(hist.flatMap((h) => h.map(([dia]) => dia)))].filter((x) => x >= corte).sort();
  if (todos.length === 0) return [];
  const primeiro = todos[0];
  const validas = hist.filter((h) => h[0][0] <= primeiro);
  return todos.map((dia) => {
    let total = 0;
    for (const h of validas) {
      let v: number | null = null;
      for (const [x, n] of h) { if (x <= dia) v = n; else break; }
      if (v !== null) total += v;
    }
    return { dia, total };
  });
}

// ----- Faixa de números -----
export interface KpisInstagram {
  seguidores: number | null;
  /** Variação no período; null = sem histórico suficiente. */
  ganho: number | null;
  serie: PontoSeguidores[];
  posts: number;
  interacoes: number;
  visualizacoes: number;
  /** Média por post; null = nenhum post no período. */
  interacoesPorPost: number | null;
  /** Média, por post, de interações ÷ seguidores da conta (0,031 = 3,1%); null = sem posts com seguidores conhecidos. */
  taxaInteracao: number | null;
  stories: number;
  mediaViewsStory: number | null;
}

export function kpisDoInstagram(d: DadosInstagram, contas: ContaInstagram[], resumo: ResumoConta[], dias = 30, agora = new Date()): KpisInstagram {
  const usuarios = new Set(contas.map((c) => c.usuario));
  const posts = postsDesde(d.posts.filter((p) => usuarios.has(p.conta)), dias, agora);
  const stories = postsDesde(d.stories.filter((s) => usuarios.has(s.conta)), dias, agora);
  const segDe = new Map(contas.map((c) => [c.usuario, c.seguidores ?? 0]));
  const ganhos = resumo.map((r) => r.ganhoSeguidores).filter((n): n is number => n != null);
  const taxas = posts.filter((p) => (segDe.get(p.conta) ?? 0) > 0).map((p) => interacoesDe(p) / (segDe.get(p.conta) as number));
  const viewsStory = stories.map((s) => s.visualizacoes).filter((n): n is number => n != null);
  const comSeg = contas.filter((c) => c.seguidores != null);
  const interacoes = soma(posts.map(interacoesDe));
  return {
    seguidores: comSeg.length ? soma(comSeg.map((c) => c.seguidores)) : null,
    ganho: ganhos.length ? soma(ganhos) : null,
    serie: serieDeSeguidores(d, contas, dias, agora),
    posts: posts.length,
    interacoes,
    visualizacoes: soma(posts.map((p) => p.visualizacoes)),
    interacoesPorPost: posts.length ? interacoes / posts.length : null,
    taxaInteracao: taxas.length ? taxas.reduce((s, x) => s + x, 0) / taxas.length : null,
    stories: stories.length,
    mediaViewsStory: viewsStory.length ? Math.round(soma(viewsStory) / viewsStory.length) : null,
  };
}

// ----- Por conta -----
export interface CartaoConta extends ResumoConta {
  interacoesPorPost: number | null;
  serie: number[];
}
/** Resumo de cada conta mais as interações por post e a série de seguidores (para o gráfico pequeno do cartão). */
export function cartoesDasContas(d: DadosInstagram, resumo: ResumoConta[], dias = 30, agora = new Date()): CartaoConta[] {
  return resumo.map((r) => {
    const posts = postsDesde(d.posts.filter((p) => p.conta === r.conta.usuario), dias, agora);
    return {
      ...r,
      interacoesPorPost: posts.length ? soma(posts.map(interacoesDe)) / posts.length : null,
      serie: serieDeSeguidores(d, [r.conta], dias, agora).map((x) => x.total),
    };
  });
}

export type OrdemContas = "seguidores" | "ganho" | "interacao";
export const ROTULO_ORDEM: Record<OrdemContas, string> = { seguidores: "Seguidores", ganho: "Ganho no período", interacao: "Interação por post" };
/** Ordena os cartões; a conta sem número vai para o fim. */
export function ordenarContas(lista: CartaoConta[], ordem: OrdemContas): CartaoConta[] {
  const chave = (c: CartaoConta) => (ordem === "seguidores" ? c.conta.seguidores : ordem === "ganho" ? c.ganhoSeguidores : c.interacoesPorPost);
  return [...lista].sort((a, b) => (chave(b) ?? -Infinity) - (chave(a) ?? -Infinity) || a.conta.usuario.localeCompare(b.conta.usuario));
}

// ----- Melhor dia e horário -----
export const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
export const DIAS_SEMANA_LONGO = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"] as const;
export const FAIXAS = [
  { id: "manha", rotulo: "Manhã", horas: "5h às 12h" },
  { id: "tarde", rotulo: "Tarde", horas: "12h às 18h" },
  { id: "noite", rotulo: "Noite", horas: "18h às 5h" },
] as const;
/** Abaixo disto a média de uma célula diz pouco: ela aparece apagada e não entra no "melhor". */
export const MIN_POSTS_CELULA = 2;

export interface CelulaCalor { dia: number; faixa: number; n: number; media: number | null }
export interface CalorDePostagem { celulas: CelulaCalor[]; melhor: CelulaCalor | null; maior: number }

/** Interações médias por post em cada dia da semana (seg a dom) e parte do dia, no horário de Brasília. */
export function calorDePostagem(posts: PostInstagram[]): CalorDePostagem {
  const acc = Array.from({ length: 21 }, () => ({ n: 0, soma: 0 }));
  for (const p of posts) {
    if (!p.data) continue;
    const t = new Date(instante(p.data) - BRASILIA);
    const dia = (t.getUTCDay() + 6) % 7;
    const h = t.getUTCHours();
    const faixa = h >= 5 && h < 12 ? 0 : h >= 12 && h < 18 ? 1 : 2;
    const a = acc[dia * 3 + faixa];
    a.n += 1; a.soma += interacoesDe(p);
  }
  const celulas: CelulaCalor[] = acc.map((a, i) => ({ dia: Math.floor(i / 3), faixa: i % 3, n: a.n, media: a.n ? a.soma / a.n : null }));
  const fortes = celulas.filter((c) => c.n >= MIN_POSTS_CELULA && c.media != null);
  const melhor = fortes.reduce<CelulaCalor | null>((m, c) => (!m || (c.media as number) > (m.media as number) ? c : m), null);
  return { celulas, melhor, maior: Math.max(1, ...fortes.map((c) => c.media as number)) };
}

// ----- O que gera mais interação -----
export interface ComposicaoTipo {
  tipo: string; rotulo: string; posts: number;
  /** Médias por post. */
  media: number; curtidas: number; comentarios: number; salvos: number; compartilhamentos: number;
}
/** Por tipo de conteúdo: interações médias por post e de que são feitas (curtidas, comentários, salvos, compartilhamentos), da maior média para a menor. */
export function composicaoPorTipo(posts: PostInstagram[]): ComposicaoTipo[] {
  const por = new Map<string, PostInstagram[]>();
  for (const p of posts) por.set(p.tipo, [...(por.get(p.tipo) ?? []), p]);
  return [...por].map(([tipo, lista]) => {
    const n = lista.length;
    return {
      tipo, rotulo: NOME_DO_TIPO[tipo] ?? tipo, posts: n,
      media: soma(lista.map(interacoesDe)) / n,
      curtidas: soma(lista.map((p) => p.curtidas)) / n, comentarios: soma(lista.map((p) => p.comentarios)) / n,
      salvos: soma(lista.map((p) => p.salvos)) / n, compartilhamentos: soma(lista.map((p) => p.compartilhamentos)) / n,
    };
  }).sort((a, b) => b.media - a.media);
}

// ----- Posts em destaque e feed -----
/** Os `n` posts do período com mais interações (sem os que não tiveram nenhuma). */
export function postsQueMaisEngajaram(posts: PostInstagram[], n = 6, dias = 30, agora = new Date()): PostInstagram[] {
  return postsDesde(posts, dias, agora).filter((p) => interacoesDe(p) > 0).sort((a, b) => interacoesDe(b) - interacoesDe(a)).slice(0, n);
}

export type OrdemFeed = "recentes" | "interacao";
export type FiltroTipo = "todos" | string;
export function filtrarFeed(posts: PostInstagram[], tipo: FiltroTipo, ordem: OrdemFeed): PostInstagram[] {
  const lista = tipo === "todos" ? [...posts] : posts.filter((p) => p.tipo === tipo);
  return ordem === "interacao"
    ? lista.sort((a, b) => interacoesDe(b) - interacoesDe(a))
    : lista.sort((a, b) => (b.data ? instante(b.data) : 0) - (a.data ? instante(a.data) : 0));
}

// ----- Stories -----
export interface DiaDeStories { dia: string; n: number }
/** Quantos stories houve em cada um dos últimos `dias` dias (dia de Brasília), do mais antigo ao de hoje; dia sem story vale 0. */
export function storiesPorDiaContagem(stories: StoryInstagram[], dias = 14, agora = new Date()): DiaDeStories[] {
  const hoje = new Date(agora.getTime() - BRASILIA).toISOString().slice(0, 10);
  const mapa = new Map<string, number>();
  for (const s of stories) if (s.data) { const k = new Date(instante(s.data) - BRASILIA).toISOString().slice(0, 10); mapa.set(k, (mapa.get(k) ?? 0) + 1); }
  return Array.from({ length: dias }, (_, i) => {
    const dia = new Date(Date.parse(`${hoje}T12:00:00Z`) - (dias - 1 - i) * DIA).toISOString().slice(0, 10);
    return { dia, n: mapa.get(dia) ?? 0 };
  });
}
