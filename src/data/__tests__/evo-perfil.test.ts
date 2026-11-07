import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { faixaDeIdade, generoDe, perfilDasOportunidades, perfilDosAlunos } from "../../../server/perfil.js";
import { somarPerfil, somarPerfilOport } from "@/data/dashboardData";

describe("perfil: gênero e idade", () => {
  it("reconhece gênero em inglês, português e vazio", () => {
    expect([generoDe("Female"), generoDe("masculino"), generoDe("M"), generoDe(null), generoDe("Other")]).toEqual([0, 1, 1, 2, 2]);
  });
  it("calcula a faixa pelo aniversário e manda datas ruins para 'sem data'", () => {
    const hoje = "2026-11-07";
    expect(faixaDeIdade("2008-11-08T03:00:00", hoje)).toBe(0); // 17 anos (faz 18 amanhã)
    expect(faixaDeIdade("2008-11-07T03:00:00", hoje)).toBe(1); // 18 hoje
    expect(faixaDeIdade("1990-02-19T03:00:00", hoje)).toBe(3); // 36
    expect(faixaDeIdade("1950-01-01", hoje)).toBe(6); // 76
    expect([faixaDeIdade(null, hoje), faixaDeIdade("2030-01-01", hoje), faixaDeIdade("1800-01-01", hoje)]).toEqual([7, 7, 7]);
  });
  it("conta gênero, idade e estado civil dos alunos", () => {
    const p = perfilDosAlunos([
      { gender: "Female", birthDate: "1990-02-19T03:00:00", maritalStatus: "SOLTEIRO" },
      { gender: "Male", birthDate: "2000-05-01", maritalStatus: "solteiro" },
      { gender: null, birthDate: null, maritalStatus: null },
    ], "2026-11-07");
    expect(p.g).toEqual([1, 1, 1]);
    expect(p.i).toEqual([0, 0, 1, 1, 0, 0, 0, 1]);
    expect(p.c).toEqual({ Solteiro: 2 });
  });
});

describe("perfil das oportunidades", () => {
  it("conta cadastradas e convertidas no período por gênero e faixa", () => {
    const r = perfilDasOportunidades([
      { registerDate: "2026-11-02T10:00:00", conversionDate: "2026-11-03T10:00:00", gender: "Female", birthDate: "1995-01-01" },
      { registerDate: "2026-11-02T10:00:00", conversionDate: null, gender: "Male", birthDate: "1995-01-01" },
      { registerDate: "2026-10-30T10:00:00", conversionDate: null, gender: "Male", birthDate: "1995-01-01" }, // fora do período
      { registerDate: "2026-11-04T10:00:00", conversionDate: "2026-12-01T10:00:00", gender: "Male", birthDate: null }, // conversão fora do período
    ], "2026-11-01", "2026-11-06", "2026-11-07");
    expect(r.g).toEqual([[1, 1], [2, 0], [0, 0]]);
    expect(r.i[2]).toEqual([2, 1]);
    expect(r.i[7]).toEqual([1, 0]);
  });
  it("soma o perfil das unidades na rede", () => {
    const a = { perfil: { g: [1, 2, 0], i: [0, 0, 1, 0, 0, 0, 0, 2], c: { Solteiro: 1 } } };
    const b = { perfil: { g: [3, 0, 1], i: [0, 0, 1, 0, 0, 0, 0, 0], c: { Solteiro: 2, Casado: 1 } } };
    expect(somarPerfil([a, b])).toEqual({ g: [4, 2, 1], i: [0, 0, 2, 0, 0, 0, 0, 2], c: { Solteiro: 3, Casado: 1 } });
    const o = somarPerfilOport([{ perfilOport: { g: [[1, 1], [0, 0], [0, 0]], i: Array.from({ length: 8 }, () => [1, 0]) } }, { perfilOport: { g: [[2, 1], [0, 0], [1, 0]], i: Array.from({ length: 8 }, () => [0, 0]) } }]);
    expect(o.g).toEqual([[3, 2], [0, 0], [1, 0]]);
    expect(o.i[0]).toEqual([1, 0]);
  });
});
