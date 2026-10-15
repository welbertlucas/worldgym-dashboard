import { describe, expect, it } from "vitest";
import { INDICATOR_BY_KEY, INDICATORS, compareIndicator, formatDelta, formatIndicator, formatRelative, relativeDiff, reviewReason, summarizeComparison } from "@/data/unitIndicators";
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
    expect(s.needsReview.map((r) => r.indicator.key)).toContain("notaGoogle");
    expect(s.biggest[0].indicator.key).toBe("faturamento");
    expect(s.biggest).toHaveLength(3);
  });

  describe("diferença absoluta (p.p.) complementar à relativa", () => {
    it("churn 6,7% vs 9,0%: −2,3 p.p. e −25,6% relativo, e A é o favorável", () => {
      const c = compareIndicator(ind("churn"), unit("A", { churn: 6.7 }), unit("B", { churn: 9 }));
      expect(c.delta).toBeCloseTo(-2.3);
      expect(c.diff).toBeCloseTo(-25.56, 1);
      expect(c.winner).toBe("a"); // menor é melhor
      expect(formatDelta(ind("churn"), c.delta!)).toBe("−2,3 p.p.");
      expect(formatRelative(c.diff!)).toBe("−25,6%");
    });

    it("não mistura % com p.p.: percentuais usam p.p.; financeiros usam valor em R$; volumes, número", () => {
      expect(formatDelta(ind("renovacoes"), 4)).toBe("+4,0 p.p.");
      expect(formatDelta(ind("faturamento"), -1200).replace(/\s/g, " ")).toBe("−R$ 1.200");
      expect(formatDelta(ind("novosContratos"), 12)).toBe("+12");
      expect(formatDelta(ind("churn"), 0.04)).toBe("+0,04 p.p."); // não arredonda para 0,0
      expect(formatRelative(389.3)).toBe("+389,3%");
    });

    it("delta é nulo quando não há comparação (sem dado ou base zero) e existe nos estados neutro e equivalente", () => {
      expect(compareIndicator(ind("vendasOnline"), unit("A", { vendasOnline: 500 }), unit("B", { vendasOnline: 0 })).delta).toBeNull();
      expect(compareIndicator(ind("nps"), unit("A", { nps: 50 }), unit("B", { nps: 0 })).delta).toBeNull();
      expect(compareIndicator(ind("camisetas"), unit("A", { camisetas: 500 }), unit("B", { camisetas: 100 })).delta).toBe(400);
      expect(compareIndicator(ind("faturamento"), unit("A", { faturamento: 100.2 }), unit("B", { faturamento: 100 })).delta).toBeCloseTo(0.2);
    });

    it("não altera o vencedor nem a diferença relativa existente", () => {
      const c = compareIndicator(ind("inadimplenciaPerc"), unit("A", { inadimplenciaPerc: 9 }), unit("B", { inadimplenciaPerc: 6 }));
      expect(c.diff).toBe(relativeDiff(9, 6));
      expect(c.winner).toBe("b");
      expect(c.delta).toBe(3);
    });

    it("motivo de revisão: base zero, sem dado em uma ou nas duas unidades", () => {
      const k = (key: string, a: object, b: object) => { const i = ind(key); const c = compareIndicator(i, unit("A", a), unit("B", b)); return reviewReason(i, c); };
      expect(k("vendasOnline", { vendasOnline: 5 }, { vendasOnline: 0 })).toMatch(/base de comparação zero/);
      expect(k("notaGoogle", { notaGoogle: 4 }, { notaGoogle: 0 })).toBe("sem dado na segunda unidade");
      expect(k("notaGoogle", { notaGoogle: 0 }, { notaGoogle: 4 })).toBe("sem dado na primeira unidade");
      expect(k("nps", { nps: 0 }, { nps: 0 })).toBe("sem dado nas duas unidades");
    });
  });
});
