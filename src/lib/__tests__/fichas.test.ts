import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import * as S from "../../../server/fichas.js";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
import { aluguelPorM2, contratoAVencer, diasParaFimDoContrato, ordenarFichas, pesoDoAluguel, resumoDoAluguel, type UnidadeFicha } from "@/lib/fichas";

// Dados INVENTADOS. Nomes de unidades são os reais da rede (públicos); valores, não.
const u = (nome: string, modelo: "low" | "pro", m2: number | null, vendas: number | null, ficha: UnidadeFicha["ficha"]): UnidadeFicha => ({ nome, modelo, m2, abertura: "2024-01", madura: true, vendas, alunos: 2000, ficha });
const f = (aluguel: number | null, contratoAte: string | null = null) => ({ aluguel, contratoAte, obs: "" });

describe("contas da ficha", () => {
  it("aluguel por m² e peso do aluguel nas vendas; sem dado, null", () => {
    const x = u("Gama", "low", 1000, 200_000, f(20_000));
    expect(aluguelPorM2(x)).toBe(20);
    expect(pesoDoAluguel(x)).toBe(0.1);
    expect(aluguelPorM2(u("Itapoã", "low", null, 1, f(20_000)))).toBeNull();
    expect(aluguelPorM2(u("Asa Norte", "low", 900, 1, null))).toBeNull();
    expect(pesoDoAluguel(u("Asa Norte", "low", 900, null, f(1000)))).toBeNull();
  });
  it("contrato a vencer: dias até o fim, vencido e fora da janela", () => {
    const hoje = "2026-11-25";
    expect(diasParaFimDoContrato(u("A", "low", 1, 1, f(1, "2026-12-25")), hoje)).toBe(30);
    expect(contratoAVencer(u("A", "low", 1, 1, f(1, "2026-12-25")), hoje)).toBe(true);
    expect(contratoAVencer(u("A", "low", 1, 1, f(1, "2026-10-01")), hoje)).toBe(true);
    expect(contratoAVencer(u("A", "low", 1, 1, f(1, "2028-01-01")), hoje)).toBe(false);
    expect(contratoAVencer(u("A", "low", 1, 1, f(1)), hoje)).toBe(false);
  });
  it("resumo: quantas têm aluguel e a mediana, o menor e o maior R$/m² por modelo", () => {
    const lista = [u("A", "low", 1000, 1, f(18_000)), u("B", "low", 1000, 1, f(22_000)), u("C", "low", 1000, 1, f(30_000)), u("D", "pro", 1000, 1, null), u("E", "low", 1000, 1, null)];
    const r = resumoDoAluguel(lista);
    expect([r.levantadas, r.total]).toEqual([3, 5]);
    expect(r.porModelo).toEqual([{ modelo: "low", n: 3, mediana: 22, minimo: 18, maximo: 30 }]);
  });
  it("a lista começa pelas unidades sem aluguel levantado", () => {
    const lista = [u("Beta", "low", 1, 1, f(1)), u("Zeta", "low", 1, 1, null), u("Alfa", "low", 1, 1, null)];
    expect(ordenarFichas(lista).map((x) => x.nome)).toEqual(["Alfa", "Zeta", "Beta"]);
  });
});

describe("servidor: guardar as fichas", () => {
  let mem: Map<string, unknown>;
  beforeEach(() => {
    mem = new Map();
    definirArmazem({ async ler(c: string) { return mem.has(c) ? JSON.parse(JSON.stringify(mem.get(c))) : null; }, async gravar(c: string, d: unknown) { mem.set(c, JSON.parse(JSON.stringify(d))); } });
    mem.set("estudos/premissas.json", { unidades: { Gama: { m2: 1000, modelo: "low", abertura: "2023-01" } }, regua: { maturidadeMeses: 12 } });
  });
  afterEach(() => definirArmazem(null));
  const dono = { papel: "dono" }, master = { papel: "master" };
  const meses = async () => [{ month: "2026-10", units: [{ name: "Gama", faturamento: 1, vendasManuais: 100_000, vendasRecorrentes: 100_000, alunosAtivos: 1800 }] }];

  it("só o dono lê e grava", async () => {
    await expect(S.lerFichas(master, meses, "2026-11")).rejects.toMatchObject({ status: 403 });
    await expect(S.salvarFicha(master, "Gama", { aluguel: 1000 })).rejects.toMatchObject({ status: 403 });
  });
  it("junta o que o Atlas sabe (m², modelo) com a ficha guardada e lista as 23 unidades", async () => {
    await S.salvarFicha(dono, "Gama", { aluguel: 18_500.456, contratoAte: "2028-03-01", obs: "  reajuste em março " });
    const r = await S.lerFichas(dono, meses, "2026-11");
    expect(r.unidades).toHaveLength(23);
    const gama = r.unidades.find((x: { nome: string }) => x.nome === "Gama");
    expect(gama).toMatchObject({ m2: 1000, modelo: "low", ficha: { aluguel: 18_500.46, contratoAte: "2028-03-01", obs: "reajuste em março" } });
    expect(r.unidades.filter((x: { ficha: unknown }) => x.ficha).length).toBe(1);
  });
  it("ficha toda vazia apaga o registro; unidade desconhecida e valores inválidos são recusados", async () => {
    await S.salvarFicha(dono, "Gama", { aluguel: 1000 });
    expect(await S.salvarFicha(dono, "Gama", { aluguel: null, contratoAte: null, obs: "" })).toBeNull();
    expect((await S.lerFichas(dono, meses, "2026-11")).unidades.every((x: { ficha: unknown }) => !x.ficha)).toBe(true);
    await expect(S.salvarFicha(dono, "Unidade Que Não Existe", { aluguel: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(S.salvarFicha(dono, "Gama", { aluguel: -5 })).rejects.toMatchObject({ status: 400 });
    await expect(S.salvarFicha(dono, "Gama", { aluguel: 1000, contratoAte: "01/03/2028" })).rejects.toMatchObject({ status: 400 });
  });
});
