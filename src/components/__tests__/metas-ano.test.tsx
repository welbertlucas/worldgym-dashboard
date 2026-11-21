import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { AnoAcumulado } from "@/components/metas/AnoAcumulado";
import { acumuladoDoAno, SOMAM_NO_ANO, type Meta } from "@/data/metas";
import type { MonthData } from "@/data/dashboardData";

const limpo = (h: string) => h.replace(/<!-- -->/g, "").replace(/ /g, " ");
const mes = (month: string, faturamento: number) => ({ month, total: { faturamento }, units: [] }) as unknown as MonthData;
const meta = (month: string, bronze: number, prata: number, ouro: number): Meta => ({ month, unit: "TOTAL", key: "faturamento", bronze, prata, ouro });
const parcial = (m: string) => m === "2026-11";

describe("acumulado do ano nas Metas", () => {
  const data = [mes("2025-01", 100), mes("2025-02", 100), mes("2025-03", 100), mes("2026-01", 120), mes("2026-02", 110), mes("2026-03", 50)];
  const metas = [meta("2026-01", 100, 110, 120), meta("2026-02", 100, 110, 120), meta("2026-03", 100, 110, 120), meta("2026-12", 10, 20, 30)];

  it("soma de janeiro até o mês exibido, a meta do ano por nível e a meta ouro acumulada", () => {
    const a = acumuladoDoAno(data, metas, "faturamento", "2026-03", parcial)!;
    expect(a.realizado).toBe(280);
    expect(a.meses.map((m) => m.acumulado)).toEqual([120, 230, 280]);
    expect(a.meses.map((m) => m.metaOuroAcumulada)).toEqual([120, 240, 360]);
    expect(a.metaDoAno).toMatchObject({ bronze: 310, prata: 350, ouro: 390 });
    expect(a.mesesComMeta).toBe(4);
    expect(a.parcial).toBe(false);
  });

  it("a variação sobre o ano anterior usa só os meses fechados; sem o ano anterior inteiro, fica sem comparação", () => {
    const a = acumuladoDoAno(data, metas, "faturamento", "2026-03", parcial)!;
    expect(a.fechados).toMatchObject({ n: 3, realizado: 280, anoAnterior: 300 });
    expect(a.fechados.variacao).toBeCloseTo(-6.67, 1);
    const sem = acumuladoDoAno([mes("2026-01", 120)], metas, "faturamento", "2026-01", parcial)!;
    expect(sem.fechados.anoAnterior).toBeNull();
    expect(sem.fechados.variacao).toBeNull();
  });

  it("o mês em andamento entra no acumulado, mas fica fora da comparação com o ano anterior", () => {
    const d = [mes("2025-10", 100), mes("2025-11", 100), mes("2026-10", 150), mes("2026-11", 40)];
    const a = acumuladoDoAno(d, [], "faturamento", "2026-11", parcial)!;
    expect(a.realizado).toBe(190);
    expect(a.parcial).toBe(true);
    expect(a.fechados).toMatchObject({ n: 1, realizado: 150, anoAnterior: 100, ultimo: "2026-10" });
    expect(a.metaDoAno).toBeNull();
  });

  it("só indicadores que somam têm acumulado; as taxas não", () => {
    expect(SOMAM_NO_ANO).toEqual(["faturamento", "recebimento", "vendasOnline", "novosContratos"]);
    expect(acumuladoDoAno(data, metas, "churn", "2026-03", parcial)).toBeNull();
    expect(acumuladoDoAno([], metas, "faturamento", "2026-03", parcial)).toBeNull();
  });

  it("a faixa mostra o acumulado, a variação e a rosca da meta do ano", () => {
    const a = acumuladoDoAno(data, metas, "faturamento", "2026-03", parcial)!;
    const h = limpo(renderToString(<AnoAcumulado a={a} metaKey="faturamento" />));
    for (const t of ["Faturamento no ano — 2026", "janeiro a março de 2026", "-6,7%", "Meta do ano — Faturamento", "soma as metas cadastradas de 4 meses"]) expect(h).toContain(t);
  });
});
