import { ALERT_LABELS, type Recommendation } from "@/data/recommendations";
import { formatMonthLong } from "@/data/periods";

const SEV = { critical: "🔴 Crítico", attention: "🟠 Atenção", info: "ℹ️ Informativo" } as const;
export const DASHBOARD_URL = "https://welbertlucas.github.io/worldgym-dashboard/";

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
  parts.push(
    "", "*Hipóteses (a verificar, não confirmadas):*", bullets(rec.hypotheses),
    "", "*Como investigar:*", bullets(rec.investigate),
    "", "*Ação sugerida:*", bullets(rec.correct),
    "", `*Acompanhar:* ${rec.followUp}`,
    "", `_World Gym Brasil • dashboard${evalMonth ? ` • avaliação de ${formatMonthLong(evalMonth)}` : ""}_`, DASHBOARD_URL,
  );
  return parts.join("\n");
}
