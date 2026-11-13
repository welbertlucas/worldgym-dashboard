import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error módulo JS do servidor
import { inadimplenciaPorPerfil, lerPagadores, salvarPagadores } from "../../../server/inadPerfil.js";
import { somarInadPerfil, type UnitData } from "@/data/dashboardData";
import { InadPerfilCard } from "@/components/clientes/CancelPerfilCard";

describe("inadimplência por gênero e idade", () => {
  it("conta [pagantes, devendo] por gênero e faixa de idade no dia 1º do mês; quem não é aluno da unidade fica fora", () => {
    const alunos = [
      { id: 1, g: 0, n: "2000-05-10" }, // 26 anos em 2026-11-01 -> 25–34
      { id: 2, g: 1, n: "2006-12-01" }, // 19 anos -> 18–24
      { id: 3, g: 1, n: null }, // sem data
    ];
    const r = inadimplenciaPorPerfil(alunos, { pagantes: [1, 2, 3, 99, 1], devendo: [2, 99] }, "2026-11");
    expect(r.g).toEqual([[1, 0], [2, 1], [0, 0]]);
    expect(r.i[1]).toEqual([1, 1]);
    expect(r.i[2]).toEqual([1, 0]);
    expect(r.i[7]).toEqual([1, 0]);
    expect(r.fora).toBe(1);
  });

  it("os pagadores ficam só num arquivo temporário da rodada", () => {
    process.env.PAGADORES_DIR = mkdtempSync(join(tmpdir(), "pag-"));
    expect(lerPagadores("2026-11")).toBeNull();
    salvarPagadores("2026-11", { Gama: { pagantes: [1], devendo: [] } });
    expect(lerPagadores("2026-11")).toEqual({ Gama: { pagantes: [1], devendo: [] } });
    delete process.env.PAGADORES_DIR;
  });

  it("soma as unidades e mostra o cartão com a taxa por grupo", () => {
    const g = (a: number, b: number): [number, number][] => [[a, b], [a, b], [0, 0]];
    const i = (): [number, number][] => Array.from({ length: 8 }, (_, k) => (k === 1 ? [100, 20] : k === 3 ? [100, 5] : [0, 0]));
    const t = somarInadPerfil([{ inadPerfil: { g: g(50, 10), i: i(), fora: 2 } }, { inadPerfil: { g: g(50, 2), i: i(), fora: 1 } }, {}])!;
    expect(t.g[0]).toEqual([100, 12]);
    expect(t.fora).toBe(3);
    const h = renderToString(createElement(InadPerfilCard, { total: { inadPerfil: t } as unknown as UnitData, monthLabel: "Outubro de 2026", partial: false, unitLabel: "Rede" })).replace(/<!-- -->/g, "");
    expect(h).toContain("Quem fica devendo: gênero e idade");
    expect(h).toContain("Faixa que mais deve: 18–24");
    expect(h).toContain("3 pagantes sem cadastro de aluno na unidade ficaram fora");
    expect(renderToString(createElement(InadPerfilCard, { total: {} as UnitData, monthLabel: "x", partial: false, unitLabel: "Rede" }))).toContain("próxima rodada noturna");
  });
});
