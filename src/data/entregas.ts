// Conferência do contrato dos influenciadores: o que foi postado (feed e reels, lidos do Instagram) contra o combinado por mês.
// Regras puras (sem rede). Stories ficam de fora: a Meta não os entrega para contas de terceiros.
import { instante } from "@/data/instagram";
import { hojeBR, type Entregas, type Influenciador } from "@/data/influenciadores";

export interface PostInfluenciador {
  id: string;
  tipo: "feed" | "reels";
  data: string | null;
  link: string | null;
  legenda: string;
  curtidas: number | null;
  comentarios: number | null;
  /** Contas da rede (sem @) que o post cita na legenda ou marca na imagem. */
  citou: string[];
}
export interface PostsDoPerfil { lidoEm: string; posts: PostInfluenciador[] }
/** Contas do Instagram da rede: a da marca e a de cada unidade. */
export interface ContasDaRede { marca: string | null; porUnidade: Record<string, string> }

type Regra = Pick<Influenciador, "unidade" | "contagem">;

/** Contas da rede cuja citação ou marcação faz um post contar para o contrato; null = qualquer post do perfil conta. */
export function contasQueContam(i: Regra, contas: ContasDaRede): string[] | null {
  if (i.contagem === "qualquer") return null;
  const lista = i.unidade ? [contas.porUnidade[i.unidade], contas.marca] : [contas.marca, ...Object.values(contas.porUnidade)];
  return lista.filter((x): x is string => Boolean(x));
}

export function postConta(p: PostInfluenciador, i: Regra, contas: ContasDaRede): boolean {
  const aceitas = contasQueContam(i, contas);
  return aceitas === null || p.citou.some((h) => aceitas.includes(h));
}

const DIA = 86400000;
const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA);
const diasDoMes = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };
/** Dia (AAAA-MM-DD) e mês (AAAA-MM) de um instante do Meta, no horário de Brasília. */
export const diaDeBrasilia = (iso: string) => new Date(instante(iso) - 3 * 3600000).toISOString().slice(0, 10);
export const mesAnteriorDe = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 7); };

/** Meta do mês: o contrato que só cobre parte do mês tem a meta reduzida na mesma proporção, arredondada para cima. */
export function metaDoMes(i: Pick<Influenciador, "inicio" | "fim" | "entregas">, ym: string): { metas: Entregas; dias: { de: string; ate: string; total: number } | null } {
  const total = diasDoMes(ym);
  const primeiro = `${ym}-01`, ultimo = `${ym}-${String(total).padStart(2, "0")}`;
  const de = i.inicio && i.inicio > primeiro ? i.inicio : primeiro;
  const ate = i.fim && i.fim < ultimo ? i.fim : ultimo;
  if (de > ate) return { metas: { stories: 0, feed: 0, reels: 0 }, dias: null };
  const fracao = (diasEntre(de, ate) + 1) / total;
  const parte = (n: number) => (fracao >= 1 ? n : Math.ceil(n * fracao));
  return { metas: { stories: parte(i.entregas.stories), feed: parte(i.entregas.feed), reels: parte(i.entregas.reels) }, dias: { de, ate, total } };
}

export type SituacaoMes = "cumprido" | "no_ritmo" | "atrasado" | "nao_cumprido" | "sem_meta" | "fora" | "sem_leitura" | "desativado";
export const ROTULO_SITUACAO_MES: Record<SituacaoMes, string> = {
  cumprido: "Cumprido", no_ritmo: "No ritmo", atrasado: "Atrasado", nao_cumprido: "Não cumprido", sem_meta: "Só stories combinados",
  fora: "Fora do contrato", sem_leitura: "Ainda sem leitura do Instagram", desativado: "Contrato desativado",
};

export interface EntregasDoMes {
  ym: string;
  /** É o mês em andamento (a meta cobra o ritmo, não o total). */
  parcial: boolean;
  metas: Entregas;
  feitas: { feed: number; reels: number };
  /** Quanto já deveria ter saído até hoje, no ritmo do contrato (no mês fechado, a meta inteira). */
  esperado: { feed: number; reels: number };
  faltam: { feed: number; reels: number };
  situacao: SituacaoMes;
  /** Posts do mês que contaram, do mais recente para o mais antigo. */
  contam: PostInfluenciador[];
  /** Posts do mês, dentro do contrato, que NÃO contaram (não citam nem marcam a unidade). */
  semCitar: number;
}

/**
 * O que um influenciador entregou em `ym` (AAAA-MM) frente ao combinado. Sem leitura de posts, só devolve as metas.
 * Mês em andamento: "no ritmo" se já saiu o que o prazo pede até hoje; "atrasado" se não; "cumprido" se já fechou a meta.
 */
export function entregasDoMes(i: Influenciador, doPerfil: PostsDoPerfil | undefined, contas: ContasDaRede, ym: string, hoje = hojeBR()): EntregasDoMes {
  const { metas, dias } = metaDoMes(i, ym);
  const parcial = ym === hoje.slice(0, 7);
  const vazio = { feed: 0, reels: 0 };
  const base = { ym, parcial, metas, feitas: vazio, esperado: vazio, faltam: { feed: metas.feed, reels: metas.reels }, contam: [] as PostInfluenciador[], semCitar: 0 };
  if (!i.ativo) return { ...base, situacao: "desativado" };
  if (!dias) return { ...base, situacao: "fora" };
  if (!doPerfil) return { ...base, situacao: "sem_leitura" };

  const noMes = doPerfil.posts.filter((p) => { const d = p.data ? diaDeBrasilia(p.data) : null; return d !== null && d >= dias.de && d <= dias.ate; });
  const contam = noMes.filter((p) => postConta(p, i, contas)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const feitas = { feed: contam.filter((p) => p.tipo === "feed").length, reels: contam.filter((p) => p.tipo === "reels").length };
  const faltam = { feed: Math.max(0, metas.feed - feitas.feed), reels: Math.max(0, metas.reels - feitas.reels) };
  const cobertos = diasEntre(dias.de, dias.ate) + 1;
  const passados = parcial ? Math.max(0, Math.min(cobertos, diasEntre(dias.de, hoje) + 1)) : cobertos;
  const esperado = { feed: Math.floor((metas.feed * passados) / cobertos), reels: Math.floor((metas.reels * passados) / cobertos) };
  const resto = { contam, semCitar: noMes.length - contam.length, feitas, faltam, esperado };

  if (metas.feed + metas.reels === 0) return { ...base, ...resto, situacao: "sem_meta" };
  if (faltam.feed === 0 && faltam.reels === 0) return { ...base, ...resto, situacao: "cumprido" };
  if (!parcial) return { ...base, ...resto, situacao: "nao_cumprido" };
  return { ...base, ...resto, situacao: feitas.feed < esperado.feed || feitas.reels < esperado.reels ? "atrasado" : "no_ritmo" };
}

/** Feed e reels entregues e combinados em `ym`, somando os contratos em vigor que têm leitura de posts (cada tipo limitado à meta). */
export function resumoDeEntregas(lista: Influenciador[], posts: Record<string, PostsDoPerfil>, contas: ContasDaRede, ym: string, hoje = hojeBR()): { feitas: number; combinadas: number; comLeitura: number } {
  let feitas = 0, combinadas = 0, comLeitura = 0;
  for (const i of lista) {
    const e = entregasDoMes(i, posts[i.usuario], contas, ym, hoje);
    if (e.situacao === "sem_leitura" || e.situacao === "desativado" || e.situacao === "fora") continue;
    comLeitura++;
    combinadas += e.metas.feed + e.metas.reels;
    feitas += Math.min(e.feitas.feed, e.metas.feed) + Math.min(e.feitas.reels, e.metas.reels);
  }
  return { feitas, combinadas, comLeitura };
}

/** A conta da rede que o influenciador deve citar na legenda: a da unidade do contrato (ou a da marca, no contrato da rede toda). */
export function contaParaCitar(i: Pick<Influenciador, "unidade">, contas: ContasDaRede): string | null {
  return (i.unidade ? contas.porUnidade[i.unidade] : null) ?? contas.marca;
}

/**
 * Pedido pronto para mandar ao influenciador, com a conta certa. null quando não há o que pedir: contrato em que qualquer post conta,
 * ou sem conta da rede conhecida.
 */
export function pedidoDeCitacao(i: Pick<Influenciador, "unidade" | "nome" | "contagem">, contas: ContasDaRede): string | null {
  if (i.contagem === "qualquer") return null;
  const conta = contaParaCitar(i, contas);
  if (!conta) return null;
  const primeiro = i.nome?.trim().split(/\s+/)[0];
  return `Oi${primeiro ? `, ${primeiro}` : ""}! Para os seus posts de feed e reels contarem no combinado com a World Gym${i.unidade ? ` ${i.unidade}` : ""}, cite a conta @${conta} na legenda de cada post (pode escrever com ou sem @). Marcar a conta só na imagem, fazer o post em colaboração ou postar só nos stories não aparece para a gente, e aí o post não entra na conta.`;
}
