import { describe, expect, it } from "vitest";
import { lacunaDeCaptacao } from "@/lib/estudoPonto";

const todos = () => true;
describe("lacunaDeCaptacao (onde o modelo espera mais alunos do que a unidade tem)", () => {
  it("compara a parte de cada hexágono no total, não os números brutos", () => {
    // esperado: 0 = 50%, 1 = 50%; real: 0 = 90%, 1 = 10% -> só o hexágono 1 tem lacuna (40 pontos)
    const r = lacunaDeCaptacao({ indices: [0, 1], pesos: [50, 50] }, { indices: [0, 1], pesos: [900, 100] }, todos);
    expect(r.indices).toEqual([1]);
    expect(r.pesos[0]).toBeCloseTo(0.4, 5);
  });
  it("hexágono sem nenhum aluno, onde o modelo espera, é lacuna cheia", () => {
    const r = lacunaDeCaptacao({ indices: [0, 1], pesos: [1, 3] }, { indices: [0], pesos: [10] }, todos);
    expect(r.indices).toEqual([1]);
    expect(r.pesos[0]).toBeCloseTo(0.75, 5);
  });
  it("só conta o que está dentro da área", () => {
    const r = lacunaDeCaptacao({ indices: [0, 1], pesos: [1, 1] }, { indices: [0], pesos: [5] }, (i) => i === 0);
    expect(r).toEqual({ indices: [], pesos: [] });
  });
  it("sem alunos ou sem demanda não há lacuna para afirmar", () => {
    expect(lacunaDeCaptacao({ indices: [0], pesos: [1] }, { indices: [], pesos: [] }, todos)).toEqual({ indices: [], pesos: [] });
    expect(lacunaDeCaptacao({ indices: [], pesos: [] }, { indices: [0], pesos: [1] }, todos)).toEqual({ indices: [], pesos: [] });
  });
});
