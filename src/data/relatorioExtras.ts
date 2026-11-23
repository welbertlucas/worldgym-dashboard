// Slides extras do menu Relatórios (pedido do dono em 23/11/2026): projeção de fechamento do mês, saldo de alunos e vendas de uma campanha
// (ex.: Black Friday) num período de dias escolhido. Tudo com os números que o Atlas já guarda; nada novo é lido do EVO.
import type { MonthData, UnitData } from "@/data/dashboardData";
import type { Meta } from "@/data/metas";
import { fracaoAteODia } from "@/data/projecaoMes";
import { metaDoEscopo } from "@/data/relatorioSemana";
import { diasNoMes, projetarMes, DIAS_MINIMOS } from "@/data/vendasDia";

export const ID_PROJECAO = "proj";
export const ID_SALDO = "saldo";
export const ID_CAMPANHA = "camp";
export const IDS_EXTRAS = [ID_PROJECAO, ID_SALDO, ID_CAMPANHA];

export interface BlocoExtra { valor: string; nome: string; detalhe?: string | null; cor?: "bom" | "ruim" | null }
export interface SlideExtra { id: string; titulo: string; subtitulo: string; blocos: BlocoExtra[]; nota?: string | null }
/** Campanha: nome e o período em dias do mês do relatório (de 1 a 31). */
export interface Campanha { nome: string; de: number; ate: number }

export interface OpcoesExtras {
  /** Dias do mês já fechados (dados até a véspera); no mês fechado, todos. */
  fechados: number;
  /** O mês ainda está em andamento. */
  parcial: boolean;
  metas?: Meta[];
  campanha?: Campanha | null;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dd = (n: number) => String(n).padStart(2, "0");
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");
const pct = (n: number) => `${Math.round(n).toLocaleString("pt-BR")}%`;
const data = (mes: string, dia: number) => `${dd(dia)}/${mes.slice(5, 7)}`;
const nomeMes = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1];
const soma = (us: UnitData[], f: (u: UnitData) => number | undefined) => us.reduce((t, u) => t + (f(u) ?? 0), 0);

/** Novos contratos por dia somando as unidades (null se nenhuma tem o dado). */
function vendasPorDia(us: UnitData[]): number[] | null {
  const com = us.filter((u) => u.vendasDia?.length);
  if (!com.length) return null;
  const n = Math.max(...com.map((u) => u.vendasDia!.length));
  return Array.from({ length: n }, (_, d) => com.reduce((s, u) => s + (u.vendasDia![d] ?? 0), 0));
}
/** Total de vendas por semana somando as unidades (null se nenhuma tem o dado). */
function vendasPorSemana(us: UnitData[]): number[] | null {
  const com = us.filter((u) => u.semanas?.some((w) => typeof w.totalVendas === "number"));
  if (!com.length) return null;
  const n = Math.max(...com.map((u) => u.semanas!.length));
  return Array.from({ length: n }, (_, k) => com.reduce((a, u) => a + (u.semanas![k]?.totalVendas ?? 0), 0));
}
/** Os até 3 meses anteriores (em até 6) que têm o dado, do mais antigo ao mais recente. */
function anteriores<T>(meses: MonthData[], mes: string, nomes: string[], ler: (us: UnitData[]) => T | null): [string, T][] {
  const out: [string, T][] = [];
  let [y, m] = mes.split("-").map(Number);
  for (let k = 0; k < 6 && out.length < 3; k++) {
    m -= 1; if (m === 0) { m = 12; y -= 1; }
    const ym = `${y}-${dd(m)}`;
    const us = (meses.find((x) => x.month === ym)?.units ?? []).filter((u) => nomes.includes(u.name));
    const v = us.length ? ler(us) : null;
    if (v !== null) out.push([ym, v]);
  }
  return out.reverse();
}

function textoMeta(metas: Meta[], mes: string, chave: "novosContratos" | "faturamento", nomes: string[], rede: boolean, projetado: number, fmt: (n: number) => string): string | null {
  const alvo = metaDoEscopo(metas, mes, chave, nomes, rede);
  return alvo ? `${pct((projetado / alvo.alvo) * 100)} da meta ${alvo.nivel} (${fmt(alvo.alvo)})` : null;
}

/** Projeção de fechamento do mês em andamento: novos contratos (curva dos dias) e faturamento (curva das semanas), como no Gerencial. */
export function slideProjecao(meses: MonthData[], mes: string, nomes: string[], rede: boolean, op: OpcoesExtras): SlideExtra | null {
  if (!op.parcial || op.fechados < DIAS_MINIMOS || op.fechados >= diasNoMes(mes)) return null;
  const us = (meses.find((x) => x.month === mes)?.units ?? []).filter((u) => nomes.includes(u.name));
  if (!us.length) return null;
  const blocos: BlocoExtra[] = [];
  const refs = new Set<string>();
  const dias = vendasPorDia(us);
  if (dias) {
    const hist = anteriores(meses, mes, nomes, vendasPorDia);
    const p = projetarMes(dias, mes, op.fechados, hist);
    if (p) {
      hist.forEach(([ym]) => refs.add(ym));
      const meta = textoMeta(op.metas ?? [], mes, "novosContratos", nomes, rede, p.valor, int);
      blocos.push({ valor: int(p.valor), nome: "Novos contratos", detalhe: [`${int(p.realizado)} até ${data(mes, op.fechados)}`, meta].filter(Boolean).join(" · ") });
    }
  }
  const vendido = soma(us, (u) => u.faturamento);
  if (vendido > 0) {
    const hist = anteriores(meses, mes, nomes, vendasPorSemana);
    const fr = hist.map(([ym, sem]) => fracaoAteODia(sem, ym, Math.min(op.fechados, diasNoMes(ym)))).filter((f): f is number => !!f && f > 0);
    if (fr.length) {
      hist.forEach(([ym]) => refs.add(ym));
      const est = vendido / (fr.reduce((a, b) => a + b, 0) / fr.length);
      const meta = textoMeta(op.metas ?? [], mes, "faturamento", nomes, rede, est, brl);
      blocos.push({ valor: brl(est), nome: "Faturamento", detalhe: [`${brl(vendido)} até ${data(mes, op.fechados)}`, meta].filter(Boolean).join(" · ") });
    }
  }
  if (!blocos.length) return null;
  const meses_ = [...refs].sort().map(nomeMes).join(", ");
  return {
    id: ID_PROJECAO, titulo: "Projeção de fechamento", subtitulo: `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)} · dados até ${data(mes, op.fechados)}`, blocos,
    nota: `Estimativa: o realizado dividido pela parte do mês que costuma estar vendida até este dia (curva de ${meses_}). Os números grandes são onde o mês deve fechar.`,
  };
}

/** Saldo de alunos ativos no mês: início, entradas (novos e retornos), saídas (cancelados e vencidos) e o saldo. */
export function slideSaldo(meses: MonthData[], mes: string, nomes: string[], op: OpcoesExtras): SlideExtra | null {
  const us = (meses.find((x) => x.month === mes)?.units ?? []).filter((u) => nomes.includes(u.name) && u.ativosIni !== undefined && u.ativosFim !== undefined);
  if (!us.length) return null;
  const ini = soma(us, (u) => u.ativosIni), fim = soma(us, (u) => u.ativosFim), saldo = fim - ini;
  const temFluxo = us.every((u) => u.fluxoNovos !== undefined);
  const novos = soma(us, (u) => u.fluxoNovos), ret = soma(us, (u) => u.fluxoRetornos), canc = soma(us, (u) => u.fluxoCancelados), venc = soma(us, (u) => u.fluxoVencidos);
  const ultimoDia = op.parcial ? op.fechados : diasNoMes(mes);
  const [y, m] = mes.split("-").map(Number);
  const vespera = new Date(Date.UTC(y, m - 1, 0));
  const blocos: BlocoExtra[] = [
    { valor: int(ini), nome: "Ativos no início", detalhe: `em ${dd(vespera.getUTCDate())}/${dd(vespera.getUTCMonth() + 1)}` },
    ...(temFluxo ? [
      { valor: `+${int(novos + ret)}`, nome: "Entradas", detalhe: `${int(novos)} novos · ${int(ret)} retornos` },
      { valor: `−${int(canc + venc)}`, nome: "Saídas", detalhe: `${int(canc)} cancelados · ${int(venc)} vencidos (sem renovar)` },
    ] : []),
    { valor: `${saldo >= 0 ? "+" : "−"}${int(Math.abs(saldo))}`, nome: "Saldo líquido", detalhe: `${int(fim)} ativos ${op.parcial ? "na última leitura do EVO" : `em ${data(mes, ultimoDia)}`}`, cor: saldo >= 0 ? "bom" : "ruim" },
  ];
  return {
    id: ID_SALDO, titulo: "Saldo de alunos", subtitulo: `${op.parcial ? `1 a ${data(mes, Math.max(1, ultimoDia))}` : `${MESES[m - 1]}/${String(y).slice(2)}`} · ${us.length === 1 ? us[0].name : `${us.length} unidades`}`, blocos,
    nota: "Saldo = ativos no fim − ativos no início. Saídas sem cancelamento são contratos que acabaram e não foram renovados.",
  };
}

/** Novos contratos nos dias da campanha, contra o ritmo do resto do mês. O EVO não marca a campanha na venda: conta tudo o que foi vendido nesses dias. */
export function slideCampanha(meses: MonthData[], mes: string, nomes: string[], op: OpcoesExtras): SlideExtra | null {
  const c = op.campanha;
  const total = diasNoMes(mes);
  if (!c || !Number.isInteger(c.de) || !Number.isInteger(c.ate) || c.de < 1 || c.ate < c.de || c.de > total) return null;
  const ate = Math.min(c.ate, total, op.fechados);
  if (ate < c.de) return null;
  const us = (meses.find((x) => x.month === mes)?.units ?? []).filter((u) => nomes.includes(u.name));
  const dias = vendasPorDia(us);
  if (!dias) return null;
  const naCampanha = dias.slice(c.de - 1, ate).reduce((a, b) => a + b, 0);
  const nCamp = ate - c.de + 1;
  const fora = dias.slice(0, op.fechados).reduce((a, b, i) => (i + 1 >= c.de && i + 1 <= ate ? a : a + b), 0);
  const nFora = op.fechados - nCamp;
  const porDia = naCampanha / nCamp, porDiaFora = nFora > 0 ? fora / nFora : null;
  const varia = porDiaFora && porDiaFora > 0 ? ((porDia - porDiaFora) / porDiaFora) * 100 : null;
  const fmt1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const nome = c.nome.trim() || "Campanha";
  const emAndamento = c.ate > ate;
  const blocos: BlocoExtra[] = [
    { valor: int(naCampanha), nome: "Novos contratos", detalhe: `de ${data(mes, c.de)} a ${data(mes, ate)}${emAndamento ? " (campanha em andamento)" : ""}` },
    { valor: fmt1(porDia), nome: "Por dia na campanha", detalhe: `${nCamp} ${nCamp === 1 ? "dia" : "dias"}`, ...(varia !== null ? { cor: varia >= 0 ? "bom" : "ruim" } as const : {}) },
    ...(porDiaFora !== null ? [{ valor: fmt1(porDiaFora), nome: "Por dia no resto do mês", detalhe: varia !== null ? `campanha ${varia >= 0 ? "+" : ""}${fmt1(varia)}% sobre o ritmo normal` : null }] : []),
  ];
  return {
    id: ID_CAMPANHA, titulo: nome.toUpperCase().length > 26 ? "Campanha" : nome, subtitulo: `${data(mes, c.de)} a ${data(mes, c.ate)} · ${us.length === 1 ? us[0].name : `${us.length} unidades`}`, blocos,
    nota: "Conta todos os novos contratos vendidos nesses dias, pelo dia da venda no EVO (o EVO não marca de qual campanha veio a venda).",
  };
}

/** Os slides extras marcados, na ordem do menu. `nomes` = unidades do relatório; `rede` = todas as unidades (para a meta da rede). */
export function montarExtras(meses: MonthData[], mes: string, escolhidos: string[], nomes: string[], rede: boolean, op: OpcoesExtras): SlideExtra[] {
  const s = new Set(escolhidos);
  return [
    s.has(ID_PROJECAO) ? slideProjecao(meses, mes, nomes, rede, op) : null,
    s.has(ID_SALDO) ? slideSaldo(meses, mes, nomes, op) : null,
    s.has(ID_CAMPANHA) ? slideCampanha(meses, mes, nomes, op) : null,
  ].filter((x): x is SlideExtra => !!x);
}
