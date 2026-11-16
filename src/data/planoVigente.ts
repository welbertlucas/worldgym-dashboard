// Plano de ação do mês vigente: os alertas do mês em andamento agrupados por unidade, em duas partes ("Resolver agora" e
// "Acelerar o mês"), com o texto para mandar no WhatsApp. "Feito" vale para o mês vigente e volta a pendente quando uma leitura
// do EVO mais nova que a marcação ainda mostra o alerta (a equipe vê que o problema continua).
import { type AlertaVigente } from "@/data/alertasVigentes";
import { formatMonthLong } from "@/data/periods";

export interface GrupoVigente { unit: string; itens: AlertaVigente[]; criticos: number; atencao: number; peso: number }

const EMOJI = { critical: "🔴", attention: "🟠", info: "▫️" } as const;

/** Agrupa por unidade: a rede primeiro, depois quem tem mais críticos, mais itens em atenção e mais peso na rede. */
export function gruposVigentes(alertas: AlertaVigente[]): GrupoVigente[] {
  const m = new Map<string, AlertaVigente[]>();
  for (const a of alertas) m.set(a.unit, [...(m.get(a.unit) ?? []), a]);
  return [...m].map(([unit, itens]) => ({
    unit, itens,
    criticos: itens.filter((a) => a.severity === "critical").length,
    atencao: itens.filter((a) => a.severity === "attention").length,
    peso: Math.max(...itens.map((a) => a.weight)),
  })).sort((a, b) => (a.unit === "Rede" ? -1 : b.unit === "Rede" ? 1 : 0) || b.criticos - a.criticos || b.atencao - a.atencao || b.peso - a.peso);
}

/** O item continua feito? Só se a marcação é mais nova que a leitura do EVO (senão o alerta continuou na leitura seguinte). */
export const continuaFeito = (feitoEm: string | undefined, atualizadoEm: string | null) => !!feitoEm && (!atualizadoEm || feitoEm >= atualizadoEm);

/** Texto do plano de uma unidade para o WhatsApp. `feitos`: tipos (kind) marcados e ainda válidos. */
export function planoVigenteTexto(g: GrupoVigente, month: string, dias: number, feitos: Set<string> = new Set()): string {
  const partes = [`*📋 Plano de ação • ${g.unit}*`, `_${formatMonthLong(month)}${dias ? `, com os dados até ${dias}/${month.slice(5)}` : ""} (mês em andamento)_`];
  const secao = (titulo: string, itens: AlertaVigente[]) => {
    const pend = itens.filter((a) => !feitos.has(a.kind));
    if (!pend.length) return;
    partes.push("", `*${titulo}*`);
    pend.forEach((a, i) => partes.push(`${EMOJI[a.severity]} *${i + 1}. ${a.title}*`, a.fact, `Fazer: ${a.action}`));
  };
  secao("Resolver agora", g.itens.filter((a) => a.tipo === "pendencia"));
  secao("Acelerar o mês", g.itens.filter((a) => a.tipo === "ritmo"));
  const prontos = g.itens.filter((a) => feitos.has(a.kind));
  if (prontos.length) partes.push("", `☑️ *Já feito:* ${prontos.map((a) => a.title).join("; ")}.`);
  return partes.join("\n");
}

/** Resumo para os sócios: uma linha por unidade com o item mais urgente e quantos outros há. */
export function resumoVigenteTexto(grupos: GrupoVigente[], month: string, dias: number): string {
  const c = grupos.reduce((s, g) => s + g.criticos, 0), a = grupos.reduce((s, g) => s + g.atencao, 0);
  const partes = ["*📋 Plano de ação da rede*", `_${formatMonthLong(month)}${dias ? `, com os dados até ${dias}/${month.slice(5)}` : ""} (mês em andamento)_`,
    `${c} ${c === 1 ? "item crítico" : "itens críticos"} e ${a} em atenção.`, ""];
  for (const g of grupos) {
    const [p, ...resto] = g.itens;
    partes.push(`${EMOJI[p.severity]} *${g.unit}*: ${p.title}${resto.length ? ` (+${resto.length})` : ""}`);
  }
  return partes.join("\n");
}
