import { describe, expect, it } from "vitest";
import { PESOS_ATRATIVIDADE_PADRAO, scoreDeAtratividade, type Censo } from "@/lib/estudoPonto";

// Hexágonos inventados em linha para leste, a cada ~1 km (0,009° de longitude). Campos: [lat, lng, pop, renda, domicílios, idade[7], tam, classes, rendaDom, gasto, comércio].
const hex = (k: number, pop: number, gasto: number, comercio: number, alvo = 0.5): Censo["celulas"][number] =>
  [-15.8, -47.9 + k * 0.0092, pop, 3000, Math.round(pop / 3), [0, 0, pop * alvo / 3, pop * alvo / 3, pop * alvo / 3, 0, 0], [], [], 3000, gasto, comercio] as never;
const censo: Censo = { rk: 0.2, celulas: [hex(0, 1000, 10_000, 2), hex(1, 2000, 20_000, 5), hex(2, 3000, 30_000, 9), hex(3, 4000, 40_000, 12), hex(4, 5000, 50_000, 20)] };
const todos = () => true;

describe("scoreDeAtratividade", () => {
  it("dá nota maior onde há mais moradores, consumo e comércio, e fica entre 0 e 100", () => {
    const r = scoreDeAtratividade(censo, todos, PESOS_ATRATIVIDADE_PADRAO, [], 2)!;
    expect(r.score.every((x) => x >= 0 && x <= 100)).toBe(true);
    expect(r.score[4]).toBeGreaterThan(r.score[0]);
    expect(Math.max(...r.score)).toBeGreaterThan(80); expect(Math.min(...r.score)).toBeLessThan(25);
  });
  it("sem unidades a variável 'longe das World Gym' sai, e os pesos das outras são refeitos (soma 1)", () => {
    const r = scoreDeAtratividade(censo, todos, PESOS_ATRATIVIDADE_PADRAO, [], 2)!;
    expect(r.usadas.some((u) => u.id === "livre")).toBe(false);
    expect(r.usadas.reduce((a, u) => a + u.peso, 0)).toBeCloseTo(1, 6);
  });
  it("uma unidade da rede em cima do hexágono derruba a nota dele", () => {
    const sem = scoreDeAtratividade(censo, todos, PESOS_ATRATIVIDADE_PADRAO, [], 2)!;
    const com = scoreDeAtratividade(censo, todos, PESOS_ATRATIVIDADE_PADRAO, [{ c: [-15.8, -47.9 + 4 * 0.0092] }], 2)!; // WG no melhor hexágono
    expect(com.usadas.some((u) => u.id === "livre")).toBe(true);
    expect(com.score[4]).toBeLessThan(100); expect(com.score[4] / Math.max(...com.score)).toBeLessThanOrEqual(1);
    expect(sem.score[4]).toBeGreaterThan(0);
  });
  it("os pesos mandam: só 'moradores' ordena pelos moradores; peso zero em tudo não gera score", () => {
    const so = scoreDeAtratividade(censo, todos, { moradores: 100, alvo: 0, consumo: 0, comercio: 0, livre: 0 }, [], 2)!;
    expect(so.usadas).toEqual([{ id: "moradores", peso: 1 }]);
    expect([...so.score]).toEqual([...so.score].sort((a, b) => a - b)); // cresce com os moradores
    expect(scoreDeAtratividade(censo, todos, { moradores: 0, alvo: 0, consumo: 0, comercio: 0, livre: 0 }, [], 2)).toBeNull();
  });
  it("devolve a nota do ponto e a parte da área que ele supera", () => {
    const r = scoreDeAtratividade(censo, todos, PESOS_ATRATIVIDADE_PADRAO, [], 2, [-15.8, -47.9 + 4 * 0.0092])!;
    expect(r.doPonto!.score).toBe(Math.max(...r.score)); expect(r.doPonto!.melhorQue).toBeCloseTo(0.8, 5);
    expect(scoreDeAtratividade(censo, todos, PESOS_ATRATIVIDADE_PADRAO, [], 2, [-10, -40])!.doPonto).toBeNull(); // ponto longe de qualquer hexágono
  });
  it("sem hexágonos suficientes na área, não há score", () => {
    expect(scoreDeAtratividade(censo, (la, ln) => ln < -47.9, PESOS_ATRATIVIDADE_PADRAO, [], 2)).toBeNull();
  });
});
