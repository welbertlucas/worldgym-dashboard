import { describe, expect, it } from "vitest";
import { posicaoNaRede, seriesFor, ultimosFechados, valorOuNulo } from "@/data/unitSeries";
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

  it("compara com a média da rede ou com outra unidade", () => {
    const fat = INDICATOR_BY_KEY.faturamento;
    expect(seriesFor(data, "Gama", fat, 3, null, now).map((r) => [r.unit, r.ref])).toEqual([[100, 200], [200, 300], [300, 400]]);
    expect(seriesFor(data, "Gama", fat, 3, "Itapoã", now).map((r) => r.ref)).toEqual([300, 400, 500]);
  });

  it("zero em churn é 'sem dado', e em faturamento é zero mesmo", () => {
    const churn = INDICATOR_BY_KEY.churn;
    expect(seriesFor(data, "Gama", churn, 3, null, now).map((r) => r.unit)).toEqual([4, null, 5]);
    expect(valorOuNulo(INDICATOR_BY_KEY.faturamento, 0)).toBe(0);
    expect(valorOuNulo(churn, 0)).toBeNull();
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
