// Jurídico: cálculos da tela a partir dos processos que o servidor entrega (sem nome de parte contrária nem texto livre).

export interface Processo {
  ano: number | null;
  numero: string;
  empresa: string;
  polo: string;
  natureza: "judicial" | "extrajudicial";
  orgao: string;
  juizo: string;
  tipo: string;
  /** Valor da causa; null = sem valor (sigiloso ou não informado). */
  valor: number | null;
  sigiloso: boolean;
  status: string;
  /** AAAA-MM-DD da última movimentação, ou null. */
  ultimaMov: string | null;
  arquivado: boolean;
}
export interface ModeloJuridico { atualizadoEm: string; processos: Processo[] }
export type RespostaJuridico = { disponivel: false } | ({ disponivel: true } & ModeloJuridico);

/** Processo ativo sem andamento há mais que isso (ou sem data de movimentação) aparece como parado. Limiar combinado com o dono: mudar só com ele. */
export const DIAS_PARADO = 60;

export type Situacao = "ativos" | "arquivados" | "todos";
export type Natureza = "todas" | "judicial" | "extrajudicial";
export interface FiltroJuridico { situacao: Situacao; natureza: Natureza; empresa: string }
export const filtroInicial: FiltroJuridico = { situacao: "ativos", natureza: "todas", empresa: "" };

export const filtrar = (ps: Processo[], f: FiltroJuridico): Processo[] =>
  ps.filter((p) => (f.situacao === "todos" || p.arquivado === (f.situacao === "arquivados")) && (f.natureza === "todas" || p.natureza === f.natureza) && (!f.empresa || p.empresa === f.empresa));

export const empresasDe = (ps: Processo[]): string[] => [...new Set(ps.map((p) => p.empresa).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

/** Dias entre a última movimentação e `hoje` (AAAA-MM-DD); null quando não há data. */
export function diasSemMovimento(p: Processo, hoje: string): number | null {
  if (!p.ultimaMov) return null;
  return Math.max(0, Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${p.ultimaMov}T00:00:00Z`)) / 86400000));
}
export const parado = (p: Processo, hoje: string): boolean => {
  if (p.arquivado) return false;
  const d = diasSemMovimento(p, hoje);
  return d === null || d > DIAS_PARADO;
};

export interface ResumoJuridico {
  total: number;
  valor: number;
  semValor: number;
  sigilosos: number;
  reu: number;
  judiciais: number;
  extrajudiciais: number;
  parados: number;
}
export function resumo(ps: Processo[], hoje: string): ResumoJuridico {
  return {
    total: ps.length,
    valor: ps.reduce((t, p) => t + (p.valor ?? 0), 0),
    semValor: ps.filter((p) => p.valor === null).length,
    sigilosos: ps.filter((p) => p.sigiloso).length,
    reu: ps.filter((p) => p.polo === "Réu").length,
    judiciais: ps.filter((p) => p.natureza === "judicial").length,
    extrajudiciais: ps.filter((p) => p.natureza === "extrajudicial").length,
    parados: ps.filter((p) => parado(p, hoje)).length,
  };
}

export interface Grupo { nome: string; qtd: number; valor: number }
/** Agrupa por empresa, órgão ou tipo: do que tem mais valor em causa para o que tem menos; empate pela quantidade. */
export function agrupar(ps: Processo[], chave: "empresa" | "orgao" | "tipo"): Grupo[] {
  const m = new Map<string, Grupo>();
  for (const p of ps) {
    const nome = p[chave] || "Não informado";
    const g = m.get(nome) ?? { nome, qtd: 0, valor: 0 };
    g.qtd += 1;
    g.valor += p.valor ?? 0;
    m.set(nome, g);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor || b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"));
}

export type Ordem = "valor" | "parados" | "recentes";
export function ordenar(ps: Processo[], ordem: Ordem): Processo[] {
  const t = (p: Processo) => (p.ultimaMov ? Date.parse(p.ultimaMov) : -Infinity);
  const f = {
    valor: (a: Processo, b: Processo) => (b.valor ?? -1) - (a.valor ?? -1),
    parados: (a: Processo, b: Processo) => t(a) - t(b),
    recentes: (a: Processo, b: Processo) => t(b) - t(a),
  }[ordem];
  return [...ps].sort(f);
}

const reais = (v: number, casas = 0) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
export const brl = (v: number) => reais(v, 2);
export const brl0 = (v: number) => reais(Math.round(v), 0);
/** Número curto para caber no arco do cartão: "R$ 1,3 mi" de 1 milhão para cima. */
export const curto = (v: number) => (Math.abs(v) >= 1e6 ? `R$ ${(v / 1e6).toFixed(2).replace(".", ",")} mi` : brl0(v));
export const dataBR = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

/** CSV dos processos do filtro, na ordem escolhida (separador ";" e vírgula decimal, como o Excel em português espera). Só o que a tela já mostra. */
export function csvDeProcessos(ps: Processo[], hoje: string): string {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const linhas = [["Processo", "Ano", "Empresa", "Órgão", "Juízo", "Tipo de ação", "Natureza", "Polo", "Valor da causa (R$)", "Status", "Última movimentação", "Dias sem movimentação", "Sem andamento"].map(q).join(";")];
  for (const p of ps) {
    const dias = diasSemMovimento(p, hoje);
    linhas.push([
      q(p.numero), p.ano === null ? "" : String(p.ano), q(p.empresa), q(p.orgao), q(p.juizo), q(p.tipo), q(p.natureza === "judicial" ? "Judicial" : "Extrajudicial"), q(p.polo),
      p.valor === null ? q(p.sigiloso ? "Sigiloso" : "") : p.valor.toFixed(2).replace(".", ","), q(p.arquivado ? "Arquivado" : p.status), q(dataBR(p.ultimaMov).replace("—", "")), dias === null ? "" : String(dias), q(parado(p, hoje) ? "Sim" : "Não"),
    ].join(";"));
  }
  return `\uFEFF${linhas.join("\r\n")}`;
}
