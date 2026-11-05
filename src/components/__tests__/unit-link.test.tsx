import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { UnitLink, UnitNavProvider } from "@/components/UnitLink";
import { dashboardData } from "@/data/dashboardData";
import { month, unit } from "@/data/__tests__/helpers";

describe("nome de unidade clicável", () => {
  dashboardData.length = 0;
  dashboardData.push(month("2026-10", [unit("Gama")]));

  it("vira botão quando há navegação e o nome é de uma unidade", () => {
    const html = renderToString(<UnitNavProvider value={vi.fn()}><UnitLink name="Gama" /></UnitNavProvider>);
    expect(html).toContain("<button");
    expect(html).toContain("Abrir o detalhe de Gama");
  });

  it("fica texto comum para 'Rede' ou sem navegação", () => {
    expect(renderToString(<UnitNavProvider value={vi.fn()}><UnitLink name="Rede" /></UnitNavProvider>)).not.toContain("<button");
    expect(renderToString(<UnitLink name="Gama" />)).not.toContain("<button");
  });
});
