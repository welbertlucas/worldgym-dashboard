import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RecommendationCard } from "@/components/tabs/RecommendationCard";
import { recommendationText, DISCLAIMER } from "@/data/shareText";
import { type Recommendation } from "@/data/recommendations";

const rec: Recommendation = {
  id: "x1", unit: "Gama", kind: "faturamento", severity: "critical", priority: 3,
  fact: "Faturamento caiu 12,5% vs. mês anterior (R$ 300.000 → R$ 262.500).",
  rule: "queda ≥ 12%",
  yoy: { reading: "confirmed", fact: "−18% vs. set. de 2025." },
  evidence: { signals: ["Novos contratos -31,0% vs. o mês anterior (130 → 90)"], quiet: ["Ticket médio"], context: ["Faturamento: unidade -12,5% e rede -3,0% — a piora é mais da unidade do que da rede (sinal de causa local)."] },
  hypotheses: [{ text: "Menos vendas novas", support: "indicio" }], investigate: ["Conferir funil de vendas"], correct: ["Plano de ação com prazo"],
  followUp: "Rever no próximo fechamento.",
};

describe("texto para WhatsApp", () => {
  it("inclui unidade, fato, hipóteses marcadas como não confirmadas, ações, acompanhamento e mês avaliado", () => {
    const t = recommendationText(rec, "2026-09");
    for (const s of ["*🔴 Crítico • Gama*", "Queda de faturamento", "*Fato (dos dados):* Faturamento caiu 12,5%", "*Ano anterior:* −18%",
      "*O que os dados indicam:*\n• Novos contratos -31,0%", "Sem sinal relevante em: ticket médio.", "• Menos vendas novas (indício nos dados)", "• Conferir funil de vendas", "• Plano de ação com prazo",
      "*Acompanhar:* Rever no próximo fechamento.", "Avaliação do mês fechado: setembro de 2026", DISCLAIMER]) expect(t).toContain(s);
    expect(t.endsWith("conferir informações relevantes._")).toBe(true);
    expect(t).not.toContain("http");
    expect(t).not.toContain("github.io");
  });

  it("sem comparativo anual nem mês, omite essas partes", () => {
    const t = recommendationText({ ...rec, yoy: undefined }, null);
    expect(t).not.toContain("Ano anterior");
    expect(t).not.toContain("Avaliação do mês");
    expect(t.endsWith(DISCLAIMER)).toBe(true);
  });
});

describe("botão de copiar no card", () => {
  it("cada card tem o botão de copiar, fora do <summary>, e nenhum link externo", () => {
    const html = renderToString(<RecommendationCard rec={rec} evalMonth="2026-09" />);
    expect(html).toContain("Copiar texto: Gama");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("WhatsApp");
    const summary = html.slice(html.indexOf("<summary"), html.indexOf("</summary>"));
    expect(summary).not.toContain("<button");
  });
});

import { RiscosTab } from "@/components/tabs/RiscosTab";
import { type Alert } from "@/data/alerts";

describe("tela de riscos em meias-luas", () => {
  const mk = (id: string, severity: Alert["severity"]): Alert => ({ id, unit: "Gama", kind: "faturamento", severity, month: "2026-09", fact: "Faturamento caiu.", rule: "regra", weight: 0.1 });
  it("resume críticos, atenção e informativos em meia-lua com a participação de cada um", () => {
    const html = renderToString(<RiscosTab alerts={[mk("a", "critical"), mk("b", "critical"), mk("c", "attention"), mk("d", "info")]} evalMonth="2026-09" />).replace(/<!-- -->/g, "");
    for (const s of ["Críticos", "Atenção", "Informativos", "50% de 4 itens", "25% de 4 itens"]) expect(html).toContain(s);
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("border-l-destructive");
  });
  it("sem alertas não quebra (0%)", () => {
    expect(renderToString(<RiscosTab alerts={[]} evalMonth={null} />)).toContain("0% de 0 itens");
  });
});
