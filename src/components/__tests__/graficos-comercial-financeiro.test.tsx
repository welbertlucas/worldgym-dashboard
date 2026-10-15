import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RevenueChart, buildRevenueRows } from "@/components/RevenueChart";
import NovosContratosChart, { buildFlowRows } from "@/components/NovosContratosChart";
import { splitPartial } from "@/components/chartData";
import { partialDot } from "@/components/PartialDot";
import { dashboardData } from "@/data/dashboardData";
import { monthKey } from "@/data/periods";
import { month, unit } from "@/data/__tests__/helpers";

afterEach(() => { dashboardData.length = 0; });

/** Dois meses fechados + o mês corrente (parcial), com valores distintos para conferir cada campo. */
function seed() {
  const d = new Date();
  const key = (back: number) => { const x = new Date(d.getFullYear(), d.getMonth() - back, 1); return monthKey(x); };
  dashboardData.push(
    month(key(2), [unit("A", { faturamento: 100000, recebimento: 90000, novosContratos: 120, cancelados: 80 }), unit("B", { faturamento: 50000, recebimento: 45000, novosContratos: 60, cancelados: 30 })]),
    month(key(1), [unit("A", { faturamento: 110000, recebimento: 95000, novosContratos: 130, cancelados: 70 }), unit("B", { faturamento: 52000, recebimento: 47000, novosContratos: 65, cancelados: 25 })]),
    month(key(0), [unit("A", { faturamento: 30000, recebimento: 28000, novosContratos: 40, cancelados: 20 }), unit("B", { faturamento: 15000, recebimento: 14000, novosContratos: 20, cancelados: 10 })]),
  );
  return { closedKey: key(1), partialKey: key(0) };
}

describe("buildRevenueRows (Financeiro)", () => {
  it("meses fechados vão para as linhas; o mês em andamento vira marcador isolado; valores reais preservados", () => {
    const { partialKey, closedKey } = seed();
    const rows = buildRevenueRows(null);
    const closed = rows.find((r) => r.month === closedKey)!;
    const partial = rows.find((r) => r.month === partialKey)!;
    expect(closed).toMatchObject({ partial: false, faturamento: 162000, recebimento: 142000, faturamentoParcial: null, recebimentoParcial: null, fat: 162000, rec: 142000 });
    expect(partial).toMatchObject({ partial: true, faturamento: null, recebimento: null, faturamentoParcial: 45000, recebimentoParcial: 42000, fat: 45000, rec: 42000 });
    expect(partial.label).toContain("(parc.)");
  });

  it("filtra por unidade e trata unidade ausente como zero (como antes)", () => {
    const { closedKey } = seed();
    expect(buildRevenueRows("A").find((r) => r.month === closedKey)).toMatchObject({ fat: 110000, rec: 95000 });
    expect(buildRevenueRows("Z").every((r) => r.fat === 0 && r.rec === 0)).toBe(true);
  });
});

describe("buildFlowRows (Comercial)", () => {
  it("cancelamentos são plotados abaixo do eixo (sinal só na plotagem) e o valor real fica preservado", () => {
    const { closedKey, partialKey } = seed();
    const rows = buildFlowRows(null);
    const closed = rows.find((r) => r.month === closedKey)!;
    expect(closed).toMatchObject({ novos: 195, cancelados: -95, novosReal: 195, canceladosReal: 95, novosParcial: null, canceladosParcial: null });
    const partial = rows.find((r) => r.month === partialKey)!;
    expect(partial).toMatchObject({ novos: null, cancelados: null, novosParcial: 60, canceladosParcial: -30, novosReal: 60, canceladosReal: 30 });
  });

  it("não cria saldo, taxa ou qualquer campo derivado novo", () => {
    seed();
    const keys = Object.keys(buildFlowRows(null)[0]).sort();
    expect(keys).toEqual(["cancelados", "canceladosParcial", "canceladosReal", "label", "month", "novos", "novosParcial", "novosReal", "partial"].sort());
  });
});

describe("renderização dos cabeçalhos", () => {
  it("Financeiro: título, valores do último mês fechado com cada série identificada e nota do parcial", () => {
    seed();
    const html = renderToString(<RevenueChart selectedUnit={null} />).replace(/<!-- -->/g, "");
    expect(html).toContain("Faturamento × Recebimento");
    expect(html).toContain("Último mês fechado:");
    expect(html).toContain(">Faturamento<");
    expect(html).toContain(">Recebimento<");
    expect(html.replace(/\s|&nbsp;/g, "")).toContain("R$162K"); // faturamento do último mês fechado
    expect(html.replace(/\s|&nbsp;/g, "")).toContain("R$142K"); // recebimento do último mês fechado
    expect(html).toContain("em andamento");
  });

  it("Comercial: título, valores reais do último mês fechado e legenda de leitura", () => {
    seed();
    const html = renderToString(<NovosContratosChart selectedUnit={null} />).replace(/<!-- -->/g, "");
    expect(html).toContain("Novos contratos × Cancelamentos");
    expect(html).toContain("Último mês fechado:");
    expect(html).toContain(">Novos contratos<");
    expect(html).toContain(">Cancelamentos<");
    expect(html).toContain(">195<");
    expect(html).toContain(">95<");
    expect(html).toContain("cancelamentos abaixo");
  });

  it("estado vazio orienta e não desenha o gráfico", () => {
    seed();
    const a = renderToString(<RevenueChart selectedUnit="Z" />).replace(/<!-- -->/g, "");
    expect(a).toContain("Sem faturamento nem recebimento de Z");
    const b = renderToString(<NovosContratosChart selectedUnit="Z" />).replace(/<!-- -->/g, "");
    expect(b).toContain("Sem novos contratos nem cancelamentos de Z");
    expect(a).not.toContain("recharts");
  });
});

describe("peças compartilhadas", () => {
  it("splitPartial aceita nome próprio para o campo parcial", () => {
    expect(splitPartial("a", true, 5, "aParcial")).toEqual({ a: null, aParcial: 5 });
    expect(splitPartial("a", false, 5)).toEqual({ a: 5, parcial: null });
  });

  it("marcador parcial lê o campo configurado e pode omitir o rótulo", () => {
    const dot = partialDot((v) => `${v}`, { field: "xParcial", label: false });
    expect(renderToString(<svg>{dot({ cx: 1, cy: 1, payload: { xParcial: 7 } })}</svg>)).toContain("circle");
    expect(renderToString(<svg>{dot({ cx: 1, cy: 1, payload: { xParcial: 7 } })}</svg>)).not.toContain("parcial: 7");
    expect(renderToString(<svg>{dot({ cx: 1, cy: 1, payload: { parcial: 7 } })}</svg>)).not.toContain("circle");
  });
});
