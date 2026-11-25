import { describe, expect, it } from "vitest";
import { zonasDeCaptacao } from "@/lib/estudoPonto";

const c: [number, number] = [-15.8, -47.9];
// hexágonos em linha para o norte: 0,009° de latitude ≈ 1 km
const h = (kmN: number, n: number): [number, number, number] => [c[0] + kmN * 0.00904, c[1], n];
describe("zonasDeCaptacao", () => {
  it("acha o menor raio que reúne cada fatia dos alunos", () => {
    // 70 alunos a 1 km, 20 a 3 km, 8 a 6 km, 2 a 12 km
    const r = zonasDeCaptacao([h(1, 70), h(3, 20), h(6, 8), h(12, 2)], c)!;
    expect(r.total).toBe(100);
    expect(r.raios[0]).toBeCloseTo(1, 1); // 70% já na primeira
    expect(r.raios[1]).toBeCloseTo(3, 1); // 90% em 3 km
    expect(r.raios[2]).toBeCloseTo(6, 1); // 98% em 6 km
    expect(r.partes).toEqual([0.7, 0.9, 0.98]);
  });
  it("ignora a ordem de entrada e hexágono vazio", () => {
    const r = zonasDeCaptacao([h(12, 2), h(1, 70), h(5, 0), h(6, 8), h(3, 20)], c)!;
    expect(r.raios[1]).toBeCloseTo(3, 1);
  });
  it("sem alunos não há zona", () => {
    expect(zonasDeCaptacao([], c)).toBeNull();
    expect(zonasDeCaptacao([h(1, 0)], c)).toBeNull();
  });
});
