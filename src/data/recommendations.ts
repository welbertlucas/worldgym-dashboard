import { type Alert, type AlertKind, type Severity, type YoyReading } from "@/data/alerts";

// Recomendações por regra (sem IA e sem chamada externa). Cada uma separa o FATO (vem do alerta,
// calculado da planilha) das HIPÓTESES (causas a verificar — nunca afirmadas) e das AÇÕES.
interface Template {
  hypotheses: string[];
  investigate: string[];
  correct: string[];
  followUp: string;
}

const TEMPLATES: Record<AlertKind, Template> = {
  faturamento: {
    hypotheses: ["Queda de novos contratos ou de renovações no período", "Aumento de cancelamentos ou de inadimplência", "Mudança de preço/mix de planos ou desconto promocional", "Evento pontual (obra, fechamento parcial, feriados)"],
    investigate: ["Abrir a aba Comercial/Retenção da unidade e comparar novos contratos, cancelados e renovação com o mês anterior", "Confirmar com o gerente se houve evento pontual no mês"],
    correct: ["Se for perda de entrada: reforçar ação comercial local; se for perda de base: plano de retenção para a carteira em risco"],
    followUp: "Faturamento da unidade no próximo mês fechado vs. mês atual",
  },
  vendasOnline: {
    hypotheses: ["Campanha ou link de venda online parado/mal divulgado", "Problema de integração ou meio de pagamento", "Sazonalidade (a série é naturalmente instável)"],
    investigate: ["Verificar se o canal de venda online da unidade estava ativo e divulgado no mês", "Conferir se o lançamento da planilha está completo (valor zerado pode ser falta de lançamento)"],
    correct: ["Retomar divulgação do link/campanha da unidade e acompanhar semanalmente"],
    followUp: "Vendas online do mês seguinte vs. média dos 3 meses anteriores",
  },
  churn: {
    hypotheses: ["Vencimento de planos contratados em campanha anterior", "Insatisfação (verificar Nota Google/NPS da unidade)", "Concorrência nova na região", "Falha no processo de renovação"],
    investigate: ["Levantar motivos de cancelamento da unidade no mês (a planilha não os tem)", "Comparar churn com renovação e inadimplência da mesma unidade"],
    correct: ["Contato ativo com alunos em fim de contrato e com baixa frequência; revisar o processo de renovação"],
    followUp: "Churn da unidade no próximo mês fechado (meta: voltar abaixo de 8%)",
  },
  inadimplencia: {
    hypotheses: ["Falha ou atraso na cobrança recorrente", "Concentração de vencimentos no período", "Perfil de plano/forma de pagamento da unidade"],
    investigate: ["Levantar a lista de inadimplentes da unidade e o tempo de atraso", "Verificar a taxa de recuperação das últimas semanas"],
    correct: ["Régua de cobrança ativa (contato, renegociação) e revisão da forma de pagamento recorrente"],
    followUp: "Inadimplência % e recebimento ÷ faturamento no próximo mês fechado",
  },
  recebimento: {
    hypotheses: ["Inadimplência elevada", "Descompasso entre competência e caixa", "Erro de lançamento"],
    investigate: ["Conferir se o recebimento foi lançado por completo e comparar com a inadimplência da unidade"],
    correct: ["Se confirmado atraso de caixa: ação de cobrança; se erro: corrigir o lançamento na planilha"],
    followUp: "Razão recebimento ÷ faturamento no próximo mês fechado",
  },
  meta: {
    hypotheses: ["Meta exigente para o momento da unidade", "O desvio vem de um indicador que já tem outro alerta (veja os demais itens da mesma unidade)"],
    investigate: ["Cruzar com os alertas da unidade para o mesmo indicador e conferir quanto falta para o bronze", "Revisar com o gestor se a meta bronze é realista para o mês"],
    correct: ["Plano de ação com prazo para chegar ao bronze; depois, definir o passo para a prata"],
    followUp: "Nível de meta atingido no próximo mês fechado",
  },
  yoyFaturamento: {
    hypotheses: ["Perda de tração ao longo do ano (base de alunos menor que a do mesmo mês do ano anterior)", "Mudança de preço, mix de planos ou desconto em relação ao ano anterior", "Concorrência nova na região ou mudança no entorno da unidade"],
    investigate: ["Comparar adimplentes, novos contratos e cancelados da unidade com o mesmo mês do ano anterior", "Verificar se a unidade passou por obra, mudança de horário ou de equipe no período"],
    correct: ["Plano de recuperação com meta de adimplentes e de novos contratos para os próximos meses"],
    followUp: "Faturamento vs. mesmo mês do ano anterior no próximo mês fechado",
  },
  yoyChurn: {
    hypotheses: ["Retenção estruturalmente pior que a do ano anterior", "Perfil de contratos diferente (mais planos curtos ou promocionais)", "Queda de satisfação (verificar Nota Google/NPS)"],
    investigate: ["Levantar motivos de cancelamento do mês (a planilha não os tem) e comparar com a política de retenção do ano anterior"],
    correct: ["Revisar a rotina de contato com alunos em risco e o processo de renovação"],
    followUp: "Churn vs. mesmo mês do ano anterior no próximo mês fechado",
  },
  yoyInadimplencia: {
    hypotheses: ["Cobrança recorrente menos efetiva que a do ano anterior", "Mudança na forma de pagamento predominante", "Perfil de alunos/planos com mais atraso"],
    investigate: ["Levantar a lista de inadimplentes e o tempo de atraso, e comparar com a régua de cobrança do ano anterior"],
    correct: ["Reforçar régua de cobrança e renegociação"],
    followUp: "Inadimplência vs. mesmo mês do ano anterior no próximo mês fechado",
  },
  yoyRenovacao: {
    hypotheses: ["Processo de renovação menos ativo que no ano anterior", "Contratos vencendo em campanhas que renovam menos"],
    investigate: ["Verificar quantos contratos venceram no mês e quantos receberam contato antes do vencimento"],
    correct: ["Contato ativo antes do vencimento e oferta de renovação antecipada"],
    followUp: "Renovação vs. mesmo mês do ano anterior no próximo mês fechado",
  },
  yoyNovosContratos: {
    hypotheses: ["Menor volume de captação (campanhas, equipe comercial, divulgação) que no ano anterior", "Mudança no tipo de contrato vendido (menos contratos, ticket diferente)", "Saturação ou concorrência na região"],
    investigate: ["Comparar oportunidades, conversão e esforço comercial da unidade com o mesmo mês do ano anterior", "Se a queda é geral na rede, conferir a política comercial e de preços do período"],
    correct: ["Plano comercial com meta de contratos; se a queda for da rede inteira, tratar como decisão de diretoria"],
    followUp: "Novos contratos vs. mesmo mês do ano anterior no próximo mês fechado",
  },
  yoyVendasOnline: {
    hypotheses: ["Canal online menos divulgado ou menos usado que no ano anterior", "Mudança de plataforma ou de meio de pagamento", "Migração de vendas para o balcão"],
    investigate: ["Verificar campanhas e links de venda online ativos no mês e comparar com o ano anterior"],
    correct: ["Retomar divulgação do canal online e acompanhar semanalmente"],
    followUp: "Vendas online vs. mesmo mês do ano anterior no próximo mês fechado",
  },
  dado: {
    hypotheses: ["Unidade ainda não lançada no mês", "Unidade encerrada/renomeada"],
    investigate: ["Conferir a planilha: a linha da unidade foi lançada?"],
    correct: ["Lançar ou corrigir o dado na planilha"],
    followUp: "Presença da unidade no próximo mês",
  },
};

export interface Recommendation {
  id: string;
  unit: string;
  kind: AlertKind;
  severity: Severity;
  priority: number;
  fact: string;
  rule: string;
  yoy?: YoyReading;
  hypotheses: string[];
  investigate: string[];
  correct: string[];
  followUp: string;
}

const sevScore: Record<Severity, number> = { critical: 3, attention: 2, info: 0.5 };

/** Prioridade = severidade × (peso da unidade no faturamento da rede, com piso para não zerar unidades pequenas). */
export function buildRecommendations(alerts: Alert[]): Recommendation[] {
  return alerts
    .map((a) => {
      const t = TEMPLATES[a.kind];
      return {
        id: a.id, unit: a.unit, kind: a.kind, severity: a.severity,
        priority: sevScore[a.severity] * (0.5 + Math.min(a.weight, 0.2) * 5),
        fact: a.fact, rule: a.rule, yoy: a.yoy,
        hypotheses: t.hypotheses, investigate: t.investigate, correct: t.correct, followUp: t.followUp,
      };
    })
    .sort((x, y) => y.priority - x.priority);
}

export const ALERT_LABELS: Record<AlertKind, string> = {
  faturamento: "Queda de faturamento",
  vendasOnline: "Queda de vendas online",
  churn: "Churn elevado ou em alta",
  inadimplencia: "Inadimplência elevada ou em alta",
  recebimento: "Recebimento baixo",
  meta: "Desvio de meta",
  dado: "Dado ausente",
  yoyFaturamento: "Faturamento abaixo do ano anterior",
  yoyChurn: "Churn acima do ano anterior",
  yoyInadimplencia: "Inadimplência acima do ano anterior",
  yoyRenovacao: "Renovação abaixo do ano anterior",
  yoyNovosContratos: "Novos contratos abaixo do ano anterior",
  yoyVendasOnline: "Vendas online abaixo do ano anterior",
};
