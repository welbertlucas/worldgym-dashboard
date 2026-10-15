import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { GaugeMeter, arcPath, gaugeAngle } from "@/components/GaugeMeter";
import { DonutList, shares } from "@/components/DonutList";
import { HealthGauges } from "@/components/executiva/HealthGauges";
import { ExecutivaTab } from "@/components/tabs/ExecutivaTab";
import { dashboardData } from "@/data/dashboardData";
import { INDICATOR_BY_KEY, gaugeMax, toneZones } from "@/data/unitIndicators";
import { month, unit } from "@/data/__tests__/helpers";

afterEach(() => { dashboardData.length = 0; });

describe("GaugeMeter (geometria)", () => {
  it("mapeia o valor para 0–180° e limita às pontas", () => {
    expect(gaugeAngle(0, 0, 100)).toBe(0);
    expect(gaugeAngle(50, 0, 100)).toBe(90);
    expect(gaugeAngle(100, 0, 100)).toBe(180);
    expect(gaugeAngle(-5, 0, 100)).toBe(0);
    expect(gaugeAngle(500, 0, 100)).toBe(180);
    expect(gaugeAngle(5, 5, 5)).toBe(0); // escala inválida não quebra
  });

  it("arco do topo vai do ponto esquerdo ao direito, passando por cima", () => {
    const d = arcPath(0, 180, 80);
    expect(d).toMatch(/^M 20\.00 100\.00 A 80 80 0 0 1 180\.00 100\.00$/);
  });

  it("desenha faixas, ponteiro e rótulos; ignora faixas sem largura", () => {
    const html = renderToString(
      <GaugeMeter max={100} value={64} label="Conversão: 64%" ticks={[{ value: 0, text: "0%" }, { value: 100, text: "100%" }]}
        zones={[{ from: 0, to: 40, color: "red" }, { from: 40, to: 60, color: "orange" }, { from: 60, to: 100, color: "green" }, { from: 100, to: 100, color: "x" }]} />,
    );
    expect((html.match(/<path/g) ?? []).length).toBe(3);
    expect(html).toContain("<line");
    expect(html).toContain('aria-label="Conversão: 64%"');
    expect(html).toContain(">100%<");
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

describe("HealthGauges", () => {
  it("mostra os quatro indicadores com valor, faixas e dica de leitura", () => {
    const html = renderToString(<HealthGauges total={unit("TOTAL", { churn: 8.8, inadimplenciaPerc: 7, renovacoes: 44.7, icv: 63.6 })} partial={false} />).replace(/<!-- -->/g, "");
    for (const s of ["Saúde da carteira", "Churn", "Inadimplência", "Renovação", "Taxa de conversão", "8,8%", "7,0%", "44,7%", "63,6%", "vermelho acima de 8%"]) expect(html).toContain(s);
    expect((html.match(/<line/g) ?? []).length).toBe(4); // um ponteiro por velocímetro
    expect(html).not.toContain("parciais");
  });

  it("mês em andamento é identificado como parcial", () => {
    expect(renderToString(<HealthGauges total={unit("TOTAL")} partial />)).toContain("parciais");
  });

  it("aparece na Visão Executiva", () => {
    const m = month("2026-09", [unit("A"), unit("B")]);
    dashboardData.push(m);
    const html = renderToString(<ExecutivaTab month={m} alerts={[]} evalMonth="2026-09" deltas={[]} metas={[]} onOpenRiscos={() => {}} onOpenUnidades={() => {}} />);
    expect(html).toContain("Saúde da carteira");
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
