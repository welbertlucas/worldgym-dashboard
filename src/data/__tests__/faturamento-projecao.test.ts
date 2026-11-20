import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaturamentoProjecao } from "@/components/FaturamentoProjecao";
import type { UnitData } from "@/data/dashboardData";

const h = (p: Partial<{ partial: boolean; total: Partial<UnitData>; at: string }>) =>
  renderToString(createElement(FaturamentoProjecao, { total: { faturamento: 600000, previsaoFaturamento: 800000, ...p.total } as UnitData, month: "2026-11", partial: p.partial ?? true, unit: "Gama", atualizadoEm: p.at ?? null, metas: [] })).replace(/<!-- -->/g, "");

describe("FaturamentoProjecao", () => {
  it("mês em andamento: já venceu, a vencer e a explicação", () => {
    const t = h({}).replace(/ /g, " ");
    expect(t).toContain("Já lançado no EVO");
    expect(t).toContain("Projeção de faturamento até o final do mês");
    expect(t).toContain("Como é calculado");
    expect(t).toContain("75,0% do total"); // 600 mil de 800 mil
  });
  it("com o faturamento sendo o Total de Vendas: o que já venceu vem dos títulos, não do cartão Faturamento", () => {
    // faturamento 700 mil (vendas) e 600 mil de títulos que já venceram, de 800 mil lançados: já venceu 75%, e ainda vai vencer 200 mil
    const t = h({ total: { faturamento: 700000, faturamentoTitulos: 600000, previsaoFaturamento: 800000 } as Partial<UnitData> }).replace(/\u00a0/g, " ");
    expect(t).toContain("75,0% do total");
    expect(t).toContain("mais R$ 200.000");
    expect(t).toContain("Conta pelas cobranças (títulos)");
  });
  it("sem vendas por dia: só o lançado, avisando da estimativa", () => {
    const t = h({}).replace(/\u00a0/g, " ");
    expect(t).not.toContain("Estimativa de fechamento");
    expect(t).toContain("a partir do dia 10");
  });
  it("com vendas por dia: soma as vendas que ainda devem entrar", () => {
    // 14 dias fechados com 2 contratos por dia (28); sem meses de referência a projeção é linear: 28 ÷ (14/30) = 60, faltam 32.
    const t = h({ total: { vendasDia: Array.from({ length: 30 }, (_, i) => (i < 14 ? 2 : 0)), novosContratos: 28, tipoVenda: { novo: [28, 28000], remat: [0, 0], renov: [0, 0] } } as Partial<UnitData>, at: "2026-11-15T09:00:00Z" }).replace(/\u00a0/g, " ");
    expect(t).toContain("Estimativa de fechamento");
    expect(t).toContain("32 × R$ 1.000"); // 32 contratos que faltam × R$ 1.000 de valor médio
    expect(t).toContain("R$ 32.000");
  });
  it("mês fechado ou sem previsão: não aparece", () => {
    expect(h({ partial: false })).toBe("");
    expect(h({ total: { previsaoFaturamento: undefined } })).toBe("");
  });
});
