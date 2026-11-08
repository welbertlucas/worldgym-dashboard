import { describe, expect, it } from "vitest";
import { mesesNoIntervalo, posicaoNaRede, seriesPorMeses, ultimosFechados, valorOuNulo } from "@/data/unitSeries";
import { INDICATOR_BY_KEY } from "@/data/unitIndicators";
import { month, unit } from "./helpers";

const now = new Date(2026, 10, 5); // novembro/2026
const data = [
  month("2026-08", [unit("Gama", { faturamento: 100, churn: 4 }), unit("Itapoã", { faturamento: 300, churn: 6 })]),
  month("2026-09", [unit("Gama", { faturamento: 200, churn: 0 }), unit("Itapoã", { faturamento: 400, churn: 8 })]),
  month("2026-10", [unit("Gama", { faturamento: 300, churn: 5 }), unit("Itapoã", { faturamento: 500, churn: 7 })]),
  month("2026-11", [unit("Gama", { faturamento: 50, churn: 0 }), unit("Itapoã", { faturamento: 60, churn: 0 })]),
];

describe("série da unidade", () => {
  it("usa só meses fechados e respeita o tamanho do período", () => {
    expect(ultimosFechados(data, 12, now).map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(ultimosFechados(data, 2, now).map((m) => m.month)).toEqual(["2026-09", "2026-10"]);
  });

  it("devolve o valor da unidade em cada mês escolhido", () => {
    const fat = INDICATOR_BY_KEY.faturamento;
    expect(seriesPorMeses(data, "Gama", fat, ["2026-08", "2026-09", "2026-10"]).map((r) => r.unit)).toEqual([100, 200, 300]);
  });

  it("zero em churn é 'sem dado', e em faturamento é zero mesmo", () => {
    const churn = INDICATOR_BY_KEY.churn;
    expect(seriesPorMeses(data, "Gama", churn, ["2026-08", "2026-09", "2026-10"]).map((r) => r.unit)).toEqual([4, null, 5]);
    expect(valorOuNulo(INDICATOR_BY_KEY.faturamento, 0)).toBe(0);
    expect(valorOuNulo(churn, 0)).toBeNull();
  });

  it("mês ou unidade sem registro vira sem dado", () => {
    expect(seriesPorMeses(data, "Gama", INDICATOR_BY_KEY.faturamento, ["2020-01"]).map((r) => r.unit)).toEqual([null]);
    expect(seriesPorMeses(data, "Inexistente", INDICATOR_BY_KEY.faturamento, ["2026-08"]).map((r) => r.unit)).toEqual([null]);
  });

  it("intervalo escolhido: só meses fechados, e aceita datas invertidas", () => {
    expect(mesesNoIntervalo(data, "2026-09", "2026-08", now)).toEqual(["2026-08", "2026-09"]);
    expect(mesesNoIntervalo(data, "2026-10", "2026-12", now)).toEqual(["2026-10"]);
  });
});

describe("posição na rede", () => {
  it("maior é melhor: faturamento", () => {
    expect(posicaoNaRede(data[2], "Itapoã", INDICATOR_BY_KEY.faturamento)).toEqual({ posicao: 1, de: 2 });
    expect(posicaoNaRede(data[2], "Gama", INDICATOR_BY_KEY.faturamento)).toEqual({ posicao: 2, de: 2 });
  });

  it("menor é melhor: churn, ignorando unidades sem dado", () => {
    expect(posicaoNaRede(data[2], "Gama", INDICATOR_BY_KEY.churn)).toEqual({ posicao: 1, de: 2 });
    expect(posicaoNaRede(data[1], "Gama", INDICATOR_BY_KEY.churn)).toBeNull();
  });

  it("sem regra de direção não tem posição", () => {
    expect(posicaoNaRede(data[2], "Gama", INDICATOR_BY_KEY.diarias)).toBeNull();
  });
});

describe("zero é 'sem dado' nos indicadores de contagem e taxa", () => {
  it("não considera zero como resultado em churn, novos contratos e ticket", async () => {
    const { hasData } = await import("@/data/unitIndicators");
    for (const k of ["churn", "novosContratos", "ticketMedio", "adimplentes", "inadimplenciaPerc"]) expect(hasData(INDICATOR_BY_KEY[k], 0)).toBe(false);
    for (const k of ["faturamento", "recebimento", "vendasOnline", "diarias"]) expect(hasData(INDICATOR_BY_KEY[k], 0)).toBe(true);
  });
});

describe("comparativo entre unidades no mês em andamento", () => {
  it("zero em venda online ou receitas complementares vira 'sem dado', e faturamento continua comparável", async () => {
    const { compareIndicator } = await import("@/data/unitIndicators");
    const a = unit("Gama", { vendasOnline: 500, diarias: 100, faturamento: 100 });
    const b = unit("Itapoã", { vendasOnline: 0, diarias: 0, faturamento: 50 });
    expect(compareIndicator(INDICATOR_BY_KEY.vendasOnline, a, b, false).state).toBe("uncomputable");
    expect(compareIndicator(INDICATOR_BY_KEY.vendasOnline, a, b, true).state).toBe("nodata");
    expect(compareIndicator(INDICATOR_BY_KEY.diarias, a, b, true).state).toBe("nodata");
    expect(compareIndicator(INDICATOR_BY_KEY.faturamento, a, b, true).state).toBe("ok");
  });
});

describe("série da rede para comparar com a unidade", () => {
  it("valores e contagens: média das unidades com dado; percentuais: o resultado da rede", async () => {
    const { serieDaRede } = await import("@/data/unitSeries");
    const m = month("2026-09", [unit("A", { faturamento: 300, churn: 4 }), unit("B", { faturamento: 100, churn: 6 })]);
    m.total = { ...m.total, churn: 5.5 };
    expect(serieDaRede([m], INDICATOR_BY_KEY.faturamento, ["2026-09", "2026-10"])).toEqual([{ month: "2026-09", unit: 200 }, { month: "2026-10", unit: null }]);
    expect(serieDaRede([m], INDICATOR_BY_KEY.churn, ["2026-09"])[0].unit).toBe(5.5);
  });
});
