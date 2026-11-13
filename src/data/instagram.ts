import { authFetch, API_BASE } from "@/lib/auth";

const URL_INSTAGRAM = `${API_BASE}/instagram`;

/** Conta do Instagram; `unidade: null` = conta Institucional (rede toda). */
export interface ContaInstagram { id: string; usuario: string; nome: string; unidade: string | null; seguidores: number | null; posts: number | null; foto: string | null }
/** IMAGE, VIDEO, CAROUSEL_ALBUM ou REELS. Números null = o Meta não informou (ou story com menos de 5 pessoas). */
export interface PostInstagram {
  id: string; conta: string; unidade: string | null; tipo: string; legenda: string; link: string | null; data: string | null;
  curtidas: number | null; comentarios: number | null; visualizacoes: number | null; alcance: number | null;
  salvos: number | null; compartilhamentos: number | null; interacoes: number | null; midia?: boolean | null;
}
export interface StoryInstagram {
  id: string; conta: string; unidade: string | null; tipo: string; link: string | null; data: string | null;
  visualizacoes: number | null; alcance: number | null; respostas: number | null; compartilhamentos: number | null; interacoes: number | null; midia?: boolean | null;
}
export interface DadosInstagram {
  geradoEm: string | null; contas: ContaInstagram[];
  /** Seguidores por conta e dia: { "worldgym.gama": { "2026-11-12": 5400 } }. */
  seguidores: Record<string, Record<string, number>>;
  posts: PostInstagram[]; stories: StoryInstagram[]; erros: { conta: string; erro: string }[];
}

let pedido: Promise<DadosInstagram | null> | null = null;

/** Lê uma vez por visita; falha não fica guardada. */
export function carregarInstagram(): Promise<DadosInstagram | null> {
  pedido ??= (async () => {
    try {
      const res = await authFetch(URL_INSTAGRAM);
      return res.ok ? ((await res.json()) as DadosInstagram) : null;
    } catch { return null; }
  })().then((d) => { if (!d) pedido = null; return d; });
  return pedido;
}

const imagens = new Map<string, Promise<string | null>>();
/** Imagem guardada de um post/story (a rota exige login, então vem por fetch e vira um endereço local do navegador). */
export function imagemInstagram(id: string): Promise<string | null> {
  if (!imagens.has(id)) {
    imagens.set(id, authFetch(`${URL_INSTAGRAM}?midia=${encodeURIComponent(id)}`)
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
      .catch(() => null));
  }
  return imagens.get(id)!;
}

/** Contas da escolha do botão de unidade: rede = todas (a Institucional primeiro); unidade = só a dela. */
export function contasDaEscolha(d: DadosInstagram, unit: string | null): ContaInstagram[] {
  const lista = unit ? d.contas.filter((c) => c.unidade === unit) : [...d.contas];
  return lista.sort((a, b) => (a.unidade === null ? -1 : b.unidade === null ? 1 : (a.unidade ?? "").localeCompare(b.unidade ?? "", "pt-BR")));
}

const DIA = 86400000;
const diaBrasilia = (iso: string) => new Date(Date.parse(iso) - 3 * 3600000).toISOString().slice(0, 10);

export interface ResumoConta {
  conta: ContaInstagram;
  postsNoPeriodo: number;
  storiesNoPeriodo: number;
  /** Dias desde o último post do feed (null = nenhum guardado). */
  diasSemPost: number | null;
  /** Variação de seguidores no período (null = sem histórico suficiente). */
  ganhoSeguidores: number | null;
  /** Média de visualizações dos posts do período (null = sem números). */
  mediaVisualizacoes: number | null;
}

/** Resumo de cada conta nos últimos `dias` dias (padrão 30), contando até `agora`. */
export function resumoDasContas(d: DadosInstagram, contas: ContaInstagram[], agora = new Date(), dias = 30): ResumoConta[] {
  const desde = new Date(agora.getTime() - dias * DIA).toISOString();
  const diaDesde = desde.slice(0, 10);
  return contas.map((conta) => {
    const posts = d.posts.filter((p) => p.conta === conta.usuario);
    const doPeriodo = posts.filter((p) => p.data && p.data >= desde);
    const ultimo = posts.reduce<string | null>((m, p) => (p.data && (!m || p.data > m) ? p.data : m), null);
    const hist = Object.entries(d.seguidores[conta.usuario] ?? {}).sort(([a], [b]) => a.localeCompare(b));
    const base = hist.find(([dia]) => dia >= diaDesde) ?? null;
    const atual = hist[hist.length - 1] ?? null;
    const comNumero = doPeriodo.filter((p) => p.visualizacoes != null);
    return {
      conta,
      postsNoPeriodo: doPeriodo.length,
      storiesNoPeriodo: d.stories.filter((s) => s.conta === conta.usuario && s.data && s.data >= desde).length,
      diasSemPost: ultimo ? Math.floor((agora.getTime() - Date.parse(ultimo)) / DIA) : null,
      ganhoSeguidores: base && atual && base[0] !== atual[0] ? atual[1] - base[1] : null,
      mediaVisualizacoes: comNumero.length ? Math.round(comNumero.reduce((s, p) => s + (p.visualizacoes ?? 0), 0) / comNumero.length) : null,
    };
  });
}

/** Stories agrupados por dia (de Brasília), mais recentes primeiro. */
export function storiesPorDia(stories: StoryInstagram[]): [string, StoryInstagram[]][] {
  const m = new Map<string, StoryInstagram[]>();
  for (const s of stories) if (s.data) { const k = diaBrasilia(s.data); m.set(k, [...(m.get(k) ?? []), s]); }
  return [...m.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([k, v]) => [k, v.sort((a, b) => String(a.data).localeCompare(String(b.data)))]);
}

export const NOME_DO_TIPO: Record<string, string> = { IMAGE: "Foto", VIDEO: "Vídeo", CAROUSEL_ALBUM: "Carrossel", REELS: "Reels" };
