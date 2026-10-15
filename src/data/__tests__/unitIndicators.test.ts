import { describe, expect, it } from "vitest";
import { INDICATOR_BY_KEY, INDICATORS, compareIndicator, formatIndicator, relativeDiff, summarizeComparison } from "@/data/unitIndicators";
import { unit } from "./helpers";

const ind = (k: string) => INDICATOR_BY_KEY[k];

describe("comparação entre duas unidades", () => {
  it("mantém os 17 indicadores do comparativo anterior (+ NPS)", () => {
    expect(INDICATORS).toHaveLength(18);
    for (const k of ["faturamento", "recebimento", "ticketMedio", "adimplentes", "novosContratos", "cancelados", "saldo", "churn", "renovacoes", "inadimplenciaPerc", "icv", "vendasOnline", "diarias", "personal", "camisetas", "coqueteleiras", "notaGoogle"]) expect(ind(k)).toBeDefined();
  });

  it("fórmula da diferença idêntica à anterior (relativa a B; 0 se B é zero)", () => {
    expect(relativeDiff(110, 100)).toBe(10);
    expect(relativeDiff(90, 100)).toBe(-10);
    expect(relativeDiff(5, 0)).toBe(0);
    expect(relativeDiff(-50, -100)).toBe(50);
  });

  it("maior é melhor: faturamento", () => {
    const c = compareIndicator(ind("faturamento"), unit("A", { faturamento: 120 }), unit("B", { faturamento: 100 }));
    expect(c).toMatchObject({ state: "ok", winner: "a", diff: 20 });
  });

  it("menor é melhor: churn, inadimplência e cancelados — diferença positiva NÃO significa melhor", () => {
    for (const k of ["churn", "inadimplenciaPerc", "cancelados"]) {
      const key = k === "cancelados" ? "cancelados" : k;
      const up = compareIndicator(ind(k), unit("A", { [key]: 12 }), unit("B", { [key]: 10 }));
      expect(up.diff).toBeGreaterThan(0);
      expect(up.winner).toBe("b");
      const down = compareIndicator(ind(k), unit("A", { [key]: 8 }), unit("B", { [key]: 10 }));
      expect(down.winner).toBe("a");
    }
  });

  it("saldo de clientes usa novos − cancelados", () => {
    const c = compareIndicator(ind("saldo"), unit("A", { novosContratos: 100, cancelados: 20 }), unit("B", { novosContratos: 90, cancelados: 50 }));
    expect([c.a, c.b, c.winner]).toEqual([80, 40, "a"]);
  });

  it("diferença desprezível é equivalente, sem lado favorável", () => {
    const c = compareIndicator(ind("faturamento"), unit("A", { faturamento: 100.2 }), unit("B", { faturamento: 100 }));
    expect(c).toMatchObject({ state: "equal", winner: null });
  });

  it("indicador sem regra (receitas complementares) mostra a diferença mas não aponta favorável", () => {
    const c = compareIndicator(ind("camisetas"), unit("A", { camisetas: 500 }), unit("B", { camisetas: 100 }));
    expect(c).toMatchObject({ state: "neutral", winner: null, diff: 400 });
  });

  it("base zero: estado neutro, sem inventar comparação", () => {
    const c = compareIndicator(ind("diarias"), unit("A", { diarias: 500 }), unit("B", { diarias: 0 }));
    expect(c).toMatchObject({ state: "uncomputable", winner: null, diff: null });
    expect(compareIndicator(ind("faturamento"), unit("A", { faturamento: 0 }), unit("B", { faturamento: 0 })).state).toBe("uncomputable");
  });

  it("nota e NPS zerados significam sem dado e não comparam", () => {
    const c = compareIndicator(ind("notaGoogle"), unit("A", { notaGoogle: 4.5 }), unit("B", { notaGoogle: 0 }));
    expect(c).toMatchObject({ state: "nodata", winner: null, diff: null });
    expect(formatIndicator(ind("nps"), 0)).toBe("—");
    expect(formatIndicator(ind("faturamento"), 0).replace(/\s/g, " ")).toBe("R$ 0");
  });

  it("resumo: placar, maiores diferenças e indicadores a revisar", () => {
    const a = unit("A", { faturamento: 200, churn: 3, vendasOnline: 3000, notaGoogle: 0 });
    const b = unit("B", { faturamento: 100, churn: 6, vendasOnline: 2000, notaGoogle: 4.5 });
    const s = summarizeComparison(a, b);
    expect(s.winsA).toBeGreaterThanOrEqual(2); // faturamento e churn
    expect(s.needsReview.map((i) => i.key)).toContain("notaGoogle");
    expect(s.biggest[0].indicator.key).toBe("faturamento");
    expect(s.biggest).toHaveLength(3);
  });
});
