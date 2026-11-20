// Royalties por unidade: série de cada unidade de royalties, as marcações de mês sem pagamento, queda forte e pico, as aberturas e o quadro
// "esperado x recebido". As regras seguem o painel original: royalties variáveis só têm saldo calculado quando a planilha informa o valor esperado.
import { type ContextoRoyalties, type FiltroRoyalties, type Modalidade, type Situacao, brl, devidoTotal, listaEmTexto, pct, periodo, recebidoDe, saldoDe, semCobranca, soma, temSaldoCalculado, unidadeNoFiltro } from "@/data/royalties";

export type TipoMarcacao = "zero" | "queda" | "pico";
export interface Marcacao { t: TipoMarcacao; esp?: number; comp?: string | null; val?: number; avg?: number; var?: number }
export type MarcacoesDaUnidade = Record<string, Marcacao>;

export const unidadesDeRoyalties = (c: ContextoRoyalties) => c.m.unidades.filter((u) => u.tipo === "royalties").map((u) => u.nome);
/** Sem valor esperado informado: mês sem depósito não é dívida, e destoar da média só ganha marcação. */
export const semEsperado = (c: ContextoRoyalties, u: string) => devidoTotal(c, u) === 0;
/** Posição do primeiro mês com recebimento (-1 se a unidade nunca recebeu). */
export const primeiroRecebimento = (c: ContextoRoyalties, u: string) => c.keys.findIndex((k) => (c.m.recebido[u]?.[k] || 0) > 0);
/** Posição do primeiro mês em que a unidade recebeu ou tinha valor esperado: daí em diante cada mês conta. */
export const inicioDeRoyalties = (c: ContextoRoyalties, u: string) => c.keys.findIndex((k) => (c.m.recebido[u]?.[k] || 0) > 0 || (c.m.devido[u]?.[k] || 0) > 0);

/** Pagamento alto logo depois de mês sem pagamento ou em queda é recuperação, não dividendo. */
const ehRecuperacao = (c: ContextoRoyalties, marcas: MarcacoesDaUnidade, i: number, inicio: number) => [1, 2, 3].some((d) => i - d >= inicio && ["zero", "queda"].includes(marcas[c.keys[i - d]]?.t));

/** Marcações de cada unidade de royalties, mês a mês, sobre a série inteira (o período do filtro só escolhe o que aparece). */
export function marcacoesDeRoyalties(c: ContextoRoyalties): Record<string, MarcacoesDaUnidade> {
  const out: Record<string, MarcacoesDaUnidade> = {};
  for (const u of unidadesDeRoyalties(c)) {
    out[u] = {};
    const v = c.keys.map((k) => c.m.recebido[u]?.[k] || 0);
    const dv = c.keys.map((k) => c.m.devido[u]?.[k] || 0);
    const inicio = inicioDeRoyalties(c, u);
    if (inicio < 0) continue;
    for (let i = inicio; i < c.keys.length; i++) {
      const anteriores = v.slice(Math.max(inicio, i - 3), i).filter((x) => x > 0);
      const media = anteriores.length ? soma(anteriores) / anteriores.length : 0;
      if (v[i] === 0) out[u][c.keys[i]] = { t: "zero", esp: dv[i], comp: v[i + 1] && media && v[i + 1] > 1.6 * media ? c.keys[i + 1] : null };
      else if (anteriores.length >= 2 && v[i] < 0.5 * media) out[u][c.keys[i]] = { t: "queda", val: v[i], avg: media, var: v[i] / media - 1 };
      else if (anteriores.length >= 2 && semEsperado(c, u) && v[i] > 1.5 * media && i - inicio >= 6 && !ehRecuperacao(c, out[u], i, inicio)) out[u][c.keys[i]] = { t: "pico", val: v[i], avg: media, var: v[i] / media - 1 };
    }
  }
  return out;
}

/** O texto curto de uma marcação (tooltip do gráfico). */
export function textoDaMarcacao(c: ContextoRoyalties, u: string, m: Marcacao): string {
  if (m.t === "zero") return "sem pagamento";
  if (m.t === "pico") return `+${pct(m.var ?? 0)} vs média, possível dividendo`;
  return `${pct(m.var ?? 0)} vs média${semEsperado(c, u) ? ", possível rateio" : ""}`;
}

/** A seção de royalties só aparece com modalidade diferente de taxa fixa e, se houver unidade escolhida, ao menos uma de royalties. */
export const mostraRoyalties = (c: ContextoRoyalties, f: FiltroRoyalties) => f.tipo !== "fixa" && (!f.unidades.length || f.unidades.some((u) => c.tipoDe[u] === "royalties"));
export const unidadesDeRoyaltiesNoFiltro = (c: ContextoRoyalties, f: FiltroRoyalties) => unidadesDeRoyalties(c).filter((u) => unidadeNoFiltro(c, f, u));

export interface PontoRoyalties { key: string; label: string; parcial: boolean; [unidade: string]: string | number | boolean | null }

/** A série para o gráfico de linhas: uma coluna por unidade, vazia antes de a unidade começar. Só entram unidades que já receberam algo. */
export function serieDeRoyalties(c: ContextoRoyalties, f: FiltroRoyalties): { pontos: PontoRoyalties[]; unidades: string[] } {
  const ks = periodo(c, f);
  const unidades = unidadesDeRoyaltiesNoFiltro(c, f).filter((u) => c.keys.some((k) => (c.m.recebido[u]?.[k] || 0) > 0));
  const pontos = ks.map((k) => {
    const p: PontoRoyalties = { key: k, label: c.rotulo[k], parcial: c.parcial.has(k) };
    for (const u of unidades) p[u] = c.keys.indexOf(k) < inicioDeRoyalties(c, u) ? null : c.m.recebido[u]?.[k] || 0;
    return p;
  });
  return { pontos, unidades };
}

export type TomMarcacao = "bad" | "peak" | "drop" | "open";
export interface ItemDeAlerta { tom: TomMarcacao; rotulo: string; unidade: string; texto: string; ordem: string }

/** A lista embaixo do gráfico: sem pagamento, queda forte ou possível rateio, possível dividendo e aberturas, do mais recente para o mais antigo. */
export function alertasDeRoyalties(c: ContextoRoyalties, f: FiltroRoyalties): ItemDeAlerta[] {
  const ks = periodo(c, f);
  const marcas = marcacoesDeRoyalties(c);
  const itens: ItemDeAlerta[] = [];
  for (const u of unidadesDeRoyaltiesNoFiltro(c, f)) {
    const total = recebidoDe(c, u, c.keys);
    if (total === 0) {
      itens.push({ tom: "bad", rotulo: "Sem recebimento", unidade: u, texto: `nenhum pagamento desde o início${devidoTotal(c, u) ? `, ${brl(devidoTotal(c, u))} esperados` : ""}`, ordem: "9999" });
      continue;
    }
    for (const k of ks) {
      const m = marcas[u][k];
      if (!m) continue;
      const parcial = c.parcial.has(k) ? " (mês parcial)" : "";
      if (m.t === "zero") itens.push({ tom: "bad", rotulo: "Sem pagamento", unidade: u, texto: `${c.rotulo[k]}${m.esp ? `, esperado ${brl(m.esp)}` : ""}${m.comp ? `. Compensado em ${c.rotulo[m.comp]} com valor dobrado` : ""}`, ordem: k });
      else if (m.t === "pico") itens.push({ tom: "peak", rotulo: "Possível dividendo", unidade: u, texto: `${c.rotulo[k]}: ${brl(m.val ?? 0)}, ${pct(m.var ?? 0)} acima da média de ${brl(m.avg ?? 0)}${parcial}`, ordem: k });
      else itens.push({ tom: "drop", rotulo: semEsperado(c, u) ? "Possível rateio" : "Queda forte", unidade: u, texto: `${c.rotulo[k]}: ${brl(m.val ?? 0)}, ${pct(-(m.var ?? 0))} abaixo da média de ${brl(m.avg ?? 0)}${parcial}`, ordem: k });
    }
    const p = primeiroRecebimento(c, u);
    if (p > 0 && ks.includes(c.keys[p])) {
      const abertura = c.m.aberturas?.[u];
      itens.push({ tom: "open", rotulo: "Abertura", unidade: u, texto: `primeiro royalty em ${c.rotulo[c.keys[p]]}: ${brl(c.m.recebido[u][c.keys[p]])}${abertura ? ` (unidade ${abertura})` : ""}`, ordem: c.keys[p] });
    }
  }
  return itens.sort((a, b) => (a.ordem < b.ordem ? 1 : a.ordem > b.ordem ? -1 : 0));
}

/** O texto de ajuda do gráfico; cita as unidades sem valor esperado, onde queda e pico viram "possível rateio" e "possível dividendo". */
export function descricaoDeRoyalties(c: ContextoRoyalties, f: FiltroRoyalties): string {
  const sem = unidadesDeRoyaltiesNoFiltro(c, f).filter((u) => semEsperado(c, u));
  return "Círculos vazados marcam mês sem pagamento ou queda abaixo de metade da média dos 3 meses anteriores. O losango marca o primeiro royalty de uma unidade que abriu depois do início da série." +
    (sem.length ? ` Em ${listaEmTexto(sem)}, abaixo de 50% da média é possível rateio e acima de 150%, possível dividendo.` : "");
}

export interface LinhaEsperado { key: string; label: string; parcial: boolean; esperado: number; recebido: number }
export interface QuadroEsperado { unidade: string; saldo: number; meses: LinhaEsperado[]; recebidoNoPeriodo: number; esperadoInformado: number; recebidoNosMeses: number }

/** Esperado x recebido: só as unidades com valor esperado informado; conta apenas os meses a partir do início da cobrança. */
export function quadrosDeEsperado(c: ContextoRoyalties, f: FiltroRoyalties): { quadros: QuadroEsperado[]; maximo: number } {
  const ks = periodo(c, f);
  const unidades = unidadesDeRoyaltiesNoFiltro(c, f).filter((u) => devidoTotal(c, u) > 0);
  const quadros = unidades.map((u) => {
    const inicio = inicioDeRoyalties(c, u);
    const meses = ks.filter((k) => c.keys.indexOf(k) >= inicio).map((k) => ({ key: k, label: c.rotulo[k], parcial: c.parcial.has(k), esperado: c.m.devido[u]?.[k] || 0, recebido: c.m.recebido[u]?.[k] || 0 }));
    return {
      unidade: u,
      saldo: saldoDe(c, u),
      meses,
      recebidoNoPeriodo: soma(meses.map((m) => m.recebido)),
      esperadoInformado: soma(meses.map((m) => m.esperado)),
      recebidoNosMeses: soma(meses.filter((m) => m.esperado).map((m) => m.recebido)),
    };
  });
  return { quadros, maximo: Math.max(1, ...quadros.flatMap((q) => q.meses.flatMap((m) => [m.esperado, m.recebido]))) };
}

export interface DetalheDaUnidade {
  unidade: string;
  tipo: Modalidade;
  /** Mostra "Sem cobrança" / "Não calculado" em vez de um valor quando não há saldo calculado. */
  saldo: number;
  saldoTexto: string;
  semCobranca: boolean;
  progresso: { percentual: number; texto: string } | null;
  fatos: [string, string][];
  mesesSemRecebimento: string[];
  naoPagos: number | null;
  meses: { key: string; label: string; recebido: number; situacao: Situacao | null }[];
  maiorRecebido: number;
  obs: string;
}

const dataBR = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

/** O painel de uma unidade: o que a planilha diz dela, com os dados que mudam conforme seja sem cobrança, de taxa fixa ou de royalties. */
export function detalheDaUnidade(c: ContextoRoyalties, u: string): DetalheDaUnidade | null {
  const tipo = c.tipoDe[u];
  if (!tipo) return null;
  const p = c.pend[u];
  const fixa = tipo === "fixa";
  const saldo = saldoDe(c, u);
  const recebidoTotal = recebidoDe(c, u, c.keys);
  const devido = fixa ? p?.devido || 0 : devidoTotal(c, u);
  const ultimo = dataBR(c.m.ultimoPagamento?.[u]);
  const sem = semCobranca(c, u);
  const primeiro = c.keys.find((k) => (c.m.recebido[u]?.[k] || 0) > 0);
  const inicioRoy = inicioDeRoyalties(c, u);
  const calculado = temSaldoCalculado(c, u);
  const apuracao = c.m.pendencias.apuracao;

  const fatos: [string, string][] = sem
    ? [["Total recebido", brl(recebidoTotal)], ["Primeiro pagamento", primeiro ? c.rotulo[primeiro] : "Nenhum"], ["Último pagamento", ultimo || "Nenhum"], ["Cobrança", "Sem cobrança"]]
    : fixa
      ? [
        ["Valor mensal", brl(p?.valorMensal ?? 0)], ["Início da cobrança", (p?.inicio && c.rotulo[p.inicio]) || p?.inicio || "—"], ["Vencimento", p?.vencimento ? `Dia ${p.vencimento}` : "—"], ["Último pagamento", ultimo || "Nenhum"],
        ["Total devido", brl(p?.devido ?? 0)], ["Total recebido", brl(recebidoTotal)], ["Saldo da apuração", brl(p?.saldoApuracao ?? 0)], ["Dívida anterior ou acordo", brl(p?.dividaAnterior ?? 0)],
      ]
      : [
        ["Valor mensal", "Variável"], ["Início", inicioRoy >= 0 ? c.rotulo[c.keys[inicioRoy]] : "—"], ["Total recebido", brl(recebidoTotal)], ["Último pagamento", ultimo || "Nenhum"],
        ["Esperado informado", devido ? brl(devido) : "Não informado"], ["Saldo devedor", calculado ? brl(saldo) : "Não calculado"],
      ];

  const quitada = fixa && recebidoTotal >= devido && !!p?.dividaAnterior;
  const progresso = devido
    ? {
      percentual: Math.min(100, (recebidoTotal / devido) * 100),
      texto: `Recebido ${brl(recebidoTotal)} de ${brl(devido)} devidos${fixa ? ` até ${(apuracao && c.rotulo[apuracao]) || apuracao}` : " (esperado informado)"}.${quitada ? " As mensalidades estão quitadas; o saldo é de dívida anterior ou acordo." : ""}`,
    }
    : null;
  const situacao = c.m.situacao[u];
  const meses = c.keys.map((k) => ({ key: k, label: c.rotulo[k], recebido: c.m.recebido[u]?.[k] || 0, situacao: situacao ? situacao[k] ?? "na" : null }));
  const mesesSemRecebimento = (p?.mesesSemRecebimento ?? []).map((k) => c.rotulo[k] || k);
  return {
    unidade: u, tipo, saldo, semCobranca: sem,
    saldoTexto: calculado ? brl(saldo) : sem ? "Sem cobrança" : "Não calculado",
    progresso, fatos, mesesSemRecebimento, naoPagos: c.m.situacaoNaoPagos[u] ?? null, meses,
    maiorRecebido: Math.max(1, ...meses.map((m) => m.recebido)), obs: p?.obs ?? "",
  };
}
