import { ALERT_LABELS, type Recommendation } from "@/data/recommendations";
import { formatMonthLong } from "@/data/periods";

const SEV = { critical: "🔴 Crítico", attention: "🟠 Atenção", info: "ℹ️ Informativo" } as const;
export const DISCLAIMER = "_Recomendação gerada pela IA da World Gym Brasil e pode cometer erros. Por isso, lembre-se de conferir informações relevantes._";

const bullets = (items: string[]) => items.map((i) => `• ${i}`).join("\n");

/**
 * Texto de um risco/recomendação para copiar e colar no WhatsApp (*negrito* e _itálico_ do próprio WhatsApp).
 * Mantém a separação do dashboard: fato (dos dados) × hipóteses (a verificar).
 */
export function recommendationText(rec: Recommendation, evalMonth?: string | null): string {
  const parts = [
    `*${SEV[rec.severity]} • ${rec.unit}*`,
    `_${ALERT_LABELS[rec.kind]}_`,
    "",
    `*Fato (dos dados):* ${rec.fact}`,
  ];
  if (rec.yoy) parts.push("", `*Ano anterior:* ${rec.yoy.fact}`);
  const ev = [...rec.evidence.signals, ...rec.evidence.context];
  if (ev.length) parts.push("", "*O que os dados indicam:*", bullets(ev));
  if (rec.evidence.quiet.length) parts.push(`Sem sinal relevante em: ${rec.evidence.quiet.join(", ").toLowerCase()}.`);
  const tag = { indicio: " (indício nos dados)", "sem-indicio": " (sem sinal nos dados)", neutro: "" } as const;
  parts.push(
    "", "*Hipóteses (a verificar, não confirmadas):*", bullets(rec.hypotheses.map((h) => `${h.text}${tag[h.support]}`)),
    "", "*Como investigar:*", bullets(rec.investigate),
    "", "*Ação sugerida:*", bullets(rec.correct),
    "", `*Acompanhar:* ${rec.followUp}`,
    ...(evalMonth ? ["", `_Avaliação do mês fechado: ${formatMonthLong(evalMonth)}_`] : []),
    "", DISCLAIMER,
  );
  return parts.join("\n");
}
