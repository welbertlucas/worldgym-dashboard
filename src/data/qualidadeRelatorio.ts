// Conteúdo do relatório em PDF de uma visita (ou envio de checklist) da Qualidade. Separado do desenho (src/lib/qualidadePdf.ts) para poder testar.
import { dataBR, pctTexto, type PlanoAcao, type RespostaVisita, type Visita } from "@/data/qualidade";

export type Situacao = "conforme" | "nao-conforme" | "nao-se-aplica";
export interface ItemDoRelatorio { id: string; texto: string; situacao: Situacao; comentario: string; vencimento: string | null; equipamentos: { codigo: string; descricao: string; fotos: string[] }[]; fotos: string[]; /** Plano de ação criado para este item (aparece dentro do bloco do item). */ plano: PlanoDoRelatorio | null }
export interface GrupoDoRelatorio { nome: string; nota: string | null; itens: ItemDoRelatorio[] }
export interface PlanoDoRelatorio { itemId: string; item: string; oQue: string; prazo: string; responsavel: string; status: string }
export interface RelatorioDaVisita {
  titulo: string; unidade: string; checklist: string; data: string; avaliador: string; nota: string;
  /** Visita da franqueadora ou envio do checklist da própria unidade. */
  origem: "franqueadora" | "unidade";
  marcas: string[];
  contagem: { conformes: number; naoConformes: number; naoSeAplica: number };
  grupos: GrupoDoRelatorio[];
  observacao: string;
  /** Planos de ação que não casam com nenhum item (o item foi removido do checklist). */
  planos: PlanoDoRelatorio[];
  /** Quantas perguntas o checklist tinha nesta visita. */
  perguntas: number;
  /** Hora do check-in e do check-out (ex.: "14:05") e onde foi, para os quadros de Check-In e Check-Out. */
  checkin: { data: string; hora: string; local: string } | null;
  checkout: { data: string; hora: string; local: string } | null;
  assinatura: { nome: string; cargo: string; foto: string } | null;
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const metros = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`);
const STATUS: Record<PlanoAcao["status"], string> = { aberto: "em aberto", validacao: "aguardando confirmação", concluido: "concluído" };

const situacaoDe = (r: RespostaVisita): Situacao => (r.conforme === true ? "conforme" : r.conforme === false ? "nao-conforme" : "nao-se-aplica");

/** Quem foi, quando, a nota, as respostas por grupo (com comentário, vencimento, equipamentos parados e fotos), os planos de ação da visita e a assinatura. A selfie nunca entra. */
export function montarRelatorioDaVisita(v: Visita, planos: PlanoAcao[] = []): RelatorioDaVisita {
  const marca = (titulo: string, m: NonNullable<Visita["checkin"]>) =>
    `${titulo} ${hora(m.em)}${m.loc ? (m.distanciaM !== undefined ? ` · ${m.foraDoLocal ? "fora do local: " : ""}a ${metros(m.distanciaM)} da unidade` : " · localização registrada") : " · sem localização"}`;
  const quadro = (m: Visita["checkin"]) => (m ? { data: new Date(m.em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }), hora: hora(m.em), local: m.loc ? (m.distanciaM !== undefined ? `${m.foraDoLocal ? "fora do local: " : ""}a ${metros(m.distanciaM)} da unidade` : "localização registrada") : "sem localização" } : null);
  const marcas = [...(v.checkin ? [marca("Check-in", v.checkin)] : []), ...(v.checkout ? [marca("Check-out", v.checkout)] : []), ...(v.duracaoMin !== undefined ? [`Duração: ${v.duracaoMin} min`] : [])];
  const ordem: string[] = [];
  const por = new Map<string, ItemDoRelatorio[]>();
  const meusPlanos = planos.filter((p) => p.visitaId === v.id).map((p) => ({ itemId: p.itemId, item: p.itemTexto, oQue: p.oQue, prazo: dataBR(p.prazo), responsavel: p.responsavel || "—", status: STATUS[p.status] }));
  const doItem = (id: string) => meusPlanos.find((p) => p.itemId === id) ?? null;
  for (const r of v.respostas) {
    const g = r.grupo?.trim() || "Itens";
    if (!por.has(g)) { por.set(g, []); ordem.push(g); }
    por.get(g)!.push({ id: r.itemId, plano: doItem(r.itemId), texto: r.texto, situacao: situacaoDe(r), comentario: r.comentario ?? "", vencimento: r.vencimento ? dataBR(r.vencimento) : null, equipamentos: (r.equipamentos ?? []).map((e) => ({ codigo: e.codigo, descricao: e.descricao, fotos: e.fotos })), fotos: r.fotos ?? [] });
  }
  const todas = v.respostas;
  return {
    titulo: v.origem === "unidade" ? "Checklist da unidade" : "Visita de qualidade",
    unidade: v.unidade, checklist: v.modeloNome, data: dataBR(v.data), avaliador: v.avaliador.nome || "—", nota: pctTexto(v.nota),
    origem: v.origem === "unidade" ? "unidade" : "franqueadora",
    marcas,
    contagem: { conformes: todas.filter((r) => r.conforme === true).length, naoConformes: todas.filter((r) => r.conforme === false).length, naoSeAplica: todas.filter((r) => r.conforme === null).length },
    grupos: ordem.map((nome) => ({ nome, nota: v.notasPorGrupo && nome in v.notasPorGrupo ? pctTexto(v.notasPorGrupo[nome]) : null, itens: por.get(nome)! })),
    observacao: v.observacao ?? "",
    planos: meusPlanos.filter((p) => !v.respostas.some((x) => x.itemId === p.itemId)),
    perguntas: v.respostas.length, checkin: quadro(v.checkin), checkout: quadro(v.checkout),
    assinatura: v.assinatura ?? null,
  };
}

/** Nome do arquivo: "Qualidade-Asa-Norte-2026-11-20.pdf". */
export function nomeDoPdf(v: Pick<Visita, "unidade" | "data" | "origem">): string {
  const un = v.unidade.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Unidade";
  return `${v.origem === "unidade" ? "Checklist" : "Qualidade"}-${un}-${v.data}.pdf`;
}
