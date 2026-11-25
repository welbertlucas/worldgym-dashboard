import { describe, expect, it } from "vitest";
import { canibalizacaoObservada } from "@/lib/estudoPonto";

// Duas unidades em linha, a ~10 km uma da outra (0,09° ≈ 10 km); alunos inventados em pontos entre elas.
const A: [number, number] = [-15.8, -47.9], B: [number, number] = [-15.8, -47.81];
const entre = (f: number): [number, number] => [-15.8, -47.9 + f * 0.09]; // 0 = em A, 1 = em B
describe("canibalizacaoObservada", () => {
  it("mede quantos alunos moram mais perto da outra unidade", () => {
    const minha = { c: A, celulas: [[...entre(0.1), 60], [...entre(0.8), 40]] as [number, number, number][] }; // 40% moram mais perto de B
    const b = { nome: "B", c: B, celulas: [[...entre(0.9), 90], [...entre(0.2), 10]] as [number, number, number][] }; // 10% dos de B moram mais perto de A
    const r = canibalizacaoObservada(minha, [b])!;
    expect(r.itens[0].nome).toBe("B");
    expect(r.itens[0].meusPertoDela).toBeCloseTo(0.4, 5);
    expect(r.itens[0].delaPertoDaqui).toBeCloseTo(0.1, 5);
    expect(r.itens[0].km).toBeGreaterThan(8); expect(r.itens[0].km).toBeLessThan(12);
    expect(r.algumaOutra).toBeCloseTo(0.4, 5);
    expect(r.alunos).toBe(100);
  });
  it("com duas vizinhas, 'alguma outra' conta o aluno uma vez só", () => {
    const C: [number, number] = [-15.8, -47.99];
    const minha = { c: A, celulas: [[...entre(0.9), 50], [-15.8, -48.0, 50]] as [number, number, number][] }; // metade perto de B, metade perto de C
    const r = canibalizacaoObservada(minha, [{ nome: "B", c: B, celulas: [[...entre(1), 10]] as [number, number, number][] }, { nome: "C", c: C, celulas: [[-15.8, -48.0, 10]] as [number, number, number][] }])!;
    expect(r.algumaOutra).toBeCloseTo(1, 5);
    expect(r.itens.map((x) => x.nome)).toEqual(["B", "C"].sort((a, b) => (a === "B" ? 0 : 1) - (b === "B" ? 0 : 1))); // do mais perto para o mais longe
  });
  it("sem alunos ou sem vizinhas, não há o que medir", () => {
    expect(canibalizacaoObservada({ c: A, celulas: [] }, [{ nome: "B", c: B, celulas: [] }])).toBeNull();
    expect(canibalizacaoObservada({ c: A, celulas: [[...entre(0.5), 10]] }, [])).toBeNull();
  });
});
