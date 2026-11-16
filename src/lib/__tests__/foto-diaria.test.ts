import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { montarFoto } from "../../../server/fotoDiaria.js";

describe("foto diária", () => {
  it("guarda só os números escolhidos de cada unidade, com os cartões recusados em aberto", () => {
    const f = montarFoto({ month: "2026-11", units: [{ name: "Gama", faturamento: 100, inadimplentes: 5, bairros: [["x", 1]], cobrancas: { abertas: 3, valorAberto: 450, falhas: 9 } }] }, "2026-11-15");
    expect(f).toEqual({ mes: "2026-11", dia: "2026-11-15", units: { Gama: { faturamento: 100, inadimplentes: 5, cartaoAbertas: 3, cartaoValorAberto: 450 } } });
  });
});
