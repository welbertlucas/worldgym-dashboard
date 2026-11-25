import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import * as S from "../../../server/obras.js";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
import { MARCOS_PADRAO, diasDeAtraso, inauguracao, obraNova, ordenar, progresso, proximoMarco, resumoDasObras, situacao, type Obra } from "@/lib/obras";

// Dados INVENTADOS (unidades, cidades e datas fictícias).
const HOJE = "2026-11-25";
const obra = (id: string, nome: string, datas: Array<[string | null, string | null]>): Obra => ({
  id, nome, cidade: "Cidade Exemplo", modelo: "low", m2: 1200, responsavel: "", obs: "",
  marcos: datas.map(([previsto, real], i) => ({ id: `${id}m${i}`, nome: `Marco ${i + 1}`, previsto, real })),
});

describe("situação e progresso da obra", () => {
  it("concluída quando todos os marcos têm data real", () => {
    const o = obra("a", "Alfa", [["2026-01-10", "2026-01-12"], ["2026-03-01", "2026-03-01"]]);
    expect(situacao(o, HOJE)).toBe("concluida");
    expect(progresso(o)).toBe(100);
    expect(proximoMarco(o)).toBeNull();
  });
  it("atrasada quando um marco pendente já passou da data prevista; no prazo quando não", () => {
    const atrasada = obra("b", "Beta", [["2026-10-01", "2026-10-02"], ["2026-11-15", null], ["2027-02-01", null]]);
    expect(situacao(atrasada, HOJE)).toBe("atrasada");
    expect(diasDeAtraso(atrasada, HOJE)).toBe(10);
    expect(progresso(atrasada)).toBe(33);
    expect(proximoMarco(atrasada)?.nome).toBe("Marco 2");
    const noPrazo = obra("c", "Gama", [["2026-10-01", "2026-10-02"], ["2026-12-15", null]]);
    expect(situacao(noPrazo, HOJE)).toBe("no-prazo");
    expect(diasDeAtraso(noPrazo, HOJE)).toBe(0);
  });
  it("marco pendente sem data prevista não conta como atraso", () => {
    expect(situacao(obra("d", "Delta", [["2026-10-01", "2026-10-02"], [null, null]]), HOJE)).toBe("no-prazo");
  });
  it("a inauguração é a data do último marco (a real, se já aconteceu)", () => {
    expect(inauguracao(obra("e", "Épsilon", [["2026-10-01", null], ["2027-03-10", null]]))).toBe("2027-03-10");
    expect(inauguracao(obra("f", "Zeta", [["2026-10-01", null], ["2027-03-10", "2027-03-20"]]))).toBe("2027-03-20");
  });
});

describe("resumo e ordem da lista", () => {
  const lista = [
    obra("1", "Zulu", [["2026-12-01", null], ["2027-01-15", null]]),
    obra("2", "Atrasada", [["2026-10-01", null], ["2027-06-01", null]]),
    obra("3", "Pronta", [["2026-01-01", "2026-01-01"]]),
    obra("4", "Breve", [["2026-12-01", null], ["2026-12-20", null]]),
  ];
  it("conta obras em andamento, atrasadas, que inauguram em 90 dias e concluídas", () => {
    expect(resumoDasObras(lista, HOJE)).toEqual({ emObra: 3, atrasadas: 1, inauguramEm90: 2, concluidas: 1 });
  });
  it("atrasadas primeiro, depois a que inaugura antes, concluídas por último", () => {
    expect(ordenar(lista, HOJE).map((o) => o.nome)).toEqual(["Atrasada", "Breve", "Zulu", "Pronta"]);
  });
  it("uma obra nova já vem com os marcos de partida e sem datas", () => {
    const n = obraNova();
    expect(n.marcos.map((m) => m.nome)).toEqual([...MARCOS_PADRAO]);
    expect(n.marcos.every((m) => !m.previsto && !m.real)).toBe(true);
    expect(new Set(n.marcos.map((m) => m.id)).size).toBe(MARCOS_PADRAO.length);
  });
});

describe("servidor: guardar as obras", () => {
  let mem: Map<string, unknown>;
  beforeEach(() => {
    mem = new Map();
    definirArmazem({
      async ler(c: string) { return mem.has(c) ? JSON.parse(JSON.stringify(mem.get(c))) : null; },
      async gravar(c: string, d: unknown) { mem.set(c, JSON.parse(JSON.stringify(d))); },
    });
  });
  afterEach(() => definirArmazem(null));
  const dono = { papel: "dono", nome: "Dono Teste" };
  const master = { papel: "master", nome: "Master Teste" };
  const valida = (extra: Record<string, unknown> = {}) => ({ ...obraNova(), id: "obra1", nome: "Unidade Exemplo", ...extra });

  it("o dono cria, atualiza e apaga; a lista começa vazia", async () => {
    expect(await S.lerObras()).toEqual([]);
    const criada = await S.salvarObra(dono, valida(), { agora: new Date("2026-11-25T10:00:00Z") });
    expect(criada.criadoEm).toBe("2026-11-25T10:00:00.000Z");
    await S.salvarObra(dono, valida({ nome: "Outro nome" }), { agora: new Date("2026-11-26T10:00:00Z") });
    const obras = await S.lerObras();
    expect(obras).toHaveLength(1);
    expect(obras[0]).toMatchObject({ nome: "Outro nome", criadoEm: "2026-11-25T10:00:00.000Z", atualizadoEm: "2026-11-26T10:00:00.000Z" });
    await S.apagarObra(dono, "obra1");
    expect(await S.lerObras()).toEqual([]);
    await expect(S.apagarObra(dono, "obra1")).rejects.toMatchObject({ status: 404 });
  });
  it("quem não é o dono não muda nada", async () => {
    await expect(S.salvarObra(master, valida())).rejects.toMatchObject({ status: 403 });
    await expect(S.apagarObra(master, "obra1")).rejects.toMatchObject({ status: 403 });
  });
  it("confere nome, datas, m², marcos e identificadores", async () => {
    await expect(S.salvarObra(dono, valida({ nome: "  " }))).rejects.toMatchObject({ status: 400 });
    await expect(S.salvarObra(dono, valida({ id: "../x" }))).rejects.toMatchObject({ status: 400 });
    await expect(S.salvarObra(dono, valida({ m2: -5 }))).rejects.toMatchObject({ status: 400 });
    await expect(S.salvarObra(dono, valida({ marcos: [] }))).rejects.toMatchObject({ status: 400 });
    await expect(S.salvarObra(dono, valida({ marcos: [{ id: "a", nome: "X", previsto: "31/12/2026", real: null }] }))).rejects.toMatchObject({ status: 400 });
    await expect(S.salvarObra(dono, valida({ marcos: [{ id: "a", nome: "X", previsto: null, real: null }, { id: "a", nome: "Y", previsto: null, real: null }] }))).rejects.toMatchObject({ status: 400 });
  });
  it("guarda só os campos conhecidos e corta textos longos", async () => {
    const r = await S.salvarObra(dono, { ...valida({ obs: "x".repeat(900) }), campoExtra: "não vale" });
    expect(r.obs).toHaveLength(600);
    expect((r as Record<string, unknown>).campoExtra).toBeUndefined();
  });
  it("posição no mapa: aceita [lat, lng] no Brasil, guarda com 6 casas e recusa o que não faz sentido", async () => {
    const ok = await S.salvarObra(dono, valida({ c: [-15.7557218123, -47.8931096456], endereco: "Rua Exemplo, 10" }));
    expect(ok.c).toEqual([-15.755722, -47.89311]);
    expect(ok.endereco).toBe("Rua Exemplo, 10");
    expect((await S.salvarObra(dono, valida({ c: null }))).c).toBeNull();
    await expect(S.salvarObra(dono, valida({ c: [40.7, -74.0] }))).rejects.toMatchObject({ status: 400 });
    await expect(S.salvarObra(dono, valida({ c: ["a", "b"] }))).rejects.toMatchObject({ status: 400 });
    await expect(S.salvarObra(dono, valida({ c: [-15.7] }))).rejects.toMatchObject({ status: 400 });
  });
});
