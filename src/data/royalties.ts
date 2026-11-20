// Regras do menu Royalties (recebimentos da marca: taxa fixa e royalties por unidade). O modelo vem pronto do projeto de royalties
// (repositório privado), que lê a planilha, confere e grava o JSON no Blob privado; aqui só se calcula o que cada painel mostra.
// As regras seguem o painel original: saldo vem da aba Pendências, "devedora" é saldo acima de meio centavo, o recebido que não tem
// unidade identificada entra só no total e na taxa fixa quando não há unidade escolhida.

export type Modalidade = "fixa" | "royalties";
export type Situacao = "pago" | "pago2x" | "naopago" | "na";

export interface LinhaPendencia {
  unidade: string;
  variavel: boolean;
  valorMensal: number | null;
  inicio: string | null;
  vencimento: number | null;
  devido: number | null;
  recebido: number | null;
  saldoApuracao: number | null;
  dividaAnterior: number | null;
  saldoTotal: number;
  mesesSemRecebimento: string[];
  obs: string;
}

export interface ModeloRoyalties {
  meses: { key: string; label: string }[];
  unidades: { nome: string; tipo: Modalidade }[];
  recebido: Record<string, Record<string, number>>;
  naoMapeado: { porMes: Record<string, number>; itens: { mes: string }[] };
  pendencias: { apuracao: string | null; dia: number | null; linhas: LinhaPendencia[] };
  devido: Record<string, Record<string, number>>;
  situacao: Record<string, Record<string, Situacao>>;
  situacaoNaoPagos: Record<string, number>;
  mesesComplemento?: string[];
  matrizOcultas?: string[];
  situacaoAjustes?: { unidade: string; mes: string; planilha: string; exibido: string }[];
  notasExtra?: string[];
  premissas?: string[];
  meta: { geradoEm: string; planilha?: string; stale?: { motivo: string; tentativa: string } | null };
}

/** O que a pessoa escolheu nos filtros do topo. `de` e `ate` são posições na lista de meses; `unidades` vazio = todas. */
export interface FiltroRoyalties { de: number; ate: number; tipo: "all" | Modalidade; soDevedoras: boolean; unidades: string[] }

export const MODALIDADE: Record<Modalidade, string> = { fixa: "Taxa fixa", royalties: "Royalties" };
const SEM_SALDO = 0.005;
export const soma = (a: (number | null | undefined)[]) => a.reduce<number>((s, x) => s + (x || 0), 0);

/** Valores de apoio calculados uma vez do modelo. */
export interface ContextoRoyalties {
  m: ModeloRoyalties;
  keys: string[];
  rotulo: Record<string, string>;
  tipoDe: Record<string, Modalidade>;
  pend: Record<string, LinhaPendencia>;
  parcial: Set<string>;
}

export function contexto(m: ModeloRoyalties): ContextoRoyalties {
  return {
    m,
    keys: m.meses.map((x) => x.key),
    rotulo: Object.fromEntries(m.meses.map((x) => [x.key, x.label])),
    tipoDe: Object.fromEntries(m.unidades.map((u) => [u.nome, u.tipo])),
    pend: Object.fromEntries(m.pendencias.linhas.map((l) => [l.unidade, l])),
    parcial: new Set(m.mesesComplemento ?? []),
  };
}

export const filtroInicial = (c: ContextoRoyalties): FiltroRoyalties => ({ de: 0, ate: c.keys.length - 1, tipo: "all", soDevedoras: false, unidades: [] });
export const periodo = (c: ContextoRoyalties, f: FiltroRoyalties) => c.keys.slice(f.de, f.ate + 1);

export const saldoDe = (c: ContextoRoyalties, u: string) => c.pend[u]?.saldoTotal || 0;
export const devidoTotal = (c: ContextoRoyalties, u: string) => soma(Object.values(c.m.devido[u] ?? {}));
export const recebidoDe = (c: ContextoRoyalties, u: string, ks: string[]) => soma(ks.map((k) => c.m.recebido[u]?.[k]));
export const naoMapeadoNo = (c: ContextoRoyalties, ks: string[]) => soma(ks.map((k) => c.m.naoMapeado.porMes[k]));
/** Taxa fixa de unidade fora de Pendências (ex.: Ceilândia) não tem cobrança. Royalties sem valor esperado não têm saldo calculado. */
export const semCobranca = (c: ContextoRoyalties, u: string) => c.tipoDe[u] === "fixa" && !c.pend[u];
export const temSaldoCalculado = (c: ContextoRoyalties, u: string) => (c.tipoDe[u] === "fixa" && !!c.pend[u]) || devidoTotal(c, u) > 0;

/** A unidade passa pelos filtros? */
export function unidadeNoFiltro(c: ContextoRoyalties, f: FiltroRoyalties, u: string) {
  return (f.tipo === "all" || c.tipoDe[u] === f.tipo) && (!f.unidades.length || f.unidades.includes(u)) && (!f.soDevedoras || saldoDe(c, u) > SEM_SALDO);
}
export const unidadesFiltradas = (c: ContextoRoyalties, f: FiltroRoyalties) => c.m.unidades.map((u) => u.nome).filter((u) => unidadeNoFiltro(c, f, u));
/** O recebido sem unidade identificada só entra quando não há unidade escolhida e a modalidade não é só royalties. */
export const incluiNaoMapeado = (f: FiltroRoyalties) => !f.unidades.length && f.tipo !== "royalties";

export interface ResumoPeriodo {
  total: number;
  fixa: number;
  royalties: number;
  naoMapeado: number;
  saldoFixa: number;
  saldoRoyalties: number;
  saldoTotal: number;
  devedoras: string[];
  cobradas: string[];
  unidades: string[];
}

export function resumoDoPeriodo(c: ContextoRoyalties, f: FiltroRoyalties): ResumoPeriodo {
  const ks = periodo(c, f);
  const us = unidadesFiltradas(c, f);
  const naoMapeado = incluiNaoMapeado(f) ? naoMapeadoNo(c, ks) : 0;
  const fixa = soma(us.filter((u) => c.tipoDe[u] === "fixa").map((u) => recebidoDe(c, u, ks))) + naoMapeado;
  const royalties = soma(us.filter((u) => c.tipoDe[u] === "royalties").map((u) => recebidoDe(c, u, ks)));
  const saldoFixa = soma(us.filter((u) => c.tipoDe[u] === "fixa").map((u) => saldoDe(c, u)));
  const saldoRoyalties = soma(us.filter((u) => c.tipoDe[u] === "royalties").map((u) => saldoDe(c, u)));
  const devedoras = us.filter((u) => saldoDe(c, u) > SEM_SALDO);
  const cobradas = us.filter((u) => temSaldoCalculado(c, u) || saldoDe(c, u) > SEM_SALDO);
  return { total: fixa + royalties, fixa, royalties, naoMapeado, saldoFixa, saldoRoyalties, saldoTotal: saldoFixa + saldoRoyalties, devedoras, cobradas, unidades: us };
}

/** Quem está devendo, do maior saldo para o menor (empate por nome). */
export function devedoras(c: ContextoRoyalties, f: FiltroRoyalties): { unidade: string; tipo: Modalidade; saldo: number; linha: LinhaPendencia }[] {
  return unidadesFiltradas(c, f)
    .filter((u) => saldoDe(c, u) > SEM_SALDO && c.pend[u])
    .map((u) => ({ unidade: u, tipo: c.tipoDe[u], saldo: saldoDe(c, u), linha: c.pend[u] }))
    .sort((a, b) => b.saldo - a.saldo || a.unidade.localeCompare(b.unidade, "pt-BR"));
}

export interface PontoMensal { key: string; label: string; parcial: boolean; fixa: number; royalties: number; total: number; naoMapeado: number }

/** Recebido por mês no período, separado em taxa fixa e royalties. */
export function serieMensal(c: ContextoRoyalties, f: FiltroRoyalties): PontoMensal[] {
  const us = unidadesFiltradas(c, f);
  const comNM = incluiNaoMapeado(f);
  return periodo(c, f).map((k) => {
    const nm = comNM ? c.m.naoMapeado.porMes[k] || 0 : 0;
    const fixa = soma(us.filter((u) => c.tipoDe[u] === "fixa").map((u) => c.m.recebido[u]?.[k])) + nm;
    const royalties = soma(us.filter((u) => c.tipoDe[u] === "royalties").map((u) => c.m.recebido[u]?.[k]));
    return { key: k, label: c.rotulo[k], parcial: c.parcial.has(k), fixa, royalties, total: fixa + royalties, naoMapeado: nm };
  });
}

export interface LinhaMatriz { unidade: string; tipo: Modalidade; celulas: { key: string; situacao: Situacao; devido: number; recebido: number; ajuste: boolean }[]; naoPagos: number | null; saldo: number }

/** A matriz de situação mês a mês: só unidades com cobrança no período, sem as que a planilha oculta, em ordem de saldo. */
export function matrizDeSituacao(c: ContextoRoyalties, f: FiltroRoyalties, ks: string[] = periodo(c, f)): LinhaMatriz[] {
  const ocultas = new Set(c.m.matrizOcultas ?? []);
  const ajustes = new Set((c.m.situacaoAjustes ?? []).map((a) => `${a.unidade}|${a.mes}`));
  return Object.keys(c.m.situacao)
    .filter((u) => !ocultas.has(u) && unidadeNoFiltro(c, f, u) && ks.some((k) => (c.m.situacao[u][k] ?? "na") !== "na"))
    .sort((x, y) => saldoDe(c, y) - saldoDe(c, x) || (c.tipoDe[x] ?? "").localeCompare(c.tipoDe[y] ?? ""))
    .map((u) => ({
      unidade: u,
      tipo: c.tipoDe[u],
      saldo: saldoDe(c, u),
      naoPagos: c.m.situacaoNaoPagos[u] ?? null,
      celulas: ks.map((k) => ({ key: k, situacao: c.m.situacao[u][k] ?? "na", devido: c.m.devido[u]?.[k] ?? 0, recebido: c.m.recebido[u]?.[k] ?? 0, ajuste: ajustes.has(`${u}|${k}`) })),
    }));
}

const reais = (v: number, casas = 2) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
export const brl = (v: number) => reais(v, 2);
export const brl0 = (v: number) => reais(Math.round(v), 0);
export const pct = (v: number) => `${Number.isFinite(v) ? Math.round(v * 100) : 0}%`;
const lista = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} e ${a[a.length - 1]}`);

/** A frase de abertura, que muda com a escolha de uma, de várias ou de nenhuma unidade. */
export function fraseDeAbertura(c: ContextoRoyalties, f: FiltroRoyalties, r: ResumoPeriodo): string {
  const ks = periodo(c, f);
  const entre = `${c.rotulo[ks[0]]} e ${c.rotulo[ks[ks.length - 1]]}`;
  const qual = f.tipo === "fixa" ? " de taxa fixa" : f.tipo === "royalties" ? " de royalties" : "";
  const unidadesEmAberto = `${brl0(r.saldoTotal)} em aberto em ${r.devedoras.length} ${r.devedoras.length === 1 ? "unidade" : "unidades"}.`;
  if (f.unidades.length > 1) return `${f.unidades.length} unidades: ${brl0(r.total)}${qual} recebidos entre ${entre}. ${r.saldoTotal > 0 ? unidadesEmAberto : "Nenhum valor em aberto."}`;
  if (f.unidades.length === 1) {
    const u = f.unidades[0];
    const fim = r.saldoTotal > 0 ? `Deve ${brl0(r.saldoTotal)}.` : temSaldoCalculado(c, u) ? "Está em dia." : semCobranca(c, u) ? "Sem cobrança, sem saldo devedor." : "Royalties sem valor esperado, sem saldo calculado.";
    return `${u} pagou ${brl0(r.total)} entre ${entre}. ${fim}`;
  }
  return `${brl0(r.total)}${qual} recebidos entre ${entre}. ${r.saldoTotal > 0 ? unidadesEmAberto : "Nenhum valor em aberto."}`;
}

/** Texto curto dos componentes do saldo de uma unidade (tooltip e lista de devedoras). */
export function componentesDoSaldo(l: LinhaPendencia): string {
  return [l.saldoApuracao ? `Apuração ${brl(l.saldoApuracao)}` : "", l.dividaAnterior ? `dívida anterior/acordo ${brl(l.dividaAnterior)}` : "", l.variavel ? "royalties com valor esperado" : ""].filter(Boolean).join(" · ");
}

/** CSV das devedoras do filtro atual (separador ";" e vírgula decimal, como o Excel em português espera). */
export function csvDeDevedoras(c: ContextoRoyalties, f: FiltroRoyalties): string {
  const n = (v: number | null | undefined) => (v == null ? "" : Number(v).toFixed(2).replace(".", ","));
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const ds = devedoras(c, f);
  const linhas = [["Unidade", "Modalidade", "Saldo devedor (R$)", "Saldo da apuração (R$)", "Dívida anterior/acordo (R$)", "Meses sem pagamento"].map(q).join(";")];
  for (const d of ds) linhas.push([q(d.unidade), q(MODALIDADE[d.tipo]), n(d.saldo), n(d.linha.saldoApuracao), n(d.linha.dividaAnterior), String(c.m.situacaoNaoPagos[d.unidade] ?? "")].join(";"));
  linhas.push([q("Total"), "", n(soma(ds.map((d) => d.saldo))), "", "", ""].join(";"));
  return `﻿${linhas.join("\r\n")}`;
}

export { lista as listaEmTexto };
