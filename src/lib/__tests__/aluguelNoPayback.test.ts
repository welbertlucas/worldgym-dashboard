import { describe, expect, it } from "vitest";
import { aluguelBaseDe, aluguelDoPonto, avaliarPonto, custoFixoDe, type FaixaM2, type PremissaModelo, type Premissas } from "@/lib/estudoPonto";

// Números INVENTADOS (as premissas reais ficam no Blob privado). `low` separa o aluguel (R$ 10 por m²) do custo fixo por m² (R$ 18); `semSeparar` não.
const semSeparar: PremissaModelo = { nome: "Low Cost", padraoM2: 1000, investimento: 3_000_000, fixoBase: 100_000, fixoPorM2: 18, variavel: 0.08, limiteM2: 1500, pesoAcima: 1 };
const low: PremissaModelo = { ...semSeparar, aluguelPorM2: 10 };
const premissas = { modelos: { low, pro: low }, regua: { mesesAprovado: 36, mesesAtencao: 48, maturacaoMeses: 6 }, curva: { raioKm: 8, meiaDistanciaKm: 2 } } as unknown as Premissas;
const faixa = { p25: 150, mediana: 200, p75: 250, n: 12 } as unknown as FaixaM2;

describe("aluguel real no custo fixo e no payback", () => {
  it("sem aluguel, o custo fixo é o padrão (base + valor por m²)", () => {
    expect(custoFixoDe(1000, low)).toBe(100_000 + 18 * 1000);
    expect(custoFixoDe(1000, low, null)).toBe(118_000);
  });
  it("o aluguel real troca só a parte de aluguel da premissa (R$ 10 por m²), não o custo fixo todo", () => {
    expect(custoFixoDe(1000, low, 40_000)).toBe(118_000 - 10 * 1000 + 40_000); // 148.000
    expect(custoFixoDe(1000, low, 10_000)).toBe(118_000); // aluguel igual ao da premissa: nada muda
  });
  it("se a premissa não separa o aluguel, ele não corrige a conta", () => {
    expect(aluguelBaseDe(semSeparar)).toBeNull();
    expect(custoFixoDe(1000, semSeparar, 40_000)).toBe(118_000);
    const a = avaliarPonto({ m2: 1000, modelo: "low" }, { ...premissas, modelos: { low: semSeparar, pro: semSeparar } } as Premissas, faixa);
    const b = avaliarPonto({ m2: 1000, modelo: "low", origem: { aluguel: 60_000 } }, { ...premissas, modelos: { low: semSeparar, pro: semSeparar } } as Premissas, faixa);
    expect(b.payback).toBe(a.payback); expect(b.aluguel).toBeNull();
    expect(aluguelBaseDe({ ...low, aluguelPorM2: 30 })).toBeNull(); // aluguel maior que o custo fixo por m² todo: premissa inválida
  });
  it("aluguel mais caro piora o payback e sobe a meta; mais barato melhora", () => {
    const base = avaliarPonto({ m2: 1000, modelo: "low" }, premissas, faixa);
    const caro = avaliarPonto({ m2: 1000, modelo: "low", origem: { aluguel: 60_000 } }, premissas, faixa);
    const barato = avaliarPonto({ m2: 1000, modelo: "low", origem: { aluguel: 6_000 } }, premissas, faixa);
    expect(caro.payback).toBeGreaterThan(base.payback); expect(caro.meta).toBeGreaterThan(base.meta); expect(caro.custoFixo).toBe(118_000 - 10_000 + 60_000);
    expect(barato.payback).toBeLessThan(base.payback); expect(barato.meta).toBeLessThan(base.meta);
    expect(base.aluguel).toBeNull(); expect(caro.aluguel).toBe(60_000);
    expect(caro.provavel).toBe(base.provavel); // o aluguel não mexe nas vendas previstas
  });
  it("aluguel fora da faixa de bom senso é ignorado (digitação errada)", () => {
    expect(aluguelDoPonto({ m2: 1000, origem: { aluguel: 300 } })).toMatchObject({ valor: null, ignorado: true }); // R$ 0,25 por m²
    expect(aluguelDoPonto({ m2: 1000, origem: { aluguel: 4_000_000 } })).toMatchObject({ valor: null, ignorado: true });
    expect(aluguelDoPonto({ m2: 1000, origem: { aluguel: 36_000 } })).toMatchObject({ valor: 36_000, ignorado: false });
    expect(aluguelDoPonto({ m2: 1000 })).toMatchObject({ valor: null, ignorado: false });
    const base = avaliarPonto({ m2: 1000, modelo: "low" }, premissas, faixa);
    const ign = avaliarPonto({ m2: 1000, modelo: "low", origem: { aluguel: 300 } }, premissas, faixa);
    expect(ign.payback).toBe(base.payback); expect(ign.aluguel).toBeNull();
  });
});
