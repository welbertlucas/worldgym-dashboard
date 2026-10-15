import { type KpiSpec } from "@/components/kpi/KpiGrid";
import { sumUnits } from "@/data/kpiView";
import { formatAbbreviatedNumber } from "@/lib/utils";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
const score = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** Receitas complementares não têm direção favorável definida: cor neutra. */
const complementar = (title: string, pick: KpiSpec["pick"]): KpiSpec => ({ title, kind: "flow", direction: null, noDataIfZero: true, pick, fmt: brl });

export const comercialSpecs: KpiSpec[] = [
  { title: "Novos Contratos", kind: "flow", pick: (v) => sumUnits(v, (u) => u.novosContratos), fmt: int },
  { title: "Saldo de Clientes", kind: "flow", pick: (v) => sumUnits(v, (u) => u.novosContratos) - v.total.cancelados, fmt: int },
  { title: "Taxa de Conversão", kind: "rate", rateKey: "icv", pick: (v) => v.total.icv, fmt: pct },
  {
    title: "Vendas Online", kind: "flow", pick: (v) => v.total.vendasOnline, fmt: brl,
    extra: (v) => (v.total.faturamento ? [{ text: `${((v.total.vendasOnline / v.total.faturamento) * 100).toFixed(2).replace(".", ",")}% do faturamento`, tone: "neutral" }] : []),
  },
  complementar("Diárias", (v) => v.total.diarias),
  complementar("Taxa de Personal", (v) => v.total.personal),
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
