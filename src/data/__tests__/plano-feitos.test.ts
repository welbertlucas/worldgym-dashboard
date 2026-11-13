import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import { feitosDoMes, marcarItem, podeMarcar } from "../../../server/planoFeitos.js";

const memoria = () => {
  const m = new Map<string, unknown>();
  return { async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); } };
};
const dono = { papel: "dono", nome: "Welbert Lucas", unidades: [] };
const gama = { papel: "unidades", nome: "Bia Gestora", unidades: ["Gama"] };

describe("Plano de ação: feito", () => {
  beforeEach(() => definirArmazem(memoria()));
  afterEach(() => definirArmazem(null));

  it("marca, mostra quem e quando, e desmarca", async () => {
    const item = await marcarItem({ mes: "2026-10", unidade: "Gama", tipo: "churn", feito: true }, gama, new Date("2026-11-13T12:00:00Z"));
    expect(item).toEqual({ por: "Bia Gestora", em: "2026-11-13T12:00:00.000Z" });
    expect(await feitosDoMes("2026-10", dono)).toEqual({ "Gama|churn": item });
    expect(await marcarItem({ mes: "2026-10", unidade: "Gama", tipo: "churn", feito: false }, dono)).toBeNull();
    expect(await feitosDoMes("2026-10", dono)).toEqual({});
  });

  it("vale só para o mês avaliado: no mês seguinte o mesmo alerta volta pendente", async () => {
    await marcarItem({ mes: "2026-10", unidade: "Gama", tipo: "churn", feito: true }, dono);
    expect(await feitosDoMes("2026-11", dono)).toEqual({});
  });

  it("cada um vê e marca só as suas unidades; Rede só quem vê a rede", async () => {
    await marcarItem({ mes: "2026-10", unidade: "Itapoã", tipo: "churn", feito: true }, dono);
    await marcarItem({ mes: "2026-10", unidade: "Rede", tipo: "faturamento", feito: true }, dono);
    expect(await feitosDoMes("2026-10", gama)).toEqual({});
    await expect(marcarItem({ mes: "2026-10", unidade: "Itapoã", tipo: "churn", feito: true }, gama)).rejects.toThrow(/Sem acesso/);
    await expect(marcarItem({ mes: "2026-10", unidade: "Rede", tipo: "x", feito: true }, gama)).rejects.toThrow(/Sem acesso/);
    expect(podeMarcar({ papel: "master" }, "Rede")).toBe(true);
    await expect(marcarItem({ mes: "out", unidade: "Gama", tipo: "churn", feito: true }, dono)).rejects.toThrow(/inválido/);
    await expect(marcarItem({ mes: "2026-10", unidade: "Ga|ma", tipo: "churn", feito: true }, dono)).rejects.toThrow(/inválido/);
  });

  it("guarda só os 6 meses mais recentes", async () => {
    for (let m = 1; m <= 8; m++) await marcarItem({ mes: `2026-0${m}`, unidade: "Gama", tipo: "churn", feito: true }, dono);
    expect(await feitosDoMes("2026-02", dono)).toEqual({});
    expect(Object.keys(await feitosDoMes("2026-03", dono))).toEqual(["Gama|churn"]);
  });
});
