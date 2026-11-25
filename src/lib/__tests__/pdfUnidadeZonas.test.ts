import { describe, expect, it } from "vitest";
import { montarPdfUnidade, type DadosPdfUnidade } from "@/components/estudos/pdfUnidade";

const base = {
  u: { nome: "Teste", modelo: "low", madura: true, vendas: 300000, m2: 1200, alunos: 2000, c: [-15.8, -47.9], bairros: [] },
  faixa: null, porM2: 250, comparado: null, minutos: 10, temArea: true, parteNaArea: 0.9, min80: null, onde80: "3 km",
  topBairros: [], alunosBairro: 0, esperadoNaArea: null, perfil: null, renda: null, potencial: null, pois: null, divideCom: [],
  fotos: { sat: null, alunos: null, oportunidade: null, idade: null, domicilios: null, renda: null, consumo: null, pois: null, rede: null },
  hoje: new Date("2026-11-25"),
} as unknown as DadosPdfUnidade;
const zonas = { lista: [{ r: 2.2, parte: 0.7, alunos: 1280, moradores: 153000 }, { r: 3.9, parte: 0.9, alunos: 1640, moradores: 378000 }, { r: 12, parte: 0.98, alunos: 1790, moradores: 1189000 }], na10: 0.9, total: 1824 };
const titulos = (d: DadosPdfUnidade) => JSON.stringify(montarPdfUnidade(d));

describe("PDF da unidade: Zonas de Captação", () => {
  it("entra com a foto, a tabela e o texto quando há as zonas e a foto", () => {
    const j = titulos({ ...base, zonas, fotos: { ...base.fotos, zonas: "data:image/jpeg;base64,AAAA" } });
    expect(j).toContain("Zonas de Captação");
    expect(j).toContain("até 2,2 km");
    expect(j).toContain("2,2 km a 3,9 km");
    expect(j).toContain("90%");
  });
  it("não entra sem a contagem por CEP (sem zonas ou sem foto)", () => {
    expect(titulos({ ...base, zonas: null })).not.toContain("Zonas de Captação");
    expect(titulos({ ...base, zonas })).not.toContain("Zonas de Captação");
  });
});
