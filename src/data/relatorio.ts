// Relatórios: monta o MODELO da apresentação (o que vai em cada slide) a partir dos meses que o painel já leu.
// Nada de leitura nova no EVO: só os totais mensais que o Atlas já guarda (nunca dado de aluno). O desenho dos slides fica em src/lib/relatorioPptx.ts.
import { evoAtualizadoEm, somarMotivos, somarRecusa, type MonthData, type UnitData } from "@/data/dashboardData";
import { paginasDoPlano, type PlanoDaUnidade } from "@/data/relatorioPlano";
import { npsDoPonto, rankingDePontos, somarPontos } from "@/data/npsPontos";
import { META_INDICATORS, actualFor, attainment, formatMetaValue, getMeta, highestTier, tierReached, type Meta, type MetaKey } from "@/data/metas";

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
  { id: "cv", rotulo: "Contratos vendidos (como no Gerencial do EVO)", titulo: "Contratos vendidos", campo: (u) => u.vendasContratos, formato: "int" },
  { id: "tk", rotulo: "Ticket médio", titulo: "Ticket médio", campo: (u) => u.ticketMedio, formato: "brl2" },
  { id: "ad", rotulo: "Adimplentes", titulo: "Adimplentes", campo: (u) => u.adimplentes, formato: "int" },
  { id: "inad", rotulo: "Inadimplência (%), com os principais motivos de recusa", titulo: "Inadimplência", campo: (u) => u.inadimplenciaPerc, formato: "pct", menorMelhor: true },
  { id: "churn", rotulo: "Churn (%), com os motivos dos cancelamentos", titulo: "Churn", campo: (u) => u.churn, formato: "pct", menorMelhor: true },
  { id: "canc", rotulo: "Cancelamentos (alunos), com os motivos", titulo: "Cancelamentos", campo: (u) => u.cancelados, formato: "int", menorMelhor: true },
  { id: "vo", rotulo: "Vendas online", titulo: "Vendas online", campo: (u) => u.vendasOnline, formato: "brl" },
  { id: "op", rotulo: "Visitantes", titulo: "Visitantes", campo: (u) => u.visitantes ?? u.oportunidades, formato: "int" },
];

/** Renovação (%) por unidade: entra logo depois do churn. */
const RENOVACAO: DefRanking = { id: "ren", rotulo: "Renovação (%)", titulo: "Renovação", campo: (u) => u.renovacoes, formato: "pct", zeroEhVazio: true };
RANKINGS.splice(RANKINGS.findIndex((d) => d.id === "canc") + 1, 0, RENOVACAO);

/** Indicadores do relatório que têm meta na planilha (aba Metas). */
const META_DO_INDICADOR: Record<string, MetaKey> = { fat: "faturamento", nc: "novosContratos", inad: "inadimplenciaPerc", churn: "churn", vo: "vendasOnline" };

/** Slide "Plano de ação da unidade" (uma unidade só): os itens em aberto do plano do mês em andamento. */
export const ID_PLANO = "plano";

/** Id do slide dos números gerais da rede (ou das unidades escolhidas). */
export const ID_BIG = "big";

/** Slide "Frequência dos alunos": mapa de calor das entradas do período e o último check-in dos alunos ativos. */
export const ID_FREQ = "freq";

/** Slide "Receitas complementares": diárias, personal, brinquedoteca, WG Plus, Pro+, camisetas e coqueteleiras num slide só. */
export const ID_COMPL = "compl";

/** Slide "Satisfação": NPS, nota no Google e nota no Reclame Aqui num slide só. */
export const ID_SATISF = "satisf";

/** Aviso que acompanha todo número de recebimento nos relatórios: o EVO soma o que entrou no período, inclusive títulos vencidos de meses anteriores pagos agora. */
export const NOTA_RECEBIMENTO = "Pagamentos dos clientes = o que foi pago no período, como no EVO. Inclui títulos vencidos de meses anteriores que foram pagos agora (saldo devedor recuperado), por isso pode passar do faturamento.";

/** Slide "Metas do mês": cada meta da planilha, o resultado e o nível atingido (só relatório de mês fechado). */
export const ID_METAS = "metas";

export const TODOS_OS_INDICADORES = [ID_BIG, ...RANKINGS.map((r) => r.id), ID_SATISF, ID_METAS, ID_COMPL, ID_FREQ];
/** O que já vem marcado ao abrir o menu: o miolo do Report Operacional. */
export const INDICADORES_PADRAO = [ID_BIG, "fat", "cresc", "nc", "cv", "tk", ID_PLANO];

/** "dos quais 8 são especiais": o total de contratos vendidos inclui os contratos especiais. */
export const notaContratosEspeciais = (n: number) => (n > 0 ? `dos quais ${n.toLocaleString("pt-BR")} ${n === 1 ? "é especial" : "são especiais"}` : undefined);

export interface BigNumero {
  nome: string;
  valor: string;
  /** Variação contra o ano anterior (%, ou pontos percentuais quando `emPontos`); null sem base. */
  variacao: number | null;
  emPontos?: boolean;
  /** Em indicador em que cair é bom (inadimplência). */
  menorMelhor?: boolean;
  anterior: string | null;
  /** Relatório de mês fechado: a segunda comparação, com o MÊS ANTERIOR (a primeira é com o mesmo mês do ano anterior, quando a unidade existia). */
  variacaoMes?: number | null;
  anteriorMes?: string | null;
  /** Linha pequena embaixo do nome (ex.: contratos especiais dentro do total de contratos vendidos). */
  nota?: string;
}

/** Slide de uma unidade só: valor em destaque, variação e o valor do ano anterior (no lugar da barra única). */
export interface Cartao {
  valor: string;
  variacao: number | null;
  emPontos?: boolean;
  menorMelhor?: boolean;
  anterior: string | null;
  /** Relatório de mês fechado: comparação com o mês anterior (a de cima é com o mesmo mês do ano anterior). */
  variacaoMes?: number | null;
  anteriorMes?: string | null;
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
  /** Semanal: quais colunas são do mês do relatório (as outras são do mês anterior e saem em cinza). */
  noMes?: boolean[];
}

/** Número de períodos no gráfico de evolução. */
export const PERIODOS_NA_EVOLUCAO = 6;

/** Slide logo depois do ranking: os motivos (de cancelamento ou de recusa do cartão) em ordem, com quanto cada um pesa. */
export interface SlideMotivos {
  titulo: string;
  subtitulo: string;
  /** Motivo e quantidade, do maior para o menor (os 8 maiores; o resto soma em "Outros"). */
  itens: [string, number][];
  total: number;
  nota?: string;
}

/** Entradas na catraca por dia da semana × hora e o último check-in dos alunos ativos. */
export interface SlideFrequencia {
  /** "1-31 out/26" ou "mês até 20/11". */
  periodo: string;
  /** 7 × 24, domingo primeiro. */
  calor: number[];
  entradas: number;
  frequentadores: number;
  /** Alunos ativos por faixa do último acesso: só existe a foto de hoje (a leitura mais recente do EVO). */
  ultimoCheckin: { rotulos: string[]; valores: number[]; total: number; posicao: string } | null;
}

/** Todas as receitas complementares num slide só, com uma legenda do que são. */
export interface SlideComplementares {
  periodo: string;
  total: number;
  /** Quanto as complementares pesam no faturamento (%), ou null sem faturamento. */
  participacao: number | null;
  /** Variação do total contra o período de comparação (%), e o valor de lá. */
  variacao: number | null;
  anterior: string | null;
  /** Cada receita e o valor, da maior para a menor (só as que tiveram valor). */
  itens: [string, number][];
  legenda: string;
}

/** NPS, Google e Reclame Aqui num slide: a nota de cada um (média das unidades com nota), a variação e quem está em cima e embaixo. */
export interface NotaSatisfacao {
  /** Relatório semanal: "no mês até aqui: NPS 62 (210 respostas)". */
  acumulado?: string;
  nome: string;
  valor: string;
  /** Diferença em pontos contra o ano anterior, ou null sem base. */
  variacao: number | null;
  casas: number;
  anterior: string | null;
  /** "12 de 23 unidades com nota". */
  base: string;
  /** Maiores e menores notas (só com mais de uma unidade): nome e nota já formatada. */
  topo: [string, string][];
  fundo: [string, string][];
}
/** NPS de um ponto de contato (Recepção, Limpeza...) no slide de Satisfação, com o NPS da rede nesse ponto como referência. */
export interface PontoDoSlide { nome: string; nps: number | null; resp: number; det: number; rede: number | null }
/** Relatório semanal: o slide único de Satisfação (NPS do mês até aqui, promotores e detratores da semana e as barras dos pontos de contato). */
export interface SatisfacaoSemanal {
  /** NPS do mês até aqui ("62"), ou null sem respostas. */
  nps: string | null;
  /** "1-21 nov/26" e "21/11" (os dados do WeHelp vão até esse dia). */
  periodoAteAgora: string;
  ateData: string;
  /** "15-21 nov/26". */
  semana: string;
  promotores: number;
  detratores: number;
}
export interface SlideSatisfacao {
  /** Só no relatório semanal: tudo em um slide. */
  semanal?: SatisfacaoSemanal;
  periodo: string;
  notas: NotaSatisfacao[];
  /** NPS por ponto de contato, do melhor para o pior (slide seguinte). */
  pontos?: PontoDoSlide[];
  /** Mostra a rede ao lado (só quando o relatório não é da rede toda). */
  comparaRede?: boolean;
}

/** Metas do mês: o resultado de cada indicador com meta cadastrada e o nível atingido. */
export interface LinhaMeta {
  nome: string;
  resultado: string;
  /** "ouro: R$ 7.000.000" (o nível mais alto cadastrado); null quando o escopo são várias unidades. */
  meta: string | null;
  nivel: "ouro" | "prata" | "bronze" | "abaixo" | null;
  /** Quanto da meta mais alta foi atingido (0 a 100+); null sem base. */
  pct: number | null;
}
export interface SlideMetas { periodo: string; linhas: LinhaMeta[]; escopoTexto: string }

export interface SlideRanking {
  id: string;
  /** Relatório semanal: o acumulado do mês até aqui, no quadro vinho ao lado do gráfico. */
  ateAgora?: AteAgora;
  /** Motivos que vão num slide logo depois deste (cancelamentos e inadimplência). */
  motivos?: SlideMotivos;
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

/** Slide "O mês até aqui" (relatório semanal): acumulado do mês até o fim da semana, contra a meta e contra o mesmo ponto do mês anterior. */
export interface ItemMesAteAqui {
  nome: string;
  valor: string;
  /** Variação contra o mesmo ponto do mês anterior (%), ou null sem comparação. */
  variacao: number | null;
  anterior: string | null;
  /** Meta do mês (nível mais alto cadastrado): quanto já foi feito e onde o ritmo do mês deveria estar. */
  meta?: { pct: number; texto: string; ritmo: number };
}
export interface MesAteAqui {
  /** "1-14 nov/26". */
  periodo: string;
  /** Dias do mês já contados. */
  dias: number;
  diasMes: number;
  /** Parte do mês que já passou (0 a 100): o ritmo esperado se o mês fosse linear. */
  ritmo: number;
  itens: ItemMesAteAqui[];
}

/** O acumulado do mês até aqui de um indicador do relatório semanal: vai no quadro vinho ao lado do gráfico (só o total, sem comparação: nem toda unidade tem o mês anterior). */
export interface AteAgora {
  /** "127" ou "R$ 206.786" (conversão: "48,4% (38 de 77 visitantes)"). */
  valor: string;
  /** "dos quais 8 são especiais" (só nos contratos vendidos). */
  nota?: string;
  /** "no mês até aqui (1-21 nov/26): 127, dos quais 8 são especiais" (prévia do menu). */
  texto: string;
  /** "1-21 nov/26". */
  periodo: string;
  /** Meta do mês (nível mais alto cadastrado): quanto já foi feito. */
  meta?: { pct: number; texto: string };
}

export interface ModeloRelatorio {
  mes: string;
  /** "OUT/2026". */
  mesCurto: string;
  /** "1-31 out/26": o período escolhido, como vai na capa. */
  periodo: string;
  /** "out/2025", ou null se o ano anterior não está guardado. */
  mesAnteriorCurto: string | null;
  /** Relatório de mês fechado: "set/2026", o mês anterior (null se não está guardado). */
  mesPassadoCurto?: string | null;
  /** Várias unidades: aviso de que a comparação inclui unidades que ainda não existiam no mês comparado (abertas depois). */
  notaComparacao?: string | null;
  escopo: string;
  nUnidades: number;
  big: BigNumero[] | null;
  conversao: number | null;
  /** Visitantes (presenciais) e os convertidos em aluno com contrato, para a rosca de conversão (como no cartão do EVO). */
  oportunidades: number | null;
  convertidas: number | null;
  rankings: SlideRanking[];
  /** Mês fechado (padrão) ou uma semana do mês. */
  tipo?: "mes" | "semana";
  /** Semana em andamento: "dados até DD/MM". */
  parcialAte?: string | null;
  /** Slide "O mês até aqui" (só no relatório semanal). */
  mesAteAqui?: MesAteAqui | null;
  /** Slide "Plano de ação da unidade" (só no relatório semanal de uma unidade, no mês em andamento). */
  plano?: PlanoDaUnidade | null;
  /** Slide "Frequência dos alunos" (mapa de calor do período e último check-in). */
  frequencia?: SlideFrequencia | null;
  /** Slide "Receitas complementares" (todas num slide só). */
  complementares?: SlideComplementares | null;
  /** Slide "Satisfação" (NPS, Google e Reclame Aqui). */
  satisfacao?: SlideSatisfacao | null;
  /** Slide "Metas do mês". */
  metas?: SlideMetas | null;
  /** Relatório semanal: o acumulado do mês até aqui de cada indicador (id → valor), para a semana nunca aparecer sozinha. */
  ateAgora?: Record<string, AteAgora>;
  /** Aviso sobre o recebimento (relatório semanal): inclui títulos vencidos de meses anteriores que foram pagos agora. */
  notaRecebimento?: string | null;
  /** Texto livre da pessoa que gera o relatório (slide "Observações"). */
  observacoes?: string | null;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesCurto = (m: string) => { const [y, n] = m.split("-"); return `${MESES[Number(n) - 1]?.toUpperCase()}/${y}`; };
const mesCurtoMin = (m: string) => { const [y, n] = m.split("-"); return `${MESES[Number(n) - 1]}/${y}`; };
/** Período como aparece na capa: "1-30 nov/26" (o mês inteiro, por enquanto). */
export const rotuloDoPeriodo = (m: string) => { const [y, n] = m.split("-").map(Number); return `1-${new Date(y, n, 0).getDate()} ${MESES[n - 1]}/${String(y).slice(2)}`; };
export const mesDoAnoAnterior = (m: string) => { const [y, n] = m.split("-"); return `${Number(y) - 1}-${n}`; };
/** "2026-10" → "2026-09". */
const mesAnteriorDe = (m: string) => { const [y, n] = m.split("-").map(Number); return new Date(Date.UTC(y, n - 2, 1)).toISOString().slice(0, 7); };

/** Meses fechados que o painel tem (um relatório de mês em andamento mostraria números parciais). */
export const mesesParaRelatorio = (meses: string[], hoje = new Date()) => {
  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  return meses.filter((m) => m < atual).sort().reverse();
};

export const fmtValor = (f: Formato, n: number) =>
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

function numerosGerais(atual: UnitData[], ant: UnitData[] | null, antMes: UnitData[] | null = null): { big: BigNumero[]; conversao: number | null; oportunidades: number | null; convertidas: number | null } {
  const tem = !!ant?.length, temM = !!antMes?.length;
  const fmtBrl = (n: number) => "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const fmtBrl2 = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
  const fmtPct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  const taxaInad = (l: UnitData[]) => { const a = soma(l, (u) => u.adimplentes), i = soma(l, (u) => u.inadimplentes); return a + i > 0 ? (i / (a + i)) * 100 : 0; };
  // Ticket médio da rede = média simples das unidades (como no resto do Atlas).
  const ticket = (l: UnitData[]) => (l.length ? soma(l, (u) => u.ticketMedio) / l.length : 0);
  const comp = (f: (u: UnitData) => number, fmt: (n: number) => string, nome: string): BigNumero => {
    const a = soma(atual, f), b = tem ? soma(ant!, f) : 0, bm = temM ? soma(antMes!, f) : 0;
    return { nome, valor: fmt(a), variacao: tem ? variacao(a, b) : null, anterior: tem && b > 0 ? fmt(b) : null, variacaoMes: temM ? variacao(a, bm) : null, anteriorMes: temM && bm > 0 ? fmt(bm) : null };
  };
  const big: BigNumero[] = [
    comp((u) => u.faturamento, fmtBrl, "Faturamento"),
    comp((u) => u.adimplentes, fmtInt, "Adimplentes"),
    comp((u) => u.novosContratos, fmtInt, "Novos contratos"),
    { ...comp((u) => u.vendasContratos ?? 0, fmtInt, "Contratos vendidos"), nota: notaContratosEspeciais(soma(atual, (u) => u.vendasContratosEspeciais ?? 0)) },
    { nome: "Ticket médio", valor: fmtBrl2(ticket(atual)), variacao: tem && ticket(ant!) > 0 ? variacao(ticket(atual), ticket(ant!)) : null, anterior: tem && ticket(ant!) > 0 ? fmtBrl2(ticket(ant!)) : null, variacaoMes: temM && ticket(antMes!) > 0 ? variacao(ticket(atual), ticket(antMes!)) : null, anteriorMes: temM && ticket(antMes!) > 0 ? fmtBrl2(ticket(antMes!)) : null },
    { nome: "Inadimplentes", valor: fmtPct(taxaInad(atual)), variacao: tem ? taxaInad(atual) - taxaInad(ant!) : null, emPontos: true, menorMelhor: true, anterior: tem ? fmtPct(taxaInad(ant!)) : null, variacaoMes: temM ? taxaInad(atual) - taxaInad(antMes!) : null, anteriorMes: temM ? fmtPct(taxaInad(antMes!)) : null },
    comp((u) => u.vendasOnline, fmtBrl, "Vendas online"),
  ];
  const op = soma(atual, (u) => u.visitantes ?? u.oportunidades), cv = soma(atual, (u) => u.convertidos ?? u.conversoes);
  return { big, conversao: op > 0 ? Math.min(100, (cv / op) * 100) : null, oportunidades: op > 0 ? op : null, convertidas: op > 0 ? Math.min(cv, op) : null };
}


const FAIXAS_ACESSO = ["Até 7 dias", "8 a 14 dias", "15 a 30 dias", "31 a 60 dias", "Mais de 60 dias", "Nunca entrou"];
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Os 8 maiores motivos e o resto em "Outros". */
function topMotivos(m: Record<string, number>, max = 8): { itens: [string, number][]; total: number } {
  const todos = Object.entries(m).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = todos.reduce((s, [, n]) => s + n, 0);
  const topo = todos.slice(0, max);
  const resto = total - topo.reduce((s, [, n]) => s + n, 0);
  return { itens: resto > 0 ? [...topo, ["Outros", resto]] : topo, total };
}

/** Motivos que acompanham o slide de cancelamento (churn e cancelamentos) e o de inadimplência (recusa do cartão), das unidades do relatório. */
export function motivosDoRanking(id: string, atual: UnitData[], periodo: string): SlideMotivos | undefined {
  if (id === "churn" || id === "canc") {
    const { itens, total } = topMotivos(somarMotivos(atual));
    return total > 0 ? { titulo: "Cancelamentos: motivos", subtitulo: `alunos que cancelaram, pelo motivo informado · ${periodo}`, itens, total } : undefined;
  }
  if (id === "inad") {
    const r = somarRecusa(atual);
    const { itens, total } = topMotivos(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.n])));
    const abertas = Object.values(r).reduce((s, v) => s + v.abertas, 0);
    const valor = Object.values(r).reduce((s, v) => s + v.valorAberto, 0);
    return total > 0 ? { titulo: "Inadimplência: motivos de recusa", subtitulo: `última recusa do cartão nas cobranças recusadas · ${periodo}`, itens, total, nota: abertas > 0 ? `${abertas.toLocaleString("pt-BR")} ainda em aberto, R$ ${Math.round(valor).toLocaleString("pt-BR")}` : undefined } : undefined;
  }
  return undefined;
}

/**
 * Frequência dos alunos: o mapa de calor das entradas do mês do relatório (a catraca só guarda o mês inteiro; no relatório semanal é o mês até aqui) e o
 * último check-in dos alunos ativos. Esse é a foto de hoje, a leitura mais recente do EVO, e não do período: o slide diz isso.
 */
export function montarFrequencia(meses: MonthData[], mes: string, atual: UnitData[], periodo: string, leitura: string | null = evoAtualizadoEm): SlideFrequencia | null {
  const comCalor = atual.filter((u) => u.calor?.length === 168);
  const calor = comCalor.length ? Array.from({ length: 168 }, (_, k) => comCalor.reduce((n, u) => n + (u.calor?.[k] ?? 0), 0)) : [];
  let ultimoCheckin: SlideFrequencia["ultimoCheckin"] = null;
  const nomes = new Set(atual.map((u) => u.name));
  for (const m of [...meses].sort((a, b) => b.month.localeCompare(a.month))) {
    const us = m.units.filter((u) => nomes.has(u.name) && u.acessos?.length);
    if (!us.length) continue;
    const valores = FAIXAS_ACESSO.map((_, i) => us.reduce((n, u) => n + (u.acessos?.[i] ?? 0), 0));
    const total = valores.reduce((a, b) => a + b, 0);
    if (total > 0) ultimoCheckin = { rotulos: FAIXAS_ACESSO, valores, total, posicao: leitura ? `posição de hoje, ${dm(new Date(Date.parse(leitura) - 3 * 3600_000).toISOString().slice(0, 10))}` : `posição de ${mesCurto(m.month)}` };
    break;
  }
  if (!calor.length && !ultimoCheckin) return null;
  return {
    periodo, calor, ultimoCheckin,
    entradas: comCalor.reduce((n, u) => n + (u.entradas ?? 0), 0),
    frequentadores: comCalor.reduce((n, u) => n + (u.frequentadores ?? 0), 0),
  };
}

/** As sete receitas complementares do Atlas (a mesma soma do cartão "Receita Complementar"). */
export const RECEITAS_COMPLEMENTARES: { chave: "diarias" | "personal" | "kids" | "plus" | "proMais" | "camisetas" | "coqueteleiras"; nome: string }[] = [
  { chave: "diarias", nome: "Diárias" }, { chave: "personal", nome: "Taxa de personal" }, { chave: "kids", nome: "Brinquedoteca" }, { chave: "plus", nome: "WG Plus" },
  { chave: "proMais", nome: "Pro+" }, { chave: "camisetas", nome: "Camisetas" }, { chave: "coqueteleiras", nome: "Coqueteleiras" },
];
export const LEGENDA_COMPLEMENTARES = "Receita complementar é tudo o que a unidade vende além dos planos de academia: diárias, taxa de personal, brinquedoteca, WG Plus, Pro+, camisetas e coqueteleiras. Vem das vendas do EVO.";

type ValoresComplementares = Partial<Record<(typeof RECEITAS_COMPLEMENTARES)[number]["chave"], number | undefined>>;
const somaComplementares = (l: ValoresComplementares[]) => RECEITAS_COMPLEMENTARES.map(({ chave }) => l.reduce((t, v) => t + (Number.isFinite(v[chave]) ? (v[chave] as number) : 0), 0));

/**
 * Monta o slide das receitas complementares do período: cada uma e o total, o peso no faturamento e a variação contra o período de comparação.
 * `atual` e `antes` são os valores (já filtrados nas unidades do relatório) de cada unidade; sem nenhuma receita no período, não há slide.
 */
export function montarComplementares(periodo: string, atual: ValoresComplementares[], faturamento: number | null, antes: ValoresComplementares[] | null, rotuloAntes: string | null): SlideComplementares | null {
  const valores = somaComplementares(atual);
  const total = valores.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  const totalAntes = antes ? somaComplementares(antes).reduce((a, b) => a + b, 0) : 0;
  return {
    periodo, total,
    participacao: faturamento && faturamento > 0 ? (total / faturamento) * 100 : null,
    variacao: totalAntes > 0 ? ((total - totalAntes) / totalAntes) * 100 : null,
    anterior: totalAntes > 0 ? `R$ ${Math.round(totalAntes).toLocaleString("pt-BR")}${rotuloAntes ? `  ·  ${rotuloAntes}` : ""}` : null,
    itens: RECEITAS_COMPLEMENTARES.map(({ nome }, i) => [nome, Math.round(valores[i] * 100) / 100] as [string, number]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]),
    legenda: LEGENDA_COMPLEMENTARES,
  };
}

const NOTAS: { nome: string; campo: (u: UnitData) => number | undefined; formato: Formato }[] = [
  { nome: "NPS", campo: (u) => u.nps, formato: "int" },
  { nome: "Google", campo: (u) => u.notaGoogle, formato: "nota" },
  { nome: "Reclame Aqui", campo: (u) => u.reclameAqui, formato: "nota" },
];
const mediaDe = (l: UnitData[], f: (u: UnitData) => number | undefined) => { const v = l.map(f).filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0); return { n: v.length, media: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }; };

/** NPS, Google e Reclame Aqui num slide só: só entram as notas que alguma unidade tem no mês. */
export function montarSatisfacao(periodo: string, atual: UnitData[], ant: UnitData[] | null, antCurto: string | null, todas: UnitData[] | null = null, redeInteira = true): SlideSatisfacao | null {
  const notas: NotaSatisfacao[] = [];
  for (const d of NOTAS) {
    const { n, media } = mediaDe(atual, d.campo);
    if (!n) continue;
    const casas = d.formato === "nota" ? 1 : 0;
    const antes = ant ? mediaDe(ant, d.campo) : null;
    const lista = atual.filter((u) => (d.campo(u) ?? 0) > 0).map((u) => [u.name, d.campo(u) as number] as [string, number]).sort((a, b) => b[1] - a[1]);
    const fmt = (v: number) => fmtValor(d.formato, v);
    const varios = atual.length > 1;
    const corte = lista.length > 6 ? 3 : lista.length;
    notas.push({
      nome: d.nome, valor: fmt(media), casas,
      variacao: antes && antes.n ? media - antes.media : null,
      anterior: antes && antes.n ? `${fmt(antes.media)}${antCurto ? `  ·  ${antCurto}` : ""}` : null,
      base: varios ? `média de ${n} ${n === 1 ? "unidade com nota" : "unidades com nota"}` : "nota da unidade",
      topo: varios ? lista.slice(0, corte).map(([nome, v]) => [nome, fmt(v)] as [string, string]) : [],
      fundo: varios && lista.length > 6 ? lista.slice(-3).map(([nome, v]) => [nome, fmt(v)] as [string, string]) : [],
    });
  }
  // NPS por ponto de contato (WeHelp): o ranking dos pontos do conjunto de unidades e, quando não é a rede toda, o NPS da rede em cada ponto
  const ranking = rankingDePontos(atual).filter((r) => r.resp > 0);
  const redePontos = todas ? somarPontos(todas) : {};
  const pontos: PontoDoSlide[] = ranking.map((r) => ({ nome: r.nome, nps: r.nps, resp: r.resp, det: r.det, rede: redePontos[r.ponto] ? npsDoPonto(redePontos[r.ponto]) : null }));
  if (!notas.length && !pontos.length) return null;
  return { periodo, notas, ...(pontos.length ? { pontos, comparaRede: !redeInteira && !!todas } : {}) };
}

const CHAVES_DE_META: MetaKey[] = ["faturamento", "recebimento", "vendasOnline", "novosContratos", "icv", "renovacoes", "churn", "inadimplenciaPerc"];

/**
 * Metas do mês (bronze, prata e ouro da planilha): rede e uma unidade comparam o resultado com a meta mais alta e dizem o nível atingido;
 * com várias unidades escolhidas, cada indicador diz quantas atingiram ao menos o bronze.
 */
export function montarMetasDoMes(metas: Meta[], m: MonthData, atual: UnitData[], rede: boolean, periodo: string): SlideMetas | null {
  const linhas: LinhaMeta[] = [];
  const umaSo = atual.length === 1 ? atual[0] : null;
  for (const key of CHAVES_DE_META) {
    const nome = META_INDICATORS[key].label;
    if (rede || umaSo) {
      const alvoUnit = rede ? "TOTAL" : umaSo!.name;
      const meta = getMeta(metas, m.month, alvoUnit, key) ?? (rede ? getMeta(metas, m.month, "Rede", key) : undefined);
      const alto = meta ? highestTier(meta) : null;
      const valor = actualFor(m, rede ? "TOTAL" : alvoUnit, key);
      if (!meta || !alto || valor === null || !Number.isFinite(valor)) continue;
      linhas.push({ nome, resultado: formatMetaValue(key, valor), meta: `${alto.tier}: ${formatMetaValue(key, alto.value)}`, nivel: tierReached(key, valor, meta), pct: attainment(key, valor, alto.value) });
    } else {
      let com = 0, atingiram = 0;
      for (const u of atual) {
        const meta = getMeta(metas, m.month, u.name, key);
        const valor = u[key];
        if (!meta || !highestTier(meta) || !Number.isFinite(valor)) continue;
        com++;
        if (tierReached(key, valor, meta) !== "abaixo") atingiram++;
      }
      if (com) linhas.push({ nome, resultado: `${atingiram} de ${com} ${com === 1 ? "unidade" : "unidades"}`, meta: null, nivel: null, pct: (atingiram / com) * 100 });
    }
  }
  return linhas.length ? { periodo, linhas, escopoTexto: rede ? "meta da rede" : umaSo ? `meta da unidade ${umaSo.name}` : "unidades que atingiram ao menos o bronze" } : null;
}

/**
 * Monta o relatório de um mês fechado. `unidades` = quais entram (null = todas as que a pessoa enxerga). `meses` = o que o painel tem
 * (já filtrado pelo servidor para o nível de acesso da pessoa).
 */
export function montarRelatorio(meses: MonthData[], mes: string, selecionados: string[], unidades: string[] | null, metas: Meta[] = [], plano: PlanoDaUnidade | null = null): ModeloRelatorio | null {
  const m = meses.find((x) => x.month === mes);
  if (!m) return null;
  const noEscopo = (l: UnitData[]) => (unidades ? l.filter((u) => unidades.includes(u.name)) : l);
  const atual = noEscopo(m.units);
  if (!atual.length) return null;
  const mAnt = meses.find((x) => x.month === mesDoAnoAnterior(mes));
  const ant = mAnt ? noEscopo(mAnt.units) : null;
  const porNomeAnt = new Map((ant ?? []).map((u) => [u.name, u]));
  const antCurto = mAnt ? mesCurtoMin(mAnt.month) : null;
  // Segunda comparação: com o mês anterior (a unidade pode não ter sido aberta no mesmo mês do ano anterior; aí só esta aparece)
  const mMes = meses.find((x) => x.month === mesAnteriorDe(mes));
  const antMes = mMes ? noEscopo(mMes.units) : null;
  const porNomeMes = new Map((antMes ?? []).map((u) => [u.name, u]));
  const mesPassadoCurto = mMes ? mesCurtoMin(mMes.month) : null;
  const escolheu = new Set(selecionados);
  // Várias unidades: quem foi aberta depois entra nos números do mês e não tinha o mês comparado; o relatório avisa
  const sem = (base: Map<string, UnitData>) => atual.filter((u) => !((base.get(u.name)?.faturamento ?? 0) > 0)).length;
  const semAno = atual.length > 1 && ant ? sem(porNomeAnt) : 0, semMes = atual.length > 1 && antMes ? sem(porNomeMes) : 0;
  const partesNota = [semAno > 0 && antCurto ? `${semAno} ${semAno === 1 ? "unidade" : "unidades"} sem ${antCurto}` : "", semMes > 0 && mesPassadoCurto ? `${semMes} ${semMes === 1 ? "unidade" : "unidades"} sem ${mesPassadoCurto}` : ""].filter(Boolean);
  const notaComparacao = partesNota.length ? `As comparações incluem unidades abertas depois do período comparado (${partesNota.join("; ")}).` : null;

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
      const bm = porNomeMes.has(umaSo.name) ? def.campo(porNomeMes.get(umaSo.name)!) : null;
      const temBaseMes = typeof bm === "number" && Number.isFinite(bm) && bm > 0;
      const variacaoMesCartao = !temBaseMes ? null : emPontos ? v - (bm as number) : ((v - (bm as number)) / (bm as number)) * 100;
      rankings.push({ id: def.id, titulo: def.titulo, subtitulo: `apenas em ${mesCurto(mes)}`, formato: def.formato, itens: [], cartao: { valor: fmtValor(def.formato, v), variacao: variacaoCartao, emPontos, menorMelhor: def.menorMelhor, anterior: temBase && antCurto ? `${fmtValor(def.formato, b as number)}  ·  ${antCurto}` : null, variacaoMes: variacaoMesCartao, anteriorMes: temBaseMes && mesPassadoCurto ? `${fmtValor(def.formato, bm as number)}  ·  ${mesPassadoCurto}` : null, meta: progressoDaMeta(metas, mes, umaSo.name, def.id, v, def.formato), serie: serieComMeta(serieMensal(meses, mes, umaSo.name, def), metas, mes, umaSo.name, def.id, def.formato) } });
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

  // Churn e Cancelamentos usam os mesmos motivos: se os dois forem pedidos, o slide de motivos vem só depois do primeiro
  let jaTemCancelamento = false;
  for (const r of rankings) {
    if ((r.id === "churn" || r.id === "canc") && jaTemCancelamento) continue;
    r.motivos = motivosDoRanking(r.id, atual, mesCurto(mes));
    if (r.motivos && (r.id === "churn" || r.id === "canc")) jaTemCancelamento = true;
  }
  const complementares = escolheu.has(ID_COMPL) ? montarComplementares(rotuloDoPeriodo(mes), atual, soma(atual, (u) => u.faturamento), ant, antCurto) : null;
  const frequencia = escolheu.has(ID_FREQ) ? montarFrequencia(meses, mes, atual, rotuloDoPeriodo(mes)) : null;
  const geral = escolheu.has(ID_BIG) ? numerosGerais(atual, ant, antMes) : null;
  const satisfacao = escolheu.has(ID_SATISF) ? montarSatisfacao(rotuloDoPeriodo(mes), atual, ant, antCurto, m.units, !unidades || unidades.length >= m.units.length) : null;
  const rede = !unidades || unidades.length >= m.units.length;
  const metasDoMes = escolheu.has(ID_METAS) ? montarMetasDoMes(metas, m, atual, rede, rotuloDoPeriodo(mes)) : null;
  const escopo = !unidades ? "Rede" : atual.length === 1 ? atual[0].name : unidades.length >= m.units.length ? "Rede" : `${atual.length} unidades`;
  return { mes, mesCurto: mesCurto(mes), periodo: rotuloDoPeriodo(mes), mesAnteriorCurto: antCurto, mesPassadoCurto, notaComparacao, escopo, nUnidades: atual.length, big: geral?.big ?? null, conversao: geral?.conversao ?? null, oportunidades: geral?.oportunidades ?? null, convertidas: geral?.convertidas ?? null, rankings, frequencia, complementares, satisfacao, metas: metasDoMes, plano: escolheu.has(ID_PLANO) && umaSo && plano && plano.unidade === umaSo.name ? plano : null };
}

/** O que o menu mostra de cada slide, antes de gerar. */
export function resumoDosSlides(modelo: ModeloRelatorio): string[] {
  return ["Capa", ...(modelo.big ? ["Overview"] : []), ...modelo.rankings.flatMap((r) => [r.titulo.replace("*", ""), ...(r.motivos ? [r.motivos.titulo] : [])]), ...(modelo.complementares ? ["Receitas complementares"] : []), ...(modelo.satisfacao?.semanal || modelo.satisfacao?.notas.length ? ["Satisfação"] : []), ...(!modelo.satisfacao?.semanal && modelo.satisfacao?.pontos?.length ? ["Satisfação: pontos de contato"] : []), ...(modelo.metas ? ["Metas do mês"] : []), ...(modelo.frequencia ? ["Frequência dos alunos"] : []), ...(modelo.plano ? [`Plano de ação${paginasDoPlano(modelo.plano).paginas.length > 1 ? ` (${paginasDoPlano(modelo.plano).paginas.length} slides)` : ""}`] : []), ...(modelo.observacoes?.trim() ? ["Observações"] : []), "Encerramento"];
}
