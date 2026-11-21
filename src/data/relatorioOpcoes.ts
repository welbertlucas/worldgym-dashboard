// Opções do menu Relatórios: uma lista só, agrupada por assunto, com o que existe no mês fechado e na semana, e a prévia dos números de cada item marcado.
import { ID_BIG, ID_COMPL, ID_FREQ, ID_METAS, ID_SATISF, RANKINGS, fmtValor, type ModeloRelatorio } from "@/data/relatorio";
import { ID_CONVERSAO, ID_MES_ATE_AQUI, ID_PLANO, SEMANAIS } from "@/data/relatorioSemana";

export interface OpcaoRelatorio {
  id: string;
  /** Existe no relatório de mês fechado / de semana (o que não existe aparece apagado). */
  mes: boolean;
  semana: boolean;
}
export interface GrupoRelatorio { titulo: string; itens: OpcaoRelatorio[] }

const o = (id: string, mes: boolean, semana: boolean): OpcaoRelatorio => ({ id, mes, semana });

/** Todos os itens que dá para marcar, por assunto. A ordem dos slides continua a do modelo (Overview, indicadores, complementares, satisfação, metas, frequência, plano). */
export const GRUPOS_DO_RELATORIO: GrupoRelatorio[] = [
  { titulo: "Visão geral", itens: [o(ID_BIG, true, true), o(ID_MES_ATE_AQUI, false, true), o(ID_METAS, true, false)] },
  { titulo: "Faturamento e vendas", itens: [o("fat", true, true), o("cresc", true, false), o("rec", false, true), o("nc", true, true), o("cv", true, true), o("vo", true, true), o("op", true, true), o(ID_CONVERSAO, false, true), o("tk", true, false), o(ID_COMPL, true, true)] },
  { titulo: "Retenção e cobrança", itens: [o("ad", true, false), o("inad", true, false), o("churn", true, false), o("canc", true, true), o("ren", true, false)] },
  { titulo: "Satisfação", itens: [o(ID_SATISF, true, false)] },
  { titulo: "Alunos", itens: [o(ID_FREQ, true, true)] },
  { titulo: "Plano de ação", itens: [o(ID_PLANO, true, true)] },
];

/** Todos os ids que existem (para limpar escolhas antigas guardadas). */
export const TODOS_OS_IDS = new Set(GRUPOS_DO_RELATORIO.flatMap((g) => g.itens.map((i) => i.id)));

/** Nome do item na lista, no mês ou na semana. */
export const AVISO_DO_RECEBIMENTO = "Recebimento = o que entrou no período, como no EVO: inclui títulos vencidos de meses anteriores pagos agora.";

export function rotuloDaOpcao(id: string, tipo: "mes" | "semana"): string {
  if (id === ID_BIG) return tipo === "mes" ? "Overview (faturamento, adimplentes, novos contratos, contratos vendidos, ticket, inadimplência, vendas online e conversão)" : "Overview (faturamento, recebimento, novos contratos, contratos vendidos, vendas online, oportunidades, cancelamentos e conversão)";
  if (id === ID_MES_ATE_AQUI) return "O mês até aqui (em letras menores, no slide Overview, com a meta e o mesmo ponto do mês anterior)";
  if (id === ID_METAS) return "Metas do mês (resultado e nível atingido: bronze, prata ou ouro)";
  if (id === ID_CONVERSAO) return "Conversão (com a base: convertidas de cadastradas)";
  if (id === ID_COMPL) return "Receitas complementares (um slide só, com a legenda do que são)";
  if (id === ID_FREQ) return `Frequência dos alunos (mapa de calor do período e último check-in)${tipo === "semana" ? " · o mapa é do mês até aqui" : ""}`;
  if (id === ID_SATISF) return "Satisfação (NPS, nota no Google e no Reclame Aqui, num slide só)";
  if (id === ID_PLANO) return "Plano de ação da unidade (itens em aberto do mês em andamento)";
  return (tipo === "mes" ? RANKINGS.find((r) => r.id === id)?.rotulo : SEMANAIS.find((r) => r.id === id)?.rotulo) ?? RANKINGS.find((r) => r.id === id)?.rotulo ?? id;
}

const sinal = (v: number, pp = false) => `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${pp ? " p.p." : "%"}`;

/** Uma linha com os números que o slide vai trazer (null = o item não gera slide neste período). */
export function previaDoItem(m: ModeloRelatorio, id: string): string | null {
  if (id === ID_BIG) return m.big ? m.big.slice(0, 3).map((k) => `${k.nome} ${k.valor}`).join(" · ") : null;
  if (id === ID_MES_ATE_AQUI) return m.mesAteAqui?.itens.length ? m.mesAteAqui.itens.slice(0, 2).map((k) => `${k.nome} ${k.valor}`).join(" · ") + ` (${m.mesAteAqui.periodo})` : null;
  if (id === ID_COMPL) return m.complementares ? `R$ ${Math.round(m.complementares.total).toLocaleString("pt-BR")} em receitas complementares` : null;
  if (id === ID_FREQ) return m.frequencia ? [m.frequencia.entradas ? `${m.frequencia.entradas.toLocaleString("pt-BR")} entradas` : "", m.frequencia.ultimoCheckin ? `${m.frequencia.ultimoCheckin.total.toLocaleString("pt-BR")} alunos ativos no último check-in` : ""].filter(Boolean).join(" · ") : null;
  if (id === ID_SATISF) return m.satisfacao ? m.satisfacao.notas.map((n) => `${n.nome} ${n.valor}`).join(" · ") : null;
  if (id === ID_METAS) return m.metas ? `${m.metas.linhas.length} ${m.metas.linhas.length === 1 ? "meta" : "metas"} · ${m.metas.escopoTexto}` : null;
  if (id === ID_PLANO) return m.plano ? `plano de ${m.plano.unidade}` : null;
  const r = m.rankings.find((x) => x.id === id);
  if (!r) return null;
  if (r.cartao) return r.cartao.valor + (r.cartao.variacao !== null ? ` (${sinal(r.cartao.variacao, !!r.cartao.emPontos)})` : "");
  const [nome, v] = r.itens[0] ?? [];
  return nome === undefined ? null : `1º ${nome}: ${fmtValor(r.formato, v as number)}`;
}
