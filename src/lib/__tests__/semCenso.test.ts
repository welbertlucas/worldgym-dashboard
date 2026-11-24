import { describe, expect, it } from "vitest";
import { fatoresDe, foraDaMalhaDoCenso, parecerDoPonto, type Censo } from "@/lib/estudoPonto";
import { secoesDeMercado } from "@/components/estudos/pdfUnidade";
import { ehAvisoSemImagem } from "@/components/estudos/mapaComum";

// Ponto fora da malha do Censo do Atlas (visto em 24/11/2026, estudo em Jataí-GO): zero moradores é falta de dado, não a realidade.
const censo: Censo = { rk: 0.2, celulas: [[-16.0, -48.0, 500, 3000, 180], [-16.01, -48.01, 800, 4000, 300]] };

describe("ponto fora da malha do Censo", () => {
  it("detecta quando não há hexágono por perto e quando há", () => {
    expect(foraDaMalhaDoCenso([-17.88, -51.72], censo)).toBe(true); // centenas de km de distância
    expect(foraDaMalhaDoCenso([-16.0, -48.001], censo)).toBe(false);
    expect(foraDaMalhaDoCenso([-16.0, -48.001], null)).toBe(true);
    expect(foraDaMalhaDoCenso([-16.0, -48.001], { rk: 0.2, celulas: [] })).toBe(true);
  });

  it("os fatores trocam população e divisão com a rede por um aviso só", () => {
    const ponto = { modelo: "low", m2: 1200 } as never;
    const r = { foraDaFaixa: false } as never;
    const cap = { populacao2km: 0, divideCom: [] } as never;
    const premissas = { modelos: { low: { limiteM2: 2000 } } } as never;
    const unidades = [{ nome: "A", c: [-16, -48], madura: true, modelo: "low" }] as never;
    const sem = fatoresDe(ponto, r, cap, unidades, censo, premissas, true);
    expect(sem).toHaveLength(1);
    expect(sem[0].texto).toMatch(/Sem dados do Censo/);
    const com = fatoresDe(ponto, r, cap, unidades, censo, premissas, false);
    expect(com.some((f) => /moradores a até 2 km/.test(f.texto))).toBe(true);
  });

  it("o parecer avisa que a demanda não foi medida e não cobra população de quem não tem dado", () => {
    const base = { veredito: "atencao" as const, provavel: 264_000, meta: 288_000, payback: 43, mesesAprovado: 36, mesesAtencao: 48 };
    const p = parecerDoPonto({ ...base, semCenso: true, populacao: null, divideCom: [] });
    expect(p.condicoes[0]).toMatch(/Medir a demanda antes de decidir/);
    expect(p.condicoes.join(" ")).not.toMatch(/menos moradores/);
    expect(parecerDoPonto(base).condicoes.join(" ")).not.toMatch(/Medir a demanda/);
  });

  it("o PDF explica a falta do Censo e não monta as páginas de gente, renda e consumo", () => {
    const secoes = secoesDeMercado({ tipo: "ponto", nome: "A", area: "na área de até 10 minutos de carro", vendas: 288_000, alunosNaArea: null, perfil: null, renda: null, potencial: null, densidade: null, pois: null, semCenso: true, fotos: { idade: null, domicilios: null, renda: null, consumo: null, pois: null } });
    expect(secoes.map((s) => s.titulo)).toEqual(["Dados do Censo indisponíveis"]);
  });
});

describe("foto de satélite sem imagem (Esri)", () => {
  it("reconhece o aviso cinza liso e não confunde com imagem de verdade", () => {
    expect(ehAvisoSemImagem(4.1, 0)).toBe(true); // Jataí no zoom 18, medido
    expect(ehAvisoSemImagem(40.2, 0.196)).toBe(false); // Jataí no zoom 17
    expect(ehAvisoSemImagem(34.8, 0.186)).toBe(false);
    expect(ehAvisoSemImagem(47.4, 0.119)).toBe(false); // Gama
  });
});
