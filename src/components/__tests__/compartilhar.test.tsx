import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RecommendationCard } from "@/components/tabs/RecommendationCard";
import { recommendationText, whatsappUrl, DASHBOARD_URL } from "@/data/shareText";
import { type Recommendation } from "@/data/recommendations";

const rec: Recommendation = {
  id: "x1", unit: "Gama", kind: "faturamento", severity: "critical", priority: 3,
  fact: "Faturamento caiu 12,5% vs. mês anterior (R$ 300.000 → R$ 262.500).",
  rule: "queda ≥ 12%",
  yoy: { reading: "confirmed", fact: "−18% vs. set. de 2025." },
  hypotheses: ["Menos vendas novas"], investigate: ["Conferir funil de vendas"], correct: ["Plano de ação com prazo"],
  followUp: "Rever no próximo fechamento.",
};

describe("texto para WhatsApp", () => {
  it("inclui unidade, fato, hipóteses marcadas como não confirmadas, ações, acompanhamento e mês avaliado", () => {
    const t = recommendationText(rec, "2026-09");
    for (const s of ["*🔴 Crítico • Gama*", "Queda de faturamento", "*Fato (dos dados):* Faturamento caiu 12,5%", "*Ano anterior:* −18%",
      "*Hipóteses (a verificar, não confirmadas):*\n• Menos vendas novas", "• Conferir funil de vendas", "• Plano de ação com prazo",
      "*Acompanhar:* Rever no próximo fechamento.", "avaliação de setembro de 2026", DASHBOARD_URL]) expect(t).toContain(s);
  });

  it("sem comparativo anual nem mês, omite essas partes", () => {
    const t = recommendationText({ ...rec, yoy: undefined }, null);
    expect(t).not.toContain("Ano anterior");
    expect(t).not.toContain("avaliação de");
  });

  it("link do WhatsApp codifica o texto (acentos, quebras de linha, &)", () => {
    const u = whatsappUrl("Gama & Asa Norte\nfaturamento: R$ 1.000 ação");
    expect(u.startsWith("https://wa.me/?text=")).toBe(true);
    expect(u).toContain("Gama%20%26%20Asa%20Norte%0Afaturamento");
    expect(u).not.toContain(" ");
    expect(decodeURIComponent(u.split("text=")[1])).toBe("Gama & Asa Norte\nfaturamento: R$ 1.000 ação");
  });
});

describe("botões de compartilhar no card", () => {
  it("cada card tem link do WhatsApp (nova aba, sem opener) e botão de copiar, fora do <summary>", () => {
    const html = renderToString(<RecommendationCard rec={rec} evalMonth="2026-09" />);
    expect(html).toContain('href="https://wa.me/?text=');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Compartilhar no WhatsApp: Gama");
    expect(html).toContain("Copiar texto: Gama");
    const summary = html.slice(html.indexOf("<summary"), html.indexOf("</summary>"));
    expect(summary).not.toContain("wa.me");
    expect(summary).not.toContain("<button");
  });
});
