import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { HalfMoon, arcAngle, arcPath } from "@/components/HalfMoon";
import { KpiGaugeCard } from "@/components/executiva/KpiGaugeCard";
import { absoluteGauge, rateGauge } from "@/data/kpiGauge";
import { DonutList, shares } from "@/components/DonutList";
import { ExecutivaTab } from "@/components/tabs/ExecutivaTab";
import { dashboardData } from "@/data/dashboardData";
import { INDICATOR_BY_KEY, gaugeMax, toneZones } from "@/data/unitIndicators";
import { month, unit } from "@/data/__tests__/helpers";
import { monthKey } from "@/data/periods";

afterEach(() => { dashboardData.length = 0; });

describe("HalfMoon (geometria)", () => {
  it("mapeia a fração para 0–180° e limita às pontas", () => {
    expect(arcAngle(0)).toBe(0);
    expect(arcAngle(0.5)).toBe(90);
    expect(arcAngle(1)).toBe(180);
    expect(arcAngle(-1)).toBe(0);
    expect(arcAngle(7)).toBe(180);
    expect(arcAngle(NaN)).toBe(0);
  });

  it("arco do topo vai do ponto esquerdo ao direito, passando por cima", () => {
    expect(arcPath(0, 180, 80)).toMatch(/^M 20\.00 100\.00 A 80 80 0 0 1 180\.00 100\.00$/);
  });

  it("desenha trilho, arco e marca (sem ponteiro); sem preenchimento não há arco colorido", () => {
    const html = renderToString(<HalfMoon fill={0.4} marker={0.8} color="green" label="Churn: 3%">3%</HalfMoon>);
    expect((html.match(/<path/g) ?? []).length).toBe(2);
    expect((html.match(/<line/g) ?? []).length).toBe(1);
    expect(html).not.toContain("<circle");
    expect(html).toContain('aria-label="Churn: 3%"');
    expect((renderToString(<HalfMoon fill={0} color="green" label="x" />).match(/<path/g) ?? []).length).toBe(1);
  });
});

describe("modelo dos indicadores em meia-lua", () => {
  it("valor absoluto: arco = realizado ÷ mês anterior; a marca do mês anterior fica em 80%", () => {
    const g = absoluteGauge(100, 100, false);
    expect(g.marker).toBeCloseTo(0.8);
    expect(g.fill).toBeCloseTo(0.8);
    expect(g.tone).toBe("good");
    expect(absoluteGauge(97, 100, false).tone).toBe("warn");
    expect(absoluteGauge(90, 100, false).tone).toBe("bad");
    expect(absoluteGauge(500, 100, false).fill).toBe(1);
  });

  it("mês em andamento: sem cor de bom/ruim; sem mês anterior: arco vazio", () => {
    expect(absoluteGauge(30, 100, true).tone).toBe("neutral");
    expect(absoluteGauge(30, 100, true).fill).toBeCloseTo(0.24);
    expect(absoluteGauge(30, undefined, false)).toEqual({ fill: 0, marker: null, tone: "neutral" });
  });

  it("taxas: cor pela faixa de leitura existente e marca do mês anterior", () => {
    const churn = INDICATOR_BY_KEY.churn;
    const g = rateGauge(churn, 3, 4.5);
    expect(g.tone).toBe(churn.tone!(3));
    expect(g.tone).toBe("good");
    expect(g.fill).toBeCloseTo(3 / 12);
    expect(g.marker).toBeCloseTo(4.5 / 12);
    expect(rateGauge(INDICATOR_BY_KEY.renovacoes, 44, undefined)).toMatchObject({ tone: "warn", marker: null });
  });
});

describe("faixas dos velocímetros = regras de cor existentes", () => {
  const tones = (key: string, v: number) => INDICATOR_BY_KEY[key].tone!(v);
  const zoneTone = (key: string, v: number) => toneZones(INDICATOR_BY_KEY[key], gaugeMax(INDICATOR_BY_KEY[key], v))!.find((z) => v >= z.from && v < z.to)!.tone;

  it("churn e inadimplência (menor é melhor) e renovação e conversão (maior é melhor) coincidem com `tone`", () => {
    for (const [key, values] of [["churn", [1, 4.9, 6.5, 7.9, 8.5, 11]], ["inadimplenciaPerc", [2, 6, 9, 14]], ["renovacoes", [10, 39, 45, 59, 70, 95]], ["icv", [10, 30, 45, 55, 70, 90]]] as const) {
      for (const v of values) expect(zoneTone(key, v), `${key} ${v}`).toBe(tones(key, v));
    }
  });

  it("indicadores sem faixas não têm velocímetro; escala se amplia se o valor passar do limite", () => {
    expect(toneZones(INDICATOR_BY_KEY.faturamento, 10)).toBeNull();
    expect(gaugeMax(INDICATOR_BY_KEY.churn, 4)).toBe(12);
    expect(gaugeMax(INDICATOR_BY_KEY.churn, 20)).toBe(22);
    expect(gaugeMax(INDICATOR_BY_KEY.renovacoes, 50)).toBe(100);
  });
});

describe("Visão Executiva em meias-luas", () => {
  const props = { alerts: [], evalMonth: "2026-09", deltas: [], metas: [], onOpenRiscos: () => {}, onOpenUnidades: () => {} };

  it("cartão: número dentro do arco, chips de comparação e aviso de parcial", () => {
    const html = renderToString(<KpiGaugeCard title="Churn" value="3,0%" fill={0.25} marker={0.4} tone="good" partial
      details={[{ text: "-1,5 p.p. vs. set. de 2026", tone: "good", direction: "down" }]} />);
    for (const s of ["Churn", "3,0%", "Em andamento", "-1,5 p.p. vs. set. de 2026"]) expect(html).toContain(s);
    expect(html).not.toContain("<line x1=\"100\""); // sem ponteiro central
  });

  it("mês fechado: oito indicadores, comparação com o mês anterior e sem 'Em andamento'", () => {
    const ant = month("2026-08", [unit("A"), unit("B")]);
    const m = month("2026-09", [unit("A"), unit("B")]);
    dashboardData.push(ant, m);
    const html = renderToString(<ExecutivaTab month={m} prev={ant} {...props} />).replace(/<!-- -->/g, "");
    for (const s of ["Faturamento", "Recebimento", "Vendas Online", "Churn", "Inadimplência", "Renovação", "Conversão", "Metas da rede", "A marca no arco é o mês anterior"]) expect(html).toContain(s);
    expect(html).not.toContain("Em andamento");
    expect(html).not.toContain("Saúde da carteira");
  });

  it("mês em andamento: taxa compara com o mês anterior; valor absoluto mostra quanto do mês anterior já foi alcançado", () => {
    const cur = monthKey(new Date());
    const ant = month("2000-01", [unit("A", { faturamento: 1000000, churn: 4 })]);
    const m = month(cur, [unit("A", { faturamento: 250000, churn: 3 })]);
    dashboardData.push(ant, m);
    const html = renderToString(<ExecutivaTab month={m} prev={ant} {...props} />).replace(/<!-- -->/g, "");
    expect(html).toContain("Em andamento");
    expect(html).toContain("0,0 p.p. vs. jan. de 2000"); // taxa parcial comparada com o mês anterior (o total do helper não varia)
    expect(html).toMatch(/25% de R\$\s?1,0M de jan\. de 2000/); // faturamento parcial
  });
});

describe("DonutList", () => {
  const items = [
    { label: "A", value: 50, color: "red", valueText: "R$ 50" },
    { label: "B", value: 30, color: "blue", valueText: "R$ 30" },
    { label: "C", value: 20, color: "gray", valueText: "R$ 20" },
    { label: "D", value: 0, color: "black", valueText: "R$ 0" },
  ];

  it("participações somam 100% e itens zerados ficam em 0", () => {
    const s = shares(items);
    expect(s).toEqual([50, 30, 20, 0]);
    expect(s.reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares([{ value: 0 }, { value: -3 }])).toEqual([0, 0]);
  });

  it("desenha uma fatia por item com valor e lista todos, inclusive o zerado", () => {
    const html = renderToString(<DonutList title="Teste" items={items} center={{ value: "R$ 100", caption: "total" }} />).replace(/<!-- -->/g, "");
    expect((html.match(/stroke-dasharray/g) ?? []).length).toBe(3);
    for (const s of ["Teste", "R$ 100", ">A<", ">D<", "50%", "0%"]) expect(html).toContain(s);
  });

  it("estado vazio orienta e não desenha a rosca", () => {
    const html = renderToString(<DonutList title="Vazio" items={items.map((i) => ({ ...i, value: 0 }))} center={{ value: "0", caption: "x" }} empty="Nada lançado." />);
    expect(html).toContain("Nada lançado.");
    expect(html).not.toContain("stroke-dasharray");
  });
});
