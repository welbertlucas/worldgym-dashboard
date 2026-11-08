import { type KpiSpec } from "@/components/kpi/KpiGrid";
import { sumUnits } from "@/data/kpiView";
import { ltv, receitaComplementar, saldoAlunos } from "@/data/dashboardData";
import { formatAbbreviatedNumber } from "@/lib/utils";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
const score = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** Receitas complementares não têm direção favorável definida: cor neutra. */
const complementar = (title: string, pick: KpiSpec["pick"]): KpiSpec => ({ title, kind: "flow", direction: null, noDataIfZero: true, projecao: true, pick, fmt: brl });

export const comercialSpecs: KpiSpec[] = [
  { title: "Novos Contratos", kind: "flow", projecao: true, pick: (v) => sumUnits(v, (u) => u.novosContratos), fmt: int },
  { title: "Saldo de Clientes", kind: "flow", pick: (v) => sumUnits(v, (u) => u.novosContratos) - v.total.cancelados, fmt: int },
  { title: "Conversão de Cadastros", kind: "rate", rateKey: "icv", pick: (v) => v.total.icv, fmt: pct },
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
  { title: "Faturamento", kind: "flow", pick: (v) => v.total.faturamento, fmt: formatAbbreviatedNumber },
  { title: "Recebimento", kind: "flow", pick: (v) => v.total.recebimento, fmt: formatAbbreviatedNumber },
  { title: "Ticket Médio", kind: "level", pick: (v) => v.total.ticketMedio, fmt: brl },
];

/** Nota do Reclame Aqui só existe para a rede (a planilha não a traz por unidade). */
export const retencaoSpecs = (withReclameAqui: boolean): KpiSpec[] => [
  { title: "Adimplentes", kind: "level", pick: (v) => v.total.adimplentes, fmt: int },
  { title: "Renovação", kind: "rate", rateKey: "renovacoes", pick: (v) => v.total.renovacoes, fmt: pct },
  { title: "Churn", kind: "rate", rateKey: "churn", pick: (v) => v.total.churn, fmt: pct },
  { title: "Inadimplência", kind: "rate", rateKey: "inadimplenciaPerc", pick: (v) => v.total.inadimplenciaPerc, fmt: pct },
  { title: "Nota do Google", kind: "level", noDataIfZero: true, pick: (v) => v.total.notaGoogle, fmt: score },
  { title: "NPS", kind: "level", noDataIfZero: true, pick: (v) => v.total.nps, fmt: score },
  ...(withReclameAqui ? [{ title: "Nota Reclame Aqui", kind: "level", noDataIfZero: true, pick: (v) => v.total.reclameAqui, fmt: score } as KpiSpec] : []),
];

const meses = (v: number) => `${v.toFixed(1).replace(".", ",")} meses`;
const sinal = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString("pt-BR")}`;

/** Clientes: base de alunos ativos, saldo do mês, permanência média e LTV (tudo do EVO). */
export const clientesSpecs: KpiSpec[] = [
  { title: "Alunos Ativos", kind: "level", noDataIfZero: true, pick: (v) => v.total.ativosFim ?? 0, fmt: int },
  { title: "Saldo de Alunos", kind: "flow", noDataIfZero: true, pick: (v) => saldoAlunos(v.total) ?? 0, fmt: sinal },
  { title: "Permanência Média", kind: "level", noDataIfZero: true, pick: (v) => v.total.permanenciaMeses ?? 0, fmt: meses },
  { title: "LTV", kind: "level", noDataIfZero: true, pick: (v) => ltv(v.total), fmt: brl },
];
