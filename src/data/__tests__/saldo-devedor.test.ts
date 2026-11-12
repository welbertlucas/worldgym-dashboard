import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
// @ts-expect-error módulo JS do servidor
import { faixaDeAtraso, resumoTitulo, saldoNoDia } from "../../../server/saldo.js";
// @ts-expect-error módulo JS do servidor
import { resumoAluno, saldoDoMes } from "../../../server/ativos.js";
import { somarSaldoDevedor, type UnitData } from "@/data/dashboardData";
import { SaldoDevedorCard, recente } from "@/components/SaldoDevedor";

const titulo = (reg: string, due: string, valor: number, quem: number | null, extra: Record<string, unknown> = {}) =>
  resumoTitulo({ registrationDate: `${reg}T10:00:00`, dueDate: `${due}T00:00:00`, cancellationDate: null, ammount: valor, idMemberPayer: quem, status: { id: 4, name: "Expired" }, ...extra });

describe("saldo devedor", () => {
  it("faixas de atraso pelo vencimento", () => {
    expect(faixaDeAtraso("2026-11-20", "2026-11-12")).toBe(0);
    expect(faixaDeAtraso("2026-11-12", "2026-11-12")).toBe(0);
    expect(faixaDeAtraso("2026-10-20", "2026-11-12")).toBe(1);
    expect(faixaDeAtraso("2026-09-01", "2026-11-12")).toBe(2);
    expect(faixaDeAtraso("2026-01-01", "2026-11-12")).toBe(3);
    expect(faixaDeAtraso("2024-01-01", "2026-11-12")).toBe(4);
  });

  it("aberto no dia = lançado até o dia e não cancelado até o dia", () => {
    const ts = [
      titulo("2026-10-05", "2026-10-05", 100, 1),
      titulo("2026-10-05", "2026-10-05", 50, 1, { cancellationDate: "2026-10-20T09:00:00", status: { id: 3, name: "Canceled" } }), // pago/perdoado em 20/10
      titulo("2026-11-03", "2026-11-03", 80, 2), // lançado depois de outubro
      titulo("2023-01-10", "2023-01-10", 30, 3),
      titulo("2026-10-01", "2026-10-01", 999, 4, { status: { id: 3, name: "Canceled" } }), // cancelado sem data: nunca conta
    ];
    const set = saldoNoDia(ts, "2026-09-30");
    expect(set.valor).toBe(30);
    const out15 = saldoNoDia(ts, "2026-10-15", new Set([1]));
    expect(out15).toMatchObject({ valor: 180, titulos: 3, pessoas: 2, ativos: [150, 1] });
    const out31 = saldoNoDia(ts, "2026-10-31", new Set([1]));
    expect(out31.valor).toBe(130);
    expect(out31.faixas[1]).toEqual([100, 1]); // 26 dias de atraso
    expect(out31.faixas[4]).toEqual([30, 1]); // mais de um ano
  });

  it("cruza com os alunos ativos no último dia do mês", () => {
    const aluno = (id: number, fim: string) => resumoAluno({ idMember: id, gender: "F", birthDate: null, memberships: [{ startDate: "2026-01-01T00:00:00", endDate: `${fim}T00:00:00`, cancelDate: null, membershipStatus: "active", valueNextMonth: 1, freezes: [] }] });
    const alunos = [aluno(1, "2026-12-31"), aluno(2, "2026-10-15")];
    const ts = [titulo("2026-09-01", "2026-09-01", 100, 1), titulo("2026-09-01", "2026-09-01", 40, 2)];
    expect(saldoDoMes(alunos, ts, "2026-10", "2026-11-12").ativos).toEqual([100, 1]); // o 2 já não era ativo em 31/10
    expect(saldoDoMes(alunos, ts, "2026-09", "2026-11-12").ativos).toEqual([140, 2]);
  });

  it("soma da rede e card", () => {
    const a = { valor: 100, titulos: 2, pessoas: 2, faixas: [[0, 0], [60, 1], [0, 0], [0, 0], [40, 1]], ativos: [60, 1] } as UnitData["saldoDevedor"];
    const b = { valor: 50, titulos: 1, pessoas: 1, faixas: [[0, 0], [0, 0], [50, 1], [0, 0], [0, 0]], ativos: [0, 0] } as UnitData["saldoDevedor"];
    const s = somarSaldoDevedor([{ saldoDevedor: a }, { saldoDevedor: b }, {}])!;
    expect(s).toMatchObject({ valor: 150, titulos: 3, pessoas: 3, ativos: [60, 1] });
    expect(s.faixas[2]).toEqual([50, 1]);
    expect(recente(s)).toBe(110);
    const h = renderToString(createElement(SaldoDevedorCard, { total: { saldoDevedor: s } as UnitData, month: "2026-10", monthLabel: "outubro de 2026", partial: false, unit: "Gama" })).replace(/<!-- -->/g, "");
    expect(h).toContain("Saldo devedor em aberto");
    expect(h).toContain("De alunos ativos");
    expect(h).toContain("27%"); // 40 de 150 com mais de um ano
    expect(renderToString(createElement(SaldoDevedorCard, { total: {} as UnitData, month: "2026-10", monthLabel: "x", partial: false, unit: null }))).toContain("ainda não foi carregado");
  });
});
