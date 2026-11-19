// Influenciadores da rede (Marketing > Influenciadores): cadastro e contrato. Regras puras (sem rede), para a tela e os testes.
import { API_BASE, authFetch } from "@/lib/auth";
import type { ContasDaRede, PostsDoPerfil } from "@/data/entregas";

export interface Entregas { stories: number; feed: number; reels: number }
export interface Influenciador {
  id: string;
  /** @ do Instagram, sem o "@". */
  usuario: string;
  nome?: string;
  /** Unidade do contrato; null = a rede toda (Institucional). */
  unidade: string | null;
  /** AAAA-MM-DD; null = sem data de início definida. */
  inicio: string | null;
  /** AAAA-MM-DD; null = sem data de fim. */
  fim: string | null;
  /** Combinado por mês. */
  entregas: Entregas;
  /** O que conta como entrega de feed e reels: só o post que cita ou marca a unidade (padrão) ou qualquer post do perfil. */
  contagem?: RegraDeContagem;
  obs?: string;
  ativo: boolean;
  criadoEm: string;
}
export type RegraDeContagem = "marcando" | "qualquer";
export type CamposInfluenciador = Omit<Influenciador, "id" | "criadoEm">;
/** O que o perfil público do @ mostra, lido do Instagram a cada 4 horas. `erro`: o perfil não pôde ser lido (conta pessoal, privada...). */
export interface PerfilInfluenciador { seguidores: number | null; publicacoes: number | null; foto: boolean; erro: string | null }
export type SituacaoContrato = "vigente" | "futuro" | "encerrado" | "inativo";

export const TIPOS_ENTREGA: { id: keyof Entregas; rotulo: string; singular: string }[] = [
  { id: "stories", rotulo: "Stories", singular: "story" },
  { id: "feed", rotulo: "Posts no feed", singular: "post no feed" },
  { id: "reels", rotulo: "Reels", singular: "reel" },
];

/** Hoje no horário de Brasília (AAAA-MM-DD). */
export const hojeBR = (agora = Date.now()) => new Date(agora - 3 * 3600_000).toISOString().slice(0, 10);

/** "inativo" = o dono desligou o contrato; senão, pela data: ainda não começou, em vigor ou terminou. Sem data de início, vale desde sempre. */
export function situacaoDoContrato(i: Pick<Influenciador, "ativo" | "inicio" | "fim">, hoje = hojeBR()): SituacaoContrato {
  if (!i.ativo) return "inativo";
  if (i.inicio && hoje < i.inicio) return "futuro";
  if (i.fim && hoje > i.fim) return "encerrado";
  return "vigente";
}
export const ROTULO_SITUACAO: Record<SituacaoContrato, string> = { vigente: "Em vigor", futuro: "Começa em breve", encerrado: "Encerrado", inativo: "Desativado" };

/** "12 stories · 4 posts no feed · 2 reels por mês" (só o que foi combinado). */
export function textoEntregas(e: Entregas): string {
  const partes = TIPOS_ENTREGA.filter((t) => e[t.id] > 0).map((t) => `${e[t.id]} ${e[t.id] === 1 ? t.singular : t.id === "feed" ? "posts no feed" : t.id}`);
  return partes.length ? `${partes.join(" · ")} por mês` : "Nada combinado";
}

const ORDEM: Record<SituacaoContrato, number> = { vigente: 0, futuro: 1, encerrado: 2, inativo: 3 };
/** Em vigor primeiro; dentro de cada grupo, por unidade (a rede toda por último) e @. */
export function ordenarInfluenciadores(lista: Influenciador[], hoje = hojeBR()): Influenciador[] {
  return [...lista].sort((a, b) => ORDEM[situacaoDoContrato(a, hoje)] - ORDEM[situacaoDoContrato(b, hoje)]
    || (a.unidade ?? "￿").localeCompare(b.unidade ?? "￿", "pt-BR") || a.usuario.localeCompare(b.usuario));
}

/** Filtro do alto da tela: uma unidade mostra só os dela; a rede mostra todos. */
export const dasUnidades = (lista: Influenciador[], unidade: string | null) => (unidade ? lista.filter((i) => i.unidade === unidade) : lista);

/** "01/11/2026" a partir de AAAA-MM-DD. */
export const dataBR = (ymd: string) => ymd.split("-").reverse().join("/");
export const vigencia = (i: Pick<Influenciador, "inicio" | "fim">) => {
  if (i.inicio && i.fim) return `${dataBR(i.inicio)} a ${dataBR(i.fim)}`;
  if (i.inicio) return `desde ${dataBR(i.inicio)}, sem data de fim`;
  if (i.fim) return `até ${dataBR(i.fim)}`;
  return "sem datas definidas";
};

// ----- API (a mesma rota do Instagram) -----
type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string };
async function chamar<T>(init?: RequestInit, consulta = ""): Promise<Resposta<T>> {
  try {
    const res = await authFetch(`${API_BASE}/instagram${consulta}`, init);
    const corpo = (await res.json().catch(() => ({}))) as { error?: string } & T;
    if (!res.ok) return { ok: false, erro: corpo.error ?? "Não consegui concluir agora. Tente de novo." };
    return { ok: true, dados: corpo };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}
const enviar = <T>(corpo: object) => chamar<T>({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });

export const listarInfluenciadores = () => chamar<{ influenciadores: Influenciador[]; perfis?: Record<string, PerfilInfluenciador>; posts?: Record<string, PostsDoPerfil>; contas?: ContasDaRede }>(undefined, "?influenciadores=1");

const fotos = new Map<string, Promise<string | null>>();
/** Foto do perfil guardada (a rota exige login, então vem por fetch e vira um endereço local do navegador). Uma busca por @ por visita. */
export function fotoDoPerfil(usuario: string): Promise<string | null> {
  if (!fotos.has(usuario)) {
    fotos.set(usuario, authFetch(`${API_BASE}/instagram?perfil=${encodeURIComponent(usuario)}`)
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
      .catch(() => null));
  }
  return fotos.get(usuario)!;
}

/** "14,4 mil", "2,5 mi", "950". */
export const seguidoresCompacto = (n: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const criarInfluenciador = (c: CamposInfluenciador) => enviar<{ influenciador: Influenciador }>({ acao: "criar", ...c });
export const atualizarInfluenciador = (id: string, c: Partial<CamposInfluenciador>) => enviar<{ influenciador: Influenciador }>({ acao: "atualizar", id, ...c });
export const removerInfluenciador = (id: string) => enviar<{ ok: true }>({ acao: "remover", id });

// ----- Resumo e andamento (para a faixa de números e os cartões) -----
const DIA_MS = 86400000;
const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);
const nDias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

export interface ResumoContratos {
  total: number;
  emVigor: number;
  /** Combinado por mês, somando só os contratos em vigor. */
  stories: number;
  feed: number;
  reels: number;
  /** Unidades diferentes com contrato em vigor (a "Rede toda" não conta como unidade). */
  unidades: number;
}
export function resumoDosContratos(lista: Pick<Influenciador, "ativo" | "inicio" | "fim" | "entregas" | "unidade">[], hoje = hojeBR()): ResumoContratos {
  const vigentes = lista.filter((i) => situacaoDoContrato(i, hoje) === "vigente");
  return {
    total: lista.length,
    emVigor: vigentes.length,
    stories: vigentes.reduce((s, i) => s + i.entregas.stories, 0),
    feed: vigentes.reduce((s, i) => s + i.entregas.feed, 0),
    reels: vigentes.reduce((s, i) => s + i.entregas.reels, 0),
    unidades: new Set(vigentes.map((i) => i.unidade).filter((u): u is string => u !== null)).size,
  };
}

/**
 * Em que ponto do contrato estamos: `pct` (0 a 100) só existe quando há início e fim; `texto` diz o que falta ou aconteceu.
 */
export function andamentoDoContrato(i: Pick<Influenciador, "ativo" | "inicio" | "fim">, hoje = hojeBR()): { pct: number | null; texto: string } {
  const sit = situacaoDoContrato(i, hoje);
  if (sit === "inativo") return { pct: null, texto: "Contrato desativado" };
  if (sit === "futuro") return { pct: i.fim ? 0 : null, texto: `Começa em ${nDias(diasEntre(hoje, i.inicio as string))}` };
  if (sit === "encerrado") return { pct: i.inicio ? 100 : null, texto: `Encerrou há ${nDias(diasEntre(i.fim as string, hoje))}` };
  if (i.inicio && i.fim) {
    const total = diasEntre(i.inicio, i.fim) + 1;
    const passou = diasEntre(i.inicio, hoje) + 1;
    const resta = diasEntre(hoje, i.fim);
    return { pct: Math.min(100, Math.max(0, Math.round((passou / total) * 100))), texto: resta === 0 ? "Termina hoje" : `Faltam ${nDias(resta)}` };
  }
  if (i.fim) return { pct: null, texto: diasEntre(hoje, i.fim) === 0 ? "Termina hoje" : `Termina em ${dataBR(i.fim)} (faltam ${nDias(diasEntre(hoje, i.fim))})` };
  if (i.inicio) return { pct: null, texto: `Em vigor desde ${dataBR(i.inicio)}, sem data de fim` };
  return { pct: null, texto: "Sem datas definidas" };
}
