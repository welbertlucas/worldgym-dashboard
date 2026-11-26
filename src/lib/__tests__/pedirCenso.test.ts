import { describe, expect, it } from "vitest";
import { andamentoDoPedido, ESTIMATIVA_MIN, pedidoEmAndamento } from "@/components/estudos/PedirCenso";

describe("andamento do pedido do Censo (só pelo tempo)", () => {
  const t0 = Date.UTC(2026, 10, 26, 19, 6);
  it("cresce com o tempo e para em 95% até o Censo chegar", () => {
    expect(andamentoDoPedido(t0, t0).parte).toBe(0);
    expect(andamentoDoPedido(t0, t0 + 10 * 60_000)).toMatchObject({ min: 10, parte: 10 / ESTIMATIVA_MIN, atrasado: false });
    expect(andamentoDoPedido(t0, t0 + 60 * 60_000)).toMatchObject({ min: 60, parte: 0.95, atrasado: true });
    expect(andamentoDoPedido(t0, t0).previsto).toBe(t0 + ESTIMATIVA_MIN * 60_000);
  });
  it("sem armazenamento do navegador, não há pedido lembrado", () => {
    expect(pedidoEmAndamento([-21.2, -47.8])).toBeNull();
  });
});
