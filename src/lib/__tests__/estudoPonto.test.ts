import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import {
  arredores, atracao, avaliarPonto, captacaoDe, fatoresDe, investimentoDe, km, m2Efetivo, paybackDe, parecidas, vendasParaPayback,
  type Censo, type Ponto, type Premissas, type UnidadeEstudo,
} from "@/lib/estudoPonto";
import { EstudosPontoTab } from "@/components/tabs/EstudosPontoTab";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import { ErroEstudos, lerEstudos, lerPontos, pontoValido, reguaPorM2, salvarPontos, unidadesDoEstudo, arquivoDePontos, ARQUIVO_PREMISSAS } from "../../../server/estudos.js";

// Números INVENTADOS: as premissas reais ficam só no Blob privado (o repositório é público).
const PREMISSAS: Premissas = {
  regua: { mesesAprovado: 36, mesesAtencao: 48, maturacaoMeses: 6, maturidadeMeses: 12 },
  modelos: {
    low: { nome: "Modelo A", padraoM2: 1000, investimento: 2_000_000, fixoBase: 100_000, fixoPorM2: 10, variavel: 0.1, limiteM2: 1500, pesoAcima: 0.5 },
    pro: { nome: "Modelo B", padraoM2: 2000, investimento: 4_000_000, fixoBase: 150_000, fixoPorM2: 10, variavel: 0.1, limiteM2: 2500, pesoAcima: 0.5, vendasPorM2: 200 },
  },
  curva: { meiaDistanciaKm: 1.5, raioKm: 6 },
};
const FAIXA = { p25: 150, mediana: 200, p75: 250, n: 16 };
const ponto = (c: [number, number], m2 = 1000, id = "a"): Ponto => ({ id, nome: id, c, modelo: "low", m2, imovel: { fachada: false, estacionamento: false, polo: false, aPe: false } });

describe("contas do estudo de ponto", () => {
  it("o m² acima do limite conta pela metade", () => {
    expect(m2Efetivo(1000, PREMISSAS.modelos.low)).toBe(1000);
    expect(m2Efetivo(2000, PREMISSAS.modelos.low)).toBe(1750);
  });
  it("o investimento acompanha o tamanho do imóvel", () => {
    expect(investimentoDe(1000, PREMISSAS.modelos.low)).toBe(2_000_000);
    expect(investimentoDe(2000, PREMISSAS.modelos.low)).toBe(4_000_000);
    expect(investimentoDe(2000, PREMISSAS.modelos.pro)).toBe(4_000_000);
  });
  it("as vendas da meta pagam o investimento exatamente no prazo", () => {
    const v = vendasParaPayback(36, 1000, PREMISSAS.modelos.low, 6);
    expect(v).toBeCloseTo((2_000_000 / 30 + 110_000) / 0.9, 3);
    expect(paybackDe(v, 1000, PREMISSAS.modelos.low, 6)).toBeCloseTo(36, 5);
  });
  it("sem lucro, o payback é infinito", () => {
    expect(paybackDe(100_000, 1000, PREMISSAS.modelos.low, 6)).toBe(Infinity);
  });
  it("veredito pelas vendas prováveis contra as metas de 36 e 48 meses", () => {
    expect(avaliarPonto({ m2: 900, modelo: "low" }, PREMISSAS, FAIXA).veredito).toBe("atencao");
    expect(avaliarPonto({ m2: 1000, modelo: "low" }, PREMISSAS, FAIXA).veredito).toBe("aprovado");
    expect(avaliarPonto({ m2: 500, modelo: "low" }, PREMISSAS, FAIXA).veredito).toBe("reprovado");
    expect(avaliarPonto({ m2: 2000, modelo: "low" }, PREMISSAS, FAIXA).foraDaFaixa).toBe(true);
  });
  it("a atração cai pela metade a cada meia-distância", () => {
    expect(atracao(2, 2)).toBeCloseTo(0.5); expect(atracao(4, 2)).toBeCloseTo(0.25);
    expect(km([-15.8, -47.9], [-15.8, -47.9])).toBe(0);
  });
});

describe("captação e unidades parecidas", () => {
  const censo: Censo = { rk: 0.3, celulas: [] };
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) censo.celulas.push([-15.8 + i * 0.005, -47.9 + j * 0.005, 500, 3000 + (i + 20) * 50]);
  const unidades: UnidadeEstudo[] = [
    { nome: "Perto", c: [-15.8, -47.885], m2: 1500, modelo: "low", abertura: "2020-01", madura: true, vendas: 300_000, alunos: 2000 },
    { nome: "Longe", c: [-16.5, -48.5], m2: 1200, modelo: "low", abertura: "2020-01", madura: true, vendas: 250_000, alunos: 1800 },
    { nome: "Nova", c: [-15.82, -47.9], m2: 1200, modelo: "low", abertura: "2026-10", madura: false, vendas: 50_000, alunos: 300 },
  ];
  it("uma World Gym perto divide a captação e o raio de 80% fica dentro da área de busca", () => {
    const p = ponto([-15.8, -47.9]);
    const cap = captacaoDe(p, censo, unidades, [], PREMISSAS.curva);
    expect(cap.raio80).toBeGreaterThan(0.5); expect(cap.raio80).toBeLessThan(5);
    expect(cap.divideCom[0].nome).toBe("World Gym Perto");
    const semRede = captacaoDe(p, censo, [], [], PREMISSAS.curva);
    expect(semRede.divideCom).toEqual([]);
    expect(cap.pesos.reduce((a, b) => a + b, 0)).toBeLessThan(semRede.pesos.reduce((a, b) => a + b, 0));
  });
  it("os arredores somam a população a até 2 km", () => {
    const a = arredores([-15.8, -47.9], censo);
    expect(a.pop).toBeGreaterThan(10_000); expect(a.renda).toBeGreaterThan(3000);
  });
  it("as parecidas são só as maduras do mesmo modelo", () => {
    const nomes = parecidas(ponto([-15.8, -47.9]), censo, unidades).map((u) => u.nome);
    expect(nomes).not.toContain("Nova");
    expect(nomes).toContain("Perto");
  });
  it("os fatores avisam do tamanho fora da faixa e da divisão com a rede", () => {
    const p = ponto([-15.8, -47.9], 2000);
    const r = avaliarPonto(p, PREMISSAS, FAIXA);
    const f = fatoresDe(p, r, captacaoDe(p, censo, unidades, [], PREMISSAS.curva), unidades, censo, PREMISSAS);
    expect(f.some((x) => !x.positivo && x.texto.includes("1.500 m²"))).toBe(true);
    expect(f.some((x) => x.texto.includes("World Gym Perto"))).toBe(true);
  });
});

describe("servidor dos estudos (server/estudos.js)", () => {
  const memoria = () => {
    const m = new Map<string, unknown>();
    return { m, async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); }, async listar(pre: string) { return [...m.keys()].filter((k) => k.startsWith(pre)); } };
  };
  const DONO = { id: "dono1", nome: "Dono", papel: "dono" }, ANA = { id: "ana", nome: "Ana", papel: "master" }, BETO = { id: "beto", nome: "Beto", papel: "unidades" };
  afterEach(() => definirArmazem(null));
  const meses = [
    { month: "2026-08", units: [{ name: "Asa Norte", vendasManuais: 100_000, vendasRecorrentes: 140_000 }, { name: "Gama", vendasRecorrentes: 300_000 }] },
    { month: "2026-09", units: [{ name: "Asa Norte", vendasManuais: 90_000, vendasRecorrentes: 150_000 }, { name: "Gama", vendasRecorrentes: 340_000 }] },
    { month: "2026-11", units: [{ name: "Asa Norte", vendasRecorrentes: 10_000, alunosAtivos: 1700 }] },
  ];
  const premissas = { regua: { maturidadeMeses: 12 }, modelos: PREMISSAS.modelos, curva: PREMISSAS.curva, unidades: { "Asa Norte": { m2: 1000, modelo: "low", abertura: "2015-01" }, Gama: { m2: 900, modelo: "low", abertura: "2026-06" } } };

  it("vendas médias só dos meses fechados, e madura com 12 meses", () => {
    const us = unidadesDoEstudo(meses, premissas, "2026-11");
    const asa = us.find((u: { nome: string }) => u.nome === "Asa Norte"), gama = us.find((u: { nome: string }) => u.nome === "Gama");
    expect(asa.vendas).toBe(240_000); expect(asa.madura).toBe(true); expect(asa.alunos).toBe(1700); expect(asa.c).toHaveLength(2);
    expect(gama.madura).toBe(false); expect(gama.vendas).toBe(320_000);
  });
  it("com poucas maduras, a régua por m² usa a premissa (Pro)", () => {
    const r = reguaPorM2([{ modelo: "low", madura: true, vendas: 300_000, m2: 1500 }], premissas);
    expect(r.low).toBeNull(); expect(r.pro.mediana).toBe(200);
  });
  it("ponto vindo do navegador é conferido", () => {
    expect(() => pontoValido({ c: [10, 0], m2: 1200 })).toThrow(ErroEstudos);
    expect(() => pontoValido({ c: [-15.8, -47.9], m2: 50 })).toThrow(ErroEstudos);
    const p = pontoValido({ c: [-15.8, -47.9], m2: 1200.4, nome: "  Av.   X ", modelo: "outro", imovel: { fachada: true, extra: true }, lixo: 1 });
    expect(p).toMatchObject({ nome: "Av. X", modelo: "low", m2: 1200, imovel: { fachada: true, estacionamento: false } });
    expect(p).not.toHaveProperty("lixo");
  });
  it("salva e lê os pontos; sem premissas a tela fica indisponível", async () => {
    const mem = memoria(); definirArmazem(mem);
    expect(await lerEstudos(async () => meses, "2026-11", DONO)).toEqual({ disponivel: false });
    await salvarPontos([{ c: [-15.8, -47.9], m2: 1200, nome: "A" }], DONO);
    expect((mem.m.get(arquivoDePontos("dono1")) as { pontos: { autor: { id: string } }[] }).pontos[0].autor.id).toBe("dono1");
    mem.m.set(ARQUIVO_PREMISSAS, premissas);
    const d = await lerEstudos(async () => meses, "2026-11", DONO);
    expect(d.disponivel).toBe(true); expect(d.pontos).toHaveLength(1); expect(d.premissas.curva.meiaDistanciaKm).toBe(1.5);
    expect(d.premissas).not.toHaveProperty("unidades");
  });
  it("cada autor vê só os próprios estudos; o dono vê todos e pode editar os de qualquer um", async () => {
    const mem = memoria(); definirArmazem(mem);
    await salvarPontos([{ c: [-15.8, -47.9], m2: 1200, nome: "Da Ana" }], ANA);
    await salvarPontos([{ c: [-15.7, -47.9], m2: 1300, nome: "Do Beto" }], BETO);
    // Beto tenta gravar um ponto com autor da Ana: vira dele, e o da Ana não muda
    await salvarPontos([{ c: [-15.7, -47.9], m2: 1300, nome: "Do Beto" }, { c: [-15.6, -47.9], m2: 1000, nome: "Falso", autor: { id: "ana", nome: "Ana" } }], BETO);
    expect((await lerPontos(ANA)).map((p: { nome: string }) => p.nome)).toEqual(["Da Ana"]);
    expect((await lerPontos(BETO)).map((p: { nome: string }) => p.nome).sort()).toEqual(["Do Beto", "Falso"]);
    const todos = await lerPontos(DONO);
    expect(todos).toHaveLength(3);
    // o dono apaga o ponto da Ana e renomeia o do Beto: cada um continua no próprio arquivo
    const doBeto = todos.filter((p: { autor: { id: string } }) => p.autor.id === "beto").map((p: { nome: string }) => (p.nome === "Do Beto" ? { ...p, nome: "Revisado" } : p));
    await salvarPontos(doBeto, DONO);
    expect(await lerPontos(ANA)).toEqual([]);
    expect((await lerPontos(BETO)).map((p: { nome: string }) => p.nome).sort()).toEqual(["Falso", "Revisado"]);
  });
});

describe("tela dos estudos de ponto", () => {
  it("abre carregando, sem quebrar no servidor", () => {
    expect(renderToString(createElement(EstudosPontoTab))).toContain("Carregando os estudos de ponto");
  });
});
