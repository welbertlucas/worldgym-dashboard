import { describe, expect, it, beforeEach } from "vitest";
// @ts-expect-error módulo JS do servidor
import { registrarChamada, consumoEvo, zerarConsumoEvo, linhaDeConsumo } from "../../../server/evo.js";

describe("contador de chamadas ao EVO", () => {
  beforeEach(() => zerarConsumoEvo());

  it("conta por rota (sem parâmetros nem ids) e por status", () => {
    registrarChamada("/receivables?idBranch=7&take=1000&skip=0", 200);
    registrarChamada("/receivables?idBranch=9&take=1000&skip=0", 200);
    registrarChamada("/members/123/contracts", 429);
    registrarChamada("/receivables?idBranch=7", 503);
    registrarChamada("/receivables?idBranch=7", null);
    const c = consumoEvo();
    expect(c.total).toBe(5);
    expect(c.rotas["/receivables"]).toBe(4);
    expect(c.rotas["/members/:id/contracts"]).toBe(1);
    expect(c.status).toEqual({ "200": 2, "429": 1, "5xx": 1, rede: 1 });
  });

  it("a linha do log traz o total e as rotas mais usadas", () => {
    registrarChamada("/a?x=1", 200); registrarChamada("/a?x=2", 200); registrarChamada("/b", 429);
    expect(linhaDeConsumo()).toBe("EVO: 3 chamadas (200: 2, 429: 1) | /a 2; /b 1");
  });
});
