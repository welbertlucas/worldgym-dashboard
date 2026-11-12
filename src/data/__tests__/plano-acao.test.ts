import { describe, expect, it } from "vitest";
import { destaquesDaUnidade, gruposDoPlano, planoTexto, resumoDaRedeTexto } from "@/data/planoAcao";
import type { Recommendation } from "@/data/recommendations";
import type { UnitDelta } from "@/data/unitMetrics";

const rec = (unit: string, severity: Recommendation["severity"], kind: Recommendation["kind"], id = `${unit}-${kind}`): Recommendation => ({
  id, unit, kind, severity, priority: 1, fact: `fato de ${unit}`, rule: "", evidence: { signals: [], quiet: [], context: [] },
  hypotheses: [], investigate: ["olhar no EVO"], correct: ["cobrar", "registrar"], followUp: "o mês seguinte",
});

describe("Plano de ação", () => {
  const recs = [rec("A", "attention", "churn"), rec("Rede", "critical", "faturamento"), rec("A", "critical", "liberacoes"), rec("B", "info", "churn")];

  it("só críticos e atenção, a rede primeiro, depois quem tem mais críticos", () => {
    const g = gruposDoPlano(recs);
    expect(g.map((x) => x.unit)).toEqual(["Rede", "A"]);
    expect(g[1].itens).toHaveLength(2);
  });

  it("destaques: só o que melhorou (churn e inadimplência melhoram quando caem), até 3", () => {
    const d = [{ unit: "A", deltas: { faturamento: 21.5, vendasOnline: -10, churn: -0.4, inadimplenciaPerc: 0.05, renovacoes: 11.8 } }] as unknown as UnitDelta[];
    expect(destaquesDaUnidade("A", d)).toEqual(["Faturamento +21,5%", "Churn −0,4 p.p.", "Renovação +11,8 p.p."]);
    expect(destaquesDaUnidade("X", d)).toEqual([]);
  });

  it("texto do plano: itens numerados com por quê, conferir, fazer e acompanhar", () => {
    const [, a] = gruposDoPlano(recs);
    const t = planoTexto(a, ["Faturamento +21,5%"], "2026-10");
    expect(t).toContain("*📋 Plano de ação • A*");
    expect(t).toContain("_Mês avaliado: outubro de 2026_");
    expect(t).toContain("🟠 *1. Churn");
    expect(t).toContain("Fazer: cobrar registrar");
    expect(t).toContain("Conferir: olhar no EVO");
    expect(t).toContain("✅ *O que melhorou:* Faturamento +21,5%.");
    expect(planoTexto(a, ["Churn −0,4 p.p."], null)).toContain("Churn −0,4 p.p.\n");
  });

  it("resumo da rede: uma linha por unidade com o item mais grave", () => {
    const t = resumoDaRedeTexto(gruposDoPlano(recs), "2026-10");
    expect(t).toContain("1 unidade com ação: 2 itens críticos e 1 em atenção.");
    expect(t).toMatch(/\*A\*: .+ \(\+1\)/);
  });
});
