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

describe("PDF da unidade: Lacuna e Zonas de Captação (uma página só)", () => {
  const foto = "data:image/jpeg;base64,AAAA";
  it("junta a foto da lacuna, o texto e a tabela das zonas numa seção", () => {
    const j = titulos({ ...base, zonas, fotos: { ...base.fotos, oportunidade: foto } });
    expect(j).toContain("Lacuna e Zonas de Captação");
    expect(j).not.toContain("\"Zonas de Captação\""); // não há mais uma página separada
    expect(j).toContain("até 2,2 km"); expect(j).toContain("2,2 km a 3,9 km"); expect(j).toContain("90%");
  });
  it("sem a contagem por CEP, fica só a lacuna; sem lacuna, só as zonas; sem nenhuma, nada", () => {
    const so = titulos({ ...base, zonas: null, fotos: { ...base.fotos, oportunidade: foto } });
    expect(so).toContain("Lacuna de Captação"); expect(so).not.toContain("Zonas");
    expect(titulos({ ...base, zonas })).toContain("\"Zonas de Captação\"");
    expect(titulos({ ...base, zonas: null })).not.toMatch(/Lacuna|Zonas de/);
  });
});
