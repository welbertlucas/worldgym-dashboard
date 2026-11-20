import { beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import * as q from "../../../server/qualidade.js";
import { DIAS_SEM_VISITA, MODELO_SUGERIDO, itensQueMaisFalham, resumoDaRede, resumoPorUnidade, tomDaNota, type Visita } from "@/data/qualidade";

const memoria = () => {
  const m = new Map<string, unknown>();
  return {
    m, async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); },
    async listar(p: string) { return [...m.keys()].filter((k) => k.startsWith(p)); }, async apagar(c: string) { m.delete(c); },
    async gravarBytes(c: string, b: Buffer) { m.set(c, b); }, async lerBytes(c: string) { return (m.get(c) as Buffer) ?? null; },
  };
};
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(50)]).toString("base64");
const AGORA = new Date("2026-11-20T15:00:00Z");

describe("checklists (modelos)", () => {
  beforeEach(() => definirArmazem(memoria()));

  it("normaliza: peso entre 1 e 5 (10 no teto), regra de foto, item novo ganha id e exige nome e itens", () => {
    const m = q.normalizarModelo({ nome: "  Limpeza  ", itens: [{ texto: "Piso limpo", peso: 3, foto: "sempre" }, { texto: "Lixeira", peso: 99, foto: "qualquer" }] }, AGORA);
    expect(m.nome).toBe("Limpeza");
    expect(m.frequencia).toBe("visita");
    expect(m.itens[0]).toMatchObject({ texto: "Piso limpo", peso: 3, foto: "sempre" });
    expect(m.itens[1]).toMatchObject({ peso: 10, foto: "nenhuma" });
    expect(m.itens[0].id).toMatch(/^[a-z0-9-]{4,}$/);
    expect(() => q.normalizarModelo({ nome: "", itens: [{ texto: "a" }] })).toThrow(/nome/);
    expect(() => q.normalizarModelo({ nome: "x", itens: [] })).toThrow(/pelo menos um item/);
    expect(() => q.normalizarModelo({ nome: "x", itens: [{ texto: " " }] })).toThrow(/texto/);
  });

  it("o roteiro sugerido tem 28 itens, todos válidos, com peso 3 em segurança e documentos e 2 em equipamentos e banheiros", () => {
    const m = q.normalizarModelo(MODELO_SUGERIDO);
    expect(m.itens).toHaveLength(28);
    expect(m.itens.filter((i: any) => i.peso === 3)).toHaveLength(4);
    expect(m.itens.filter((i: any) => i.peso === 2)).toHaveLength(5);
    expect(m.itens.some((i: any) => /Certificado de Regularidade PJ do CREF/.test(i.texto))).toBe(true);
    // foto obrigatória (se não conforme) só nos itens de peso 2 ou 3; nos demais é opcional
    expect(m.itens.every((i: any) => i.foto === (i.peso > 1 ? "nao_conforme" : "nenhuma"))).toBe(true);
    expect(m.itens.filter((i: any) => i.foto === "nao_conforme")).toHaveLength(9);
    expect(new Set(m.itens.map((i: any) => i.id)).size).toBe(28);
  });

  it("salva, edita pelo id e apaga", async () => {
    const a = await q.salvarModelo({ nome: "A", itens: [{ texto: "x" }] });
    await q.salvarModelo({ nome: "B", itens: [{ texto: "y" }] });
    await q.salvarModelo({ ...a, nome: "A2" });
    expect((await q.lerModelos()).map((m: any) => m.nome)).toEqual(["A2", "B"]);
    await q.apagarModelo(a.id);
    expect((await q.lerModelos()).map((m: any) => m.nome)).toEqual(["B"]);
    await expect(q.apagarModelo("nao-existe")).rejects.toThrow(/não encontrado/);
  });
});

describe("visitas", () => {
  beforeEach(() => definirArmazem(memoria()));
  const modelo = () => q.normalizarModelo({ nome: "Roteiro", itens: [{ texto: "Piso", peso: 1, foto: "nao_conforme" }, { texto: "Banheiro", peso: 2, foto: "sempre" }, { texto: "Sala", peso: 1 }] }, AGORA);
  const unidade = "Asa Norte";

  it("nota ponderada: pontos conseguidos entre os que se aplicam, 'não se aplica' fora", async () => {
    const m = modelo();
    const foto = "11111111-1111-1111-1111-111111111111";
    const v = q.montarVisita({ unidade, data: "2026-11-19", respostas: [
      { itemId: m.itens[0].id, conforme: false, comentario: "piso sujo", fotos: [foto] },
      { itemId: m.itens[1].id, conforme: true, fotos: [foto] },
      { itemId: m.itens[2].id, conforme: null },
    ] }, m, { nome: "Ana", email: "a@x.com" }, AGORA);
    expect(v.nota).toBe(66.7); // 2 de 3 pontos (peso 1 falhou, peso 2 passou)
    expect(v.respostas[2]).toMatchObject({ conforme: null });
    expect(v.avaliador.nome).toBe("Ana");
    expect(q.notaDaVisita([{ conforme: null }])).toBeNull();
  });

  it("regras: não conforme pede o que corrigir e foto (se o item pedir); item 'sempre' pede foto; unidade e data válidas; nada respondido não vale", () => {
    const m = modelo();
    const foto = "11111111-1111-1111-1111-111111111111";
    const base = (respostas: any[], extra: any = {}) => () => q.montarVisita({ unidade, data: "2026-11-19", respostas, ...extra }, m, {}, AGORA);
    expect(base([{ itemId: m.itens[0].id, conforme: false, fotos: [foto] }])).toThrow(/o que precisa ser corrigido/);
    expect(base([{ itemId: m.itens[0].id, conforme: false, comentario: "x" }])).toThrow(/pede uma foto/);
    expect(base([{ itemId: m.itens[1].id, conforme: true }])).toThrow(/pede uma foto/);
    expect(base([{ itemId: m.itens[2].id, conforme: true }], { unidade: "Outra" })).toThrow(/unidade/);
    expect(base([{ itemId: m.itens[2].id, conforme: true }], { data: "2026-12-30" })).toThrow(/futuro/);
    expect(base([{ itemId: m.itens[2].id, conforme: true }], { data: "ontem" })).toThrow(/Data inválida/);
    expect(base([])).toThrow(/pelo menos um item/);
    expect(base([{ itemId: m.itens[2].id, conforme: true }], { chegada: "25:99" })().chegada).toBe("");
  });

  it("grava por mês, lista as recentes e apaga a visita com as fotos", async () => {
    const m = await q.salvarModelo({ nome: "Roteiro", itens: [{ texto: "Sala", foto: "sempre" }] });
    const fotoId = await q.salvarFoto(JPEG);
    const v = await q.salvarVisita({ modeloId: m.id, unidade, data: "2026-11-19", respostas: [{ itemId: m.itens[0].id, conforme: true, fotos: [fotoId] }] }, { nome: "Ana", email: "a@x.com" }, AGORA);
    expect((await q.visitasRecentes(12, AGORA)).map((x: any) => x.id)).toEqual([v.id]);
    expect((await q.lerFoto(fotoId)).length).toBeGreaterThan(10);
    await q.apagarVisita(v.id, v.mes);
    expect(await q.visitasRecentes(12, AGORA)).toEqual([]);
    await expect(q.lerFoto(fotoId)).rejects.toThrow(/não encontrada/);
    await expect(q.salvarVisita({ modeloId: "x", unidade, data: "2026-11-19", respostas: [] }, {}, AGORA)).rejects.toThrow(/não existe/);
  });

  it("foto: só JPEG, tamanho limitado e id válido", async () => {
    expect(() => q.decodificarFoto(Buffer.from("PNG....").toString("base64"))).toThrow(/JPEG/);
    expect(() => q.decodificarFoto(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(800 * 1024)]).toString("base64"))).toThrow(/grande/);
    expect(() => q.decodificarFoto("***")).toThrow(/inválida/);
    await expect(q.lerFoto("../segredo")).rejects.toThrow(/inválida/);
  });
});

const V = (o: Partial<Visita>): Visita => ({ id: "1", modeloId: "m", modeloNome: "Roteiro", unidade: "A", data: "2026-11-10", mes: "2026-11", avaliador: { nome: "x", email: "" }, respostas: [], observacao: "", nota: 80, criadoEm: "2026-11-10T10:00:00Z", ...o });
const HOJE = "2026-11-20";

describe("cálculos da tela de qualidade", () => {
  const visitas = [V({ id: "1", unidade: "A", nota: 100 }), V({ id: "2", unidade: "A", nota: 80, data: "2026-10-25", mes: "2026-10" }), V({ id: "3", unidade: "B", nota: 60, data: "2026-11-01" }), V({ id: "4", unidade: "C", nota: 95, data: "2026-07-01", mes: "2026-07" })];

  it("nota média de 90 dias, última visita e ordem (com nota primeiro, sem visita no fim)", () => {
    const l = resumoPorUnidade(visitas, ["A", "B", "C", "D"], HOJE);
    expect(l.map((x) => x.unidade)).toEqual(["A", "B", "C", "D"]);
    expect(l[0]).toMatchObject({ unidade: "A", media: 90, visitas: 2, diasSemVisita: 10 });
    expect(l[2]).toMatchObject({ unidade: "C", media: null, diasSemVisita: 142 }); // visita antiga: sem nota recente
    expect(l[3]).toMatchObject({ unidade: "D", ultima: null, diasSemVisita: null });
  });

  it("resumo da rede: nota média, visitas do mês, sem visita e itens não conformes", () => {
    const comItens = [V({ respostas: [{ itemId: "a", grupo: "", texto: "Piso", conforme: false, comentario: "x", fotos: [] }, { itemId: "b", grupo: "", texto: "Sala", conforme: true, comentario: "", fotos: [] }] }), ...visitas.slice(1)];
    const r = resumoDaRede(comItens, ["A", "B", "C", "D"], HOJE);
    expect(r).toEqual({ notaMedia: 70, visitasNoMes: 2, semVisita: 2, naoConformes: 1 }); // A 90, B 60; C e D sem visita recente (C há 142 dias, D nunca)
    expect(DIAS_SEM_VISITA).toBe(60);
  });

  it("itens que mais falham e as faixas de cor", () => {
    const r = (texto: string, conforme: boolean | null) => ({ itemId: texto, grupo: "", texto, conforme, comentario: conforme === false ? "x" : "", fotos: [] });
    const vs = [V({ id: "1", unidade: "A", respostas: [r("Piso", false), r("Sala", true)] }), V({ id: "2", unidade: "B", respostas: [r("Piso", false), r("Sala", false)] }), V({ id: "3", unidade: "A", respostas: [r("Piso", true), r("Copa", null)] })];
    const f = itensQueMaisFalham(vs, HOJE);
    expect(f.map((x) => [x.texto, x.falhas, x.respondidas, x.unidades])).toEqual([["Piso", 2, 3, 2], ["Sala", 1, 2, 1]]);
    expect([tomDaNota(95), tomDaNota(80), tomDaNota(50), tomDaNota(null)]).toEqual(["good", "warn", "bad", "neutral"]);
  });
});
