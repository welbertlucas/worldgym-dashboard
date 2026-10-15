import { describe, expect, it } from "vitest";
import { attainment, metaWarnings, nextTier, parseMetasCSV, tierReached, type Meta } from "@/data/metas";

describe("metas bronze/prata/ouro", () => {
  it("lê a aba Metas com os três níveis (opcionais) e mapeia a rede", () => {
    const csv = `Mês,Unidade,Indicador,Bronze,Prata,Ouro\n2026-9,Gama,Faturamento," R$  380.000 "," R$  420.000 "," R$  460.000 "\n2026-09,Rede,Churn,"8,0%","6,5%",\n2026-09,Gama,Indicador inexistente,1,2,3\n2026-09,Gama,NPS,,,`;
    expect(parseMetasCSV(csv)).toEqual([
      { month: "2026-09", unit: "Gama", key: "faturamento", bronze: 380000, prata: 420000, ouro: 460000 },
      { month: "2026-09", unit: "TOTAL", key: "churn", bronze: 8, prata: 6.5 },
    ]);
  });

  it("devolve [] se o CSV não for a aba Metas (aba principal ou sem colunas de nível)", () => {
    expect(parseMetasCSV("Mês,Unidade,Faturamento\n2026-09,Gama,1")).toEqual([]);
    expect(parseMetasCSV("Mês,Unidade,Indicador,Meta\n2026-09,Gama,Faturamento,1")).toEqual([]);
  });

  const fat: Meta = { month: "2026-09", unit: "A", key: "faturamento", bronze: 100, prata: 120, ouro: 150 };
  const churn: Meta = { month: "2026-09", unit: "A", key: "churn", bronze: 8, prata: 6, ouro: 4 };

  it("nível atingido: maior é melhor", () => {
    expect(tierReached("faturamento", 99, fat)).toBe("abaixo");
    expect(tierReached("faturamento", 100, fat)).toBe("bronze");
    expect(tierReached("faturamento", 130, fat)).toBe("prata");
    expect(tierReached("faturamento", 150, fat)).toBe("ouro");
  });

  it("nível atingido: menor é melhor (churn)", () => {
    expect(tierReached("churn", 9, churn)).toBe("abaixo");
    expect(tierReached("churn", 8, churn)).toBe("bronze");
    expect(tierReached("churn", 5, churn)).toBe("prata");
    expect(tierReached("churn", 3.9, churn)).toBe("ouro");
  });

  it("aceita metas com só alguns níveis", () => {
    const so: Meta = { month: "2026-09", unit: "A", key: "faturamento", prata: 120 };
    expect(tierReached("faturamento", 119, so)).toBe("abaixo");
    expect(tierReached("faturamento", 120, so)).toBe("prata");
  });

  it("próximo nível e quanto falta", () => {
    expect(nextTier("faturamento", 110, fat)).toEqual({ tier: "prata", value: 120, gap: 10 });
    expect(nextTier("faturamento", 160, fat)).toBeNull();
    expect(nextTier("churn", 7, churn)).toEqual({ tier: "prata", value: 6, gap: 1 });
  });

  it("avisa quando os níveis estão fora de ordem", () => {
    expect(metaWarnings([fat, churn])).toEqual([]);
    expect(metaWarnings([{ ...fat, bronze: 200 }])).toHaveLength(1);
    expect(metaWarnings([{ ...churn, ouro: 9 }])).toHaveLength(1);
  });

  it("atingimento relativo inverte para menor é melhor", () => {
    expect(attainment("faturamento", 90, 100)).toBe(90);
    expect(attainment("churn", 8, 4)).toBe(50);
    expect(attainment("faturamento", 1, 0)).toBeNull();
  });
});
