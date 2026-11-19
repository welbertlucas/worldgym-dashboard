// Influenciadores da rede (Marketing > Influenciadores): cadastro e contrato. Regras puras (sem rede), para a tela e os testes.
import { API_BASE, authFetch } from "@/lib/auth";

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
  obs?: string;
  ativo: boolean;
  criadoEm: string;
}
export type CamposInfluenciador = Omit<Influenciador, "id" | "criadoEm">;
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

export const listarInfluenciadores = () => chamar<{ influenciadores: Influenciador[] }>(undefined, "?influenciadores=1");
export const criarInfluenciador = (c: CamposInfluenciador) => enviar<{ influenciador: Influenciador }>({ acao: "criar", ...c });
export const atualizarInfluenciador = (id: string, c: Partial<CamposInfluenciador>) => enviar<{ influenciador: Influenciador }>({ acao: "atualizar", id, ...c });
export const removerInfluenciador = (id: string) => enviar<{ ok: true }>({ acao: "remover", id });
