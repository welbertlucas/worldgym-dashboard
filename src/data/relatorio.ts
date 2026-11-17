// Relatórios: monta o MODELO da apresentação (o que vai em cada slide) a partir dos meses que o painel já leu.
// Nada de leitura nova no EVO: só os totais mensais que o Atlas já guarda (nunca dado de aluno). O desenho dos slides fica em src/lib/relatorioPptx.ts.
import type { MonthData, UnitData } from "@/data/dashboardData";
import { META_INDICATORS, type Meta, type MetaKey } from "@/data/metas";

export type Formato = "brl" | "brl2" | "int" | "pct" | "nota";

export interface DefRanking {
  id: string;
  rotulo: string;
  /** Título do slide. */
  titulo: string;
  campo: (u: UnitData) => number | null | undefined;
  formato: Formato;
  /** Compara com o mesmo mês do ano anterior (variação %) em vez do valor do mês. */
  crescimento?: boolean;
  /** Valor zero significa "sem dado" (notas), e não resultado. */
  zeroEhVazio?: boolean;
  /** Cair é bom (inadimplência, churn): a cor da variação se inverte. */
  menorMelhor?: boolean;
}

/** Indicadores de ranking por unidade que o menu oferece. A ordem é a dos slides. */
export const RANKINGS: DefRanking[] = [
  { id: "fat", rotulo: "Faturamento", titulo: "Faturamento", campo: (u) => u.faturamento, formato: "brl" },
  { id: "cresc", rotulo: "Crescimento do faturamento (contra o ano anterior)", titulo: "Crescimento faturamento*", campo: (u) => u.faturamento, formato: "pct", crescimento: true },
  { id: "nc", rotulo: "Novos contratos", titulo: "Novos contratos", campo: (u) => u.novosContratos, formato: "int" },
  { id: "tk", rotulo: "Ticket médio", titulo: "Ticket médio", campo: (u) => u.ticketMedio, formato: "brl2" },
  { id: "ad", rotulo: "Adimplentes", titulo: "Adimplentes", campo: (u) => u.adimplentes, formato: "int" },
  { id: "inad", rotulo: "Inadimplência (%)", titulo: "Inadimplência", campo: (u) => u.inadimplenciaPerc, formato: "pct", menorMelhor: true },
  { id: "churn", rotulo: "Churn (%)", titulo: "Churn", campo: (u) => u.churn, formato: "pct", menorMelhor: true },
  { id: "vo", rotulo: "Vendas online", titulo: "Vendas online", campo: (u) => u.vendasOnline, formato: "brl" },
  { id: "op", rotulo: "Oportunidades cadastradas", titulo: "Oportunidades", campo: (u) => u.oportunidades, formato: "int" },
  { id: "di", rotulo: "Diárias", titulo: "Diárias", campo: (u) => u.diarias, formato: "int" },
  { id: "pers", rotulo: "Personal", titulo: "Personal", campo: (u) => u.personal, formato: "int" },
  { id: "cam", rotulo: "Camisetas", titulo: "Camisetas", campo: (u) => u.camisetas, formato: "int" },
  { id: "coq", rotulo: "Coqueteleiras", titulo: "Coqueteleiras", campo: (u) => u.coqueteleiras, formato: "int" },
  { id: "nps", rotulo: "NPS", titulo: "NPS", campo: (u) => u.nps, formato: "int", zeroEhVazio: true },
  { id: "google", rotulo: "Nota no Google", titulo: "Nota no Google", campo: (u) => u.notaGoogle, formato: "nota", zeroEhVazio: true },
  { id: "ra", rotulo: "Nota no Reclame Aqui", titulo: "Nota no Reclame Aqui", campo: (u) => u.reclameAqui, formato: "nota", zeroEhVazio: true },
];

/** Indicadores do relatório que têm meta na planilha (aba Metas). */
const META_DO_INDICADOR: Record<string, MetaKey> = { fat: "faturamento", nc: "novosContratos", inad: "inadimplenciaPerc", churn: "churn", vo: "vendasOnline" };

/** Id do slide dos números gerais da rede (ou das unidades escolhidas). */
export const ID_BIG = "big";

export const TODOS_OS_INDICADORES = [ID_BIG, ...RANKINGS.map((r) => r.id)];
/** O que já vem marcado ao abrir o menu: o miolo do Report Operacional. */
export const INDICADORES_PADRAO = [ID_BIG, "fat", "cresc", "nc", "tk"];

export interface BigNumero {
  nome: string;
  valor: string;
  /** Variação contra o ano anterior (%, ou pontos percentuais quando `emPontos`); null sem base. */
  variacao: number | null;
  emPontos?: boolean;
  /** Em indicador em que cair é bom (inadimplência). */
  menorMelhor?: boolean;
  anterior: string | null;
}

/** Slide de uma unidade só: valor em destaque, variação e o valor do ano anterior (no lugar da barra única). */
export interface Cartao {
  valor: string;
  variacao: number | null;
  emPontos?: boolean;
  menorMelhor?: boolean;
  anterior: string | null;
  /** Barra de progresso da meta do mês (só relatório de mês fechado): quanto do nível mais alto já foi atingido. */
  meta?: { pct: number; texto: string };
  /** Evolução dos últimos períodos (até 6) para o gráfico de colunas: o último é o do relatório. */
  serie?: SerieEvolucao;
}

export interface SerieEvolucao {
  rotulos: string[];
  valores: number[];
  /** Posição da coluna do relatório (a última). */
  destaque: number;
  /** Posição da coluna usada na comparação (ex.: a mesma semana do mês anterior), se estiver no gráfico. */
  comparada?: number;
  /** Linha de meta (nível mais alto cadastrado), só no relatório de mês. */
  metaLinha?: { valor: number; rotulo: string };
  /** Período em andamento: a última coluna ainda não fechou. */
  parcial?: boolean;
}

/** Número de períodos no gráfico de evolução. */
export const PERIODOS_NA_EVOLUCAO = 6;

export interface SlideRanking {
  id: string;
  titulo: string;
  subtitulo: string;
  formato: Formato;
  /** Nome e valor, na ordem da leitura (maior primeiro). */
  itens: [string, number][];
  nota?: string;
  /** Texto extra por unidade ao lado do nome no gráfico (ex.: "4 de 12"): todo percentual leva a base. */
  bases?: Record<string, string>;
  /** Quando o relatório é de uma unidade só, o slide vira um cartão de destaque (itens fica vazio). */
  cartao?: Cartao;
}

export interface ModeloRelatorio {
  mes: string;
  /** "OUT/2026". */
  mesCurto: string;
  /** "1-31 out/26": o período escolhido, como vai na capa. */
  periodo: string;
  /** "out/2025", ou null se o ano anterior não está guardado. */
  mesAnteriorCurto: string | null;
  escopo: string;
  nUnidades: number;
  big: BigNumero[] | null;
  conversao: number | null;
  /** Oportunidades cadastradas e as que viraram venda, para a rosca de conversão. */
  oportunidades: number | null;
  convertidas: number | null;
  rankings: SlideRanking[];
  /** Mês fechado (padrão) ou uma semana do mês. */
  tipo?: "mes" | "semana";
  /** Semana em andamento: "dados até DD/MM". */
  parcialAte?: string | null;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesCurto = (m: string) => { const [y, n] = m.split("-"); return `${MESES[Number(n) - 1]?.toUpperCase()}/${y}`; };
const mesCurtoMin = (m: string) => { const [y, n] = m.split("-"); return `${MESES[Number(n) - 1]}/${y}`; };
/** Período como aparece na capa: "1-30 nov/26" (o mês inteiro, por enquanto). */
export const rotuloDoPeriodo = (m: string) => { const [y, n] = m.split("-").map(Number); return `1-${new Date(y, n, 0).getDate()} ${MESES[n - 1]}/${String(y).slice(2)}`; };
export const mesDoAnoAnterior = (m: string) => { const [y, n] = m.split("-"); return `${Number(y) - 1}-${n}`; };

/** Meses fechados que o painel tem (um relatório de mês em andamento mostraria números parciais). */
export const mesesParaRelatorio = (meses: string[], hoje = new Date()) => {
  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  return meses.filter((m) => m < atual).sort().reverse();
};

const fmtValor = (f: Formato, n: number) =>
  f === "brl" ? "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
  : f === "brl2" ? "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : f === "pct" ? n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
  : f === "nota" ? n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  : Math.round(n).toLocaleString("pt-BR");

/**
 * Progresso da meta do mês de uma unidade (nível mais alto cadastrado). Quando mais é melhor: "62% da meta ouro · R$ 500.000" e a barra enche.
 * Quando menos é melhor (inadimplência, churn): só diz se a meta foi atingida, sem barra.
 */
export function progressoDaMeta(metas: Meta[], mes: string, unidade: string, id: string, valor: number, formato: Formato): { pct: number; texto: string } | undefined {
  const chave = META_DO_INDICADOR[id];
  const m = chave ? metas.find((x) => x.month === mes && x.unit === unidade && x.key === chave) : undefined;
  const nivel = m ? (m.ouro !== undefined ? "ouro" : m.prata !== undefined ? "prata" : m.bronze !== undefined ? "bronze" : null) : null;
  const alvo = m && nivel ? m[nivel] : undefined;
  if (!m || !nivel || typeof alvo !== "number" || !(alvo > 0)) return undefined;
  const fmtAlvo = fmtValor(formato, alvo);
  if (META_INDICATORS[chave!].lowerIsBetter) {
    const ok = valor <= alvo;
    return { pct: ok ? 100 : 0, texto: `Meta ${nivel}: ${fmtAlvo} · ${ok ? "atingida" : "não atingida"}` };
  }
  const pct = (valor / alvo) * 100;
  return { pct, texto: `${Math.round(pct).toLocaleString("pt-BR")}% da meta ${nivel} · ${fmtAlvo}` };
}

/** Põe na série a linha da meta do mês (nível mais alto cadastrado), se houver. */
function serieComMeta(s: SerieEvolucao | undefined, metas: Meta[], mes: string, unidade: string, id: string, formato: Formato): SerieEvolucao | undefined {
  if (!s) return s;
  const chave = META_DO_INDICADOR[id];
  const m = chave ? metas.find((x) => x.month === mes && x.unit === unidade && x.key === chave) : undefined;
  const nivel = m ? (m.ouro !== undefined ? "ouro" : m.prata !== undefined ? "prata" : m.bronze !== undefined ? "bronze" : null) : null;
  const alvo = m && nivel ? m[nivel] : undefined;
  return typeof alvo === "number" && alvo > 0 ? { ...s, metaLinha: { valor: alvo, rotulo: `Meta ${nivel}: ${fmtValor(formato, alvo)}` } } : s;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string) => { const [y, n] = m.split("-"); return `${MESES_CURTOS[Number(n) - 1]}/${y.slice(2)}`; };
/** Indicadores em que mês antigo sem o dado guardado vem como 0 (não é resultado): zero é "sem dado". */
const ZERO_E_VAZIO = new Set(["tk", "inad", "churn", "ad", "nps", "google", "ra"]);

/** Valores dos últimos meses (até `n`, terminando em `mes`) de uma unidade num indicador; mês sem dado fica de fora. */
export function serieMensal(meses: MonthData[], mes: string, unidade: string, def: DefRanking, n = PERIODOS_NA_EVOLUCAO): SerieEvolucao | undefined {
  const ate = meses.filter((m) => m.month <= mes).sort((a, b) => a.month.localeCompare(b.month));
  const pontos: { mes: string; v: number }[] = [];
  for (const m of ate) {
    const u = m.units.find((x) => x.name === unidade);
    const v = u ? def.campo(u) : undefined;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if ((def.zeroEhVazio || ZERO_E_VAZIO.has(def.id)) && v <= 0) continue;
    pontos.push({ mes: m.month, v });
  }
  const ult = pontos.slice(-n);
  if (ult.length < 2 || ult[ult.length - 1].mes !== mes) return undefined; // sem pelo menos dois períodos (o do relatório entre eles) não há evolução
  const casas = def.formato === "brl2" || def.formato === "nota" || def.formato === "pct" ? 100 : 1;
  return { rotulos: ult.map((p) => rotuloMes(p.mes)), valores: ult.map((p) => Math.round(p.v * casas) / casas), destaque: ult.length - 1 };
}

const soma = (l: UnitData[], f: (u: UnitData) => number) => l.reduce((s, u) => s + (Number.isFinite(f(u)) ? f(u) : 0), 0);
const variacao = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

function numerosGerais(atual: UnitData[], ant: UnitData[] | null): { big: BigNumero[]; conversao: number | null; oportunidades: number | null; convertidas: number | null } {
  const tem = !!ant?.length;
  const fmtBrl = (n: number) => "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const fmtBrl2 = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
  const fmtPct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  const taxaInad = (l: UnitData[]) => { const a = soma(l, (u) => u.adimplentes), i = soma(l, (u) => u.inadimplentes); return a + i > 0 ? (i / (a + i)) * 100 : 0; };
  // Ticket médio da rede = média simples das unidades (como no resto do Atlas).
  const ticket = (l: UnitData[]) => (l.length ? soma(l, (u) => u.ticketMedio) / l.length : 0);
  const comp = (f: (u: UnitData) => number, fmt: (n: number) => string, nome: string): BigNumero => {
    const a = soma(atual, f), b = tem ? soma(ant!, f) : 0;
    return { nome, valor: fmt(a), variacao: tem ? variacao(a, b) : null, anterior: tem && b > 0 ? fmt(b) : null };
  };
  const big: BigNumero[] = [
    comp((u) => u.faturamento, fmtBrl, "Faturamento"),
    comp((u) => u.adimplentes, fmtInt, "Adimplentes"),
    comp((u) => u.novosContratos, fmtInt, "Novos contratos"),
    { nome: "Ticket médio", valor: fmtBrl2(ticket(atual)), variacao: tem && ticket(ant!) > 0 ? variacao(ticket(atual), ticket(ant!)) : null, anterior: tem && ticket(ant!) > 0 ? fmtBrl2(ticket(ant!)) : null },
    { nome: "Inadimplentes", valor: fmtPct(taxaInad(atual)), variacao: tem ? taxaInad(atual) - taxaInad(ant!) : null, emPontos: true, menorMelhor: true, anterior: tem ? fmtPct(taxaInad(ant!)) : null },
    comp((u) => u.vendasOnline, fmtBrl, "Vendas online"),
  ];
  const op = soma(atual, (u) => u.oportunidades), cv = soma(atual, (u) => u.conversoes);
  return { big, conversao: op > 0 ? Math.min(100, (cv / op) * 100) : null, oportunidades: op > 0 ? op : null, convertidas: op > 0 ? Math.min(cv, op) : null };
}

/**
 * Monta o relatório de um mês fechado. `unidades` = quais entram (null = todas as que a pessoa enxerga). `meses` = o que o painel tem
 * (já filtrado pelo servidor para o nível de acesso da pessoa).
 */
export function montarRelatorio(meses: MonthData[], mes: string, selecionados: string[], unidades: string[] | null, metas: Meta[] = []): ModeloRelatorio | null {
  const m = meses.find((x) => x.month === mes);
  if (!m) return null;
  const noEscopo = (l: UnitData[]) => (unidades ? l.filter((u) => unidades.includes(u.name)) : l);
  const atual = noEscopo(m.units);
  if (!atual.length) return null;
  const mAnt = meses.find((x) => x.month === mesDoAnoAnterior(mes));
  const ant = mAnt ? noEscopo(mAnt.units) : null;
  const porNomeAnt = new Map((ant ?? []).map((u) => [u.name, u]));
  const antCurto = mAnt ? mesCurtoMin(mAnt.month) : null;
  const escolheu = new Set(selecionados);

  const rankings: SlideRanking[] = [];
  const umaSo = atual.length === 1 ? atual[0] : null;
  for (const def of RANKINGS) {
    if (!escolheu.has(def.id)) continue;
    if (umaSo) {
      // Uma unidade só: não há ranking, então o slide é um cartão com o valor, a variação e o ano anterior.
      const antU = porNomeAnt.get(umaSo.name);
      if (def.crescimento) {
        const b = antU?.faturamento ?? 0;
        if (!ant || b <= 0) continue;
        const v = ((umaSo.faturamento - b) / b) * 100;
        rankings.push({ id: def.id, titulo: def.titulo.replace("*", ""), subtitulo: `comparado com ${antCurto}`, formato: def.formato, itens: [], cartao: { valor: (v >= 0 ? "+" : "") + v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%", variacao: null, anterior: `${fmtValor("brl", b)} em ${antCurto} → ${fmtValor("brl", umaSo.faturamento)}` } });
        continue;
      }
      const v = def.campo(umaSo);
      if (typeof v !== "number" || !Number.isFinite(v) || (def.zeroEhVazio && v <= 0)) continue;
      const b = antU ? def.campo(antU) : null;
      // mês antigo sem o campo guardado vem como 0: sem base, não compara
      const temBase = typeof b === "number" && Number.isFinite(b) && b > 0;
      const emPontos = def.formato === "pct";
      const variacaoCartao = !temBase ? null : emPontos ? v - (b as number) : (b as number) > 0 ? ((v - (b as number)) / (b as number)) * 100 : null;
      rankings.push({ id: def.id, titulo: def.titulo, subtitulo: `apenas em ${mesCurto(mes)}`, formato: def.formato, itens: [], cartao: { valor: fmtValor(def.formato, v), variacao: variacaoCartao, emPontos, menorMelhor: def.menorMelhor, anterior: temBase && antCurto ? `${fmtValor(def.formato, b as number)}  ·  ${antCurto}` : null, meta: progressoDaMeta(metas, mes, umaSo.name, def.id, v, def.formato), serie: serieComMeta(serieMensal(meses, mes, umaSo.name, def), metas, mes, umaSo.name, def.id, def.formato) } });
      continue;
    }
    let itens: [string, number][] = [];
    let nota: string | undefined;
    if (def.crescimento) {
      if (!ant) continue; // sem o ano anterior guardado não há comparação
      const sem: string[] = [];
      for (const u of atual) {
        const b = porNomeAnt.get(u.name)?.faturamento ?? 0;
        if (b > 0) itens.push([u.name, Math.round(((u.faturamento - b) / b) * 10000) / 100]); else sem.push(u.name);
      }
      if (sem.length) nota = `*Unidades sem base de comparação em ${antCurto}:\n${sem.join("\n")}`;
    } else {
      for (const u of atual) {
        const v = def.campo(u);
        if (typeof v !== "number" || !Number.isFinite(v) || (def.zeroEhVazio && v <= 0)) continue;
        itens.push([u.name, def.formato === "brl2" || def.formato === "nota" || def.formato === "pct" ? Math.round(v * 100) / 100 : Math.round(v)]);
      }
    }
    itens = itens.sort((a, b) => b[1] - a[1]);
    if (!itens.length) continue;
    rankings.push({ id: def.id, titulo: def.titulo, subtitulo: def.crescimento ? `comparado com ${antCurto}` : `apenas em ${mesCurto(mes)}`, formato: def.formato, itens, nota });
  }

  const geral = escolheu.has(ID_BIG) ? numerosGerais(atual, ant) : null;
  const escopo = !unidades ? "Rede" : atual.length === 1 ? atual[0].name : unidades.length >= m.units.length ? "Rede" : `${atual.length} unidades`;
  return { mes, mesCurto: mesCurto(mes), periodo: rotuloDoPeriodo(mes), mesAnteriorCurto: antCurto, escopo, nUnidades: atual.length, big: geral?.big ?? null, conversao: geral?.conversao ?? null, oportunidades: geral?.oportunidades ?? null, convertidas: geral?.convertidas ?? null, rankings };
}

/** O que o menu mostra de cada slide, antes de gerar. */
export function resumoDosSlides(modelo: ModeloRelatorio): string[] {
  return ["Capa", ...(modelo.big ? ["Números gerais"] : []), ...modelo.rankings.map((r) => r.titulo.replace("*", "")), "Encerramento"];
}
