import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS da função serverless
import { aplicarVerComo } from "../../../api/_auth.js";
import { cabecalhoVerComo } from "@/lib/auth";

const dono = { id: "1", nome: "Dono", email: "d@x", papel: "dono", unidades: [], legado: false };
const nomes = ["Gama", "Itapoã", "Asa Norte"];

describe("ver como (dono simulando outro nível)", () => {
  it("dono vira master ou o acesso de unidades válidas, com papelReal", () => {
    expect(aplicarVerComo(dono, "master", nomes)).toMatchObject({ papel: "master", unidades: [], papelReal: "dono" });
    expect(aplicarVerComo(dono, cabecalhoVerComo({ papel: "unidades", unidades: ["Itapoã", "Inventada"] })["X-Atlas-Ver-Como"], nomes))
      .toMatchObject({ papel: "unidades", unidades: ["Itapoã"], papelReal: "dono" });
  });

  it("ignora pedido inválido e quem não é dono não consegue simular", () => {
    expect(aplicarVerComo(dono, "unidades:Inventada", nomes)).toBe(dono);
    expect(aplicarVerComo(dono, "admin", nomes)).toBe(dono);
    expect(aplicarVerComo(dono, undefined, nomes)).toBe(dono);
    const master = { ...dono, papel: "master" };
    expect(aplicarVerComo(master, "unidades:Gama", nomes)).toBe(master);
    const unidade = { ...dono, papel: "unidades", unidades: ["Gama"] };
    expect(aplicarVerComo(unidade, "master", nomes)).toBe(unidade); // não sobe de nível
  });

  it("o cabeçalho leva os nomes com acento codificados", () => {
    expect(cabecalhoVerComo(null)).toEqual({});
    expect(cabecalhoVerComo({ papel: "master" })).toEqual({ "X-Atlas-Ver-Como": "master" });
    expect(cabecalhoVerComo({ papel: "unidades", unidades: ["Itapoã", "Gama"] })["X-Atlas-Ver-Como"]).toBe("unidades:Itapo%C3%A3%7CGama");
  });
});
