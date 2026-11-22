// Relatório semanal: semanas fixas do mês (1: dias 1-7, 2: 8-14, 3: 15-21, 4: 22-28, 5: 29 ao fim), comparadas com a MESMA semana do mês anterior.
// Os números de cada semana vêm de `semanas` de cada unidade (gravados pelas leituras do EVO que já existem). Todo percentual leva a base ("4 de 12").
import type { MonthData, SemanaDoMes, UnitData } from "@/data/dashboardData";
import type { Meta, MetaKey } from "@/data/metas";
import type { PlanoDaUnidade } from "@/data/relatorioPlano";
import type { AteAgora } from "@/data/relatorio";
import { npsDoPonto, rankingDePontos, somarPontos } from "@/data/npsPontos";
import { ID_BIG, ID_COMPL, ID_FREQ, ID_PLANO, ID_SATISF, NOTA_RECEBIMENTO, montarComplementares, PERIODOS_NA_EVOLUCAO, mesCurto, montarFrequencia, notaContratosEspeciais, motivosDoRanking, type BigNumero, type PontoDoSlide, type SlideSatisfacao, type Cartao, type Formato, type ItemMesAteAqui, type MesAteAqui, type ModeloRelatorio, type SerieEvolucao, type SlideRanking } from "@/data/relatorio";

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

/** "1-14 nov/26": o mês do dia 1 até o dia `dias`. */
export function rotuloAcumulado(mes: string, dias: number): string {
  const [y, m] = mes.split("-").map(Number);
  return `1-${dias} ${MESES[m - 1]}/${String(y).slice(2)}`;
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
  { id: "fat", rotulo: "Faturamento", titulo: "Faturamento", formato: "brl", campo: (s) => s.totalVendas ?? s.faturamento },
  { id: "rec", rotulo: "Recebimento", titulo: "Recebimento", formato: "brl", campo: (s) => s.recebimento },
  { id: "nc", rotulo: "Novos contratos", titulo: "Novos contratos", formato: "int", campo: (s) => s.novosContratos },
  { id: "cv", rotulo: "Contratos vendidos", titulo: "Contratos vendidos", formato: "int", campo: (s) => s.vendasContratos },
  { id: "vo", rotulo: "Vendas online", titulo: "Vendas online", formato: "brl", campo: (s) => s.vendasOnline },
  { id: "op", rotulo: "Visitantes", titulo: "Visitantes", formato: "int", campo: (s) => s.visitantes ?? s.oportunidades },
  { id: "canc", rotulo: "Cancelamentos", titulo: "Cancelamentos", formato: "int", campo: (s) => s.cancelados, menorMelhor: true },
];
/** Relatório semanal com variação e comparação com a mesma semana do mês anterior (religado a pedido do dono em 21/11/2026, só para semana fechada e quando o mês anterior tem a semana). */
export const COMPARAR_COM_MES_ANTERIOR = true;

export const ID_CONVERSAO = "conv";
/** Slide "O mês até aqui". */
export const ID_MES_ATE_AQUI = "mes";
/** Slide "Plano de ação da unidade" (relatório de uma unidade só): o mesmo id do relatório de mês. */
export { ID_PLANO };
/** Indicadores acumulados do mês que têm meta na planilha. */
const ACUMULADOS: { id: string; chave: MetaKey | null }[] = [
  { id: "fat", chave: "faturamento" }, { id: "rec", chave: "recebimento" }, { id: "nc", chave: "novosContratos" }, { id: "cv", chave: null }, { id: "vo", chave: "vendasOnline" }, { id: "op", chave: null }, { id: "canc", chave: null },
];
export const INDICADORES_SEMANA_PADRAO = [ID_BIG, ID_MES_ATE_AQUI, "fat", "nc", "cv", "op", ID_CONVERSAO, "canc", ID_PLANO];
export const TODOS_SEMANA = [ID_BIG, ID_MES_ATE_AQUI, "fat", "rec", "nc", "cv", "vo", "op", ID_CONVERSAO, "canc", ID_SATISF, ID_COMPL, ID_FREQ, ID_PLANO];
/** Abaixo disso a conversão da semana vale pouco (um aluno muda vários pontos): o slide avisa. */
export const BASE_PEQUENA = 10;

const fmt = (f: Formato, n: number) =>
  f === "brl" ? "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : Math.round(n).toLocaleString("pt-BR");
const fmtPct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
const variacao = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
const num = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const baseDe = (conv: number, op: number) => `${conv.toLocaleString("pt-BR")} de ${op.toLocaleString("pt-BR")} visitantes${op < BASE_PEQUENA ? " (base pequena)" : ""}`;

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
    noMes: ult.map((p) => p.mes === mes),
  };
}

/** Soma das semanas 1 a `ate` do mês nas unidades de `nomes`; null se faltar número em alguma semana (a soma ficaria menor que a real). */
function acumulado(m: MonthData | undefined, ate: number, nomes: string[], campo: (s: SemanaDoMes) => number | undefined): number | null {
  const us = (m?.units ?? []).filter((u) => nomes.includes(u.name));
  if (!us.length) return null;
  let total = 0;
  for (const u of us) for (let n = 1; n <= ate; n++) {
    const v = u.semanas?.[n - 1] ? campo(u.semanas[n - 1]) : undefined;
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    total += v;
  }
  return total;
}

/** Meta do mês para o conjunto de unidades: a da rede (TOTAL) quando é a rede; senão a soma das metas das unidades, no nível mais alto que todas cadastraram. */
export function metaDoEscopo(metas: Meta[], mes: string, chave: MetaKey, nomes: string[], rede: boolean): { nivel: "ouro" | "prata" | "bronze"; alvo: number } | undefined {
  const doMes = metas.filter((m) => m.month === mes && m.key === chave);
  const niveis = ["ouro", "prata", "bronze"] as const;
  if (rede) {
    const total = doMes.find((m) => m.unit === "TOTAL" || m.unit === "Rede");
    const n = total ? niveis.find((x) => typeof total[x] === "number" && (total[x] as number) > 0) : undefined;
    if (total && n) return { nivel: n, alvo: total[n] as number };
  }
  const ms = nomes.map((nome) => doMes.find((m) => m.unit === nome));
  if (!ms.length || ms.some((m) => !m)) return undefined;
  for (const nivel of niveis) if (ms.every((m) => typeof m![nivel] === "number" && (m![nivel] as number) > 0)) return { nivel, alvo: ms.reduce((s, m) => s + (m![nivel] as number), 0) };
  return undefined;
}

/** NPS por ponto de contato de uma unidade somando as semanas 1 a `ate` do mês. */
function somaSemanas(u: UnitData, ate: number): Record<string, [number, number, number]> {
  const por: Record<string, [number, number, number]> = {};
  for (let n = 1; n <= ate; n++) for (const [ponto, [r, p, d]] of Object.entries(u.semanas?.[n - 1]?.npsPontos ?? {})) { const a = (por[ponto] ??= [0, 0, 0]); a[0] += r; a[1] += p; a[2] += d; }
  return por;
}

interface Dados { u: UnitData; s: SemanaDoMes }
const daSemana = (m: MonthData | undefined, n: number, nomes: string[] | null): Dados[] =>
  (m?.units ?? []).filter((u) => !nomes || nomes.includes(u.name)).flatMap((u) => (u.semanas?.[n - 1] ? [{ u, s: u.semanas[n - 1] }] : []));
const somaCampo = (l: Dados[], f: (s: SemanaDoMes) => number | undefined) => l.reduce((t, d) => t + num(f(d.s)), 0);

/**
 * Relatório de uma semana do mês. `fechados` = dias fechados do mês (para saber se a semana já terminou). Semana em andamento sai sem
 * comparação (comparar uma semana pela metade com a semana inteira do mês anterior enganaria). Devolve null se a semana não tem dados.
 */
export function montarRelatorioSemanal(meses: MonthData[], mes: string, semana: number, selecionados: string[], unidades: string[] | null, fechados: number, metas: Meta[] = [], plano: PlanoDaUnidade | null = null): ModeloRelatorio | null {
  const lim = limitesDaSemana(mes, semana);
  const m = meses.find((x) => x.month === mes);
  if (!lim || !m) return null;
  const estado = estadoDaSemana(mes, semana, fechados);
  if (estado === "futura") return null;
  const atual = daSemana(m, semana, unidades);
  if (!atual.length) return null;

  const mAnt = meses.find((x) => x.month === mesAnterior(mes));
  const limAnt = limitesDaSemana(mesAnterior(mes), semana);
  // Decisão do dono (21/11/2026): os indicadores do semanal voltam a mostrar a variação contra a mesma semana do mês anterior (verde bom, vermelho ruim).
  // Só em semana fechada e só quando o mês anterior tem aquela semana; o quadro vinho do mês até aqui continua sem comparação.
  const comparar = COMPARAR_COM_MES_ANTERIOR && estado === "fechada" && !!mAnt && !!limAnt;
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
      const linhas = atual.map((d) => ({ nome: d.u.name, op: num(d.s.visitantes ?? d.s.oportunidades), cv: num(d.s.convertidos ?? d.s.conversoes) })).filter((x) => x.op > 0);
      if (!linhas.length) continue;
      if (umaSo) {
        const x = linhas[0], pct = (x.cv / x.op) * 100;
        const a = antPorNome.get(x.nome);
        const pAnt = temAnt && a && num(a.visitantes ?? a.oportunidades) > 0 ? (num(a.convertidos ?? a.conversoes) / num(a.visitantes ?? a.oportunidades)) * 100 : null;
        rankings.push({ id, titulo: "Conversão", subtitulo: sub, formato: "pct", itens: [], cartao: {
          valor: fmtPct(pct), variacao: pAnt !== null ? pct - pAnt : null, emPontos: true,
          anterior: baseDe(x.cv, x.op) + (pAnt !== null && rotuloAnt ? `  ·  antes: ${fmtPct(pAnt)} (${rotuloAnt})` : ""),
        } });
      } else {
        const bases: Record<string, string> = {};
        const itens: [string, number][] = linhas.map((x) => { bases[x.nome] = `${x.cv} de ${x.op}${x.op < BASE_PEQUENA ? ", base pequena" : ""}`; return [x.nome, Math.round((x.cv / x.op) * 1000) / 10]; });
        rankings.push({ id, titulo: "Conversão", subtitulo: `${sub} · convertidos entre os visitantes da semana`, formato: "pct", itens: itens.sort((a, b) => b[1] - a[1]), bases });
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
    rankings.push({ id, titulo: def.titulo, subtitulo: sub, formato: def.formato, itens: itens.sort((a, b) => b[1] - a[1]), ...(id === "rec" ? { nota: NOTA_RECEBIMENTO } : {}) });
  }

  let big: BigNumero[] | null = null, oportunidades: number | null = null, convertidas: number | null = null, conversao: number | null = null;
  if (escolheu.has(ID_BIG) || escolheu.has(ID_MES_ATE_AQUI)) {
    const kpi = (nome: string, def: DefSemana): BigNumero => {
      const v = somaCampo(atual, def.campo), b = temAnt ? somaCampo(ant, def.campo) : 0;
      return { nome, valor: fmt(def.formato, v), variacao: temAnt ? variacao(v, b) : null, menorMelhor: def.menorMelhor, anterior: temAnt && b > 0 ? fmt(def.formato, b) : null };
    };
    // Contratos vendidos só entra se a semana tem o número (meses lidos antes dele não têm; somar como zero enganaria)
    const temCv = atual.some((d) => typeof d.s.vendasContratos === "number");
    big = ["fat", "rec", "nc", ...(temCv ? ["cv"] : []), "vo", "op", "canc"].map((id) => { const d = SEMANAIS.find((x) => x.id === id)!; const k = kpi(d.titulo === "Oportunidades" ? "Oportunidades" : d.titulo, d); return id === "cv" ? { ...k, nota: notaContratosEspeciais(somaCampo(atual, (s) => s.vendasContratosEspeciais)) } : k; });
    oportunidades = somaCampo(atual, (s) => s.visitantes ?? s.oportunidades);
    convertidas = Math.min(somaCampo(atual, (s) => s.convertidos ?? s.conversoes), oportunidades);
    conversao = oportunidades > 0 ? (convertidas / oportunidades) * 100 : null;
    if (oportunidades <= 0) { oportunidades = null; convertidas = null; }
  }

  // "Até agora no mês": o acumulado de cada indicador (semanas 1 a N), para o número da semana nunca aparecer sozinho no relatório
  const nomesAtual = atual.map((d) => d.u.name);
  const periodoAteAgora = rotuloAcumulado(mes, estado === "fechada" ? lim.ate : fechados);
  const prefixoAteAgora = umaSo ? "no mês até aqui" : "total das unidades no mês até aqui";
  const ateAgora: Record<string, AteAgora> = {};
  const redeAteAgora = !unidades || unidades.length >= m.units.length;
  const chaveDoId = Object.fromEntries(ACUMULADOS.map((a) => [a.id, a.chave]));
  for (const def of SEMANAIS) {
    const v = acumulado(m, semana, nomesAtual, def.campo);
    if (v === null) continue;
    const nota = def.id === "cv" ? notaContratosEspeciais(acumulado(m, semana, nomesAtual, (s) => s.vendasContratosEspeciais) ?? 0) : undefined;
    const chave = chaveDoId[def.id];
    const alvo = chave ? metaDoEscopo(metas, mes, chave, nomesAtual, redeAteAgora) : undefined;
    const pct = alvo ? (v / alvo.alvo) * 100 : null;
    ateAgora[def.id] = {
      valor: fmt(def.formato, v), nota, periodo: periodoAteAgora, texto: `${prefixoAteAgora} (${periodoAteAgora}): ${fmt(def.formato, v)}${nota ? `, ${nota}` : ""}`,
      meta: alvo && pct !== null ? { pct, texto: `${Math.round(pct).toLocaleString("pt-BR")}% da meta ${alvo.nivel} · ${fmt(def.formato, alvo.alvo)}` } : undefined,
    };
  }
  {
    // A conversão não se soma: no acumulado é a taxa do mês até aqui (convertidos ÷ visitantes de 1 até o fim da semana)
    const vis = acumulado(m, semana, nomesAtual, (s) => s.visitantes ?? s.oportunidades), cvs = acumulado(m, semana, nomesAtual, (s) => s.convertidos ?? s.conversoes);
    if (vis !== null && cvs !== null && vis > 0) {
      const v = `${fmtPct((cvs / vis) * 100)} (${fmt("int", cvs)} de ${fmt("int", vis)} visitantes)`;
      ateAgora[ID_CONVERSAO] = { valor: v, periodo: periodoAteAgora, texto: `${prefixoAteAgora} (${periodoAteAgora}): ${v}` };
    }
  }
  for (const r of rankings) { const a = ateAgora[r.id]; if (a) r.ateAgora = a; }

  // Satisfação (um slide só): o NPS e os pontos de contato do MÊS ATÉ AQUI (semanas 1 a N, a leitura do WeHelp da madrugada) e, ao lado, só os promotores e
  // detratores da semana. Não há NPS da semana: com cerca de 10 respostas por unidade ele balança demais. Google e Reclame Aqui só existem por mês.
  let satisfacao: SlideSatisfacao | null = null;
  if (escolheu.has(ID_SATISF)) {
    const naEscopo = m.units.filter((x) => nomesAtual.includes(x.name));
    let rA = 0, pA = 0, dA = 0;
    for (let n = 1; n <= semana; n++) for (const u of naEscopo) { const w = u.semanas?.[n - 1]; rA += num(w?.npsRespostas); pA += num(w?.npsPromotores); dA += num(w?.npsDetratores); }
    const promSem = somaCampo(atual, (s) => s.npsPromotores), detSem = somaCampo(atual, (s) => s.npsDetratores);
    const ate = (arr: UnitData[]) => arr.map((u) => ({ npsPontos: somaSemanas(u, semana) }));
    const meus = rankingDePontos(ate(naEscopo)).filter((x) => x.resp > 0);
    const redePontos = somarPontos(ate(m.units));
    const pontos: PontoDoSlide[] = meus.map((x) => ({ nome: x.nome, nps: x.nps, resp: x.resp, det: x.det, rede: redePontos[x.ponto] ? npsDoPonto(redePontos[x.ponto]) : null }));
    if (rA > 0 || pontos.length) {
      satisfacao = {
        periodo, notas: [], ...(pontos.length ? { pontos, comparaRede: !!unidades && unidades.length < m.units.length } : {}),
        semanal: { nps: rA > 0 ? String(Math.round(((pA - dA) / rA) * 100)) : null, periodoAteAgora, ateData: `${dd(estado === "fechada" ? lim.ate : fechados)}/${mes.slice(5, 7)}`, semana: periodo, promotores: promSem, detratores: detSem },
      };
    }
  }
  // "O mês até aqui": acumulado das semanas 1 a N (a semana em andamento entra até onde os dados chegaram), contra a meta e contra o mesmo ponto do mês anterior
  let mesAteAqui: MesAteAqui | null = null;
  if (escolheu.has(ID_MES_ATE_AQUI)) {
    const nomes = atual.map((d) => d.u.name);
    const rede = !unidades || unidades.length >= m.units.length;
    const dias = estado === "fechada" ? lim.ate : fechados;
    const diasMes = diasDoMes(mes);
    const ritmo = Math.min(100, (dias / diasMes) * 100);
    const itens: ItemMesAteAqui[] = [];
    for (const { id, chave } of ACUMULADOS) {
      const def = SEMANAIS.find((d) => d.id === id)!;
      const v = acumulado(m, semana, nomes, def.campo);
      if (v === null) continue;
      const b: number | null = null; // quadro vinho do mês até aqui: sem comparação (decisão do dono)
      const alvo = chave ? metaDoEscopo(metas, mes, chave, nomes, rede) : undefined;
      const pct = alvo ? (v / alvo.alvo) * 100 : null;
      itens.push({
        nome: def.titulo, valor: fmt(def.formato, v), variacao: b !== null ? variacao(v, b) : null,
        anterior: b !== null && b > 0 && rotuloAnt ? `${fmt(def.formato, b)} no mesmo ponto de ${rotuloAnt.split(" ")[1]}` : null,
        meta: alvo && pct !== null ? { pct, texto: `${Math.round(pct).toLocaleString("pt-BR")}% da meta ${alvo.nivel} · ${fmt(def.formato, alvo.alvo)}`, ritmo } : undefined,
      });
    }
    if (itens.length) mesAteAqui = { periodo: rotuloAcumulado(mes, dias), dias, diasMes, ritmo, itens };
  }

  // Motivos dos cancelamentos e frequência: a catraca e os motivos são guardados por mês, então aqui valem para o mês até aqui
  const ateAqui = `mês até ${estado === "andamento" ? `${dd(fechados)}/${mes.slice(5, 7)}` : rotuloAcumulado(mes, lim.ate).split(" ").pop()}`;
  for (const r of rankings) r.motivos = motivosDoRanking(r.id, atual.map((d) => d.u), ateAqui);
  const frequencia = escolheu.has(ID_FREQ) ? montarFrequencia(meses, mes, atual.map((d) => d.u), ateAqui) : null;
  const complementares = escolheu.has(ID_COMPL) ? montarComplementares(periodo, atual.map((d) => d.s), somaCampo(atual, (s) => s.faturamento), temAnt ? ant.map((d) => d.s) : null, rotuloAnt) : null;
  const escopo = !unidades ? "Rede" : atual.length === 1 ? atual[0].u.name : unidades.length >= m.units.length ? "Rede" : `${atual.length} unidades`;
  const parcialAte = estado === "andamento" ? `${dd(fechados)}/${mes.slice(5, 7)}` : null;
  return {
    mes, mesCurto: mesCurto(mes), periodo, mesAnteriorCurto: rotuloAnt, escopo, nUnidades: atual.length, big, conversao, oportunidades, convertidas, rankings,
    tipo: "semana", parcialAte, mesAteAqui, ateAgora, frequencia, complementares, satisfacao,
    notaRecebimento: big?.some((k) => k.nome === "Recebimento") || rankings.some((r) => r.id === "rec") || mesAteAqui?.itens.some((k) => k.nome === "Recebimento") ? NOTA_RECEBIMENTO : null,
    // O plano é de uma unidade só e do mês em andamento: quem monta já confere isso, aqui só entra se foi pedido e o relatório é de uma unidade
    plano: escolheu.has(ID_PLANO) && umaSo && plano && plano.unidade === umaSo.u.name ? plano : null,
  };
}
