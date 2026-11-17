import { describe, expect, it } from "vitest";
import { ID_BIG, mesDoAnoAnterior, rotuloDoPeriodo, mesesParaRelatorio, montarRelatorio, resumoDosSlides } from "@/data/relatorio";
import { month, unit } from "./helpers";

const dados = [
  month("2025-10", [unit("Asa Sul", { faturamento: 100000 }), unit("Gama", { faturamento: 50000 })]),
  month("2026-10", [unit("Asa Sul", { faturamento: 120000, nps: 80, notaGoogle: 4.6 }), unit("Gama", { faturamento: 40000 }), unit("Nova", { faturamento: 30000 })]),
];

describe("relatório", () => {
  it("mês do ano anterior e meses fechados", () => {
    expect(mesDoAnoAnterior("2026-10")).toBe("2025-10");
    expect(rotuloDoPeriodo("2026-11")).toBe("1-30 nov/26");
    expect(rotuloDoPeriodo("2026-02")).toBe("1-28 fev/26");
    expect(mesesParaRelatorio(["2026-09", "2026-10", "2026-11"], new Date(2026, 10, 17))).toEqual(["2026-10", "2026-09"]);
  });

  it("ranking de faturamento em ordem e crescimento só das unidades com base", () => {
    const m = montarRelatorio(dados, "2026-10", ["fat", "cresc"], null)!;
    expect(m.rankings[0].itens.map((i) => i[0])).toEqual(["Asa Sul", "Gama", "Nova"]);
    const c = m.rankings[1];
    expect(c.itens).toEqual([["Asa Sul", 20], ["Gama", -20]]);
    expect(c.nota).toContain("Nova");
  });

  it("notas zeradas ficam de fora e o escopo restringe as unidades", () => {
    const m = montarRelatorio(dados, "2026-10", ["nps", "google"], ["Asa Sul", "Gama"])!;
    expect(m.rankings.map((r) => [r.id, r.itens.length])).toEqual([["nps", 1], ["google", 1]]);
    expect(m.nUnidades).toBe(2);
    expect(m.escopo).toBe("2 unidades");
  });

  it("números gerais comparam com o ano anterior e o resumo lista os slides", () => {
    const m = montarRelatorio(dados, "2026-10", [ID_BIG, "fat"], ["Asa Sul", "Gama"])!;
    const fat = m.big![0];
    expect(fat.variacao).toBeCloseTo(6.67, 1);
    expect(fat.anterior).toContain("150");
    expect(resumoDosSlides(m)).toEqual(["Capa", "Números gerais", "Faturamento", "Encerramento"]);
  });

  it("sem o mês no painel ou sem unidade no escopo devolve nada; sem ano anterior não há crescimento", () => {
    expect(montarRelatorio(dados, "2024-01", ["fat"], null)).toBeNull();
    expect(montarRelatorio(dados, "2026-10", ["fat"], ["Inexistente"])).toBeNull();
    expect(montarRelatorio([dados[1]], "2026-10", ["cresc"], null)!.rankings).toHaveLength(0);
  });
});
