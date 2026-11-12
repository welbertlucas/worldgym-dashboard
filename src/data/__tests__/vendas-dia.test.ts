import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
// @ts-expect-error módulo JS do servidor
import { resumirVendas } from "../../../server/vendas.js";
import { diasFechados, mediaPorDiaDaSemana, projetarMes, diaDaSemana } from "@/data/vendasDia";
import { somarVendasDia, type UnitData } from "@/data/dashboardData";
import { VendasPorDia } from "@/components/VendasPorDia";

describe("vendas por dia do mês", () => {
  it("conta os novos contratos pelo dia da venda, com as mesmas regras do total", () => {
    const venda = (saleDate: string, item: Record<string, unknown>) => ({ idBranch: 5, removed: null, saleSource: null, saleDate, saleItens: [{ description: "PLANO", saleValue: 100, quantity: 1, ...item }] });
    const por = resumirVendas([
      venda("2026-10-01T00:00:00", { idMembership: 1 }),
      venda("2026-10-01T18:40:00", { idMembership: 1 }),
      venda("2026-10-31T09:00:00", { idMembership: 1 }),
      venda("2026-10-02T10:00:00", { idMembership: 1, idMembershipRenewed: 7 }), // renovação: fica de fora
      venda("2026-10-03T10:00:00", { description: "DIARIA", idMembership: 2 }), // diária: fica de fora
    ], new Map(), 31);
    const u = Object.values(por)[0] as { novosContratos: number; vendasDia: number[] };
    expect(u.vendasDia).toHaveLength(31);
    expect(u.vendasDia[0]).toBe(2);
    expect(u.vendasDia[30]).toBe(1);
    expect(u.vendasDia.reduce((a, b) => a + b, 0)).toBe(u.novosContratos);
  });

  it("soma as unidades dia a dia", () => {
    expect(somarVendasDia([{ vendasDia: [1, 2, 3] }, { vendasDia: [10, 0, 1] }, {}])).toEqual([11, 2, 4]);
    expect(somarVendasDia([{}, {}])).toBeUndefined();
  });

  it("dias fechados: até a véspera da leitura de madrugada (horário de Brasília)", () => {
    expect(diasFechados("2026-11", true, "2026-11-12T05:01:04Z")).toBe(11); // 02:01 de 12/11 em Brasília
    expect(diasFechados("2026-11", true, "2026-11-12T01:30:00Z")).toBe(10); // ainda 11/11 em Brasília
    expect(diasFechados("2026-11", true, "2026-10-31T23:00:00Z")).toBe(0);
    expect(diasFechados("2026-10", false, null)).toBe(31);
  });

  it("média por dia da semana dos meses de referência", () => {
    const ref = (m: string, n: number): [string, number[]] => [m, Array.from({ length: n }, (_, i) => ([0, 6].includes(diaDaSemana(m, i + 1)) ? 2 : 10))];
    const media = mediaPorDiaDaSemana([ref("2026-08", 31), ref("2026-09", 30), ref("2026-10", 31)]);
    expect(media[1]).toBe(10);
    expect(media[0]).toBe(2);
  });

  it("projeção pela curva do mês: realizado ÷ parte das vendas que os meses anteriores tinham feito até o mesmo dia", () => {
    // Referência: metade das vendas do mês nos 10 primeiros dias.
    const ref = (m: string, n: number): [string, number[]] => [m, Array.from({ length: n }, (_, i) => (i < 10 ? 20 : 200 / (n - 10)))];
    const hist = [ref("2026-08", 31), ref("2026-09", 30), ref("2026-10", 31)];
    const nov = Array.from({ length: 30 }, (_, i) => (i < 10 ? 30 : 0)); // 300 em 10 dias
    const p = projetarMes(nov, "2026-11", 10, hist)!;
    expect(p.realizado).toBe(300);
    expect(p.fatia).toBeCloseTo(0.5);
    expect(p.valor).toBeCloseTo(600);
    // Sem referência: ritmo linear. Antes do dia 10: sem projeção.
    expect(projetarMes(Array(30).fill(3), "2026-11", 10, [])!.valor).toBeCloseTo(90);
    expect(projetarMes(nov, "2026-11", 9, hist)).toBeNull();
  });

  it("card: calendário, sem dado e mês fechado sem projeção", () => {
    const total = { vendasDia: Array.from({ length: 31 }, (_, i) => (i === 4 ? 40 : 10)) } as unknown as UnitData;
    const h = renderToString(createElement(VendasPorDia, { total, month: "2026-10", partial: false, unit: "Gama", atualizadoEm: null, metas: [] })).replace(/<!-- -->/g, "");
    expect(h).toContain("Novos contratos no mês");
    expect(h).toContain("340"); // 30 × 10 + 40
    expect(h).toContain("5/10"); // maior dia
    expect(h).toContain("Dia que mais vendeu em outubro"); // o próprio mês, não os anteriores
    expect(h).toContain("Segunda"); // 05/10/2026 é segunda
    expect(h).not.toContain("Dia que mais vendia antes");
    expect(h).not.toContain("Projeção para o fechamento");
    expect(renderToString(createElement(VendasPorDia, { total: {} as UnitData, month: "2026-10", partial: false, unit: null, atualizadoEm: null, metas: [] }))).toContain("ainda não foram carregadas");
  });
});
