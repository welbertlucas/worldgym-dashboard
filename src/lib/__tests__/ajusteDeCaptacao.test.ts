import { describe, expect, it } from "vitest";
import { ajusteDeCaptacao, avaliarPonto, type Censo, type Premissas, type UnidadeEstudo } from "@/lib/estudoPonto";

// Rede inventada: 12 unidades maduras em linha (a cada ~5 km) sobre uma faixa de hexágonos; vendas por m² crescem com a população de cada trecho.
const curva = { raioKm: 8, meiaDistanciaKm: 2 } as Premissas["curva"];
const premissas = { curva, modelos: { low: { padraoM2: 1000 }, pro: { padraoM2: 800 } } } as unknown as Premissas;
const lng = (k: number) => -47.9 + k * 0.045; // ~5 km por passo
const censoDe = (pop: (k: number) => number): Censo => ({ rk: 0.2, celulas: Array.from({ length: 12 * 25 }, (_, i) => [-15.8, lng(i / 25), pop(i / 25), 0] as [number, number, number, number]) });
const unidade = (k: number, vm2: number): UnidadeEstudo => ({ nome: `U${k}`, c: [-15.8, lng(k)], m2: 1000, modelo: "low", madura: true, vendas: vm2 * 1000 } as unknown as UnidadeEstudo);
const unidades = (vm2: (k: number) => number) => Array.from({ length: 12 }, (_, k) => unidade(k, vm2(k)));
const ponto = (k: number) => ({ c: [-15.8, lng(k)] as [number, number], m2: 1000, modelo: "low" as const });

describe("ajusteDeCaptacao", () => {
  it("sobe a previsão onde há mais público e desce onde há menos, dentro do limite", () => {
    const pop = (x: number) => 1000 + 4000 * (x / 12);
    const c = censoDe(pop), us = unidades((k) => 100 + 6 * k); // vendas por m² crescem com o público: há efeito medido
    const alto = ajusteDeCaptacao(ponto(11), premissas, c, us)!, baixo = ajusteDeCaptacao(ponto(0), premissas, c, us)!;
    expect(alto.elasticidade).toBeGreaterThan(0);
    expect(alto.fator).toBeGreaterThan(1); expect(baixo.fator).toBeLessThan(1);
    expect(alto.fator).toBeLessThanOrEqual(1.15); expect(baixo.fator).toBeGreaterThanOrEqual(0.85);
  });
  it("sem efeito na rede (vendas iguais), a elasticidade é zero e o fator é 1", () => {
    const c = censoDe((x) => 1000 + 4000 * (x / 12));
    const r = ajusteDeCaptacao(ponto(11), premissas, c, unidades(() => 100))!;
    expect(r.elasticidade).toBe(0); expect(r.fator).toBe(1);
  });
  it("vendas que caem com o público não viram efeito negativo", () => {
    const c = censoDe((x) => 1000 + 4000 * (x / 12));
    expect(ajusteDeCaptacao(ponto(11), premissas, c, unidades((k) => 200 - 8 * k))!.elasticidade).toBe(0);
  });
  it("sem unidades maduras suficientes do modelo ou fora da malha do Censo, não ajusta", () => {
    const c = censoDe(() => 2000);
    expect(ajusteDeCaptacao(ponto(3), premissas, c, unidades(() => 100).slice(0, 5))).toBeNull();
    expect(ajusteDeCaptacao({ ...ponto(3), c: [-20, -40] }, premissas, c, unidades(() => 100))).toBeNull();
    expect(ajusteDeCaptacao({ ...ponto(3), modelo: "pro" }, premissas, c, unidades(() => 100))).toBeNull(); // nenhuma Pro madura
  });
  it("avaliarPonto multiplica as três vendas previstas pelo fator", () => {
    const p = { modelos: { low: { padraoM2: 1000, limiteM2: 5000, pesoAcima: 1, investimentoM2: 1, custoFixoM2: 1, variavel: 0.1, nome: "Low Cost" } }, regua: { mesesAprovado: 36, mesesAtencao: 48, maturacaoMeses: 6 } } as unknown as Premissas;
    const f = { p25: 80, mediana: 100, p75: 120, n: 10 } as never;
    const a = avaliarPonto({ m2: 1000, modelo: "low" }, p, f), b = avaliarPonto({ m2: 1000, modelo: "low" }, p, f, 1.1);
    expect(b.provavel).toBeCloseTo(a.provavel * 1.1, 6); expect(b.pessimista).toBeCloseTo(a.pessimista * 1.1, 6); expect(b.otimista).toBeCloseTo(a.otimista * 1.1, 6);
  });
});
