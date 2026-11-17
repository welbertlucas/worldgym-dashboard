// Relatório semanal: semanas fixas do mês (1: dias 1-7, 2: 8-14, 3: 15-21, 4: 22-28, 5: 29 ao fim), comparadas com a MESMA semana do mês anterior.
// Os números de cada semana vêm de `semanas` de cada unidade (gravados pelas leituras do EVO que já existem). Todo percentual leva a base ("4 de 12").
import type { MonthData, SemanaDoMes, UnitData } from "@/data/dashboardData";
import { ID_BIG, PERIODOS_NA_EVOLUCAO, mesCurto, type BigNumero, type Cartao, type Formato, type ModeloRelatorio, type SerieEvolucao, type SlideRanking } from "@/data/relatorio";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dd = (n: number) => String(n).padStart(2, "0");
const diasDoMes = (mes: string) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

/** Mês com mais de 28 dias tem a semana 5 (1 a 3 dias). */
export const semanasNoMes = (mes: string) => (diasDoMes(mes) > 28 ? 5 : 4);
export function limitesDaSemana(mes: string, n: number): { de: number; ate: number } | null {
  if (!Number.isInteger(n) || n < 1 || n > semanasNoMes(mes)) return null;
  return { de: (n - 1) * 7 + 1, ate: n === 5 ? diasDoMes(mes) : n * 7 };
}
export const mesAnterior = (mes: string) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7); };
/** "8-14 nov/26". */
export function rotuloDaSemana(mes: string, n: number): string {
  const l = limitesDaSemana(mes, n);
  const [y, m] = mes.split("-").map(Number);
  return l ? `${l.de}-${l.ate} ${MESES[m - 1]}/${String(y).slice(2)}` : "";
}

export type EstadoDaSemana = "fechada" | "andamento" | "futura";
/** `fechados` = dias do mês já fechados (os dados vão até a véspera da última leitura do EVO). */
export function estadoDaSemana(mes: string, n: number, fechados: number): EstadoDaSemana {
  const l = limitesDaSemana(mes, n);
  if (!l || fechados < l.de) return "futura";
  return fechados >= l.ate ? "fechada" : "andamento";
}

/** O mês tem números por semana (a leitura do EVO que os grava já rodou para ele). */
export const temSemanas = (m: MonthData) => m.units.some((u) => (u.semanas?.length ?? 0) > 0);

export interface DefSemana {
  id: string;
  rotulo: string;
  titulo: string;
  formato: Formato;
  campo: (s: SemanaDoMes) => number | undefined;
  /** Cair é bom (cancelamentos). */
  menorMelhor?: boolean;
}
/** Indicadores que existem por semana (ticket, inadimplência, adimplentes, churn e notas são do mês, não da semana). */
export const SEMANAIS: DefSemana[] = [
  { id: "fat", rotulo: "Faturamento", titulo: "Faturamento", formato: "brl", campo: (s) => s.faturamento },
  { id: "rec", rotulo: "Recebimento", titulo: "Recebimento", formato: "brl", campo: (s) => s.recebimento },
  { id: "nc", rotulo: "Novos contratos", titulo: "Novos contratos", formato: "int", campo: (s) => s.novosContratos },
  { id: "vo", rotulo: "Vendas online", titulo: "Vendas online", formato: "brl", campo: (s) => s.vendasOnline },
  { id: "op", rotulo: "Oportunidades cadastradas", titulo: "Oportunidades", formato: "int", campo: (s) => s.oportunidades },
  { id: "canc", rotulo: "Cancelamentos", titulo: "Cancelamentos", formato: "int", campo: (s) => s.cancelados, menorMelhor: true },
  { id: "di", rotulo: "Diárias", titulo: "Diárias", formato: "brl", campo: (s) => s.diarias },
  { id: "pers", rotulo: "Personal", titulo: "Personal", formato: "brl", campo: (s) => s.personal },
  { id: "cam", rotulo: "Camisetas", titulo: "Camisetas", formato: "brl", campo: (s) => s.camisetas },
  { id: "coq", rotulo: "Coqueteleiras", titulo: "Coqueteleiras", formato: "brl", campo: (s) => s.coqueteleiras },
];
export const ID_CONVERSAO = "conv";
export const INDICADORES_SEMANA_PADRAO = [ID_BIG, "fat", "nc", "op", ID_CONVERSAO, "canc"];
export const TODOS_SEMANA = [ID_BIG, "fat", "rec", "nc", "vo", "op", ID_CONVERSAO, "canc", "di", "pers", "cam", "coq"];
/** Abaixo disso a conversão da semana vale pouco (um aluno muda vários pontos): o slide avisa. */
export const BASE_PEQUENA = 10;

const fmt = (f: Formato, n: number) =>
  f === "brl" ? "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : Math.round(n).toLocaleString("pt-BR");
const fmtPct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
const variacao = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
const num = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const baseDe = (conv: number, op: number) => `${conv.toLocaleString("pt-BR")} de ${op.toLocaleString("pt-BR")} oportunidades${op < BASE_PEQUENA ? " (base pequena)" : ""}`;

/**
 * Últimas semanas (até 6, em ordem, terminando na escolhida) de uma unidade num indicador, atravessando meses. A coluna da mesma semana
 * do mês anterior (a da comparação) fica marcada. Semana sem número fica de fora; só entram semanas já começadas.
 */
export function serieSemanal(meses: MonthData[], mes: string, semana: number, unidade: string, campo: (s: SemanaDoMes) => number | undefined, fechados: number): SerieEvolucao | undefined {
  const pontos: { mes: string; n: number; v: number }[] = [];
  for (const m of [...meses].filter((x) => x.month <= mes).sort((a, b) => a.month.localeCompare(b.month))) {
    const u = m.units.find((x) => x.name === unidade);
    if (!u?.semanas) continue;
    for (let n = 1; n <= semanasNoMes(m.month); n++) {
      if (m.month === mes && n > semana) break;
      const v = u.semanas[n - 1] ? campo(u.semanas[n - 1]) : undefined;
      if (typeof v === "number" && Number.isFinite(v)) pontos.push({ mes: m.month, n, v });
    }
  }
  const ult = pontos.slice(-PERIODOS_NA_EVOLUCAO);
  const ultimo = ult[ult.length - 1];
  if (ult.length < 2 || !ultimo || ultimo.mes !== mes || ultimo.n !== semana) return undefined;
  const iComp = ult.findIndex((p) => p.mes === mesAnterior(mes) && p.n === semana);
  return {
    rotulos: ult.map((p) => rotuloDaSemana(p.mes, p.n).replace(/\/\d\d$/, "")),
    valores: ult.map((p) => Math.round(p.v * 100) / 100),
    destaque: ult.length - 1,
    comparada: iComp >= 0 ? iComp : undefined,
    parcial: estadoDaSemana(mes, semana, fechados) === "andamento",
  };
}

interface Dados { u: UnitData; s: SemanaDoMes }
const daSemana = (m: MonthData | undefined, n: number, nomes: string[] | null): Dados[] =>
  (m?.units ?? []).filter((u) => !nomes || nomes.includes(u.name)).flatMap((u) => (u.semanas?.[n - 1] ? [{ u, s: u.semanas[n - 1] }] : []));
const somaCampo = (l: Dados[], f: (s: SemanaDoMes) => number | undefined) => l.reduce((t, d) => t + num(f(d.s)), 0);

/**
 * Relatório de uma semana do mês. `fechados` = dias fechados do mês (para saber se a semana já terminou). Semana em andamento sai sem
 * comparação (comparar uma semana pela metade com a semana inteira do mês anterior enganaria). Devolve null se a semana não tem dados.
 */
export function montarRelatorioSemanal(meses: MonthData[], mes: string, semana: number, selecionados: string[], unidades: string[] | null, fechados: number): ModeloRelatorio | null {
  const lim = limitesDaSemana(mes, semana);
  const m = meses.find((x) => x.month === mes);
  if (!lim || !m) return null;
  const estado = estadoDaSemana(mes, semana, fechados);
  if (estado === "futura") return null;
  const atual = daSemana(m, semana, unidades);
  if (!atual.length) return null;

  const mAnt = meses.find((x) => x.month === mesAnterior(mes));
  const limAnt = limitesDaSemana(mesAnterior(mes), semana);
  const comparar = estado === "fechada" && !!mAnt && !!limAnt;
  const ant = comparar ? daSemana(mAnt, semana, unidades) : [];
  const temAnt = comparar && ant.length > 0;
  const rotuloAnt = temAnt ? rotuloDaSemana(mesAnterior(mes), semana) : null;
  const antPorNome = new Map(ant.map((d) => [d.u.name, d.s]));
  const periodo = rotuloDaSemana(mes, semana);
  const escolheu = new Set(selecionados);
  const umaSo = atual.length === 1 ? atual[0] : null;

  const rankings: SlideRanking[] = [];
  const sub = `apenas em ${periodo}`;
  const cartaoDe = (def: { formato: Formato; menorMelhor?: boolean }, v: number, b: number | null, base?: string): Cartao => ({
    valor: fmt(def.formato, v), variacao: b !== null && temAnt ? variacao(v, b) : null, menorMelhor: def.menorMelhor,
    anterior: b !== null && temAnt && rotuloAnt ? `${fmt(def.formato, b)}  ·  ${rotuloAnt}` : base ?? null,
  });

  for (const id of TODOS_SEMANA) {
    if (!escolheu.has(id)) continue;
    if (id === ID_CONVERSAO) {
      const linhas = atual.map((d) => ({ nome: d.u.name, op: num(d.s.oportunidades), cv: num(d.s.conversoes) })).filter((x) => x.op > 0);
      if (!linhas.length) continue;
      if (umaSo) {
        const x = linhas[0], pct = (x.cv / x.op) * 100;
        const a = antPorNome.get(x.nome);
        const pAnt = temAnt && a && num(a.oportunidades) > 0 ? (num(a.conversoes) / num(a.oportunidades)) * 100 : null;
        rankings.push({ id, titulo: "Conversão", subtitulo: sub, formato: "pct", itens: [], cartao: {
          valor: fmtPct(pct), variacao: pAnt !== null ? pct - pAnt : null, emPontos: true,
          anterior: baseDe(x.cv, x.op) + (pAnt !== null && rotuloAnt ? `  ·  antes: ${fmtPct(pAnt)} (${rotuloAnt})` : ""),
        } });
      } else {
        const bases: Record<string, string> = {};
        const itens: [string, number][] = linhas.map((x) => { bases[x.nome] = `${x.cv} de ${x.op}${x.op < BASE_PEQUENA ? ", base pequena" : ""}`; return [x.nome, Math.round((x.cv / x.op) * 1000) / 10]; });
        rankings.push({ id, titulo: "Conversão", subtitulo: `${sub} · convertidas de cadastradas na semana`, formato: "pct", itens: itens.sort((a, b) => b[1] - a[1]), bases });
      }
      continue;
    }
    const def = SEMANAIS.find((d) => d.id === id);
    if (!def) continue;
    if (umaSo) {
      const v = def.campo(umaSo.s);
      if (typeof v !== "number") continue;
      const a = antPorNome.get(umaSo.u.name);
      const b = temAnt && a && typeof def.campo(a) === "number" ? num(def.campo(a)) : null;
      rankings.push({ id, titulo: def.titulo, subtitulo: sub, formato: def.formato, itens: [], cartao: { ...cartaoDe(def, v, b), serie: serieSemanal(meses, mes, semana, umaSo.u.name, def.campo, fechados) } });
      continue;
    }
    const itens: [string, number][] = atual.filter((d) => typeof def.campo(d.s) === "number").map((d) => [d.u.name, Math.round(num(def.campo(d.s)) * 100) / 100]);
    if (!itens.length) continue;
    rankings.push({ id, titulo: def.titulo, subtitulo: sub, formato: def.formato, itens: itens.sort((a, b) => b[1] - a[1]) });
  }

  let big: BigNumero[] | null = null, oportunidades: number | null = null, convertidas: number | null = null, conversao: number | null = null;
  if (escolheu.has(ID_BIG)) {
    const kpi = (nome: string, def: DefSemana): BigNumero => {
      const v = somaCampo(atual, def.campo), b = temAnt ? somaCampo(ant, def.campo) : 0;
      return { nome, valor: fmt(def.formato, v), variacao: temAnt ? variacao(v, b) : null, menorMelhor: def.menorMelhor, anterior: temAnt && b > 0 ? fmt(def.formato, b) : null };
    };
    big = ["fat", "rec", "nc", "vo", "op", "canc"].map((id) => { const d = SEMANAIS.find((x) => x.id === id)!; return kpi(d.titulo === "Oportunidades" ? "Oportunidades" : d.titulo, d); });
    oportunidades = somaCampo(atual, (s) => s.oportunidades);
    convertidas = Math.min(somaCampo(atual, (s) => s.conversoes), oportunidades);
    conversao = oportunidades > 0 ? (convertidas / oportunidades) * 100 : null;
    if (oportunidades <= 0) { oportunidades = null; convertidas = null; }
  }

  const escopo = !unidades || unidades.length >= m.units.length ? "Rede" : unidades.length === 1 ? unidades[0] : `${unidades.length} unidades`;
  const parcialAte = estado === "andamento" ? `${dd(fechados)}/${mes.slice(5, 7)}` : null;
  return {
    mes, mesCurto: mesCurto(mes), periodo, mesAnteriorCurto: rotuloAnt, escopo, nUnidades: atual.length, big, conversao, oportunidades, convertidas, rankings,
    tipo: "semana", parcialAte,
  };
}
