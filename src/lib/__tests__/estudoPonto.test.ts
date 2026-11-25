import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import {
  acertoDoModelo, alunosDoPonto, arredores, atracao, avaliarPonto, populacaoCanva, populacaoRecomendada, precoDeTabela, regiaoDe, ticketSugerido, vagasDoPonto, vereditoFinal, captacaoDe, fatoresDe, investimentoDe, km, m2Efetivo, paybackDe, parecidas, vendasParaPayback,
  type Censo, type Ponto, type Premissas, type UnidadeEstudo,
} from "@/lib/estudoPonto";
import { EstudosPontoTab } from "@/components/tabs/EstudosPontoTab";
import { ListaEstudos } from "@/components/estudos/ListaEstudos";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS da função serverless
import { sessaoDe } from "../../../api/_auth.js";
// @ts-expect-error módulo JS do servidor
import { ErroEstudos, lerEstudos, lerPontos, modoDe, podeEditar, pontoValido, reguaPorM2, salvarPontos, unidadesDoEstudo, arquivoDePontos, ARQUIVO_PREMISSAS } from "../../../server/estudos.js";

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
    // endereço do ponto (inventado): guardado limpo e cortado em 160 caracteres; vazio não entra
    expect(pontoValido({ c: [-15.8, -47.9], m2: 1200, endereco: "  Rua   Inventada, 10 - Bairro   Teste " }).endereco).toBe("Rua Inventada, 10 - Bairro Teste");
    expect(pontoValido({ c: [-15.8, -47.9], m2: 1200, endereco: "x".repeat(300) }).endereco).toHaveLength(160);
    expect("endereco" in pontoValido({ c: [-15.8, -47.9], m2: 1200, endereco: "  " })).toBe(false);
    expect(p).not.toHaveProperty("lixo");
    const v = pontoValido({ c: [-15.8, -47.9], m2: 1000, imovel: { vagas: "42.6", vagasPerto: -3 } });
    expect(v.imovel).toMatchObject({ vagas: 43, estacionamento: true }); expect(v.imovel).not.toHaveProperty("vagasPerto");
    expect(p.criadoEm).toMatch(/^\d{4}-/);
    const d = pontoValido({ c: [-15.8, -47.9], m2: 1000, decisao: { status: "unidade", unidade: "Gama", comentario: " ok ", previsao: { provavel: "300000.4", pessimista: 250000, otimista: 350000 } } });
    expect(d.decisao).toMatchObject({ status: "unidade", unidade: "Gama", comentario: "ok", previsao: { provavel: 300000 } });
    expect(pontoValido({ c: [-15.8, -47.9], m2: 1000, decisao: { status: "unidade", unidade: "Inventada" } }).decisao.unidade).toBeUndefined();
    expect(pontoValido({ c: [-15.8, -47.9], m2: 1000, decisao: { status: "talvez" } })).not.toHaveProperty("decisao");
  });
  it("salva e lê os pontos; sem premissas a tela fica indisponível", async () => {
    const mem = memoria(); definirArmazem(mem);
    expect(await lerEstudos(async () => meses, "2026-11", DONO)).toEqual({ disponivel: false, modo: "completo" });
    await salvarPontos([{ c: [-15.8, -47.9], m2: 1200, nome: "A" }], DONO);
    expect((mem.m.get(arquivoDePontos("dono1")) as { pontos: { autor: { id: string } }[] }).pontos[0].autor.id).toBe("dono1");
    mem.m.set(ARQUIVO_PREMISSAS, premissas);
    const d = await lerEstudos(async () => meses, "2026-11", DONO);
    expect(d.disponivel).toBe(true); expect(d.pontos).toHaveLength(1); expect(d.premissas.curva.meiaDistanciaKm).toBe(1.5);
    expect(d.premissas).not.toHaveProperty("unidades");
  });
  it("modo por perfil: dono e liberados editam, Master consulta, unidade vê só a própria", () => {
    expect(modoDe(DONO)).toBe("completo"); expect(modoDe({ ...BETO, verEstudos: true })).toBe("completo");
    expect(modoDe(ANA)).toBe("consulta"); expect(modoDe(BETO)).toBe("unidade");
    expect(modoDe({ ...DONO, papel: "unidades", papelReal: "dono" })).toBe("unidade"); // "Ver como" do dono
    expect(podeEditar(ANA)).toBe(false); expect(podeEditar(DONO)).toBe(true);
  });
  it("a liberação antiga de só ver o menu (verEstudos gravado) NÃO dá a visão completa; só fazEstudos dá", () => {
    expect(modoDe(sessaoDe({ id: "b", nome: "B", papel: "unidades", unidades: ["Itapoã"], verEstudos: true }))).toBe("unidade");
    expect(modoDe(sessaoDe({ id: "m", nome: "M", papel: "master", unidades: [], verEstudos: true }))).toBe("consulta");
    expect(modoDe(sessaoDe({ id: "f", nome: "F", papel: "unidades", unidades: ["Itapoã"], fazEstudos: true }))).toBe("completo");
  });
  it("a unidade recebe só a própria unidade, sem premissas, estudos nem vendas de outras; o Master vê os estudos de todos", async () => {
    const mem = memoria(); definirArmazem(mem);
    mem.m.set(ARQUIVO_PREMISSAS, premissas);
    await salvarPontos([{ c: [-15.8, -47.9], m2: 1000, nome: "Do dono" }], DONO);
    const comBairros = [...meses.slice(0, 2), { month: "2026-11", units: [{ name: "Asa Norte", alunosAtivos: 1700, bairros: [["Centro", "Brasília", 40, -15.76, -47.89], ["Longe", "Brasília", 5, -15.7, -47.8, 1]] }, { name: "Gama", alunosAtivos: 900 }] }];
    const u = await lerEstudos(async () => comBairros, "2026-11", { ...BETO, unidades: ["Asa Norte"] });
    expect(u.modo).toBe("unidade"); expect(u.minhas).toEqual(["Asa Norte"]); expect(u.pontos).toEqual([]);
    expect(u.premissas).toEqual({ curva: premissas.curva });
    const asa = u.unidades.find((x: { nome: string }) => x.nome === "Asa Norte"), gama = u.unidades.find((x: { nome: string }) => x.nome === "Gama");
    expect(asa.vendas).toBe(240_000); expect(asa.bairros).toEqual([["Centro", -15.76, -47.89, 40]]);
    expect(gama.vendas).toBeNull(); expect(gama.alunos).toBeNull(); expect(gama.bairros).toEqual([]);
    expect(u.vendasPorM2.low).toBeNull();
    const m = await lerEstudos(async () => comBairros, "2026-11", ANA);
    expect(m.modo).toBe("consulta"); expect(m.pontos.map((p: { nome: string }) => p.nome)).toEqual(["Do dono"]);
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

describe("lista de estudos", () => {
  const unidades: UnidadeEstudo[] = [
    { nome: "Centro", c: [-15.8, -47.9], m2: 1000, modelo: "low", abertura: "2020-01", madura: true, vendas: 210_000, alunos: 2000 },
    { nome: "Nova", c: [-15.9, -47.9], m2: 1000, modelo: "low", abertura: "2026-10", madura: false, vendas: 40_000, alunos: 200 },
  ];
  const base = (id: string, extra: Partial<Ponto> = {}): Ponto => ({ ...ponto([-15.81, -47.9], 1000, id), criadoEm: "2026-11-01T12:00:00.000Z", ...extra });
  it("região: a escrita, ou a distância até a World Gym mais próxima", () => {
    expect(regiaoDe(base("a", { regiao: "Setor Sul" }), unidades)).toBe("Setor Sul");
    expect(regiaoDe(base("b"), unidades)).toMatch(/^a 1(,\d)? km da WG Centro$/);
  });
  it("acerto do modelo: só estudos que viraram unidade madura, com a previsão do dia da decisão", () => {
    const prev = { provavel: 200_000, pessimista: 160_000, otimista: 240_000 };
    expect(acertoDoModelo([base("a")], unidades)).toBeNull();
    const r = acertoDoModelo([
      base("a", { decisao: { status: "unidade", em: "2025-01-01T00:00:00.000Z", unidade: "Centro", previsao: prev } }),
      base("b", { decisao: { status: "unidade", em: "2025-01-01T00:00:00.000Z", unidade: "Nova", previsao: prev } }),
    ], unidades)!;
    expect(r.n).toBe(1); expect(r.dentro).toBe(1); expect(r.erroMedio).toBeCloseTo(10_000 / 210_000);
  });
  it("mostra os estudos com veredito e decisão", () => {
    const dados = { disponivel: true, premissas: PREMISSAS, vendasPorM2: { low: FAIXA, pro: null }, unidades, censo: { rk: 0.3, celulas: [] }, pontos: [] };
    const html = renderToString(createElement(ListaEstudos, { dados, pontos: [base("a", { nome: "Galpão Teste", decisao: { status: "recusado", em: "2026-11-02T00:00:00.000Z", comentario: "aluguel alto" } })], abrir: () => {}, novo: () => {}, comparar: () => {} }));
    expect(html).toContain("Galpão Teste"); expect(html).toContain("Recusado"); expect(html).toContain("aprovam"); expect(html).toContain("com condicionantes");
    expect(renderToString(createElement(ListaEstudos, { dados, pontos: [], abrir: () => {}, novo: () => {}, comparar: () => {} }))).toContain("Nenhum estudo ainda");
  });
});

describe("tela dos estudos de ponto", () => {
  it("abre carregando, sem quebrar no servidor", () => {
    expect(renderToString(createElement(EstudosPontoTab))).toContain("Carregando os estudos de ponto");
  });
});

describe("PDF do estudo", () => {
  it("gera o PDF da unidade e o de vários pontos com a página de comparação", async () => {
    const { gerarPdfDoEstudo, nomeDoArquivo } = await import("@/lib/estudoPdf");
    const pagina = { titulo: "World Gym Teste", subtitulo: "Estudo da unidade", frase: "Vende R$ 300 mil por mês.", numeros: [{ rotulo: "Vendas por m²", valor: "R$ 250" }], secoes: [{ titulo: "Bairros", linhas: [{ texto: "Centro", valor: "40 (50%)" }] }] };
    const um = await gerarPdfDoEstudo({ arquivo: "a.pdf", cabecalho: "Estudo da unidade", foto: null, paginas: [pagina] }, "blob");
    const dois = await gerarPdfDoEstudo({ arquivo: "b.pdf", cabecalho: "Estudo de ponto", foto: null, paginas: [pagina, pagina], comparacao: { colunas: ["Ponto", "Veredito"], linhas: [["A", "Aprovado"], ["B", "Atenção"]] } }, "blob");
    expect((um as Blob).size).toBeGreaterThan(1000);
    expect((dois as Blob).size).toBeGreaterThan((um as Blob).size);
    expect(nomeDoArquivo("estudo-unidade-Águas Claras Pro")).toBe("estudo-unidade-aguas-claras-pro.pdf");
  });
});

describe("pontos de interesse (server/pois.js)", () => {
  it("confere o pedido, reconhece as grandes redes, busca e guarda o resultado", async () => {
    // @ts-expect-error módulo JS do servidor
    const { pedidoValido, redeDe, buscarPois, ErroPois } = await import("../../../server/pois.js");
    expect(() => pedidoValido({ c: [-15.8, -47.9], raioKm: 9 })).toThrow(ErroPois);
    expect(() => pedidoValido({ c: [-15.8, -47.9], raioKm: 2, categoria: "bares" })).toThrow(ErroPois);
    expect(redeDe("SMART FIT - Ceilândia")).toBe("Smart Fit"); expect(redeDe("Academia do Zé")).toBeNull();
    const m = new Map<string, unknown>();
    definirArmazem({ async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); } });
    let chamadas = 0;
    const fetcher = async (url: string) => {
      chamadas++;
      if (url.includes("computeInsights")) return { json: async () => ({ placeInsights: [{ place: "places/a" }, { place: "places/b" }] }) };
      const perto = url.endsWith("/a");
      return { json: async () => ({ displayName: { text: perto ? "Smart Fit Centro" : "Academia Longe" }, formattedAddress: "Rua X", location: perto ? { latitude: -15.801, longitude: -47.9 } : { latitude: -15.9, longitude: -47.9 } }) };
    };
    const r = await buscarPois({ c: [-15.8, -47.9], raioKm: 2, categoria: "academias" }, { chave: "k", fetcher });
    expect(r.total).toBe(1); expect(r.lugares[0]).toMatchObject({ nome: "Smart Fit Centro", rede: "Smart Fit" }); expect(r.doCache).toBe(false);
    const antes = chamadas;
    const r2 = await buscarPois({ c: [-15.8, -47.9], raioKm: 2, categoria: "academias" }, { chave: "k", fetcher });
    expect(r2.doCache).toBe(true); expect(chamadas).toBe(antes);
    definirArmazem(null);
  });

  it("conta as academias pela categoria principal, só pelo número, e guarda", async () => {
    // @ts-expect-error módulo JS do servidor
    const { contarAcademias } = await import("../../../server/pois.js");
    const m = new Map<string, unknown>();
    definirArmazem({ async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); } });
    let corpo = "", chamadas = 0;
    const fetcher = async (_url: string, o: { body: string }) => { chamadas++; corpo = o.body; return { json: async () => ({ count: "9" }) }; };
    const r = await contarAcademias({ c: [-15.8, -47.9], raioKm: 1.5 }, { chave: "k", fetcher });
    expect(r).toMatchObject({ academias: 9, raioKm: 1.5, doCache: false });
    expect(JSON.parse(corpo)).toMatchObject({ insights: ["INSIGHT_COUNT"], filter: { typeFilter: { includedPrimaryTypes: ["gym", "fitness_center"] } } });
    expect((await contarAcademias({ c: [-15.8, -47.9], raioKm: 1.5 }, { chave: "k", fetcher })).doCache).toBe(true);
    expect(chamadas).toBe(1);
    definirArmazem(null);
  });
});

describe("área de deslocamento (server/deslocamento.js e contas no front)", () => {
  it("confere o pedido, busca no Mapbox uma vez e guarda; as contas usam a área", async () => {
    // @ts-expect-error módulo JS do servidor
    const { pedidoValido, buscarDeslocamento, ErroDeslocamento } = await import("../../../server/deslocamento.js");
    expect(() => pedidoValido({ c: [10, 10] })).toThrow(ErroDeslocamento);
    expect(() => pedidoValido({ c: [-15.8, -47.9], modo: "bicicleta" })).toThrow(ErroDeslocamento);
    const m = new Map<string, unknown>();
    definirArmazem({ async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); } });
    const quadrado = (r: number) => ({ type: "Polygon", coordinates: [[[-47.9 - r, -15.8 - r], [-47.9 + r, -15.8 - r], [-47.9 + r, -15.8 + r], [-47.9 - r, -15.8 + r], [-47.9 - r, -15.8 - r]]] });
    let chamadas = 0, url = "";
    const fetcher = async (u: string) => { chamadas++; url = u; return { json: async () => ({ features: [5, 10, 15, 20].map((mi) => ({ properties: { contour: mi }, geometry: quadrado(mi / 1000) })) }) }; };
    const d = await buscarDeslocamento({ c: [-15.8, -47.9], modo: "carro" }, { chave: "k", fetcher });
    expect(url).toContain("/driving/-47.9,-15.8"); expect(url).toContain("contours_minutes=5,10,15,20");
    expect(Object.keys(d.contornos)).toEqual(["5", "10", "15", "20"]); expect(d.doCache).toBe(false);
    const d2 = await buscarDeslocamento({ c: [-15.8, -47.9], modo: "carro" }, { chave: "k", fetcher });
    expect(d2.doCache).toBe(true); expect(chamadas).toBe(1);
    // só o cache (a lista de estudos): área já guardada volta; a que não existe não chama o Mapbox
    expect((await buscarDeslocamento({ c: [-15.8, -47.9], modo: "carro", soCache: true }, { chave: "k", fetcher })).doCache).toBe(true);
    expect((await buscarDeslocamento({ c: [-15.5, -47.5], modo: "carro", soCache: true }, { chave: "k", fetcher })).ausente).toBe(true);
    expect(chamadas).toBe(1);
    await expect(buscarDeslocamento({ c: [-15.7, -47.9] }, { chave: "", fetcher })).rejects.toThrow(ErroDeslocamento);
    definirArmazem(null);

    const { dentroDaArea, moradoresNaArea, parteDosAlunos, minutosPara80 } = await import("@/lib/estudoPonto");
    const g10 = d.contornos["10"];
    expect(dentroDaArea(-15.8, -47.9, g10)).toBe(true); expect(dentroDaArea(-15.9, -47.9, g10)).toBe(false);
    const censo = { rk: 0.3, celulas: [[-15.8, -47.9, 500, 2000], [-15.9, -47.9, 999, 2000]] as [number, number, number, number | null][] };
    expect(moradoresNaArea(censo, g10)).toBe(500);
    // 70 alunos a 0,003° (dentro de 5 min), 20 a 0,008° (dentro de 10) e 10 a 0,018° (dentro de 20)
    const bairros: [string, number, number, number][] = [["Perto", -15.803, -47.9, 70], ["Meio", -15.808, -47.9, 20], ["Longe", -15.818, -47.9, 10]];
    expect(parteDosAlunos(bairros, g10)).toBeCloseTo(0.9);
    expect(minutosPara80(bairros, d)).toBe(7.5);
  });
});

describe("busca de endereço (server/deslocamento.js)", () => {
  it("usa o Google quando tem a chave, cai no Mapbox sem ela e recusa texto curto", async () => {
    // @ts-expect-error módulo JS do servidor
    const { buscarEndereco, ErroDeslocamento } = await import("../../../server/deslocamento.js");
    await expect(buscarEndereco({ q: "ab" }, { chave: "m", chaveGoogle: "g", fetcher: async () => ({ json: async () => ({}) }) })).rejects.toThrow(ErroDeslocamento);
    const g = await buscarEndereco({ q: "Rua Exemplo 10", perto: [-15.8, -47.9] }, { chave: "m", chaveGoogle: "g", fetcher: async (url: string) => ({ json: async () => (url.includes("searchText") ? { places: [{ displayName: { text: "Rua Exemplo" }, formattedAddress: "Rua Exemplo, 10", location: { latitude: -15.81, longitude: -47.91 } }] } : {}) }) });
    expect(g.lugares).toEqual([{ nome: "Rua Exemplo", endereco: "Rua Exemplo, 10", c: [-15.81, -47.91] }]);
    const m = await buscarEndereco({ q: "Rua Exemplo 10" }, { chave: "m", chaveGoogle: "", fetcher: async () => ({ json: async () => ({ features: [{ geometry: { coordinates: [-47.91, -15.81] }, properties: { name: "Rua Exemplo", full_address: "Rua Exemplo, 10" } }] }) }) });
    expect(m.lugares[0].c).toEqual([-15.81, -47.91]);
  });
});

describe("recomendação de localização", () => {
  it("acha a posição com mais público por perto e respeita o limite de canibalização", async () => {
    const { posicoesMelhores } = await import("@/lib/estudoPonto");
    const curva = { meiaDistanciaKm: 1.4, raioKm: 6 };
    // gente concentrada 2 km ao norte do ponto; pouca gente no ponto
    const celulas: [number, number, number, number | null][] = [[-15.8, -47.9, 400, 2000]];
    for (let i = 0; i < 6; i++) celulas.push([-15.782 + i * 0.002, -47.9, 5000, 3000]);
    const censo = { rk: 0.3, celulas };
    const r = posicoesMelhores({ c: [-15.8, -47.9], m2: 1200 }, censo, [], [], curva, { raioKm: 3 });
    expect(r.sugestoes.length).toBeGreaterThan(0);
    expect(r.sugestoes[0].ganho).toBeGreaterThan(0.1);
    expect(r.sugestoes[0].c[0]).toBeGreaterThan(-15.79);
    // uma World Gym em cima da multidão: com limite de 20%, nenhuma nova unidade ali
    const wg = [{ nome: "Modelo A", c: [-15.777, -47.9] as [number, number], m2: 1200, modelo: "low" as const, abertura: null, madura: true, vendas: 1, alunos: 1 }];
    const nova = posicoesMelhores({ c: [-15.8, -47.9], m2: 1200 }, censo, wg, [], curva, { raioKm: 3, longeDeUnidadesKm: 1, maxCanibalizacao: 0.2 });
    expect(nova.sugestoes.every((x) => x.divideCom.every((d) => d.parte <= 0.2))).toBe(true);
  });
});

describe("classes de renda", () => {
  it("com a estimativa por domicílio, soma os domicílios de cada classe (AA a E)", async () => {
    const { classesNoRaio } = await import("@/lib/estudoPonto");
    // inventado: dois hexágonos com domicílios por classe [AA, A, B, C, D, E]
    const censo = { rk: 0.3, celulas: [
      [-15.8, -47.9, 300, 4000, 100, undefined, undefined, [2, 3, 15, 40, 25, 15]],
      [-15.801, -47.9, 200, 3000, 60, undefined, undefined, [0, 1, 4, 25, 20, 10]],
    ] as never };
    const r = classesNoRaio([-15.8, -47.9], censo, 2);
    expect(r.porDomicilio).toBe(true);
    expect(r.moradores).toBe(160); // aqui é o total de domicílios
    expect(r.classes.find((c) => c.id === "AA")?.parte).toBeCloseTo(2 / 160);
    expect(r.classes.find((c) => c.id === "C")?.parte).toBeCloseTo(65 / 160);
    expect(r.media).toBeCloseTo((4000 * 100 + 3000 * 60) / 160);
  });
  it("classifica pela faixa e divide os moradores do raio por classe", async () => {
    const { classeDaRenda, classesNoRaio } = await import("@/lib/estudoPonto");
    expect(classeDaRenda(1000)?.id).toBe("E");
    expect(classeDaRenda(5000)?.id).toBe("C");
    expect(classeDaRenda(30000)?.id).toBe("AA");
    expect(classeDaRenda(null)).toBeNull();
    const censo = { rk: 0.3, celulas: [[-15.8, -47.9, 300, 2000], [-15.801, -47.9, 100, 9000], [-15.9, -47.9, 999, 50000]] as [number, number, number, number | null][] };
    const r = classesNoRaio([-15.8, -47.9], censo, 2);
    expect(r.moradores).toBe(400);
    expect(r.classes.find((c) => c.id === "D")?.parte).toBeCloseTo(0.75);
    expect(r.ab).toBeCloseTo(0.25);
    expect(r.cde).toBeCloseTo(0.75);
    expect(r.media).toBeCloseTo((300 * 2000 + 100 * 9000) / 400);
  });
});


// Números INVENTADOS (o repositório é público).
describe("população recomendada, ticket e estacionamento", () => {
  const refs = [100, 200, 300, 400, 500].map((m, i) => ({ nome: `U${i}`, vendas: 1000, moradores: m }));
  it("recomendada pela mediana da rede e mínima pelo quartil de cima", () => {
    // vendas por morador: 10, 5, 3,33, 2,5, 2 -> mediana 3,33; quartil de cima 5
    const r = populacaoRecomendada(1000, 250, refs)!;
    expect(r.recomendada).toBeCloseTo(300); expect(r.minima).toBeCloseTo(200); expect(r.situacao).toBe("limite");
    expect(populacaoRecomendada(1000, 150, refs)!.situacao).toBe("abaixo");
    expect(populacaoRecomendada(1000, 300, refs)!.situacao).toBe("adequada");
    expect(populacaoRecomendada(1000, 300, refs.slice(0, 3))).toBeNull();
    const cv = populacaoCanva(100, 0.1); expect(cv.min).toBeCloseTo(5000); expect(cv.max).toBeCloseTo(6666.67, 1);
  });
  it("ticket: preço de tabela terminado em ,90, das parecidas quando houver", () => {
    expect(precoDeTabela(57)).toBeCloseTo(59.9); expect(precoDeTabela(61)).toBeCloseTo(59.9);
    const u = (nome: string, ticket: number | null, madura = true): UnidadeEstudo => ({ nome, c: [0, 0], m2: 100, modelo: "low", abertura: null, madura, vendas: 1, alunos: 1, ticket });
    const us = [u("A", 40), u("B", 50), u("C", 60), u("D", 999, false), u("E", null)];
    expect(ticketSugerido("low", us, [])).toMatchObject({ realizado: 50, n: 3, dasParecidas: false });
    expect(ticketSugerido("low", us, [us[2]])).toMatchObject({ realizado: 60, dasParecidas: true });
    expect(ticketSugerido("pro", us, [])).toBeNull();
    expect(alunosDoPonto({ meta: 1000, provavel: 800 }, 10)).toBe(100);
  });
  it("vagas: faixa pelo pico e pelo carro; insuficiente reprova", () => {
    const im = { fachada: false, estacionamento: false, polo: false, aPe: false };
    const v = vagasDoPonto(1000, im);
    expect(v).toMatchObject({ min: 16, max: 36, situacao: "sem-dado" });
    expect(vagasDoPonto(1000, { ...im, vagas: 10 }).situacao).toBe("insuficiente");
    expect(vagasDoPonto(1000, { ...im, vagas: 10, vagasPerto: 10 }).situacao).toBe("limite");
    expect(vagasDoPonto(1000, { ...im, vagas: 40 }).situacao).toBe("suficiente");
    expect(vereditoFinal("aprovado", { situacao: "insuficiente" })).toBe("reprovado");
    expect(vereditoFinal("atencao", { situacao: "sem-dado" })).toBe("atencao");
  });
});

describe("faixa de idade que predomina", () => {
  it("compara por ano de idade: a faixa de 60 anos ou mais (uns 20 anos) não ganha só por ser mais larga", async () => {
    const { faixaPredominante, idadeEm, FAIXAS_IDADE } = await import("@/lib/estudoPonto");
    expect(FAIXAS_IDADE[0]).toBe("Crianças (0 a 9 anos)");
    expect(FAIXAS_IDADE[1]).toBe("Adolescentes (10 a 19 anos)");
    // inventado: 60+ tem 400 (20 por ano), 20-29 tem 250 (25 por ano) → predomina 20-29
    expect(faixaPredominante([150, 160, 250, 200, 180, 100, 400])).toBe(2);
    expect(faixaPredominante([])).toBeNull();
    expect(idadeEm({ rk: 0.3, celulas: [[0, 0, 10, null, 3, [1, 2, 3, 4, 5, 6, 7]], [1, 1, 10, null, 3, [1, 1, 1, 1, 1, 1, 1]]] }, (la) => la < 0.5)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("domicílios por número de moradores", () => {
  it("com o dado do IBGE, soma 1, 2, 3, 4 e 5 ou mais; sem ele, usa a média por hexágono", async () => {
    const { densidadeEm, tamanhoPredominante } = await import("@/lib/estudoPonto");
    // inventado
    const com = densidadeEm({ rk: 0.3, celulas: [[0, 0, 30, null, 10, undefined, [2, 3, 2, 2, 1]], [0, 1, 20, null, 10, undefined, [5, 3, 1, 1, 0]]] }, () => true);
    expect(com.porTamanho).toBe(true);
    expect(com.classes.map((c) => c.domicilios)).toEqual([7, 6, 3, 3, 1]);
    expect(com.total).toBe(20); expect(com.porDomicilio).toBe(2.5);
    expect(tamanhoPredominante([2, 3, 2, 2, 1])).toBe(1);
    const sem = densidadeEm({ rk: 0.3, celulas: [[0, 0, 30, null, 10]] }, () => true);
    expect(sem.porTamanho).toBe(false);
  });
});

describe("unidades parecidas com comparação", () => {
  it("aponta parecida, só referência e a leitura; sem parecida, avisa", async () => {
    const { compararComParecidas, leituraParecidas } = await import("@/lib/estudoPonto");
    // inventado: 3 vizinhanças em volta de 3 posições; renda igual
    const censo = { rk: 0.3, celulas: [[0, 0, 1000, 3000], [1, 1, 1200, 3000], [2, 2, 5000, 3000]] } as never;
    const u = (nome: string, c: [number, number], vendas: number) => ({ nome, c, m2: 1000, modelo: "low", abertura: null, madura: true, vendas, alunos: 1 }) as never;
    const r = compararComParecidas([0, 0], "low", censo, [u("A", [1, 1], 300000), u("B", [2, 2], 400000)]);
    expect(r.itens.map((i) => i.u.nome)).toEqual(["A", "B"]);
    expect(r.itens[0].parecida).toBe(true); expect(r.itens[1].parecida).toBe(false);
    expect(r.itens[0].leitura).toContain("menos moradores");
    expect(leituraParecidas(r)).toContain("R$ 300 mil");
    const longe = compararComParecidas([0, 0], "low", censo, [u("B", [2, 2], 400000)]);
    expect(longe.semReferencia).toBe(true);
    expect(leituraParecidas(longe)).toContain("Nenhuma unidade");
    expect(leituraParecidas(r, 360000)).toContain("a mais");
  });
});

describe("malha v6: renda total, potencial e comércio", () => {
  it("soma a renda dos domicílios, o gasto do hexágono e os pontos de comércio", async () => {
    const { rendaTotalEm, comercioEm, potencialNaArea, malhaV6 } = await import("@/lib/estudoPonto");
    // inventado: [lat, lng, moradores, renda resp., domicílios, idade, tamanhos, classes, renda do domicílio, gasto do hexágono, comércio]
    const censo = { rk: 0.2, celulas: [
      [0.001, 0.001, 30, 3000, 10, undefined, undefined, undefined, 4500, 300, 4],
      [0.002, 0.002, 20, 2000, 8, undefined, undefined, undefined, 3000, 120, 0],
      [5, 5, 99, 9000, 50, undefined, undefined, undefined, 13000, 9000, 70],
    ] as never };
    const area = { type: "Polygon" as const, coordinates: [[[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]]] };
    expect(malhaV6(censo)).toBe(true);
    expect(rendaTotalEm(censo, (la) => la < 1)).toEqual({ total: 4500 * 10 + 3000 * 8, domicilios: 18, porDomicilio: (45000 + 24000) / 18 });
    expect(comercioEm(censo, (la) => la < 1)).toBe(4);
    expect(potencialNaArea(censo, area)).toEqual({ total: 420, domicilios: 18, porDomicilio: 420 / 18 });
    expect(comercioEm({ rk: 0.3, celulas: [[0, 0, 1, null]] }, () => true)).toBeNull();
  });
});

describe("parecer do Atlas", () => {
  it("diz se aprova, por quê e o que precisa para seguir (números inventados)", async () => {
    const { parecerDoPonto } = await import("@/lib/estudoPonto");
    const base = { provavel: 300_000, meta: 320_000, payback: 43, mesesAprovado: 36, mesesAtencao: 48 };
    const a = parecerDoPonto({ ...base, veredito: "atencao", vagas: { situacao: "sem-dado", min: 50, max: 80 }, populacao: { situacao: "abaixo", recomendada: 120_000 }, divideCom: [{ nome: "Gama", parte: 0.3 }] });
    expect(a.rotulo).toBe("Aprova com condicionantes");
    expect(a.porque).toContain("abaixo dos R$ 320 mil");
    expect(a.condicoes).toHaveLength(4);
    const b = parecerDoPonto({ ...base, veredito: "aprovado", vagas: { situacao: "insuficiente", min: 50, max: 80 } });
    expect(b.rotulo).toBe("Não aprova");
    expect(b.porque).toContain("eliminatório");
    expect(parecerDoPonto({ ...base, provavel: 400_000, veredito: "aprovado" })).toMatchObject({ rotulo: "Aprova", condicoes: [] });
  });
});

describe("fatia do potencial de consumo", () => {
  it("faixa tirada das unidades da rede e o parecer do ponto (números inventados)", async () => {
    const { faixaDaFatia, vereditoComFatia, parecerDoPonto } = await import("@/lib/estudoPonto");
    const refs = [10, 20, 30, 40, 70].map((f, i) => ({ nome: `U${i}`, vendas: f * 10_000, moradores: 100_000, potencial: 1_000_000 }));
    const fx = faixaDaFatia(refs)!;
    expect(fx.maxima).toBeCloseTo(0.7); expect(fx.mediana).toBeCloseTo(0.3); expect(fx.comum).toBeCloseTo(0.4); expect(fx.unidades).toBe(5);
    expect(faixaDaFatia(refs.slice(0, 4))).toBeNull(); // menos de 5 unidades maduras (ex.: o Pro, com 3): sem faixa, a fatia não barra o parecer
    expect(vereditoComFatia("aprovado", 1.4, fx)).toBe("reprovado"); // acima da maior da rede
    expect(vereditoComFatia("aprovado", 0.5, fx)).toBe("atencao"); // acima da comum
    expect(vereditoComFatia("atencao", 0.2, fx)).toBe("atencao");
    expect(vereditoComFatia("aprovado", 0.5, null)).toBe("aprovado");
    const p = parecerDoPonto({ veredito: "reprovado", provavel: 264_000, meta: 288_000, payback: 43, mesesAprovado: 36, mesesAtencao: 48, fatia: { valor: 1.4, potencial: 188_000, comum: 0.38, maxima: 0.74 } });
    expect(p.rotulo).toBe("Não aprova");
    expect(p.porque).toContain("140%"); expect(p.porque).toContain("74%");
  });
});

describe("freios da demanda para qualquer modelo", () => {
  // números inventados: 6 unidades do modelo A e 3 do modelo B (poucas para ter régua própria)
  const refs = [
    ...[100, 110, 120, 130, 140, 150].map((m, i) => ({ nome: `A${i}`, modelo: "low" as const, vendas: 250_000 + i * 10_000, moradores: m * 1000, potencial: 900_000, ab: 0.2, alunos: 2000 + i * 100 })),
    ...[0.5, 0.6, 0.7].map((ab, i) => ({ nome: `B${i}`, modelo: "pro" as const, vendas: 300_000 + i * 10_000, moradores: 120_000, potencial: 1_000_000, ab, alunos: 1000 + i * 100 })),
  ];

  it("modelo com poucas unidades usa a rede toda e avisa", async () => {
    const { refsParaModelo } = await import("@/lib/estudoPonto");
    expect(refsParaModelo(refs, "low")).toMatchObject({ daRede: false });
    expect(refsParaModelo(refs, "low")!.refs).toHaveLength(6);
    expect(refsParaModelo(refs, "pro")).toMatchObject({ daRede: true });
    expect(refsParaModelo(refs, "pro")!.refs).toHaveLength(9);
    expect(refsParaModelo(null, "pro")).toBeNull();
  });

  it("ponto pobre e pequeno no modelo caro não passa, mesmo com a conta do dinheiro fechando", async () => {
    const { freiosDeDemanda, aplicarFreios } = await import("@/lib/estudoPonto");
    const f = freiosDeDemanda({ modelo: "pro", refs, meta: 460_000, moradores: 30_000, ab: 0.2, alunosNecessarios: 2200 });
    expect(f.daRede).toBe(true);
    expect(f.freios.map((x) => x.id).sort()).toEqual(["alunos", "populacao", "renda"]);
    expect(f.freios.find((x) => x.id === "renda")!.nivel).toBe("reprovado"); // 20% contra o piso de 50%: menos da metade
    expect(f.freios.find((x) => x.id === "alunos")!.nivel).toBe("reprovado"); // 2.200 contra 1.200 de maior base: mais de 1,5 vez
    expect(aplicarFreios("aprovado", f.freios)).toBe("reprovado");
  });

  it("renda e alunos só limitam quando há referência do próprio modelo; população limita o 'aprova'", async () => {
    const { freiosDeDemanda, aplicarFreios } = await import("@/lib/estudoPonto");
    const bom = freiosDeDemanda({ modelo: "pro", refs, meta: 400_000, moradores: 200_000, ab: 0.55, alunosNecessarios: 1100 });
    expect(bom.freios).toEqual([]);
    expect(aplicarFreios("aprovado", bom.freios)).toBe("aprovado");
    // renda entre a metade do piso e o piso: com condicionantes
    const meio = freiosDeDemanda({ modelo: "pro", refs, meta: 400_000, moradores: 200_000, ab: 0.4, alunosNecessarios: 1100 });
    expect(meio.freios.map((x) => [x.id, x.nivel])).toEqual([["renda", "atencao"]]);
    expect(aplicarFreios("aprovado", meio.freios)).toBe("atencao");
    expect(aplicarFreios("reprovado", meio.freios)).toBe("reprovado");
    // o modelo barato não tem regra de renda
    expect(freiosDeDemanda({ modelo: "low", refs, meta: 300_000, moradores: 200_000, ab: 0.01, alunosNecessarios: 2000 }).freios).toEqual([]);
    // população abaixo do mínimo da rede: não é "aprova"
    const pop = freiosDeDemanda({ modelo: "low", refs, meta: 300_000, moradores: 20_000, ab: 0.2, alunosNecessarios: 2000 });
    expect(pop.freios.map((x) => x.id)).toEqual(["populacao"]);
    expect(aplicarFreios("aprovado", pop.freios)).toBe("atencao");
    // sem Censo, os freios de moradores e renda não valem
    expect(freiosDeDemanda({ modelo: "pro", refs, meta: 400_000, moradores: 0, ab: 0, alunosNecessarios: 1100, semCenso: true }).freios).toEqual([]);
  });

  it("o parecer explica o motivo e a conta mostra de onde vem o número", async () => {
    const { freiosDeDemanda, parecerDoPonto, contaDoPonto, avaliarPonto } = await import("@/lib/estudoPonto");
    const f = freiosDeDemanda({ modelo: "pro", refs, meta: 460_000, moradores: 30_000, ab: 0.2, alunosNecessarios: 2200 });
    const pr = parecerDoPonto({ veredito: "reprovado", provavel: 530_000, meta: 460_000, payback: 28, mesesAprovado: 36, mesesAtencao: 48, freios: f.freios });
    expect(pr.rotulo).toBe("Não aprova");
    expect(pr.porque).toContain("A conta do dinheiro fecha");
    expect(pr.porque).toContain("Mas o ponto não aprova");
    expect(pr.condicoes.join(" ")).toContain("mais renda");
    const r = avaliarPonto({ m2: 2000, modelo: "pro" }, PREMISSAS, { p25: 160, mediana: 200, p75: 226, n: 3 });
    const conta = contaDoPonto({ m2: 2000, modelo: "pro" }, r, PREMISSAS, { p25: 160, mediana: 200, p75: 226, n: 3 }, { min: 130, max: 220, n: 3 });
    expect(conta.join(" ")).toMatch(/R\$ 200 por m² × 2\.000 m²/);
    expect(conta.join(" ")).toContain("é uma premissa"); // a mediana é igual à premissa do modelo
    expect(conta.join(" ")).toContain("de R$ 130 a R$ 220 por m²");
  });
});

describe("avaliarCompleto: a mesma conta na tela do estudo, na lista e no mapa", () => {
  it("com a área e as referências aplica os freios; sem elas devolve o parecer simples; sem Censo limita (números inventados)", async () => {
    const { avaliarCompleto } = await import("@/lib/estudoPonto");
    const refs = [
      ...[100, 110, 120, 130, 140, 150].map((m, i) => ({ nome: `A${i}`, modelo: "low" as const, vendas: 250_000 + i * 10_000, moradores: m * 1000, potencial: 900_000, ab: 0.2, alunos: 2000 + i * 100 })),
      ...[0.5, 0.6, 0.7].map((ab, i) => ({ nome: `B${i}`, modelo: "pro" as const, vendas: 300_000 + i * 10_000, moradores: 120_000, potencial: 1_000_000, ab, alunos: 1000 + i * 100 })),
    ];
    const quadrado = { type: "Polygon" as const, coordinates: [[[-47.95, -15.85], [-47.85, -15.85], [-47.85, -15.75], [-47.95, -15.75], [-47.95, -15.85]]] };
    const censo = { rk: 0.3, celulas: [[-15.8, -47.9, 30_000, 2000]] as [number, number, number, number | null][] };
    const p = { ...ponto([-15.8, -47.9], 2000), modelo: "pro" as const };
    const ctx = { premissas: PREMISSAS, vendasPorM2: { low: FAIXA, pro: { p25: 160, mediana: 200, p75: 226, n: 3 } }, unidades: [], censo, refs, area: quadrado, semCenso: false };
    const simples = avaliarCompleto(p, { ...ctx, area: null })!;
    expect(simples.completo).toBe(false); expect(simples.veredito).toBe("aprovado"); expect(simples.freios).toEqual([]); // só a conta do dinheiro
    const completo = avaliarCompleto(p, ctx)!;
    expect(completo.completo).toBe(true); expect(completo.veredito).toBe("reprovado");
    expect(completo.freios.map((f) => f.id)).toContain("renda");
    expect(avaliarCompleto(p, { ...ctx, refs: null })!.completo).toBe(false);
    const sem = avaliarCompleto(p, { ...ctx, semCenso: true })!;
    expect(sem.completo).toBe(true); expect(sem.veredito).toBe("atencao"); expect(sem.freios).toEqual([]);
    expect(avaliarCompleto(p, { ...ctx, vendasPorM2: { low: FAIXA, pro: null } })).toBeNull();
  });
});

describe("Plus Code", () => {
  it("reconhece o Plus Code (sozinho ou com a cidade) e não confunde com endereço", async () => {
    const { ehPlusCode } = await import("@/components/estudos/sugestoes");
    expect(ehPlusCode("VR2M+XX")).toBe(true);
    expect(ehPlusCode("VR2M+XX Jataí, GO")).toBe(true);
    expect(ehPlusCode("8FWH4HVP+2F")).toBe(true); // o código global também é um Plus Code
    expect(ehPlusCode("R. Jerônimo Vilela, 327 - Vila Sofia")).toBe(false);
    expect(ehPlusCode("Av. 24+ de maio")).toBe(false);
    expect(ehPlusCode("")).toBe(false); expect(ehPlusCode(null)).toBe(false);
  });
});

describe("nome do arquivo do PDF", () => {
  it("usa o nome do estudo, só tirando o que o sistema de arquivos não aceita", async () => {
    const { nomeLegivelDoArquivo } = await import("@/lib/estudoPdf");
    expect(nomeLegivelDoArquivo("Unidade Jataí 3")).toBe("Unidade Jataí 3.pdf");
    expect(nomeLegivelDoArquivo("R. Jerônimo Vilela, 327")).toBe("R. Jerônimo Vilela, 327.pdf");
    expect(nomeLegivelDoArquivo("Av. A/B: lote \"7\"?")).toBe("Av. A-B- lote -7.pdf");
    expect(nomeLegivelDoArquivo("   ")).toBe("estudo-de-ponto.pdf");
    expect(nomeLegivelDoArquivo("x".repeat(200)).length).toBe(84);
  });
});

describe("página da concorrência e distância das World Gym", () => {
  it("rosca, texto e até MAX_LISTA_ACADEMIAS lugares cabem numa página só", async () => {
    const { gerarPdfDoEstudo } = await import("@/lib/estudoPdf");
    const { MAX_LISTA_ACADEMIAS } = await import("@/components/estudos/pdfUnidade");
    const paginas = async (n: number) => {
      const linhas = Array.from({ length: n }, (_, i) => [String(i + 1), `Academia de Teste Número ${i + 1} (Rede Fictícia)`, (0.3 + i / 40).toLocaleString("pt-BR")]);
      const secao = { titulo: "Composição da Concorrência e Academias da Área", novaPagina: true, linhas: [],
        texto: ["Dos 90 lugares, 60 disputam diretamente o aluno da World Gym (grandes redes e academias independentes). Os studios e modalidades atendem nichos e entram só em parte na disputa."],
        grafico: { tipo: "rosca" as const, fatias: [{ rotulo: "Grandes redes", valor: 20, cor: "#1b2130" }, { rotulo: "Academias independentes", valor: 40, cor: "#1f5f8b" }, { rotulo: "Studios e modalidades", valor: 30, cor: "#b9c3d0" }], centro: "90", rotuloCentro: "lugares" },
        tabela: { colunas: ["Nº", "Academia", "km"], larguras: [6.5, 38.5, 9], blocos: 3, linhas },
        paragrafo: "Os 90 lugares estão em ordem de distância do ponto, em quilômetros; os nomes aparecem resumidos. A lista mostra os mais próximos; outros mais distantes ficaram de fora." };
      const blob = (await gerarPdfDoEstudo({ arquivo: "c.pdf", cabecalho: "Estudo de ponto", foto: null, paginas: [{ titulo: "Ponto", subtitulo: "x", numeros: [], secoes: [secao] }] }, "blob")) as Blob;
      return (new TextDecoder("latin1").decode(await blob.arrayBuffer()).match(/\/Type\s*\/Page\b/g) ?? []).length;
    };
    expect(await paginas(MAX_LISTA_ACADEMIAS)).toBe(await paginas(3));
    expect(await paginas(120)).toBeGreaterThan(await paginas(3)); // o limite antigo não cabia
  });

  it("diz a distância da World Gym mais próxima", async () => {
    const { unidadesMaisProximas, fraseUnidadesProximas } = await import("@/lib/estudoPonto");
    const u = (nome: string, c: [number, number]) => ({ nome, c, m2: 1000, modelo: "low", abertura: null, madura: true, vendas: 1, alunos: 1 }) as UnidadeEstudo;
    const px = unidadesMaisProximas([-15.8, -47.9], [u("Longe", [-15.2, -47.9]), u("Perto", [-15.8, -47.88]), u("Média", [-15.7, -47.9]), u("Sem posição", null as unknown as [number, number])], 3);
    expect(px.map((x) => x.nome)).toEqual(["World Gym Perto", "World Gym Média", "World Gym Longe"]);
    expect(px[0].km).toBeCloseTo(2.1, 1);
    expect(unidadesMaisProximas([-15.8, -47.9], [u("A", [-15.8, -47.9])], 3, "A")).toEqual([]);
    const f = fraseUnidadesProximas(px, "ponto");
    expect(f).toContain("A World Gym mais próxima do ponto é a WG Perto, a 2,1 km em linha reta");
    expect(f).toContain("WG Média"); expect(f).toContain("WG Longe");
    expect(fraseUnidadesProximas([], "ponto")).toBe("");
  });
});

describe("página com mapa, números e rosca", () => {
  it("o mapa diminui o que for preciso e a rosca fica na mesma página, mesmo com a legenda do mapa em duas linhas", async () => {
    const { gerarPdfDoEstudo } = await import("@/lib/estudoPdf");
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const paginas = async (comRosca: boolean, legenda: string) => {
      const secao = { titulo: "Domicílios e Densidade Residencial", novaPagina: true, linhas: [],
        texto: ["A área conta com 112.177 domicílios ocupados, com média de 2,37 moradores por domicílio (Brasil: 2,79). Domicílios menores (pessoas sozinhas e casais) costumam ter mais renda disponível por pessoa e mais rotina individual, o que favorece frequência alta e planos de maior valor."],
        foto: { dados: png, legenda }, altFoto: 120,
        destaques: [{ valor: "112.177", rotulo: "domicílios ocupados" }, { valor: "2,37", rotulo: "moradores por domicílio" }, { valor: "265 mil", rotulo: "moradores" }],
        ...(comRosca ? { grafico: { tipo: "rosca" as const, titulo: "Domicílios por número de moradores", fatias: ["1 morador", "2 moradores", "3 moradores", "4 moradores", "5 ou mais"].map((rotulo, i) => ({ rotulo, valor: 10 + i, cor: "#c41230" })), centro: "112 mil", rotuloCentro: "domicílios" } } : {}) };
      const blob = (await gerarPdfDoEstudo({ arquivo: "d.pdf", cabecalho: "Estudo de ponto", foto: null, paginas: [{ titulo: "Ponto", subtitulo: "x", numeros: [], secoes: [secao] }] }, "blob")) as Blob;
      return (new TextDecoder("latin1").decode(await blob.arrayBuffer()).match(/\/Type\s*\/Page\b/g) ?? []).length;
    };
    const longa = "Cada hexágono na cor do tamanho de domicílio mais comum (número de moradores, Censo 2022). Contorno cinza: sem moradores no Censo 2022 (parque, setor institucional, terra rural ou loteamento novo).";
    expect(await paginas(true, longa)).toBe(await paginas(false, longa));
    expect(await paginas(true, "Legenda curta.")).toBe(await paginas(false, "Legenda curta."));
  });
});

describe("gráficos das páginas de faturamento, ticket, estacionamento e parecidas", () => {
  it("montam as barras e a rosca com os números do estudo (inventados)", async () => {
    const { graficosDeFaturamento, graficosDeTicket, graficoDeVagas, graficoDeParecidas } = await import("@/components/estudos/pdfPonto");
    const r = { pessimista: 200_000, provavel: 300_000, otimista: 360_000, meta: 330_000, custoFixo: 135_000 };
    const f = graficosDeFaturamento(r, 0.1);
    expect(f.barras.tipo).toBe("barras");
    if (f.barras.tipo === "barras") {
      expect(f.barras.itens.map((i) => i.rotulo)).toEqual(["Pessimista", "Provável", "Otimista", "Meta da régua", "Equilíbrio (sem lucro)"]);
      expect(f.barras.itens.find((i) => i.rotulo.startsWith("Equilíbrio"))!.valor).toBeCloseTo(150_000); // 135 mil ÷ 0,9
      expect(f.barras.itens.filter((i) => i.destaque).map((i) => i.rotulo)).toEqual(["Provável"]);
    }
    if (f.rosca.tipo === "rosca") {
      expect(f.rosca.fatias.map((x) => x.rotulo)).toEqual(["Custo variável", "Custo fixo", "Lucro"]);
      expect(f.rosca.fatias.reduce((a, x) => a + x.valor, 0)).toBeCloseTo(1); // variável 10% + fixo 45% + lucro 45%
      expect(f.rosca.centro).toBe("45%");
    }
    // sem lucro: a rosca mostra só os custos e diz "prejuízo"
    const pre = graficosDeFaturamento({ ...r, provavel: 140_000 }, 0.1);
    if (pre.rosca.tipo === "rosca") { expect(pre.rosca.fatias.map((x) => x.rotulo)).toEqual(["Custo variável", "Custo fixo"]); expect(pre.rosca.centro).toBe("prejuízo"); }

    const tk = graficosDeTicket({ preco: 139.9, p25: 129.9, p75: 149.9 }, 2100, { mediana: 2000, maior: 2900, n: 16 });
    expect(tk).toHaveLength(2);
    expect(graficosDeTicket({ preco: 139.9, p25: 129.9, p75: 149.9 }, null, null)).toHaveLength(1); // sem régua de alunos, só o ticket
    const vg = graficoDeVagas({ min: 40, max: 70, proprias: 30, perto: null });
    if (vg.tipo === "barras") { expect(vg.itens.map((i) => i.texto)).toEqual(["40 vagas", "70 vagas", "30 vagas", "não informado"]); }
    const pa = graficoDeParecidas(264_000, [{ nome: "Unidade A", vendas: 300_000 }, { nome: "Sem venda", vendas: null }, { nome: "Nome muito comprido de unidade parecida", vendas: 250_000 }]);
    if (pa.tipo === "barras") { expect(pa.itens).toHaveLength(3); expect(pa.itens[0].destaque).toBe(true); expect(pa.itens[2].rotulo.endsWith("…")).toBe(true); }
  });

  it("a página de faturamento (barras + rosca + tabela) cabe numa folha só", async () => {
    const { gerarPdfDoEstudo } = await import("@/lib/estudoPdf");
    const { graficosDeFaturamento } = await import("@/components/estudos/pdfPonto");
    const g = graficosDeFaturamento({ pessimista: 200_000, provavel: 300_000, otimista: 360_000, meta: 330_000, custoFixo: 135_000 }, 0.1);
    const paginas = async (com: boolean) => {
      const secao = { titulo: "Estimativa de Faturamento", novaPagina: true, linhas: [], faixa: "Modelo direcionado: Low Cost",
        texto: ["Os três cenários usam as vendas por m² das unidades maduras da rede: o pessimista é o quartil inferior, o provável é a mediana e o otimista é o quartil superior. A meta é o que paga o investimento em 3 anos."],
        ...(com ? { grafico: g.barras, graficos: [g.rosca] } : {}),
        tabela: { colunas: ["Cenário", "Vendas por mês", "Lucro por mês", "Payback"], larguras: [1, 1, 1, 0.8], linhas: [["Pessimista", "R$ 200 mil", "R$ 45 mil", "80 meses"], ["Provável", "R$ 300 mil", "R$ 135 mil", "50 meses"], ["Otimista", "R$ 360 mil", "R$ 190 mil", "40 meses"], ["Meta da régua", "R$ 330 mil", "", "36 meses"]] } };
      const blob = (await gerarPdfDoEstudo({ arquivo: "e.pdf", cabecalho: "Estudo de ponto", foto: null, paginas: [{ titulo: "Ponto", subtitulo: "x", numeros: [], secoes: [secao] }] }, "blob")) as Blob;
      return (new TextDecoder("latin1").decode(await blob.arrayBuffer()).match(/\/Type\s*\/Page\b/g) ?? []).length;
    };
    expect(await paginas(true)).toBe(await paginas(false));
  });
});
