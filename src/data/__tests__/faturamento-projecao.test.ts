import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { FaturamentoProjecao } from "@/components/FaturamentoProjecao";
import { contratosDaRegra, dashboardData, type MonthData, type UnitData } from "@/data/dashboardData";
import { fracaoAteODia } from "@/data/projecaoMes";

// Números inventados. Meses anteriores com vendas por semana: 30% do mês na semana 1, 20% em cada uma das 2 a 4 e 10% na 5.
const semanas = (total: number) => [0.3, 0.2, 0.2, 0.2, 0.1].map((p) => ({ totalVendas: total * p }));
const mesRef = (ym: string) => ({ month: ym, total: {} as UnitData });
const h = (p: Partial<{ partial: boolean; total: Partial<UnitData>; at: string }>) =>
  renderToString(createElement(FaturamentoProjecao, { total: { faturamento: 600000, ...p.total } as UnitData, month: "2026-11", partial: p.partial ?? true, unit: "Gama", atualizadoEm: p.at ?? null })).replace(/<!-- -->/g, "").replace(/ /g, " ");

afterEach(() => { dashboardData.length = 0; });

describe("previsão de faturamento em duas linhas", () => {
  it("parte do mês vendida até o dia, pela curva semanal", () => {
    const s = [30, 20, 20, 20, 10];
    expect(fracaoAteODia(s, "2026-10", 7)).toBeCloseTo(0.3);
    expect(fracaoAteODia(s, "2026-10", 14)).toBeCloseTo(0.5);
    expect(fracaoAteODia(s, "2026-10", 31)).toBeCloseTo(1);
    expect(fracaoAteODia([0, 0], "2026-10", 7)).toBeNull();
  });
  it("vendido até agora e deve fechar o mês em", () => {
    dashboardData.push(...["2026-08", "2026-09", "2026-10"].map((ym) => ({ ...mesRef(ym), units: [{ name: "Gama", faturamento: 1000, recebimento: 0, semanas: semanas(1000) } as never] }) as MonthData));
    // dados até o dia 14 (lido em 15/11): nos meses anteriores, 50% do mês estava vendido até o dia 14 → 600 mil ÷ 50% = 1,2 milhão
    const t = h({ at: "2026-11-15T09:00:00Z" });
    expect(t).toContain("Vendido até agora");
    expect(t).toContain("R$ 600.000");
    expect(t).toContain("Deve fechar o mês em");
    expect(t).toContain("≈ R$ 1.200.000");
    expect(t).not.toContain("lançado");
  });
  it("antes do dia 10: só o vendido até agora", () => {
    const t = h({ at: "2026-11-06T09:00:00Z" });
    expect(t).toContain("Vendido até agora");
    expect(t).not.toContain("Deve fechar o mês em");
    expect(t).toContain("a partir do dia 10");
  });
  it("mês fechado ou sem venda: não aparece", () => {
    expect(h({ partial: false })).toBe("");
    expect(h({ total: { faturamento: 0 } })).toBe("");
  });
  it("regra única de contratos: matrícula + rematrícula + renovação com vigência, sem a recorrência automática", () => {
    expect(contratosDaRegra({ novo: [10, 1000], remat: [5, 500], renov: [20, 2000], auto: [15, 1500] })).toEqual({ n: 20, v: 2000 });
    expect(contratosDaRegra({ novo: [10, 1000], remat: [5, 500], renov: [20, 2000] })).toEqual({ n: 15, v: 1500 }); // mês antigo, sem a divisão
    expect(contratosDaRegra(undefined)).toBeNull();
  });
});
