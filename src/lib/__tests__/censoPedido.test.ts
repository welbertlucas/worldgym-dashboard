import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import { ehCodigoDePedido, pedirCenso, ufDaPosicao, arquivoDoPedido, VALIDADE_PEDIDO_MIN } from "../../../server/censoPedido.js";
// @ts-expect-error módulo JS do servidor
import { blocosUrbanos } from "../../../server/censoMunicipio.js";

// Pedido do Censo de um município: nada de posição nem nome de cidade pode ir ao GitHub (repositório público). Números inventados.
const guardado = new Map<string, unknown>();
beforeEach(() => { guardado.clear(); definirArmazem({ ler: async (c: string) => guardado.get(c) ?? null, gravar: async (c: string, d: unknown) => { guardado.set(c, d); }, apagar: async (c: string) => { guardado.delete(c); } }); });
afterEach(() => definirArmazem(null));

const mapbox = (uf: string) => async () => ({ json: async () => ({ features: [{ properties: { context: { region: { region_code: uf } } } }] }) });
const PONTO = [-17.88, -51.7185];
const feitos = () => {
  const chamadas: { url: string; corpo: string }[] = [];
  const fetcher = async (url: string, opcoes?: { body?: string }) => {
    if (String(url).includes("mapbox")) return mapbox("GO")();
    chamadas.push({ url: String(url), corpo: String(opcoes?.body ?? "") });
    return { ok: true, status: 204 };
  };
  return { chamadas, fetcher };
};

describe("pedido do Censo de um município", () => {
  it("descobre o estado, guarda a posição só no arquivo privado e manda ao GitHub apenas o código", async () => {
    const { chamadas, fetcher } = feitos();
    const r = await pedirCenso({ c: PONTO }, { fetcher, token: "t", chaveMapbox: "m", id: "0123456789abcdef0123", agora: 1000 });
    expect(r).toEqual({ estado: "pedido", uf: "GO" });
    expect(guardado.get(arquivoDoPedido("0123456789abcdef0123"))).toMatchObject({ uf: "GO", c: PONTO });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toContain("/actions/workflows/censo-municipio.yml/dispatches");
    const corpo = JSON.parse(chamadas[0].corpo);
    expect(corpo.inputs).toEqual({ pedido: "0123456789abcdef0123", gravar: "true" });
    // nada que identifique onde o dono estuda
    expect(chamadas[0].corpo).not.toMatch(/-17\.88|-51\.71|GO|Jata/);
  });

  it("não repete o pedido da mesma área enquanto o anterior pode estar rodando, e repete depois", async () => {
    const { chamadas, fetcher } = feitos();
    const base = { fetcher, token: "t", chaveMapbox: "m" };
    await pedirCenso({ c: PONTO }, { ...base, id: "aaaaaaaaaaaaaaaaaaaa", agora: 0 });
    expect((await pedirCenso({ c: [-17.885, -51.72] }, { ...base, id: "bbbbbbbbbbbbbbbbbbbb", agora: 60_000 })).estado).toBe("em-andamento");
    expect(chamadas).toHaveLength(1);
    expect((await pedirCenso({ c: PONTO }, { ...base, id: "cccccccccccccccccccc", agora: (VALIDADE_PEDIDO_MIN + 1) * 60_000 })).estado).toBe("pedido");
    expect(chamadas).toHaveLength(2);
  });

  it("se o Atlas já tem o Censo daquela área, não pede nada", async () => {
    const celulas = Array.from({ length: 6 }, (_, i) => [-17.88 + i * 0.003, -51.72 + i * 0.003, 200, 3000, 70]);
    guardado.set("estudos/censo-mun/indice.json", { municipios: [{ cod: "5200001", nome: "X", uf: "GO", blocos: blocosUrbanos(celulas) }] });
    const { chamadas, fetcher } = feitos();
    expect(await pedirCenso({ c: PONTO }, { fetcher, token: "t", chaveMapbox: "m" })).toEqual({ estado: "pronto" });
    expect(chamadas).toHaveLength(0);
  });

  it("recusa o GitHub, falta de chave, posição fora do Brasil e estado desconhecido, sem deixar o pedido guardado", async () => {
    const recusa = async (url: string) => (String(url).includes("mapbox") ? mapbox("GO")() : { ok: false, status: 403 });
    await expect(pedirCenso({ c: PONTO }, { fetcher: recusa, token: "t", chaveMapbox: "m", id: "dddddddddddddddddddd" })).rejects.toThrow(/GitHub não aceitou/);
    expect(guardado.has(arquivoDoPedido("dddddddddddddddddddd"))).toBe(false);
    await expect(pedirCenso({ c: PONTO }, { fetcher: feitos().fetcher, token: "", chaveMapbox: "m" })).rejects.toThrow(/falta a chave/);
    await expect(pedirCenso({ c: [40, 2] }, { fetcher: feitos().fetcher, token: "t", chaveMapbox: "m" })).rejects.toThrow(/inválida/);
    await expect(ufDaPosicao(PONTO, { chave: "m", fetcher: mapbox("XX") })).rejects.toThrow(/estado/);
    expect(await ufDaPosicao(PONTO, { chave: "m", fetcher: mapbox("mg") })).toBe("MG");
  });

  it("o código do pedido só vale com 20 caracteres hexadecimais (nada de caminho nem comando)", () => {
    expect(ehCodigoDePedido("0123456789abcdef0123")).toBe(true);
    for (const ruim of ["", "../../x", "0123456789ABCDEF0123", "0123456789abcdef012", "0123456789abcdef01234", "a b", null, 5]) expect(ehCodigoDePedido(ruim)).toBe(false);
  });
});
