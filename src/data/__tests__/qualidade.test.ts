import { beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { definirArmazem, gravarBytes, lerBytes } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import * as q from "../../../server/qualidade.js";
import { DIAS_SEM_VISITA, MODELO_ABERTURA, avaliadoresDasVisitas, evolucaoDaNota, gruposDasVisitas, notaFiltrada, MODELO_SUGERIDO, PRAZO_DIAS, certificadosPorUnidade, equipamentosParados, itensDaUnidade, itensQueMaisFalham, resumoDaRede, resumoPorUnidade, rotinaDasUnidades, tomDaNota, type Visita } from "@/data/qualidade";

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

  it("como avaliar: instrução por item, com quebras de linha mantidas, espaços limpos e limite de 600 caracteres; os roteiros sugeridos já trazem a de cada item", () => {
    const m = q.normalizarModelo({ nome: "R", itens: [{ texto: "Piso", instrucao: "  Olhe o piso.  \r\n\r\n\r\n\r\nSem   lixo. " }, { texto: "Sem", instrucao: "   " }, { texto: "Longa", instrucao: "x".repeat(900) }] }, AGORA);
    expect(m.itens[0].instrucao).toBe("Olhe o piso.\n\nSem lixo.");
    expect("instrucao" in m.itens[1]).toBe(false);
    expect(m.itens[2].instrucao).toHaveLength(600);
    for (const modelo of [MODELO_SUGERIDO, MODELO_ABERTURA]) {
      const n = q.normalizarModelo(modelo);
      expect(n.itens.every((i: any) => typeof i.instrucao === "string" && i.instrucao.length > 20 && i.instrucao.length <= 600)).toBe(true);
    }
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
  const modelo = () => q.normalizarModelo({ nome: "Roteiro", plano: false, itens: [{ texto: "Piso", peso: 1, foto: "nao_conforme" }, { texto: "Banheiro", peso: 2, foto: "sempre" }, { texto: "Sala", peso: 1 }] }, AGORA);
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

  it("itens por unidade: o que não vale para a unidade não é perguntado nem conta na nota; unidade nova já recebe tudo", () => {
    const m = q.normalizarModelo({ nome: "R", itens: [{ texto: "Piso", foraDe: [] }, { texto: "Área de lutas", foraDe: ["Gama", "Gama", "Inventada"] }, { texto: "Sala" }] }, AGORA);
    expect(m.itens[0].foraDe).toBeUndefined();
    expect(m.itens[1].foraDe).toEqual(["Gama"]); // sem repetição e só unidades da rede
    const ids = m.itens.map((i: any) => i.id);
    const todas = (u: string) => q.montarVisita({ unidade: u, data: "2026-11-19", respostas: ids.map((id: string) => ({ itemId: id, conforme: id === ids[1] ? false : true, comentario: "x" })) }, m, {}, AGORA);
    // Asa Norte tem a área de lutas (reprovada): 2 de 3
    expect(todas("Asa Norte").respostas.map((r: any) => r.itemId)).toEqual(ids);
    expect(todas("Asa Norte").nota).toBe(66.7);
    // Gama não tem: o item sai da visita e da nota, mesmo que a tela mande a resposta
    const g = todas("Gama");
    expect(g.respostas.map((r: any) => r.itemId)).toEqual([ids[0], ids[2]]);
    expect(g.nota).toBe(100);
    // se nenhum item vale para a unidade, não há visita
    const so = q.normalizarModelo({ nome: "S", itens: [{ texto: "Só em Gama", foraDe: ["Asa Norte"] }] }, AGORA);
    expect(() => q.montarVisita({ unidade: "Asa Norte", data: "2026-11-19", respostas: [{ itemId: so.itens[0].id, conforme: true }] }, so, {}, AGORA)).toThrow(/Nenhum item/);
    expect(itensDaUnidade(m.itens, "Gama").map((i) => i.texto)).toEqual(["Piso", "Sala"]);
    expect(itensDaUnidade(m.itens, "Itapoã")).toHaveLength(3);
  });

  it("o checklist de abertura sugerido: diário, 10 itens, equipamentos parados primeiro e sem CREF", () => {
    const m = q.normalizarModelo(MODELO_ABERTURA);
    expect(m.frequencia).toBe("diaria");
    expect(m.itens).toHaveLength(10);
    expect(m.itens[0]).toMatchObject({ tipo: "equipamentos", peso: 2 });
    expect(m.itens.some((i: any) => /CREF/.test(i.texto))).toBe(false);
  });

  it("o roteiro sugerido começa com o item de equipamentos parados", () => {
    expect(q.normalizarModelo(MODELO_SUGERIDO).itens[0]).toMatchObject({ tipo: "equipamentos", peso: 2, foto: "nao_conforme" });
  });

  // check-in feito 30 minutos antes de AGORA (15h00 UTC = 12h00 em Brasília), no Gama de verdade: perto do ponto marcado como o local da unidade
  const ANTES = new Date("2026-11-20T14:30:00Z");
  const autorV = { nome: "Ana", email: "a@x.com" };
  const checkin = (m: any, tipo: "visita" | "unidade", o: any = {}) => q.criarCheckin({ unidade: o.unidade ?? "Asa Norte", modeloId: m.id, loc: o.loc, selfie: o.selfie === null ? undefined : JPEG }, { autor: o.autor ?? autorV, tipo, ip: o.ip ?? "200.1.1.1", unidadesPermitidas: [o.unidade ?? "Asa Norte"] }, o.agora ?? ANTES);

  it("visita da franqueadora: exige check-in com selfie; a data é a do check-in (ninguém escolhe); o check-out é automático; sem assinatura", async () => {
    const m = await q.salvarModelo({ nome: "Roteiro", itens: [{ texto: "Sala", foto: "sempre" }] });
    const fotoId = await q.salvarFoto(JPEG);
    const corpo = (ck: any, extra: any = {}) => ({ modeloId: m.id, unidade, data: "2020-01-01", checkinId: ck?.id, respostas: [{ itemId: m.itens[0].id, conforme: true, fotos: [fotoId] }], ...extra });
    // sem check-in não grava
    await expect(q.salvarVisita(corpo(null), autorV, AGORA)).rejects.toThrow(/check-in/);
    // a visita pede selfie no check-in (padrão da visita da franqueadora); pequena e em JPEG
    await expect(checkin(m, "visita", { selfie: null })).rejects.toThrow(/selfie/);
    await expect(q.criarCheckin({ unidade, modeloId: m.id, selfie: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(200 * 1024)]).toString("base64") }, { autor: autorV, tipo: "visita", ip: "1.1.1.1", unidadesPermitidas: [unidade] }, ANTES)).rejects.toThrow(/grande/);
    const ck = await checkin(m, "visita", { loc: { lat: -15.8, lng: -47.9, precisao: 15 } });
    expect(ck).toMatchObject({ comLocalizacao: true, comSelfie: true });
    const v = await q.salvarVisita(corpo(ck, { localizacaoSaida: { lat: -15.8001, lng: -47.9001, precisao: 20 } }), autorV, AGORA, { ip: "200.1.1.2" });
    // a data enviada (2020) é ignorada: vale a do check-in
    expect(v).toMatchObject({ data: "2026-11-20", mes: "2026-11", chegada: "11:30", saida: "12:00", duracaoMin: 30 });
    expect(v.assinatura).toBeUndefined();
    expect(v.checkin).toMatchObject({ em: ANTES.toISOString(), ip: "200.1.1.1", loc: { lat: -15.8, lng: -47.9 }, selfie: expect.stringMatching(/^2026-11_[0-9a-f-]{36}$/) });
    expect(v.checkout).toMatchObject({ em: AGORA.toISOString(), ip: "200.1.1.2", loc: { lat: -15.8001, lng: -47.9001 } });
    expect((await q.lerSelfie(v.checkin.selfie)).length).toBeGreaterThan(10);
    await expect(q.lerSelfie("../x")).rejects.toThrow(/inválida/);
    // o check-in vale uma vez
    await expect(q.salvarVisita(corpo(ck), autorV, AGORA)).rejects.toThrow(/já foi usado/);
    expect((await q.visitasRecentes(12, AGORA)).map((x: any) => x.id)).toEqual([v.id]);
    expect((await q.lerFoto(fotoId)).length).toBeGreaterThan(10);
    await q.apagarVisita(v.id, v.mes);
    expect(await q.visitasRecentes(12, AGORA)).toEqual([]);
    await expect(q.lerFoto(fotoId)).rejects.toThrow(/não encontrada/);
    await expect(q.salvarVisita({ modeloId: "x", unidade, respostas: [] }, {}, AGORA)).rejects.toThrow(/não existe/);
  });

  it("selfie: o dono escolhe por checklist (a da unidade não pede por padrão) e as selfies passam do prazo de 3 meses e são apagadas", async () => {
    const visita = await q.salvarModelo({ nome: "Roteiro", frequencia: "visita", itens: [{ texto: "a" }] });
    const abertura = await q.salvarModelo({ nome: "Abertura", frequencia: "diaria", itens: [{ texto: "a" }] });
    const comSelfie = await q.salvarModelo({ nome: "Abertura com selfie", frequencia: "diaria", selfie: true, itens: [{ texto: "a" }] });
    const semSelfie = await q.salvarModelo({ nome: "Visita sem selfie", frequencia: "visita", selfie: false, itens: [{ texto: "a" }] });
    expect([visita, abertura, comSelfie, semSelfie].map((m: any) => q.pedeSelfie(m))).toEqual([true, false, true, false]);
    const ckAbertura = await checkin(abertura, "unidade", { selfie: null }); // a abertura não pede: sem selfie passa
    expect(ckAbertura).toMatchObject({ comSelfie: false });
    await expect(checkin(comSelfie, "unidade", { selfie: null })).rejects.toThrow(/selfie/);
    expect((await checkin(semSelfie, "visita", { selfie: null })).comSelfie).toBe(false);
    // retenção: mês atual e os 3 anteriores ficam; de 4 meses para trás é apagado a cada novo check-in
    await gravarBytes("qualidade/selfies/2026-07/velha.jpg", Buffer.from("x")); // 4 meses antes de novembro: fora do prazo
    await gravarBytes("qualidade/selfies/2026-03/mais-velha.jpg", Buffer.from("x"));
    await gravarBytes("qualidade/selfies/2026-08/dentro.jpg", Buffer.from("x")); // 3 meses antes: ainda dentro
    await checkin(visita, "visita");
    expect(await lerBytes("qualidade/selfies/2026-07/velha.jpg")).toBeNull();
    expect(await lerBytes("qualidade/selfies/2026-08/dentro.jpg")).not.toBeNull();
  });

  it("check-in: só da própria pessoa, unidade e checklist, até 12 horas depois, e a localização é conferida com o local marcado da unidade", async () => {
    const m = await q.salvarModelo({ nome: "Roteiro", itens: [{ texto: "Sala" }] });
    const outro = await q.salvarModelo({ nome: "Outro", itens: [{ texto: "Piso" }] });
    const resp = [{ itemId: m.itens[0].id, conforme: true }];
    const base = { modeloId: m.id, unidade, respostas: resp };
    const ck = await checkin(m, "visita");
    await expect(q.salvarVisita({ ...base, checkinId: ck.id }, { nome: "Outra", email: "outra@x.com" }, AGORA)).rejects.toThrow(/outra pessoa/);
    await expect(q.salvarVisita({ ...base, modeloId: outro.id, checkinId: ck.id }, autorV, AGORA)).rejects.toThrow(/outro checklist/);
    await expect(q.salvarVisita({ ...base, unidade: "Gama", checkinId: ck.id }, autorV, AGORA)).rejects.toThrow(/outro checklist ou de outra pessoa/);
    await expect(q.salvarVisita({ ...base, checkinId: ck.id }, autorV, new Date(ANTES.getTime() + 13 * 3600 * 1000))).rejects.toThrow(/venceu/);
    // local marcado da unidade: perto = na unidade; longe = fora do local; sem localização = só o IP
    await q.salvarLocal("Asa Norte", { lat: -15.7801, lng: -47.8999, raio: 300 });
    const perto = await checkin(m, "visita", { loc: { lat: -15.7803, lng: -47.9, precisao: 10 } });
    expect(perto).toMatchObject({ comLocalizacao: true, foraDoLocal: false });
    expect(perto.distanciaM).toBeLessThan(60);
    const longe = await checkin(m, "visita", { loc: { lat: -15.85, lng: -47.95, precisao: 10 } });
    expect(longe).toMatchObject({ foraDoLocal: true });
    expect(longe.distanciaM).toBeGreaterThan(5000);
    const sem = await checkin(m, "visita");
    expect(sem).toMatchObject({ comLocalizacao: false });
    expect(sem.foraDoLocal).toBeUndefined(); // sem localização não dá para dizer: só o horário e o IP
    // precisão ruim (200 m) perdoa quem está na beira do raio; coordenadas inválidas viram "sem localização"
    expect(q.normalizarLocalizacao({ lat: 99, lng: 0 })).toBeNull();
    expect(q.normalizarLocalizacao({ lat: "x", lng: 0 })).toBeNull();
    expect(q.normalizarLocalizacao({ lat: -15.1234567, lng: -47.7654321, precisao: 12.4 })).toEqual({ lat: -15.123457, lng: -47.765432, precisao: 12 });
    await expect(q.salvarLocal("Inventada", { lat: 1, lng: 1 })).rejects.toThrow(/Unidade inválida/);
    await expect(q.salvarLocal("Gama", { lat: 200, lng: 1 })).rejects.toThrow(/Coordenadas/);
    expect(q.distanciaM({ lat: -15.78, lng: -47.9 }, { lat: -15.78, lng: -47.9 })).toBe(0);
    await q.apagarLocal("Asa Norte");
    expect(await q.lerLocais()).toEqual({});
  });

  it("envio da unidade: check-in e check-out, sem assinatura; só o checklist que a unidade preenche, só a própria unidade, sempre com a data do check-in; fica à parte das visitas", async () => {
    const abertura = await q.salvarModelo({ nome: "Abertura", frequencia: "diaria", itens: [{ texto: "Recepção limpa" }] });
    const roteiro = await q.salvarModelo({ nome: "Roteiro", frequencia: "visita", itens: [{ texto: "Piso" }] });
    const autor = { nome: "Gerente", email: "g@x.com" };
    const resp = (m: any) => [{ itemId: m.itens[0].id, conforme: true }];
    const ck = (m: any, o: any = {}) => checkin(m, "unidade", { autor, ...o });
    const c1 = await ck(abertura);
    const e = await q.salvarEnvio({ modeloId: abertura.id, unidade: "Asa Norte", data: "2020-01-01", chegada: "08:00", checkinId: c1.id, respostas: resp(abertura) }, autor, ["Asa Norte"], AGORA, { ip: "187.0.0.9" });
    expect(e).toMatchObject({ origem: "unidade", unidade: "Asa Norte", data: "2026-11-20", chegada: "11:30", saida: "12:00", duracaoMin: 30, avaliador: { nome: "Gerente" } }); // a data e a hora enviadas são ignoradas
    expect(e.assinatura).toBeUndefined(); // o gestor da própria unidade não assina
    expect(e.checkin).toMatchObject({ ip: "200.1.1.1" });
    expect(e.checkout).toMatchObject({ ip: "187.0.0.9" });
    // sem check-in não envia
    await expect(q.salvarEnvio({ modeloId: abertura.id, unidade: "Asa Norte", respostas: resp(abertura) }, autor, ["Asa Norte"], AGORA)).rejects.toThrow(/check-in/);
    // regras: só a própria unidade e só checklist que a unidade preenche (já no check-in)
    await expect(q.criarCheckin({ unidade: "Gama", modeloId: abertura.id }, { autor, tipo: "unidade", ip: "1.1.1.1", unidadesPermitidas: ["Asa Norte"] }, AGORA)).rejects.toThrow(/sua unidade/);
    await expect(q.criarCheckin({ unidade: "Asa Norte", modeloId: roteiro.id }, { autor, tipo: "unidade", ip: "1.1.1.1", unidadesPermitidas: ["Asa Norte"] }, AGORA)).rejects.toThrow(/não está disponível/);
    expect((await q.enviosRecentes(30, AGORA)).map((x: any) => x.id)).toEqual([e.id]);
    expect((await q.enviosRecentes(30, AGORA, ["Gama"]))).toEqual([]);
    expect(await q.visitasRecentes(12, AGORA)).toEqual([]); // envio não é visita: fora da nota e do ranking
    expect(q.modelosDaUnidade(await q.lerModelos()).map((m: any) => m.nome)).toEqual(["Abertura"]);
    // limite por dia e apagar
    for (let i = 0; i < 4; i += 1) await q.salvarEnvio({ modeloId: abertura.id, unidade: "Asa Norte", checkinId: (await ck(abertura)).id, respostas: resp(abertura) }, autor, ["Asa Norte"], AGORA);
    await expect(q.salvarEnvio({ modeloId: abertura.id, unidade: "Asa Norte", checkinId: (await ck(abertura)).id, respostas: resp(abertura) }, autor, ["Asa Norte"], AGORA)).rejects.toThrow(/5 envios por dia/);
    await q.apagarEnvio(e.id, e.mes);
    expect((await q.enviosRecentes(30, AGORA)).length).toBe(4);
    // a unidade só enxerga a foto do próprio envio
    const foto = await q.salvarFoto(JPEG);
    const m2 = await q.salvarModelo({ nome: "Com foto", frequencia: "semanal", itens: [{ texto: "X", foto: "sempre" }] });
    await q.salvarEnvio({ modeloId: m2.id, unidade: "Asa Norte", checkinId: (await ck(m2)).id, respostas: [{ itemId: m2.itens[0].id, conforme: true, fotos: [foto] }] }, autor, ["Asa Norte"], AGORA);
    expect(await q.fotoDeEnvioDe(foto, ["Asa Norte"], AGORA)).toBe(true);
    expect(await q.fotoDeEnvioDe(foto, ["Gama"], AGORA)).toBe(false);
  });

  it("plano de ação: a visita pede um por item não conforme; a unidade marca como feito; quem criou confirma ou devolve (o dono também); o gerente não valida o próprio", async () => {
    const m = await q.salvarModelo({ nome: "Roteiro", itens: [{ texto: "Banheiro feminino" }, { texto: "Recepção" }] }); // visita: o plano é exigido por padrão
    expect(q.exigePlano(m)).toBe(true);
    expect(q.exigePlano({ frequencia: "diaria" })).toBe(false);
    expect(q.exigePlano({ frequencia: "diaria", plano: true })).toBe(true);
    const hoje = "2026-11-20";
    const respostas = [{ itemId: m.itens[0].id, conforme: false }, { itemId: m.itens[1].id, conforme: true }];
    const corpo = async (planos: any[], extra: any = {}) => ({ modeloId: m.id, unidade, checkinId: (await checkin(m, "visita")).id, respostas, planos, ...extra });
    const plano = { itemId: m.itens[0].id, oQue: "Repor o sabonete e consertar a descarga", prazo: "2026-11-25", responsavel: "Gerente da unidade" };
    // regras: todo item não conforme precisa do plano; o plano precisa de texto e de um prazo válido; só item não conforme tem plano
    await expect(q.salvarVisita(await corpo([]), autorV, AGORA)).rejects.toThrow(/Crie o plano de ação do item não conforme: "Banheiro feminino"/);
    await expect(q.salvarVisita(await corpo([{ ...plano, oQue: "x" }]), autorV, AGORA)).rejects.toThrow(/o que será feito/);
    await expect(q.salvarVisita(await corpo([{ ...plano, prazo: "2026-11-19" }]), autorV, AGORA)).rejects.toThrow(/prazo/);
    await expect(q.salvarVisita(await corpo([{ ...plano, prazo: "2028-01-01" }]), autorV, AGORA)).rejects.toThrow(/prazo/);
    await expect(q.salvarVisita(await corpo([plano, { itemId: m.itens[1].id, oQue: "Sem motivo", prazo: "2026-11-25" }]), autorV, AGORA)).rejects.toThrow(/Só item marcado como não conforme/);
    const v = await q.salvarVisita(await corpo([plano]), autorV, AGORA);
    expect(v.respostas[0].conforme).toBe(false);
    const [p] = await q.lerPlanos();
    expect(p).toMatchObject({ unidade, visitaId: v.id, itemTexto: "Banheiro feminino", oQue: plano.oQue, prazo: "2026-11-25", responsavel: "Gerente da unidade", status: "aberto", criadoPor: { email: "a@x.com" } });
    expect(p.historico.map((h: any) => h.acao)).toEqual(["criado"]);

    // a unidade marca como feito (só a própria unidade; precisa dizer o quê); vai para a validação de quem criou
    const gerente = { nome: "Gerente", email: "g@x.com" };
    await expect(q.marcarPlanoFeito(p.id, { texto: "ok" }, gerente, ["Asa Norte"], AGORA)).rejects.toThrow(/o que foi feito/);
    await expect(q.marcarPlanoFeito(p.id, { texto: "Repus e consertei" }, gerente, ["Gama"], AGORA)).rejects.toThrow(/outra unidade/);
    const foto = await q.salvarFoto(JPEG);
    const feito = await q.marcarPlanoFeito(p.id, { texto: "Repus o sabonete e consertei a descarga", fotos: [foto, "lixo"] }, gerente, ["Asa Norte"], AGORA);
    expect(feito).toMatchObject({ status: "validacao" });
    expect(feito.historico[1]).toMatchObject({ acao: "feito", fotos: [foto], por: { nome: "Gerente" } });
    await expect(q.marcarPlanoFeito(p.id, { texto: "de novo" }, gerente, ["Asa Norte"], AGORA)).rejects.toThrow(/não está esperando a correção/);
    expect(await q.fotoDeEnvioDe(foto, ["Asa Norte"], AGORA)).toBe(true); // a unidade vê a própria foto do plano
    expect(await q.fotoDeEnvioDe(foto, ["Gama"], AGORA)).toBe(false);

    // validação: quem criou (ou o dono); o gerente e outra pessoa, não
    await expect(q.validarPlano(p.id, { decisao: "confirmar" }, { ...gerente, ehDono: false }, AGORA)).rejects.toThrow(/quem criou o plano/);
    await expect(q.validarPlano(p.id, { decisao: "confirmar" }, { nome: "Outra", email: "outra@x.com", ehDono: false }, AGORA)).rejects.toThrow(/quem criou o plano/);
    await expect(q.validarPlano(p.id, { decisao: "devolver" }, autorV, AGORA)).rejects.toThrow(/o que ainda falta/);
    await expect(q.validarPlano(p.id, { decisao: "talvez" }, autorV, AGORA)).rejects.toThrow(/confirmar ou devolver/);
    const devolvido = await q.validarPlano(p.id, { decisao: "devolver", texto: "A descarga ainda vaza" }, autorV, AGORA);
    expect(devolvido).toMatchObject({ status: "aberto" });
    expect(devolvido.historico.map((h: any) => h.acao)).toEqual(["criado", "feito", "devolvido"]);
    await q.marcarPlanoFeito(p.id, { texto: "Troquei o reparo da descarga" }, gerente, ["Asa Norte"], AGORA);
    const ok = await q.validarPlano(p.id, { decisao: "confirmar", texto: "Conferi, está certo" }, { nome: "Dono", email: "dono@x.com", ehDono: true }, AGORA); // o dono também confirma
    expect(ok).toMatchObject({ status: "concluido", concluidoEm: AGORA.toISOString() });
    await expect(q.validarPlano(p.id, { decisao: "confirmar" }, autorV, AGORA)).rejects.toThrow(/não está esperando validação/);
    await expect(q.marcarPlanoFeito("nao-existe", { texto: "abc" }, gerente, ["Asa Norte"], AGORA)).rejects.toThrow(/não encontrado/);
  });

  it("plano de ação: checklist com plano desligado não pede e volta a exigir o comentário do que corrigir", async () => {
    const m = await q.salvarModelo({ nome: "Sem plano", plano: false, itens: [{ texto: "Piso" }] });
    const corpo = async (extra: any) => ({ modeloId: m.id, unidade, checkinId: (await checkin(m, "visita")).id, respostas: [{ itemId: m.itens[0].id, conforme: false, ...extra }] });
    await expect(q.salvarVisita(await corpo({}), autorV, AGORA)).rejects.toThrow(/o que precisa ser corrigido/);
    await q.salvarVisita(await corpo({ comentario: "piso sujo" }), autorV, AGORA);
    expect(await q.lerPlanos()).toEqual([]);
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

  it("rotina das unidades: último envio, atraso pelo prazo da frequência (diária 1, semanal 7, mensal 31) e atrasadas primeiro", () => {
    const modelo = (id: string, frequencia: any, ativo = true) => ({ id, nome: `Checklist ${id}`, descricao: "", frequencia, ativo, itens: [], atualizadoEm: "" });
    const envio = (unidade: string, modeloId: string, data: string, falha = false) => V({ id: `${unidade}${modeloId}${data}`, unidade, modeloId, modeloNome: `Checklist ${modeloId}`, data, mes: data.slice(0, 7), origem: "unidade", criadoEm: `${data}T10:00:00Z`, respostas: falha ? [{ itemId: "a", grupo: "", texto: "Piso", conforme: false, comentario: "x", fotos: [] }] : [] });
    const modelos = [modelo("d", "diaria"), modelo("v", "visita"), modelo("s", "semanal", false)];
    const soEmA = { ...modelo("x", "diaria"), itens: [{ id: "i", grupo: "", texto: "t", peso: 1, foto: "nenhuma" as const, foraDe: ["B", "C", "D"] }] };
    expect(rotinaDasUnidades([], [soEmA], ["A", "B"], HOJE).map((x) => x.unidade)).toEqual(["A"]); // nenhum item vale para B: não é cobrada
    const envios = [envio("A", "d", "2026-11-20"), envio("A", "d", "2026-11-18"), envio("B", "d", "2026-11-19", true), envio("C", "d", "2026-11-10")];
    const l = rotinaDasUnidades(envios, modelos, ["A", "B", "C", "D"], HOJE);
    expect(l.map((x) => [x.unidade, x.situacao, x.dias, x.naoConformes])).toEqual([["C", "atrasado", 10, 0], ["D", "nunca", null, 0], ["B", "em-dia", 1, 1], ["A", "em-dia", 0, 0]]);
    expect(l.every((x) => x.modeloId === "d")).toBe(true); // visita e fora de uso não entram
    expect(PRAZO_DIAS).toEqual({ visita: 0, diaria: 1, semanal: 7, mensal: 31 });
  });

  it("itens só de uma unidade (soEm): valem só nela; sem a marca valem para todas", () => {
    const m = q.normalizarModelo({ nome: "R", itens: [{ texto: "Piso" }, { texto: "Piscina", soEm: ["Gama", "Inventada", "Gama"] }] }, AGORA);
    expect(m.itens[1].soEm).toEqual(["Gama"]);
    expect(m.itens[0].soEm).toBeUndefined();
    expect(itensDaUnidade(m.itens, "Gama").map((i) => i.texto)).toEqual(["Piso", "Piscina"]);
    expect(itensDaUnidade(m.itens, "Asa Norte").map((i) => i.texto)).toEqual(["Piso"]);
    const v = q.montarVisita({ unidade: "Asa Norte", data: "2026-11-19", respostas: m.itens.map((i: any) => ({ itemId: i.id, conforme: true })) }, m, {}, AGORA);
    expect(v.respostas.map((r: any) => r.texto)).toEqual(["Piso"]); // a piscina não é perguntada fora do Gama
  });
});

describe("filtros por grupo e evolução da nota", () => {
  const respostas = [
    { itemId: "a", grupo: "Limpeza", texto: "x", peso: 3, conforme: true },
    { itemId: "b", grupo: "Limpeza", texto: "y", peso: 1, conforme: false },
    { itemId: "c", grupo: "Equipe", texto: "z", peso: 2, conforme: false },
    { itemId: "d", grupo: "Equipe", texto: "w", peso: 2, conforme: null },
  ];
  it("nota por grupo usa os pesos e ignora o que não foi respondido", () => {
    expect(q.notasPorGrupo(respostas)).toEqual({ Limpeza: 75, Equipe: 0 });
  });
  it("a visita sem peso (outros níveis) ainda leva a nota do grupo, sem expor o peso", () => {
    const v = q.semPesosNaVisita({ id: "1", respostas });
    expect(v.notasPorGrupo).toEqual({ Limpeza: 75, Equipe: 0 });
    expect(v.respostas.every((r: any) => !("peso" in r))).toBe(true);
  });
  const vis = (mes: string, nota: number | null, nome: string, g: Record<string, number | null> = {}) => ({ mes, nota, avaliador: { nome, email: "" }, notasPorGrupo: g }) as unknown as Visita;
  it("evolução mensal faz a média por mês, em ordem, e usa o grupo quando escolhido", () => {
    const vs = [vis("2026-10", 80, "Ana", { Limpeza: 60 }), vis("2026-09", 70, "Bia", { Limpeza: 90 }), vis("2026-10", 90, "Ana", { Limpeza: null }), vis("2026-11", null, "Ana")];
    expect(evolucaoDaNota(vs)).toEqual([{ mes: "2026-09", nota: 70, visitas: 1 }, { mes: "2026-10", nota: 85, visitas: 2 }]);
    expect(evolucaoDaNota(vs, "Limpeza")).toEqual([{ mes: "2026-09", nota: 90, visitas: 1 }, { mes: "2026-10", nota: 60, visitas: 1 }]);
    expect(notaFiltrada(vs[0], "Equipe")).toBeNull();
    expect(avaliadoresDasVisitas(vs)).toEqual(["Ana", "Bia"]);
    expect(gruposDasVisitas(vs)).toEqual(["Limpeza"]);
  });
});
