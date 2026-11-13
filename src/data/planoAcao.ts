import { ALERT_LABELS, type Recommendation } from "@/data/recommendations";
import { agruparPorUnidade, type GrupoRisco } from "@/data/riscosGrupos";
import { DISCLAIMER } from "@/data/shareText";
import { formatMonthLong } from "@/data/periods";
import { TREND_META, type TrendKey, type UnitDelta } from "@/data/unitMetrics";

/**
 * Plano de ação: o que fazer em cada unidade, a partir dos alertas críticos e de atenção do último mês fechado. A tela
 * Alertas explica o que aconteceu e as hipóteses; aqui fica só a ação, em texto curto para mandar ao gestor ou à equipe.
 */

const EMOJI = { critical: "🔴", attention: "🟠", info: "ℹ️" } as const;

/** Só o que pede ação (críticos e atenção), agrupado por unidade: a rede primeiro, depois quem tem mais críticos. */
export const gruposDoPlano = (recs: Recommendation[]): GrupoRisco[] => agruparPorUnidade(recs.filter((r) => r.severity !== "info"));

const num1 = (n: number) => Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** O que melhorou na unidade no mês avaliado (vs. o anterior), até 3 indicadores: "Faturamento +21,5%". */
export function destaquesDaUnidade(unit: string, deltas: UnitDelta[]): string[] {
  const d = deltas.find((x) => x.unit === unit);
  if (!d) return [];
  return (Object.keys(TREND_META) as TrendKey[])
    .filter((k) => {
      const m = TREND_META[k], v = d.deltas[k];
      return Math.abs(v) >= (m.mode === "pct" ? 0.5 : 0.1) && (v > 0) === m.higherIsBetter;
    })
    .slice(0, 3)
    .map((k) => {
      const m = TREND_META[k], v = d.deltas[k];
      return `${m.label} ${v > 0 ? "+" : "−"}${num1(v)}${m.mode === "pct" ? "%" : " p.p."}`;
    });
}

/** A lista de destaques numa frase, com ponto final sem dobrar o de "p.p.". */
export const fraseDeDestaques = (destaques: string[]) => { const t = destaques.join("; "); return t.endsWith(".") ? t : `${t}.`; };

/** Os passos de um item: por quê (o fato), conferir (1º passo da investigação), fazer e acompanhar. */
export function passosDoItem(r: Recommendation): { porque: string; conferir?: string; fazer: string; acompanhar: string } {
  return { porque: r.fact, conferir: r.investigate[0], fazer: r.correct.join(" "), acompanhar: r.followUp };
}

/** Texto do plano de uma unidade para colar no WhatsApp (*negrito* e _itálico_ do próprio WhatsApp).
 *  `feitos`: tipos de alerta já marcados como feitos; saem da lista e aparecem numa linha no fim. */
export function planoTexto(g: GrupoRisco, destaques: string[], evalMonth: string | null, feitos: Set<string> = new Set()): string {
  const partes = [`*📋 Plano de ação • ${g.unit}*`];
  if (evalMonth) partes.push(`_Mês avaliado: ${formatMonthLong(evalMonth)}_`);
  const pendentes = g.itens.filter((r) => !feitos.has(r.kind));
  const prontos = g.itens.filter((r) => feitos.has(r.kind));
  pendentes.forEach((r, i) => {
    const p = passosDoItem(r);
    partes.push("", `${EMOJI[r.severity]} *${i + 1}. ${ALERT_LABELS[r.kind]}*`, `Por quê: ${p.porque}`);
    if (p.conferir) partes.push(`Conferir: ${p.conferir}`);
    partes.push(`Fazer: ${p.fazer}`, `Acompanhar: ${p.acompanhar}`);
  });
  if (prontos.length) partes.push("", `☑️ *Já feito:* ${prontos.map((r) => ALERT_LABELS[r.kind]).join("; ")}.`);
  if (destaques.length) partes.push("", `✅ *O que melhorou:* ${fraseDeDestaques(destaques)}`);
  partes.push("", DISCLAIMER);
  return partes.join("\n");
}

/** Resumo para os sócios: uma linha por unidade, com o item mais grave e quantos outros há. */
export function resumoDaRedeTexto(grupos: GrupoRisco[], evalMonth: string | null): string {
  const criticos = grupos.reduce((s, g) => s + g.criticos, 0), atencao = grupos.reduce((s, g) => s + g.atencao, 0);
  const unidades = grupos.filter((g) => g.unit !== "Rede").length;
  const partes = ["*📋 Plano de ação da rede*"];
  if (evalMonth) partes.push(`_Mês avaliado: ${formatMonthLong(evalMonth)}_`);
  partes.push(`${unidades} ${unidades === 1 ? "unidade" : "unidades"} com ação: ${criticos} ${criticos === 1 ? "item crítico" : "itens críticos"} e ${atencao} em atenção.`, "");
  for (const g of grupos) {
    const [r, ...resto] = g.itens;
    partes.push(`${EMOJI[r.severity]} *${g.unit}*: ${ALERT_LABELS[r.kind]}${resto.length ? ` (+${resto.length})` : ""}`);
  }
  partes.push("", DISCLAIMER);
  return partes.join("\n");
}
