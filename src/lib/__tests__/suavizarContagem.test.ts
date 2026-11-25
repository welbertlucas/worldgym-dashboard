import { describe, expect, it } from "vitest";
import { suavizarContagem, type Censo } from "@/lib/estudoPonto";
import { arco } from "@/components/estudos/mapaComum";

// Hexágonos inventados em linha, a cada ~220 m (0,002° de latitude); o último está a ~9 km; o do meio não tem moradores.
const censo: Censo = { rk: 0.2, celulas: [[-15.8, -47.9, 500, 0], [-15.802, -47.9, 500, 0], [-15.804, -47.9, 0, 0], [-15.806, -47.9, 500, 0], [-15.88, -47.9, 500, 0]] };
const c: [number, number] = [-15.8, -47.9];

describe("suavizarContagem (mapa de calor dos alunos)", () => {
  it("espalha a contagem para os vizinhos, com peso que cai com a distância", () => {
    const r = suavizarContagem(censo, [0], [10], c);
    const peso = (j: number) => r.pesos[r.indices.indexOf(j)];
    expect(peso(0)).toBeCloseTo(10, 5); // o próprio hexágono mantém a contagem
    expect(peso(1)).toBeGreaterThan(0); expect(peso(1)).toBeLessThan(peso(0));
    expect(peso(3)).toBeLessThan(peso(1)); // mais longe, menos peso
  });
  it("não pinta hexágono sem moradores, nem o que está além do raio ou do limite de distância", () => {
    const r = suavizarContagem(censo, [0], [10], c);
    expect(r.indices).not.toContain(2); expect(r.indices).not.toContain(4);
    expect(suavizarContagem(censo, [0], [10], c, { maxKm: 0.1 }).indices).toEqual([0]);
  });
  it("hexágonos de contagem zero não geram calor", () => {
    expect(suavizarContagem(censo, [0, 1], [0, 0], c)).toEqual({ indices: [], pesos: [] });
  });
  it("a soma de dois focos é maior do que cada um sozinho", () => {
    const um = suavizarContagem(censo, [0], [5], c), dois = suavizarContagem(censo, [0, 3], [5, 5], c);
    expect(dois.pesos[dois.indices.indexOf(1)]).toBeGreaterThan(um.pesos[um.indices.indexOf(1)]);
  });
});

describe("rampa do mapa de calor", () => {
  it("começa azul e termina vermelha, sem sair do intervalo", () => {
    const f = (t: number) => arco(t);
    expect(f(0)).not.toEqual(f(1));
    expect(JSON.stringify(f(-1))).toBe(JSON.stringify(f(0))); expect(JSON.stringify(f(2))).toBe(JSON.stringify(f(1)));
  });
});
