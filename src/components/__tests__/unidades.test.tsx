import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { UnitHighlights } from "@/components/UnitHighlights";
import { UnitsRanking } from "@/components/unidades/UnitsRanking";
import { UnitComparison } from "@/components/UnitComparison";
import { dashboardData } from "@/data/dashboardData";
import { computeUnitDeltas } from "@/data/unitMetrics";
import { month, unit } from "@/data/__tests__/helpers";

afterEach(() => { dashboardData.length = 0; });

describe("UnitHighlights", () => {
  it("cor segue a direção do indicador: churn em queda é melhora; inadimplência em alta é piora", () => {
    const prev = month("2026-08", [unit("A", { churn: 8, inadimplenciaPerc: 4 }), unit("B")]);
    const cur = month("2026-09", [unit("A", { churn: 6, inadimplenciaPerc: 5 }), unit("B")]);
    const html = renderToString(<UnitHighlights deltas={computeUnitDeltas(cur, prev)} limit={1} />);
    expect(html).toContain("Resultados positivos");
    expect(html).toContain("Deterioração de indicadores");
    expect(html).toMatch(/Churn[\s\S]*?-2,0 p\.p\.[\s\S]*?\(melhora\)/);
    expect(html).toMatch(/Inadimplência[\s\S]*?\+1,0 p\.p\.[\s\S]*?\(piora\)/);
    expect(html).toContain("Critério:");
  });
});

describe("UnitsRanking", () => {
  const units = [unit("A", { faturamento: 300 }), unit("B", { faturamento: 200 }), unit("C", { faturamento: 500 })];

  it("indicador de maior é melhor: ordena do maior para o menor, com valores reais", () => {
    const html = renderToString(<UnitsRanking units={units} monthLabel="setembro de 2026" partial={false} />);
    expect(html.indexOf(">C<")).toBeLessThan(html.indexOf(">A<"));
    expect(html.indexOf(">A<")).toBeLessThan(html.indexOf(">B<"));
    expect(html.replace(/\s|&nbsp;/g, "")).toContain("R$500");
    expect(html).toContain("Maior é melhor");
  });

  it("indica mês em andamento e oferece todos os indicadores como botões", () => {
    const html = renderToString(<UnitsRanking units={units} monthLabel="outubro de 2026" partial />);
    expect(html).toContain("valores parciais");
    for (const label of ["Faturamento", "Churn", "Inadimplência", "Camisetas", "Taxa de conversão"]) expect(html).toContain(label);
    expect(html).toContain('aria-pressed="true"');
  });

  it("sem visão de variação, não oferece a alternância", () => {
    expect(renderToString(<UnitsRanking units={units} monthLabel="x" partial={false} />)).not.toContain("Variação");
  });
});

describe("UnitComparison", () => {
  it("mostra painéis, resumo e estados neutros sem inventar comparação", () => {
    dashboardData.push(month("2026-09", [
      unit("Alfa", { faturamento: 200, churn: 3, vendasOnline: 500, nps: 0 }),
      unit("Beta", { faturamento: 100, churn: 6, vendasOnline: 0, nps: 0 }),
    ]));
    const html = renderToString(<UnitComparison selectedMonth="2026-09" />);
    expect(html).toContain("Comparativo de unidades");
    expect(html).toContain("Primeira unidade");
    expect(html).toContain("Segunda unidade");
    for (const cat of ["Financeiro", "Comercial", "Retenção", "Receitas complementares"]) expect(html).toContain(cat);
    expect(html).toContain("Sem base de comparação"); // vendas online com base zero
    expect(html).toContain("Sem dado"); // NPS
    expect(html).toContain("Precisam de análise adicional");
    expect(html).toContain("favorável"); // selo acessível do lado favorável
  });

  it("percentuais mostram p.p. e variação relativa separadas; valor negativo usa barra listrada", () => {
    dashboardData.push(month("2026-09", [
      unit("Alfa", { churn: 6.7, novosContratos: 10, cancelados: 30 }), // saldo = -20
      unit("Beta", { churn: 9, novosContratos: 50, cancelados: 20 }),
    ]));
    const html = renderToString(<UnitComparison selectedMonth="2026-09" />).replace(/<!-- -->/g, ""); // o React separa trechos de texto com comentários
    expect(html).toContain("−2,3 p.p.");
    expect(html).toContain("−25,6% relativo");
    expect(html).toContain("repeating-linear-gradient");
    // "Maiores diferenças" traz os valores das duas unidades e a diferença absoluta
    expect(html).toContain("diferença de");
    expect(html).toContain("confira os valores de cada unidade");
  });

  it("indicadores sem comparação listam o motivo", () => {
    dashboardData.push(month("2026-09", [unit("Alfa", { vendasOnline: 500 }), unit("Beta", { vendasOnline: 0 })]));
    const html = renderToString(<UnitComparison selectedMonth="2026-09" />);
    expect(html).toContain("base de comparação zero");
    expect(html).toContain("sem dado nas duas unidades"); // NPS
  });
});
