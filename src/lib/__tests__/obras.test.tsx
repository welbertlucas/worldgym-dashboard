import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { TarefasLista } from "@/components/obras/TarefasObra";
import { ObrasLista } from "@/components/tabs/ObrasTab";
// @ts-expect-error módulo JS do servidor
import * as S from "../../../server/obras.js";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
import { MARCOS_PADRAO, diasDeAtraso, filtrarFases, fimPelaDuracao, inauguracao, obraNova, ordenar, progresso, progressoTarefas, proximoMarco, resumoDasObras, situacao, situacaoTarefa, tarefasAtrasadas, type Fase, type Obra } from "@/lib/obras";

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
      async apagar(c: string) { mem.delete(c); },
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
  it("o Master cadastra e muda, mas não apaga; quem tem acesso a unidades não muda nada", async () => {
    const unidade = { papel: "unidades", nome: "Unidade Teste" };
    await expect(S.salvarObra(unidade, valida())).rejects.toMatchObject({ status: 403 });
    await S.salvarObra(master, valida());
    expect((await S.lerObras()).map((o: { id: string }) => o.id)).toEqual(["obra1"]);
    await expect(S.apagarObra(master, "obra1")).rejects.toMatchObject({ status: 403 });
    await expect(S.apagarObra(unidade, "obra1")).rejects.toMatchObject({ status: 403 });
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

describe("tarefas na tela", () => {
  const t = (id: string, extra: Partial<Fase["tarefas"][number]> = {}) => ({ id, nome: `Tarefa ${id}`, dias: 5, resp: "", inicio: null, fim: null, feito: null, ...extra });
  it("o fim sai do início + duração, contando o dia do início", () => {
    expect(fimPelaDuracao("2026-11-27", 5)).toBe("2026-12-01");
    expect(fimPelaDuracao("2026-12-30", 3)).toBe("2027-01-01");
    expect(fimPelaDuracao(null, 5)).toBeNull();
  });
  it("situação: concluída pela data de conclusão, atrasada pelo fim, em andamento pelo início", () => {
    expect(situacaoTarefa(t("a", { fim: "2026-11-01", feito: "2026-11-02" }), HOJE)).toBe("feita");
    expect(situacaoTarefa(t("b", { inicio: "2026-11-01", fim: "2026-11-20" }), HOJE)).toBe("atrasada");
    expect(situacaoTarefa(t("c", { inicio: "2026-11-20", fim: "2026-12-20" }), HOJE)).toBe("andamento");
    expect(situacaoTarefa(t("d"), HOJE)).toBe("a-fazer");
  });
  it("filtro de pendentes, atrasadas e busca", () => {
    const fases: Fase[] = [
      { id: "f1", nome: "Fase Alfa", marco: null, tarefas: [t("1", { feito: "2026-11-01" }), t("2", { fim: "2026-11-10", resp: "Pessoa Exemplo" })] },
      { id: "f2", nome: "Fase Beta", marco: null, tarefas: [t("3")] },
    ];
    expect(filtrarFases(fases, "pendentes", "", HOJE).flatMap((f) => f.tarefas.map((x) => x.id))).toEqual(["2", "3"]);
    expect(filtrarFases(fases, "atrasadas", "", HOJE).map((f) => f.id)).toEqual(["f1"]);
    expect(filtrarFases(fases, "todas", "pessoa", HOJE).flatMap((f) => f.tarefas.map((x) => x.id))).toEqual(["2"]);
  });
  it("resumo da obra: progresso e atrasadas pelo fim das pendentes", () => {
    const r = { modelo: null, total: 4, concluidas: 1, fimPendente: { "2026-11-10": 2, "2026-12-01": 1 } };
    expect(progressoTarefas(r)).toBe(25);
    expect(tarefasAtrasadas(r, HOJE)).toBe(2);
    expect(progressoTarefas(undefined)).toBeNull();
  });
});

describe("servidor: modelos, fases e tarefas", () => {
  let mem: Map<string, unknown>;
  beforeEach(() => {
    mem = new Map();
    definirArmazem({
      async ler(c: string) { return mem.has(c) ? JSON.parse(JSON.stringify(mem.get(c))) : null; },
      async gravar(c: string, d: unknown) { mem.set(c, JSON.parse(JSON.stringify(d))); },
      async apagar(c: string) { mem.delete(c); },
    });
  });
  afterEach(() => definirArmazem(null));
  const dono = { papel: "dono", nome: "Dono Teste" };
  const master = { papel: "master", nome: "Master Teste" };
  const unidade = { papel: "unidades", nome: "Unidade Teste" };
  // Modelo INVENTADO (fases e tarefas fictícias).
  const MODELOS = [{ id: "pro", nome: "Modelo Exemplo", fases: [
    { nome: "Fase Um", marco: "Iniciação", tarefas: [{ nome: "Tarefa A", dias: 5, extra: "some" }, { nome: "Tarefa B", dias: 10 }] },
    { nome: "Fase Dois", marco: "Outro", tarefas: [{ nome: "Tarefa C", dias: 3 }] },
  ] }];
  const criar = () => S.salvarObra(dono, { ...obraNova(), id: "obra1", nome: "Unidade Exemplo", modelo: "pro" });

  it("a obra guarda os quatro modelos de unidade; o que não conhece vira Low Cost", async () => {
    for (const m of ["low", "prime", "pro", "pro-recovery"]) expect((await S.salvarObra(dono, { ...obraNova(), id: "o" + m.replace("-", ""), nome: "X", modelo: m })).modelo).toBe(m);
    expect((await S.salvarObra(dono, { ...obraNova(), id: "ox", nome: "X", modelo: "outro" })).modelo).toBe("low");
  });
  it("modelos: guarda só nome, marco da fase e nome e duração das tarefas; recusa id desconhecido", async () => {
    await S.gravarModelos(MODELOS);
    const [m] = await S.lerModelos();
    expect(m.fases[0].tarefas[0]).toEqual({ nome: "Tarefa A", dias: 5 });
    expect(m.fases[1].marco).toBeNull();
    expect(S.resumoDosModelos([m])).toEqual([{ id: "pro", nome: "Modelo Exemplo", fases: 2, tarefas: 3 }]);
    expect(() => S.limparModelos([{ ...MODELOS[0], id: "outro" }])).toThrow();
  });
  it("aplicar o modelo copia fases e tarefas sem datas; só uma vez; só dono e Master", async () => {
    await S.gravarModelos(MODELOS);
    await criar();
    await expect(S.aplicarModelo(unidade, "obra1", "pro")).rejects.toMatchObject({ status: 403 });
    const r = await S.aplicarModelo(master, "obra1", "pro", { agora: new Date("2026-11-26T10:00:00Z") });
    expect(r.fases.map((f: Fase) => f.nome)).toEqual(["Fase Um", "Fase Dois"]);
    expect(r.fases[0].tarefas[0]).toMatchObject({ nome: "Tarefa A", dias: 5, resp: "", inicio: null, fim: null, feito: null });
    expect((await S.lerObras())[0].tarefas).toEqual({ modelo: "pro", total: 3, concluidas: 0, fimPendente: {} });
    await expect(S.aplicarModelo(dono, "obra1", "pro")).rejects.toMatchObject({ status: 409 });
    await expect(S.lerTarefas(unidade, "obra1")).rejects.toMatchObject({ status: 403 });
    expect((await S.lerTarefas(master, "obra1")).fases).toHaveLength(2);
    await expect(S.aplicarModelo(dono, "obra1", "nenhum")).rejects.toMatchObject({ status: 409 });
  });
  it("tarefa: o fim sai do início + duração; concluir e apagar atualizam o resumo da obra", async () => {
    await S.gravarModelos(MODELOS);
    await criar();
    const { fases } = await S.aplicarModelo(dono, "obra1", "pro");
    const [f1] = fases, [ta, tb] = f1.tarefas;
    let r = await S.salvarTarefa(master, { obraId: "obra1", faseId: f1.id, tarefa: { ...ta, inicio: "2026-11-27", fim: null } });
    expect(r.fases[0].tarefas[0].fim).toBe("2026-12-01");
    r = await S.salvarTarefa(master, { obraId: "obra1", faseId: f1.id, tarefa: { ...tb, inicio: "2026-11-01", fim: "2026-11-05", resp: "Pessoa Exemplo" } });
    expect(r.resumo.fimPendente).toEqual({ "2026-12-01": 1, "2026-11-05": 1 });
    r = await S.salvarTarefa(master, { obraId: "obra1", faseId: f1.id, tarefa: { ...r.fases[0].tarefas[1], feito: "2026-11-06" } });
    expect(r.resumo).toMatchObject({ total: 3, concluidas: 1, fimPendente: { "2026-12-01": 1 } });
    await expect(S.salvarTarefa(master, { obraId: "obra1", faseId: f1.id, tarefa: { ...ta, inicio: "2026-12-10", fim: "2026-12-01" } })).rejects.toMatchObject({ status: 400 });
    await expect(S.salvarTarefa(master, { obraId: "obra1", faseId: f1.id, tarefa: { ...ta, dias: 0 } })).rejects.toMatchObject({ status: 400 });
    r = await S.salvarTarefa(master, { obraId: "obra1", faseId: f1.id, tarefa: { nome: "Tarefa nova", dias: 2 } });
    expect(r.fases[0].tarefas).toHaveLength(3);
    r = await S.apagarTarefa(master, { obraId: "obra1", faseId: f1.id, tarefaId: ta.id });
    expect(r.resumo.total).toBe(3);
    await expect(S.apagarTarefa(master, { obraId: "obra1", faseId: f1.id, tarefaId: ta.id })).rejects.toMatchObject({ status: 404 });
    await expect(S.salvarTarefa(unidade, { obraId: "obra1", faseId: f1.id, tarefa: { nome: "X" } })).rejects.toMatchObject({ status: 403 });
  });
  it("fases: cria, renomeia e apaga; salvar a obra não perde o resumo; apagar a obra apaga as tarefas", async () => {
    await criar();
    let r = await S.salvarFase(master, { obraId: "obra1", fase: { nome: "Fase Livre" } });
    const fid = r.fases[0].id;
    r = await S.salvarTarefa(master, { obraId: "obra1", faseId: fid, tarefa: { nome: "Algo", dias: 1 } });
    r = await S.salvarFase(master, { obraId: "obra1", fase: { id: fid, nome: "Fase Renomeada" } });
    expect(r.fases.map((f: Fase) => f.nome)).toEqual(["Fase Renomeada"]);
    await S.salvarObra(master, { ...(await S.lerObras())[0], nome: "Nome Novo", tarefas: { total: 999 } });
    expect((await S.lerObras())[0].tarefas.total).toBe(1);
    r = await S.apagarFase(master, { obraId: "obra1", faseId: fid });
    expect(r.resumo.total).toBe(0);
    expect(mem.has(S.caminhoTarefas("obra1"))).toBe(true);
    await S.apagarObra(dono, "obra1");
    expect(mem.has(S.caminhoTarefas("obra1"))).toBe(false);
  });
});

/** renderToString separa textos com <!-- -->; tira para conferir o texto como aparece na tela. */
const semMarcas = (h: string) => h.replace(/<!-- -->/g, "");

describe("tela das tarefas", () => {
  const nada = () => {};
  const fases: Fase[] = [{ id: "f1", nome: "Fase Exemplo", marco: "Execução", tarefas: [
    { id: "t1", nome: "Tarefa Concluída", dias: 5, resp: "", inicio: "2026-11-01", fim: "2026-11-05", feito: "2026-11-04" },
    { id: "t2", nome: "Tarefa Vencida", dias: 10, resp: "Pessoa Exemplo", inicio: "2026-11-01", fim: "2026-11-10", feito: null },
  ] }];
  it("mostra a fase com o placar, as atrasadas e, aberta, as tarefas com a situação", () => {
    const fechada = semMarcas(renderToString(<TarefasLista fases={fases} todas={fases} abertas={new Set()} alternar={nada} hoje={HOJE} salvarTarefa={nada} apagarTarefa={nada} criarTarefa={async () => {}} renomearFase={nada} apagarFase={nada} />));
    expect(fechada).toContain("Fase Exemplo");
    expect(fechada).toContain("1 atrasada");
    expect(fechada).toContain("1/2");
    expect(fechada).not.toContain("Tarefa Vencida");
    const aberta = semMarcas(renderToString(<TarefasLista fases={fases} todas={fases} abertas={new Set(["f1"])} alternar={nada} hoje={HOJE} salvarTarefa={nada} apagarTarefa={nada} criarTarefa={async () => {}} renomearFase={nada} apagarFase={nada} />));
    expect(aberta).toContain("Tarefa Vencida");
    expect(aberta).toContain("Atrasada");
    expect(aberta).toContain("Feita 04/11");
  });
  it("o card da obra mostra as tarefas concluídas e atrasadas e o progresso pelas tarefas", () => {
    const o = { ...obraNova(), id: "c1", nome: "Unidade Card", modelo: "pro-recovery" as const, tarefas: { modelo: "pro-recovery" as const, total: 4, concluidas: 1, fimPendente: { "2026-11-10": 2 } } };
    const html = semMarcas(renderToString(<ObrasLista obras={[o]} abrir={nada} hoje={HOJE} />));
    expect(html).toContain("Pro / Recovery");
    expect(html).toContain("1 de 4");
    expect(html).toContain("2 atrasadas");
    expect(html).toContain("25%");
  });
});
