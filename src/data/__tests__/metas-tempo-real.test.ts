import { describe, expect, it } from "vitest";
import { bulletScale, progressToNext, tierReached, type Meta } from "@/data/metas";

const fat: Meta = { month: "2026-10", unit: "A", key: "faturamento", bronze: 100, prata: 120, ouro: 150 };
const churn: Meta = { month: "2026-10", unit: "A", key: "churn", bronze: 8, prata: 6, ouro: 4 };

describe("progressToNext", () => {
  it("maior é melhor: % do próximo nível ainda não atingido", () => {
    expect(progressToNext("faturamento", 50, fat)).toMatchObject({ pct: 50, next: { tier: "bronze", value: 100, gap: 50 } });
    expect(progressToNext("faturamento", 110, fat)).toMatchObject({ next: { tier: "prata", gap: 10 } });
    expect(progressToNext("faturamento", 110, fat).pct).toBeCloseTo((110 / 120) * 100);
  });
  it("todos os níveis atingidos = 100% e sem próximo", () => {
    expect(progressToNext("faturamento", 160, fat)).toEqual({ pct: 100, next: null });
  });
  it("menor é melhor: usa a fórmula de atingimento existente (alvo/realizado), limitada a 100", () => {
    const p = progressToNext("churn", 10, churn); // ainda acima do bronze (8)
    expect(p.next?.tier).toBe("bronze");
    expect(p.pct).toBeCloseTo(80);
    expect(progressToNext("churn", 7, churn).next?.tier).toBe("prata");
    expect(progressToNext("churn", 3, churn)).toEqual({ pct: 100, next: null });
  });
  it("realizado zerado ou nenhum nível = 0%", () => {
    expect(progressToNext("faturamento", 0, fat).pct).toBe(0);
  });
});

describe("bulletScale (barra de faixas)", () => {
  const zoneAt = (s: NonNullable<ReturnType<typeof bulletScale>>, v: number) => s.zones.find((z) => v >= z.from && v <= z.to)!.tier;

  it("maior é melhor: abaixo → bronze → prata → ouro, coerente com tierReached", () => {
    for (const v of [50, 99, 105, 125, 160]) {
      const s = bulletScale("faturamento", v, fat)!;
      const expected = tierReached("faturamento", v, fat);
      expect(zoneAt(s, v)).toBe(expected);
    }
  });

  it("menor é melhor: ouro à esquerda e 'abaixo' à direita, coerente com tierReached", () => {
    for (const v of [3, 5, 7, 9, 12]) {
      const s = bulletScale("churn", v, churn)!;
      expect(zoneAt(s, v)).toBe(tierReached("churn", v, churn));
    }
    const s = bulletScale("churn", 5, churn)!;
    expect(s.zones[0].tier).toBe("ouro");
    expect(s.zones[s.zones.length - 1].tier).toBe("abaixo");
  });

  it("marcadores e realizado ficam dentro da barra; realizado acima do ouro amplia a escala", () => {
    const s = bulletScale("faturamento", 400, fat)!;
    expect(s.actualPos).toBeLessThanOrEqual(100);
    expect(s.max).toBeGreaterThanOrEqual(400);
    expect(s.markers.map((m) => m.tier)).toEqual(["bronze", "prata", "ouro"]);
    expect(s.markers.every((m) => m.pos >= 0 && m.pos <= 100)).toBe(true);
  });

  it("aceita metas com poucos níveis e devolve null sem nenhum", () => {
    const so: Meta = { month: "2026-10", unit: "A", key: "faturamento", prata: 120 };
    expect(bulletScale("faturamento", 50, so)!.markers).toHaveLength(1);
    expect(bulletScale("faturamento", 50, { month: "x", unit: "A", key: "faturamento" })).toBeNull();
  });
});

import { parseMetaMonth, parseMetasCSV as parseMetasMes } from "@/data/metas";

describe("mês por nome na aba Metas", () => {
  it("aceita nome, abreviação, mm/aaaa e aaaa-mm", () => {
    expect(parseMetaMonth("Outubro", 2026)).toBe("2026-10");
    expect(parseMetaMonth("out/2026", 2025)).toBe("2026-10");
    expect(parseMetaMonth("Março de 2027", 2026)).toBe("2027-03");
    expect(parseMetaMonth("10/2026", 2020)).toBe("2026-10");
    expect(parseMetaMonth("2026-9", 2020)).toBe("2026-09");
    expect(parseMetaMonth("abc", 2026)).toBeNull();
  });
  it("lê as linhas da planilha com mês 'Outubro'", () => {
    const csv = 'Mês,Unidade,Indicador,Bronze,Prata,Ouro\nOutubro,Gama,Faturamento,"R$ 347.045,38","R$ 365.310,92","R$ 390.882,69"';
    const r = parseMetasMes(csv, 2026);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ month: "2026-10", unit: "Gama", key: "faturamento", bronze: 347045.38 });
  });
});
