import { type KpiSpec } from "@/components/kpi/KpiGrid";
import { sumUnits, type MonthView } from "@/data/kpiView";
import { type MetricDetail } from "@/components/MetricCard";
import { ltv, receitaComplementar, saldoAlunos, type UnitData } from "@/data/dashboardData";
import { formatAbbreviatedNumber } from "@/lib/utils";
// formatAbbreviatedNumber segue usado nos demais cartões

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
const score = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** Receitas complementares não têm direção favorável definida: cor neutra. */
const complementar = (title: string, pick: KpiSpec["pick"]): KpiSpec => ({ title, kind: "flow", direction: null, noDataIfZero: true, projecao: true, pick, fmt: brl });

/**
 * Conversão como no cartão "Visitantes x conversões" do Dashboard do EVO: convertidos (com contrato vendido, sem VIP) ÷ visitantes (presenciais).
 * Os meses lidos antes dessa regra seguem com a conversão por cadastros (oportunidades).
 */
export const taxaDoCartao = (v: MonthView): number => (v.total.visitantes ? Math.round(((v.total.convertidos ?? 0) / v.total.visitantes) * 1000) / 10 : v.total.icv);

/** Abaixo do velocímetro de conversão (Comercial e Overview): quantos visitantes e quantos convertidos, como no EVO. */
export const oportunidadesCadastradas = (v: MonthView): MetricDetail[] => {
  if (v.total.visitantes) return [{ text: `${int(v.total.visitantes)} visitantes · ${int(v.total.convertidos ?? 0)} convertidos`, tone: "neutral" }];
  return v.total.oportunidades > 0 ? [{ text: `${int(v.total.oportunidades)} oportunidades cadastradas`, tone: "neutral" }] : [];
};

/** Número do cartão de faturamento: exato até 1 milhão (como no EVO) e "R$ 5,57 mi" daí para cima, para caber no medidor. */
export const brlCurto = (v: number) => (Math.abs(v) >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi` : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }));

/**
 * O ÚNICO cartão de faturamento do Atlas (Overview, Financeiro e Comercial): o Total de Vendas do EVO, somando recepção, cartão recorrente e online.
 * Os mesmos números, com o mesmo nome, em todas as telas.
 */
export const faturamentoSpec: KpiSpec = {
  title: "Faturamento", kind: "flow", noDataIfZero: true, direction: "higher",
  pick: (v) => v.total.faturamento, fmt: brlCurto,
};

export const comercialSpecs: KpiSpec[] = [
  faturamentoSpec,
  {
    title: "Contratos Vendidos", kind: "flow", noDataIfZero: true, semTextoDoMesAnterior: true, projecao: true, pick: (v) => sumUnits(v, (u) => u.vendasContratos ?? 0), fmt: int,
    // Do total, quantos são contratos especiais (VIP e cortesias de valor R$ 0): explica a diferença para o EVO em algumas unidades
    extra: (v) => { const n = sumUnits(v, (u) => u.vendasContratosEspeciais ?? 0); return n > 0 ? [{ text: `${int(n)} ${n === 1 ? "é contrato especial" : "são contratos especiais"}`, tone: "neutral" }] : []; },
  },
  { title: "Saldo de Clientes", kind: "flow", pick: (v) => sumUnits(v, (u) => u.novosContratos) - v.total.cancelados, fmt: int },
  {
    title: "Conversão de Cadastros", kind: "rate", rateKey: "icv", pick: taxaDoCartao, fmt: pct,
    extra: oportunidadesCadastradas,
  },
  {
    title: "Vendas Online", kind: "flow", projecao: true, pick: (v) => v.total.vendasOnline, fmt: brl,
    extra: (v) => (v.total.faturamento ? [{ text: `${((v.total.vendasOnline / v.total.faturamento) * 100).toFixed(2).replace(".", ",")}% do faturamento`, tone: "neutral" }] : []),
  },
];

/** Receitas complementares: o total (com a participação no faturamento) e cada uma das sete. */
export const complementaresSpecs: KpiSpec[] = [
  {
    ...complementar("Receita Complementar", (v) => receitaComplementar(v.total)),
    extra: (v) => (v.total.faturamento ? [{ text: `${((receitaComplementar(v.total) / v.total.faturamento) * 100).toFixed(2).replace(".", ",")}% do faturamento`, tone: "neutral" }] : []),
  },
  complementar("Diárias", (v) => v.total.diarias),
  complementar("Taxa de Personal", (v) => v.total.personal),
  complementar("Brinquedoteca", (v) => v.total.kids ?? 0),
  complementar("WG Plus", (v) => v.total.plus ?? 0),
  complementar("Pro+", (v) => v.total.proMais ?? 0),
  complementar("Camisetas", (v) => v.total.camisetas),
  complementar("Coqueteleiras", (v) => v.total.coqueteleiras),
];

export const financeiroSpecs: KpiSpec[] = [
  faturamentoSpec,
  { title: "Pagamentos dos clientes", kind: "flow", pick: (v) => v.total.recebimento, fmt: formatAbbreviatedNumber },
  // Ticket = pagamentos dos clientes ÷ ativos: no mês em andamento acumula como o recebimento (comparado como fluxo).
  { title: "Ticket Médio", kind: "flow", pick: (v) => v.total.ticketMedio, fmt: brl },
];

/** Nota do Reclame Aqui só existe para a rede (a planilha não a traz por unidade). */
export const retencaoSpecs = (withReclameAqui: boolean): KpiSpec[] => [
  { title: "Adimplentes", kind: "level", pick: (v) => v.total.adimplentes, fmt: int },
  { title: "Renovação", kind: "rate", rateKey: "renovacoes", pick: (v) => v.total.renovacoes, fmt: pct },
  { title: "Churn", kind: "rate", rateKey: "churn", pick: (v) => v.total.churn, fmt: pct },
  { title: "Inadimplência", kind: "rate", rateKey: "inadimplenciaPerc", pick: (v) => v.total.inadimplenciaPerc, fmt: pct },
  { title: "Nota do Google", kind: "level", noDataIfZero: true, pick: (v) => v.total.notaGoogle, fmt: score },
  {
    title: "NPS", kind: "level", noDataIfZero: true, pick: (v) => v.total.nps, fmt: score,
    // Promotores, neutros e detratores que formam o NPS (WeHelp): o NPS sozinho esconde quantos reclamaram
    extra: (v) => {
      const r = v.total.npsRespostas, p = v.total.npsPromotores, d = v.total.npsDetratores;
      if (!r || p === undefined || d === undefined) return [];
      return [{ text: `${int(p)} promotores · ${int(r - p - d)} neutros · ${int(d)} detratores (${int(r)} respostas)`, tone: "neutral" }];
    },
  },
  ...(withReclameAqui ? [{ title: "Nota Reclame Aqui", kind: "level", noDataIfZero: true, pick: (v) => v.total.reclameAqui, fmt: score } as KpiSpec] : []),
];

const meses = (v: number) => `${v.toFixed(1).replace(".", ",")} meses`;
const sinal = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("pt-BR")}`;

/** Clientes: base de alunos ativos, saldo do mês, permanência média e LTV (tudo do EVO). */
export const clientesSpecs: KpiSpec[] = [
  {
    title: "Alunos Ativos", kind: "level", noDataIfZero: true, pick: (v) => v.total.ativosFim ?? 0, fmt: int,
    // Suspensos (contrato trancado) seguem nos ativos; o número sai à parte, como no EVO Insights.
    extra: (v) => {
      const s = v.total.suspensosFim, a = v.total.ativosFim;
      if (s === undefined || !a) return [];
      return [{ text: `${int(s)} ${s === 1 ? "suspenso" : "suspensos"} (contrato trancado) · ${pct((s / a) * 100)}`, tone: "neutral" }];
    },
  },
  { title: "Saldo de Alunos", kind: "flow", noDataIfZero: true, pick: (v) => saldoAlunos(v.total) ?? 0, fmt: sinal },
  { title: "Permanência Média", kind: "level", noDataIfZero: true, pick: (v) => v.total.permanenciaMeses ?? 0, fmt: meses },
  { title: "LTV", kind: "flow", noDataIfZero: true, pick: (v) => ltv(v.total), fmt: brl },
];
