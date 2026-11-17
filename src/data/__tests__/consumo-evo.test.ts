import { describe, expect, it, beforeEach } from "vitest";
// @ts-expect-error módulo JS do servidor
import { registrarChamada, consumoEvo, consumoEntre, zerarConsumoEvo, linhaDeConsumo } from "../../../server/evo.js";

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

  it("mede o tempo das respostas e mostra o que aconteceu entre duas fotos (por unidade)", () => {
    registrarChamada("/members?idBranch=5&take=100&skip=0", 200, 300);
    const antes = consumoEvo();
    registrarChamada("/members?idBranch=5&take=100&skip=100", 200, 500);
    registrarChamada("/members?idBranch=5&take=100&skip=200", 429, 100);
    expect(linhaDeConsumo()).toBe("EVO: 3 chamadas (200: 2, 429: 1) | /members 3 | resposta em média 300 ms, a mais lenta 500 ms");
    expect(consumoEntre(antes)).toBe("2 chamadas (200: 1, 429: 1) | resposta em média 300 ms");
    expect(consumoEntre(consumoEvo(), consumoEvo())).toBe("0 chamadas ()");
  });
});
