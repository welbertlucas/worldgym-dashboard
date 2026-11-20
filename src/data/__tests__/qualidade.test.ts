import { beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import * as q from "../../../server/qualidade.js";
import { DIAS_SEM_VISITA, MODELO_SUGERIDO, certificadosPorUnidade, equipamentosParados, itensQueMaisFalham, resumoDaRede, resumoPorUnidade, tomDaNota, type Visita } from "@/data/qualidade";

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

  it("aceita comentário longo (até 1000 caracteres) e até 10 fotos por item, com teto de 100 por visita", () => {
    const m = q.normalizarModelo({ nome: "R", itens: [{ texto: "Equipamentos" }, { texto: "Outro" }] }, AGORA);
    const id = (n: number) => `${String(n).padStart(8, "0")}-1111-1111-1111-111111111111`;
    const fotos = (n: number) => Array.from({ length: n }, (_, i) => id(i));
    const codigos = Array.from({ length: 10 }, (_, i) => `EQ-${1000 + i} esteira com a esteira travada`).join(", ");
    const v = q.montarVisita({ unidade: "Asa Norte", data: "2026-11-19", respostas: [{ itemId: m.itens[0].id, conforme: false, comentario: codigos, fotos: fotos(15) }] }, m, {}, AGORA);
    expect(v.respostas[0].comentario).toBe(codigos);
    expect(v.respostas[0].fotos).toHaveLength(10);
    const muitas = m.itens.map((i: any) => ({ itemId: i.id, conforme: true, fotos: fotos(10) }));
    expect(q.montarVisita({ unidade: "Asa Norte", data: "2026-11-19", respostas: muitas }, m, {}, AGORA).respostas.reduce((t: number, r: any) => t + r.fotos.length, 0)).toBe(20);
    const trinta = Array.from({ length: 11 }, (_, i) => ({ ...m.itens[0], id: `it-${i}00${i}` }));
    const grande = q.normalizarModelo({ nome: "G", itens: trinta.map((x) => ({ id: x.id, texto: `Item ${x.id}` })) }, AGORA);
    const resp = grande.itens.map((i: any) => ({ itemId: i.id, conforme: true, fotos: fotos(10) }));
    expect(() => q.montarVisita({ unidade: "Asa Norte", data: "2026-11-19", respostas: resp }, grande, {}, AGORA)).toThrow(/100 fotos/);
  });

  it("item de equipamentos parados: um registro por equipamento (código, descrição, foto); sem registro ou sem foto não vale", async () => {
    const m = q.normalizarModelo({ nome: "R", itens: [{ texto: "Equipamentos em operação?", tipo: "equipamentos", foto: "nao_conforme", peso: 2 }, { texto: "Outro" }] }, AGORA);
    expect(m.itens[0].tipo).toBe("equipamentos");
    expect(m.itens[1].tipo).toBe("conforme");
    const foto = "11111111-1111-1111-1111-111111111111";
    const visita = (equipamentos: any[], extra: any = {}) => () => q.montarVisita({ unidade: "Asa Norte", data: "2026-11-19", respostas: [{ itemId: m.itens[0].id, conforme: false, equipamentos, ...extra }] }, m, {}, AGORA);
    expect(visita([])).toThrow(/código de cada equipamento/);
    expect(visita([{ codigo: "  ", descricao: "x", fotos: [foto] }])).toThrow(/código de cada equipamento/);
    expect(visita([{ codigo: "EQ-1", descricao: "esteira travada" }])).toThrow(/pede uma foto \(EQ-1\)/);
    const v = visita([{ codigo: " EQ-1 ", descricao: " esteira  travada ", fotos: [foto, foto, foto, foto] }, { codigo: "EQ-2", fotos: [foto] }])();
    expect(v.respostas[0].equipamentos).toEqual([{ codigo: "EQ-1", descricao: "esteira travada", fotos: [foto, foto, foto] }, { codigo: "EQ-2", descricao: "", fotos: [foto] }]);
    expect(v.respostas[0].conforme).toBe(false); // o comentário não é obrigatório: o registro dos equipamentos faz esse papel
    expect(v.nota).toBe(0);
    // em operação: não guarda lista nenhuma
    const ok = q.montarVisita({ unidade: "Asa Norte", data: "2026-11-19", respostas: [{ itemId: m.itens[0].id, conforme: true, equipamentos: [{ codigo: "X", fotos: [foto] }] }] }, m, {}, AGORA);
    expect(ok.respostas[0].equipamentos).toEqual([]);
    // as fotos dos equipamentos contam no teto da visita e são apagadas com ela
    const eq30 = Array.from({ length: 30 }, (_, i) => ({ codigo: `E${i}`, fotos: [foto, foto, foto] }));
    const m3 = q.normalizarModelo({ nome: "R3", itens: [{ texto: "Equipamentos?", tipo: "equipamentos" }, { texto: "A" }, { texto: "B" }] }, AGORA);
    const dez = Array.from({ length: 10 }, () => foto);
    expect(() => q.montarVisita({ unidade: "Asa Norte", data: "2026-11-19", respostas: [{ itemId: m3.itens[0].id, conforme: false, equipamentos: eq30 }, { itemId: m3.itens[1].id, conforme: true, fotos: dez }, { itemId: m3.itens[2].id, conforme: true, fotos: dez }] }, m3, {}, AGORA)).toThrow(/100 fotos/); // 90 + 10 + 10
  });

  it("item de vencimento: a pessoa informa só a data; em dia se for igual ou depois da visita; sem data = não se aplica", () => {
    const m = q.normalizarModelo({ nome: "R", itens: [{ texto: "Certificado PJ do CREF", tipo: "vencimento", peso: 3, foto: "nao_conforme" }, { texto: "Outro" }] }, AGORA);
    expect(m.itens[0].tipo).toBe("vencimento");
    const foto = "11111111-1111-1111-1111-111111111111";
    const visita = (vencimento: string | undefined, fotos: string[] = [], extra: any = {}) => q.montarVisita({ unidade: "Asa Norte", data: "2026-11-19", respostas: [{ itemId: m.itens[0].id, conforme: false, vencimento, fotos }, { itemId: m.itens[1].id, conforme: true }], ...extra }, m, {}, AGORA);
    // o servidor decide pela data, ignorando o "conforme" que veio
    expect(visita("2027-03-10").respostas[0]).toMatchObject({ conforme: true, vencimento: "2027-03-10", tipo: "vencimento" });
    expect(visita("2026-11-19").respostas[0].conforme).toBe(true); // vence no dia da visita: ainda em dia
    expect(() => visita("2026-11-18")).toThrow(/pede uma foto/); // vencido: pede foto (regra do item)
    const vencido = visita("2026-11-18", [foto]);
    expect(vencido.respostas[0]).toMatchObject({ conforme: false, comentario: "" }); // sem comentário obrigatório: a data explica
    expect(vencido.nota).toBe(25); // peso 3 reprovado, peso 1 aprovado
    // sem data (ou data inválida): não se aplica
    expect(visita(undefined).respostas[0].conforme).toBeNull();
    expect(visita("31/12/2026").respostas[0]).toMatchObject({ conforme: null, vencimento: "" });
    expect(visita("2026-11-19").respostas[1].vencimento).toBeUndefined();
  });

  it("o roteiro sugerido começa com o item de equipamentos parados", () => {
    expect(q.normalizarModelo(MODELO_SUGERIDO).itens[0]).toMatchObject({ tipo: "equipamentos", peso: 2, foto: "nao_conforme" });
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

  it("equipamentos parados: os da última visita de cada unidade, com 'desde' pelas visitas seguidas", () => {
    const eq = (codigos: string[], conforme = false) => [{ itemId: "e", grupo: "", texto: "Equipamentos", tipo: "equipamentos" as const, conforme, comentario: "", fotos: [], equipamentos: codigos.map((codigo) => ({ codigo, descricao: `${codigo} parado`, fotos: ["f"] })) }];
    const vs = [
      V({ id: "1", unidade: "A", data: "2026-09-01", mes: "2026-09", respostas: eq(["EQ-1"]) }),
      V({ id: "2", unidade: "A", data: "2026-10-01", mes: "2026-10", respostas: eq(["EQ-1", "EQ-2"]) }),
      V({ id: "3", unidade: "A", data: "2026-11-10", respostas: eq(["eq-1", "EQ-3"]) }),
      V({ id: "4", unidade: "B", data: "2026-11-05", respostas: eq([], true) }), // tudo em operação
      V({ id: "5", unidade: "C", data: "2026-11-01", respostas: [] }), // visita sem o item
    ];
    const p = equipamentosParados(vs, HOJE);
    expect(p.map((x) => [x.unidade, x.codigo, x.desde, x.visitas, x.dias])).toEqual([["A", "eq-1", "2026-09-01", 3, 80], ["A", "EQ-3", "2026-11-10", 1, 10]]);
    // o código que some da visita seguinte recomeça a contagem quando volta
    const volta = [V({ id: "1", unidade: "A", data: "2026-09-01", mes: "2026-09", respostas: eq(["EQ-1"]) }), V({ id: "2", unidade: "A", data: "2026-10-01", mes: "2026-10", respostas: eq(["EQ-9"]) }), V({ id: "3", unidade: "A", data: "2026-11-10", respostas: eq(["EQ-1"]) })];
    expect(equipamentosParados(volta, HOJE).map((x) => [x.codigo, x.desde, x.visitas])).toEqual([["EQ-1", "2026-11-10", 1]]);
  });

  it("certificado PJ do CREF: o vencimento da última visita de cada unidade, em ordem de urgência", () => {
    const venc = (vencimento: string) => [{ itemId: "c", grupo: "", texto: "Certificado", tipo: "vencimento" as const, conforme: null, comentario: "", fotos: [], vencimento }];
    const vs = [
      V({ id: "1", unidade: "A", data: "2026-09-01", mes: "2026-09", respostas: venc("2026-10-01") }), // antiga: vale a mais nova
      V({ id: "2", unidade: "A", data: "2026-11-10", respostas: venc("2027-05-01") }),
      V({ id: "3", unidade: "B", data: "2026-11-05", respostas: venc("2026-12-10") }),
      V({ id: "4", unidade: "C", data: "2026-11-05", respostas: venc("2026-11-01") }),
      V({ id: "5", unidade: "D", data: "2026-11-05", respostas: [] }),
    ];
    const l = certificadosPorUnidade(vs, ["A", "B", "C", "D", "E"], HOJE);
    expect(l.map((x) => [x.unidade, x.vencimento, x.dias, x.situacao])).toEqual([
      ["C", "2026-11-01", -19, "vencido"], ["B", "2026-12-10", 20, "a-vencer"], ["A", "2027-05-01", 162, "em-dia"], ["D", null, null, "sem-data"], ["E", null, null, "sem-data"],
    ]);
  });
});
