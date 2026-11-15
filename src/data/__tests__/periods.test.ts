import { describe, expect, it } from "vitest";
import { getLastClosedMonth, getMonthToOpen, isPartialMonth } from "@/data/periods";

const now = new Date(2026, 9, 14); // 14/out/2026
describe("períodos", () => {
  it("último mês fechado é o anterior ao corrente", () => {
    expect(getLastClosedMonth(["2026-08", "2026-09", "2026-10"], now)).toBe("2026-09");
  });
  it("marca o mês corrente como parcial", () => {
    expect(isPartialMonth("2026-10", now)).toBe(true);
    expect(isPartialMonth("2026-09", now)).toBe(false);
  });
  it("sem mês fechado retorna null", () => {
    expect(getLastClosedMonth(["2026-10"], now)).toBeNull();
  });

  it("abre no mês atual; sem ele, no mais recente que existe", () => {
    const now = new Date(2026, 10, 15); // novembro/2026
    expect(getMonthToOpen(["2026-09", "2026-10", "2026-11"], now)).toBe("2026-11");
    expect(getMonthToOpen(["2026-09", "2026-10"], now)).toBe("2026-10");
    expect(getMonthToOpen(["2027-01"], now)).toBe("2027-01");
    expect(getMonthToOpen([], now)).toBeNull();
  });
});
