import { describe, expect, it } from "vitest";
import { lerCsv, lerImoveis, mapearColunas, numeroBr, tirarRepetidos, MAX_IMOVEIS_POR_IMPORTACAO } from "@/lib/importarImoveis";
// @ts-expect-error módulo JS do servidor
import { geocodificarLote, ErroDeslocamento } from "../../../server/deslocamento.js";
// @ts-expect-error módulo JS do servidor
import { pontoValido } from "../../../server/estudos.js";

// Endereços, nomes e valores INVENTADOS.
describe("leitura do CSV", () => {
  it("entende ponto e vírgula, aspas, vírgula decimal e BOM", () => {
    const l = lerCsv('﻿Código;Endereço;Área (m²);Aluguel\r\nA1;"Rua Exemplo, 10; Centro";"1.250,5";"R$ 18.000"\r\n\r\nA2;Av. Teste 5;900;12000\r\n');
    expect(l).toHaveLength(3);
    expect(l[1]).toEqual(["A1", "Rua Exemplo, 10; Centro", "1.250,5", "R$ 18.000"]);
  });
  it("aceita vírgula e tabulação como separador e aspas duplas dentro de aspas", () => {
    expect(lerCsv('a,b\n"x ""y"" z",2')[1]).toEqual(['x "y" z', "2"]);
    expect(lerCsv("a\tb\n1\t2")[1]).toEqual(["1", "2"]);
  });
  it("converte números do jeito brasileiro", () => {
    expect(numeroBr("R$ 12.000")).toBe(12000); expect(numeroBr("1.234,56")).toBe(1234.56); expect(numeroBr("850 m²")).toBe(850);
    expect(numeroBr("-15,79")).toBe(-15.79); expect(numeroBr("")).toBeNull(); expect(numeroBr("abc")).toBeNull();
  });
});

describe("colunas e imóveis", () => {
  it("acha as colunas pelo nome, sem acento e fora de ordem", () => {
    const c = mapearColunas(["Observações", "Endereço", "Metragem", "Valor do aluguel", "Link do anúncio", "Código"]);
    expect(c).toMatchObject({ obs: 0, endereco: 1, m2: 2, aluguel: 3, link: 4, nome: 5, lat: -1 });
  });
  it("monta os imóveis, pula linha sem posição e avisa m² estranho", () => {
    const r = lerImoveis(lerCsv("Nome;Endereço;m2;Aluguel;Modelo;Link\nPonto 1;Rua Exemplo 10, Cidade Exemplo;1200;R$ 20.000;Pro;https://exemplo.test/a\nPonto 2;;;;;\nPonto 3;Av. Teste 5, Cidade Exemplo;50;;;javascript:alert(1)"));
    expect(r.imoveis).toHaveLength(2);
    expect(r.imoveis[0]).toMatchObject({ nome: "Ponto 1", m2: 1200, aluguel: 20000, modelo: "pro", link: "https://exemplo.test/a" });
    expect(r.imoveis[1]).toMatchObject({ m2: null, link: "" }); // 50 m² fora da faixa; link perigoso descartado
    expect(r.avisos.join(" ")).toMatch(/Linha 3.*pulada/); expect(r.avisos.join(" ")).toMatch(/Linha 4.*m²/);
  });
  it("usa latitude e longitude da planilha e recusa as que caem fora do Brasil", () => {
    const r = lerImoveis(lerCsv("Nome;Latitude;Longitude\nA;-15,80;-47,90\nB;48,85;2,35"));
    expect(r.imoveis).toHaveLength(1); expect(r.imoveis[0].c).toEqual([-15.8, -47.9]);
  });
  it("sem coluna de endereço nem coordenadas não importa nada", () => {
    expect(lerImoveis(lerCsv("Nome;Preço\nA;10")).imoveis).toEqual([]);
  });
  it("respeita o limite por importação", () => {
    const linhas = ["Endereço", ...Array.from({ length: MAX_IMOVEIS_POR_IMPORTACAO + 5 }, (_, i) => `Rua Exemplo ${i + 1}, Cidade`)].join("\n");
    const r = lerImoveis(lerCsv(linhas));
    expect(r.imoveis).toHaveLength(MAX_IMOVEIS_POR_IMPORTACAO); expect(r.truncado).toBe(true);
  });
  it("tira os que ficam a menos de 30 m de outro ou de um estudo que já existe", () => {
    const novos = [{ c: [-15.8, -47.9] as [number, number] }, { c: [-15.80010, -47.9] as [number, number] }, { c: [-15.81, -47.9] as [number, number] }, { c: [-15.9, -47.9] as [number, number] }];
    expect(tirarRepetidos(novos, [[-15.81, -47.90005]])).toEqual({ ficam: [0, 3], repetidos: [1, 2] });
  });
});

describe("busca de endereços em lote (servidor)", () => {
  const fetcher = async (_u: string, init?: { body?: string }) => {
    const q = JSON.parse(init?.body ?? "{}").textQuery as string;
    return { json: async () => (q.includes("inexistente") ? { places: [] } : { places: [{ displayName: { text: q }, formattedAddress: `${q}, Brasil`, location: { latitude: -15.8, longitude: -47.9 } }] }) };
  };
  it("devolve a posição de cada endereço na ordem e null para o que não achou", async () => {
    const r = await geocodificarLote({ itens: [{ i: 0, q: "Rua Exemplo 10" }, { i: 1, q: "lugar inexistente" }, { i: 2, q: "Av. Teste 5" }] }, { chave: "m", chaveGoogle: "g", fetcher });
    expect(r.resultados.map((x: { i: number }) => x.i)).toEqual([0, 1, 2]);
    expect(r.resultados[0].lugar.c).toEqual([-15.8, -47.9]); expect(r.resultados[1].lugar).toBeNull();
  });
  it("recusa lote vazio ou grande demais e propaga falha do serviço", async () => {
    await expect(geocodificarLote({ itens: [] })).rejects.toThrow(ErroDeslocamento);
    await expect(geocodificarLote({ itens: Array.from({ length: 41 }, (_, i) => ({ i, q: "Rua Exemplo 10" })) })).rejects.toThrow(/No máximo/);
    await expect(geocodificarLote({ itens: [{ i: 0, q: "Rua Exemplo 10" }] }, { chave: "", chaveGoogle: "", fetcher })).rejects.toThrow(ErroDeslocamento);
  });
});

describe("origem do imóvel no estudo", () => {
  const base = { c: [-15.8, -47.9], modelo: "low", m2: 1000 };
  it("guarda aluguel, link seguro e observações", () => {
    expect(pontoValido({ ...base, origem: { aluguel: 18000.4, link: "https://exemplo.test/a", obs: " perto  do metrô " } }).origem).toEqual({ aluguel: 18000, link: "https://exemplo.test/a", obs: "perto do metrô" });
  });
  it("descarta link perigoso e origem vazia", () => {
    expect(pontoValido({ ...base, origem: { link: "javascript:alert(1)", aluguel: -5 } }).origem).toBeUndefined();
    expect(pontoValido(base).origem).toBeUndefined();
  });
});
