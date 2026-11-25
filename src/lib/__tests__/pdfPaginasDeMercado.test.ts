import { describe, expect, it } from "vitest";
import { secoesDeMercado, type DadosMercado } from "@/components/estudos/pdfUnidade";

// Números INVENTADOS. As páginas novas do PDF do estudo: Score de Atratividade, População da Área, Renda Total e Concentração Comercial.
const foto = "data:image/jpeg;base64,AAAA";
const base = (extra: Partial<DadosMercado> = {}, fotos: Partial<DadosMercado["fotos"]> = {}): DadosMercado => ({
  tipo: "ponto", nome: "Ponto Exemplo", area: "na área de 10 minutos de carro", vendas: 288_000, alunosNaArea: null,
  perfil: { moradores: 256_013, domicilios: 90_000 } as never, renda: null, potencial: null, densidade: null, pois: null,
  fotos: { idade: null, domicilios: null, renda: null, consumo: null, pois: null, ...fotos }, ...extra,
});
const titulos = (m: DadosMercado) => secoesDeMercado(m).map((s) => s.titulo);

describe("PDF do estudo: páginas de população, renda total, comércio e score", () => {
  it("sem foto não há página (a camada que não saiu fica de fora)", () => {
    expect(titulos(base({ rendaTotal: { total: 5e8, domicilios: 90_000, porDomicilio: 5500 }, comercio: 1200, atratividade: { score: 61, melhorQue: 0.7, usadas: [{ rotulo: "Moradores", peso: 1 }] } }))).toEqual([]);
  });
  it("com foto e dado, cada camada vira a sua página, na ordem das camadas do mapa", () => {
    const m = base({ rendaTotal: { total: 5e8, domicilios: 90_000, porDomicilio: 5500 }, comercio: 1200, atratividade: { score: 61, melhorQue: 0.7, usadas: [{ rotulo: "Moradores", peso: 0.6 }, { rotulo: "Potencial de consumo", peso: 0.4 }] } },
      { atratividade: foto, pessoas: foto, rendaTotal: foto, comercio: foto });
    expect(titulos(m)).toEqual(["Score de Atratividade", "População da Área", "Renda Total dos Domicílios", "Concentração Comercial"]);
  });
  it("a página de população traz o número de moradores e a foto", () => {
    const s = secoesDeMercado(base({}, { pessoas: foto })).find((x) => x.titulo === "População da Área")!;
    expect(s.destaques?.[0]).toEqual({ valor: "256.013", rotulo: "moradores na área de 10 minutos de carro" });
    expect(s.foto?.dados).toBe(foto);
  });
  it("o score mostra a nota, a parte da área abaixo dela e os pesos", () => {
    const s = secoesDeMercado(base({ atratividade: { score: 61, melhorQue: 0.7, usadas: [{ rotulo: "Moradores", peso: 0.6 }, { rotulo: "Potencial de consumo", peso: 0.4 }] } }, { atratividade: foto })).find((x) => x.titulo === "Score de Atratividade")!;
    expect(s.destaques?.[0].valor).toBe("61");
    expect(s.destaques?.[1].valor).toBe("70%");
    expect((s.texto ?? []).join(" ")).toMatch(/moradores \(60%\), potencial de consumo \(40%\)/);
    expect((s.texto ?? []).join(" ")).toMatch(/Não é previsão de vendas/);
  });
  it("a renda total traz o total, os domicílios e a média; o comércio traz a contagem", () => {
    const m = base({ rendaTotal: { total: 5e8, domicilios: 90_000, porDomicilio: 5500 }, comercio: 1200 }, { rendaTotal: foto, comercio: foto });
    const rt = secoesDeMercado(m).find((x) => x.titulo === "Renda Total dos Domicílios")!;
    expect(rt.destaques?.map((d) => d.valor)).toEqual(["R$ 500 mi", "90.000", "R$ 5.500"]);
    const co = secoesDeMercado(m).find((x) => x.titulo === "Concentração Comercial")!;
    expect(co.destaques?.[0].valor).toBe("1.200");
  });
});

import { enderecoAproximado, linhasSugestoes, type ResultadoSugestoes } from "@/components/estudos/sugestoes";

describe("recomendação de localização: endereço aproximado de cada posição", () => {
  const res = { referencia: { publico: 1000 }, testadas: 10, saturadas: 0, naoAprovam: 0, sugestoes: [
    { c: [-16.68123, -49.25456] as [number, number], ganho: 0.18, distanciaKm: 1.4, renda: 4200, divideCom: [] },
    { c: [-16.7, -49.3] as [number, number], ganho: 0.12, distanciaKm: 2.1, renda: null, divideCom: [{ nome: "World Gym Exemplo", parte: 0.05 }] },
  ] } as unknown as ResultadoSugestoes;
  it("a tabela traz o endereço sem CEP nem país, na segunda coluna", () => {
    const linhas = linhasSugestoes(res, ["Rua Exemplo, 100, Setor Alfa, Goiânia - Goiás, 74000-000, Brasil", null]);
    expect(linhas[0][0]).toBe("1");
    expect(linhas[0][1]).toBe("Rua Exemplo, 100, Setor Alfa, Goiânia - Goiás");
    expect(linhas[0]).toHaveLength(6);
  });
  it("sem endereço, a linha mostra as coordenadas para não ficar sem referência", () => {
    expect(linhasSugestoes(res, ["Rua Exemplo", null])[1][1]).toBe("Sem endereço; coordenadas -16.70000, -49.30000");
    expect(enderecoAproximado([-16.1, -49.2], undefined)).toMatch(/coordenadas -16.10000, -49.20000/);
  });
});
