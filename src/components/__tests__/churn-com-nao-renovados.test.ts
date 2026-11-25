import { describe, expect, it } from "vitest";
import { churnComNaoRenovados } from "@/components/kpi/tabSpecs";

// Números INVENTADOS. A vista tem só o que a linha lê: unidades com ativos no início, cancelados e não renovados do mês.
const extra = (units: Record<string, number | undefined>[]) => churnComNaoRenovados({ units } as never);

describe("Churn: linha 'Com não renovados'", () => {
  it("soma cancelados e não renovados sobre os ativos do início", () => {
    // 1.000 ativos no início, 50 cancelados e 30 não renovados = 8,0%
    expect(extra([{ ativosIni: 1000, cancelados: 50, naoRenovados: 30 }])[0].text).toBe("Com não renovados: 8,0%");
  });
  it("com várias unidades, usa a soma de todas (não a média das taxas)", () => {
    // (50+30 + 20+0) / (1.000 + 500) = 6,7%
    expect(extra([{ ativosIni: 1000, cancelados: 50, naoRenovados: 30 }, { ativosIni: 500, cancelados: 20, naoRenovados: 0 }])[0].text).toBe("Com não renovados: 6,7%");
  });
  it("não aparece se alguma unidade ainda não tem os não renovados (mês sem o dado) ou não tem base", () => {
    expect(extra([{ ativosIni: 1000, cancelados: 50 }])).toEqual([]);
    expect(extra([{ ativosIni: 1000, cancelados: 50, naoRenovados: 30 }, { ativosIni: 500, cancelados: 20 }])).toEqual([]);
    expect(extra([{ cancelados: 5, naoRenovados: 2 }])).toEqual([]);
    expect(extra([])).toEqual([]);
  });
});
