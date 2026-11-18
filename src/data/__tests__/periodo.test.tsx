import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { agregarPeriodo, mediaPonderada, mesesDoPeriodo, periodoAnterior, rotuloPeriodo } from "@/data/periodo";
import { SeletorPeriodo } from "@/components/executiva/SeletorPeriodo";
import { KpiGrid, type KpiSpec } from "@/components/kpi/KpiGrid";
import type { MonthView } from "@/data/kpiView";
import { unit } from "@/data/__tests__/helpers";
import type { UnitData } from "@/data/dashboardData";

const vista = (month: string, t: Partial<UnitData>): MonthView => ({ month, total: unit("TOTAL", t), units: [] });
const sem = (v: string) => v.replace(/<!-- -->/g, "").replace(/ /g, " ");

describe("mesesDoPeriodo e periodoAnterior", () => {
  const todos = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((month) => ({ month }));

  it("traz os meses do início ao fim, com as pontas", () => {
    expect(mesesDoPeriodo(todos, "2026-08", "2026-10")).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(mesesDoPeriodo(todos, "2026-10", "2026-10")).toEqual(["2026-10"]);
  });

  it("vazio quando as pontas estão invertidas ou o mês não existe", () => {
    expect(mesesDoPeriodo(todos, "2026-10", "2026-08")).toEqual([]);
    expect(mesesDoPeriodo(todos, "2020-01", "2026-08")).toEqual([]);
  });

  it("o período anterior tem o mesmo tamanho e termina logo antes do início", () => {
    expect(periodoAnterior(todos, "2026-09", "2026-11")).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("sem meses suficientes para trás, não há período anterior", () => {
    expect(periodoAnterior(todos, "2026-07", "2026-11")).toEqual([]);
  });
});

describe("mediaPonderada", () => {
  const taxa = (t: UnitData) => t.churn;
  const base = (t: UnitData) => t.ativosIni;

  it("pondera pela base: o mês maior pesa mais", () => {
    const meses = [vista("2026-09", { churn: 2, ativosIni: 1000 }), vista("2026-10", { churn: 6, ativosIni: 3000 })];
    expect(mediaPonderada(meses, taxa, base)).toBe(5); // (2*1000 + 6*3000) / 4000
  });

  it("um mês só dá exatamente o número do mês", () => {
    expect(mediaPonderada([vista("2026-10", { churn: 3.7, ativosIni: 500 })], taxa, base)).toBe(3.7);
  });

  it("meses sem base ficam de fora quando existe algum com base", () => {
    const meses = [vista("2025-01", { churn: 9 }), vista("2026-10", { churn: 4, ativosIni: 800 })];
    expect(mediaPonderada(meses, taxa, base)).toBe(4);
  });

  it("sem base em nenhum mês, vale a média simples", () => {
    expect(mediaPonderada([vista("2025-01", { churn: 2 }), vista("2025-02", { churn: 4 })], taxa, base)).toBe(3);
  });

  it("sem meses, zero", () => {
    expect(mediaPonderada([], taxa, base)).toBe(0);
  });
});

describe("agregarPeriodo", () => {
  const meses = [
    vista("2026-09", { faturamento: 1_000_000, recebimento: 900_000, vendasOnline: 10_000, cancelados: 40, churn: 2, ativosIni: 2000, inadimplenciaPerc: 5, pagantes: 1000, renovacoes: 50, aVencer: 100, icv: 40, oportunidades: 200, conversoes: 80 }),
    vista("2026-10", { faturamento: 2_000_000, recebimento: 1_800_000, vendasOnline: 20_000, cancelados: 180, churn: 6, ativosIni: 3000, inadimplenciaPerc: 7, pagantes: 3000, renovacoes: 70, aVencer: 300, icv: 60, oportunidades: 800, conversoes: 480 }),
  ];
  const p = agregarPeriodo(meses);

  it("soma o que é soma", () => {
    expect(p.total.faturamento).toBe(3_000_000);
    expect(p.total.recebimento).toBe(2_700_000);
    expect(p.total.vendasOnline).toBe(30_000);
    expect(p.total.cancelados).toBe(220);
    expect(p.total.oportunidades).toBe(1000);
  });

  it("pondera cada taxa pela sua própria base", () => {
    expect(p.total.churn).toBe(4.4); // (2*2000 + 6*3000) / 5000
    expect(p.total.inadimplenciaPerc).toBe(6.5); // (5*1000 + 7*3000) / 4000
    expect(p.total.renovacoes).toBe(65); // (50*100 + 70*300) / 400
    expect(p.total.icv).toBe(56); // (40*200 + 60*800) / 1000
  });

  it("a vista leva o último mês", () => {
    expect(p.month).toBe("2026-10");
  });

  it("a previsão do período soma a previsão de cada mês (mês fechado vale o faturamento)", () => {
    const comPrevisao = agregarPeriodo([vista("2026-10", { faturamento: 100 }), vista("2026-11", { faturamento: 40, previsaoFaturamento: 150 })]);
    expect(comPrevisao.total.previsaoFaturamento).toBe(250);
    expect(agregarPeriodo(meses).total.previsaoFaturamento).toBeUndefined();
  });

  it("um mês só é igual ao mês", () => {
    const um = agregarPeriodo([meses[1]]);
    expect(um.total.faturamento).toBe(2_000_000);
    expect(um.total.churn).toBe(6);
    expect(um.total.inadimplenciaPerc).toBe(7);
    expect(um.total.renovacoes).toBe(70);
    expect(um.total.icv).toBe(60);
  });
});

describe("rotuloPeriodo", () => {
  it("abrevia o período", () => {
    expect(rotuloPeriodo("2026-07", "2026-11")).toBe("jul–nov/2026");
    expect(rotuloPeriodo("2025-11", "2026-02")).toBe("nov/2025–fev/2026");
    expect(rotuloPeriodo("2026-11", "2026-11")).toBe("nov/2026");
  });
});

describe("SeletorPeriodo", () => {
  const meses = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];

  it("desligado, mostra só o botão 'Ver por período'", () => {
    const html = sem(renderToString(<SeletorPeriodo meses={meses} periodo={null} aoMudar={() => {}} ate="2026-11" />));
    expect(html).toContain("Ver por período");
    expect(html).not.toContain("periodo-de");
  });

  it("ligado, mostra De e Até com os meses e o botão de voltar ao mês", () => {
    const html = sem(renderToString(<SeletorPeriodo meses={meses} periodo={{ de: "2026-08", ate: "2026-10" }} aoMudar={() => {}} ate="2026-11" />));
    for (const s of ["De", "Até", "Ago/26", "Out/26", "Voltar ao mês escolhido", "Novembro de 2026"]) expect(html).toContain(s);
  });
});

describe("velocímetro com período anterior", () => {
  it("a comparação leva o nome do período, não de um mês", () => {
    const cur = agregarPeriodo([vista("2026-09", { churn: 4, ativosIni: 100 }), vista("2026-10", { churn: 4, ativosIni: 100 })]);
    const prev = agregarPeriodo([vista("2026-07", { churn: 3, ativosIni: 100 }), vista("2026-08", { churn: 3, ativosIni: 100 })]);
    const specs: KpiSpec[] = [{ title: "Churn", kind: "rate", rateKey: "churn", pick: (v) => v.total.churn, fmt: (n) => `${n}%` }];
    const html = sem(renderToString(<KpiGrid ctx={{ cur, prev, partial: false, prevLabel: "jul–ago/2026" }} specs={specs} />));
    expect(html).toContain("vs. jul–ago/2026");
  });
});
