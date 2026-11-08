import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { contarPorBairro, saiuNosUltimos12Meses } from "../../../server/bairros.js";
import { somarBairros } from "@/data/mapaAlunos";

const hoje = "2026-11-07";
const c = (ini: string | null, fim: string | null, cancel: string | null = null) => [ini, fim, cancel, "x", false];

describe("saiuNosUltimos12Meses", () => {
  it("conta quem terminou ou cancelou nos últimos 12 meses", () => {
    expect(saiuNosUltimos12Meses([c("2025-01-01", "2026-03-01")], hoje)).toBe(true);
    expect(saiuNosUltimos12Meses([c("2025-01-01", "2027-01-01", "2026-06-10")], hoje)).toBe(true);
  });
  it("deixa de fora ativos, quem saiu há mais de um ano, quem nunca começou e quem tem contrato futuro", () => {
    expect(saiuNosUltimos12Meses([c("2026-01-01", "2027-01-01")], hoje)).toBe(false);
    expect(saiuNosUltimos12Meses([c("2024-01-01", "2025-10-01")], hoje)).toBe(false);
    expect(saiuNosUltimos12Meses([c(null, null)], hoje)).toBe(false);
    expect(saiuNosUltimos12Meses([c("2025-01-01", "2026-03-01"), c("2026-12-01", "2027-12-01")], hoje)).toBe(false);
  });
  it("usa o último contrato quando o aluno voltou e saiu de novo", () => {
    expect(saiuNosUltimos12Meses([c("2023-01-01", "2024-01-01"), c("2026-01-01", "2026-09-01")], hoje)).toBe(true);
  });
});

describe("contarPorBairro com filtro de inativos", () => {
  it("separa ativos e inativos sem repetir aluno", () => {
    const m = (id: number, ms: object[]) => ({ idMember: id, neighborhood: "Paranoá", city: "Brasília", state: "DF", memberships: ms });
    const ct = (s: string, e: string) => ({ startDate: s, endDate: e });
    const membros = [m(1, [ct("2026-01-01", "2027-01-01")]), m(2, [ct("2025-01-01", "2026-03-01")]), m(3, [ct("2020-01-01", "2021-01-01")])];
    expect(contarPorBairro(membros, hoje).lista[0].n).toBe(1);
    expect(contarPorBairro(membros, hoje, saiuNosUltimos12Meses).lista[0].n).toBe(1);
  });
});

describe("somarBairros", () => {
  it("junta o mesmo bairro e mantém a posição aproximada só se todas forem aproximadas", () => {
    const r = somarBairros([[["A", "X", 2, 1, 1, 1], ["B", "X", 1, 2, 2]], [["A", "X", 3, 1, 1]]]);
    expect(r.find((b) => b[0] === "A")?.[2]).toBe(5);
    expect(r.find((b) => b[0] === "A")?.[5]).toBeUndefined();
    expect(r).toHaveLength(2);
  });
});
