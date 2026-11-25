import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import * as E from "../../../server/escalas.js";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";

// Dados INVENTADOS (nomes e escalas fictícios). Armazém em memória.
let mem: Map<string, unknown>;
beforeEach(() => {
  mem = new Map();
  definirArmazem({
    async ler(c: string) { return mem.has(c) ? JSON.parse(JSON.stringify(mem.get(c))) : null; },
    async gravar(c: string, d: unknown) { mem.set(c, JSON.parse(JSON.stringify(d))); },
    async apagar(c: string) { mem.delete(c); },
    async listar(p: string) { return [...mem.keys()].filter((k) => k.startsWith(p)); },
  });
});
afterEach(() => definirArmazem(null));

const dono = { papel: "dono", nome: "Dono Teste", email: "dono@teste", unidades: [] };
const master = { papel: "master", nome: "Master Teste", email: "master@teste", unidades: [] };
const gestorGama = { papel: "unidades", nome: "Gestor Gama", email: "gama@teste", unidades: ["Gama"] };
const gestorAsa = { papel: "unidades", nome: "Gestor Asa", email: "asa@teste", unidades: ["Asa Norte"] };
const escala = (id: string, unitId: string, ano = 2026, mes = 11, extra: Record<string, unknown> = {}) => ({ id, unitId, year: ano, month: mes, status: "rascunho", confirmedAt: null, managerName: "Fulana", config: { team: "administrativa" }, ...extra });
const t0 = new Date("2026-11-20T10:00:00Z");
const depoisDe = (min: number) => new Date(t0.getTime() + min * 60000);

describe("escalas: quem vê o quê", () => {
  it("dono e Master veem todas as unidades; o gestor só as dele", async () => {
    await E.salvarEscala(dono, escala("e1", "gama"), { agora: t0 });
    await E.salvarEscala(dono, escala("e2", "asa-norte"), { agora: t0 });
    expect((await E.listarEscalas(dono)).map((x: { id: string }) => x.id).sort()).toEqual(["e1", "e2"]);
    expect((await E.listarEscalas(master)).length).toBe(2);
    expect((await E.listarEscalas(gestorGama)).map((x: { id: string }) => x.id)).toEqual(["e1"]);
    expect(await E.lerEscala(gestorGama, "e1")).toMatchObject({ id: "e1" });
    await expect(E.lerEscala(gestorGama, "e2")).rejects.toMatchObject({ status: 403 });
    await expect(E.listarEscalas(gestorGama, "asa-norte")).rejects.toMatchObject({ status: 403 });
    await expect(E.salvarEscala(gestorGama, escala("e3", "asa-norte"))).rejects.toMatchObject({ status: 403 });
    await expect(E.apagarEscala(gestorGama, "e2")).rejects.toMatchObject({ status: 403 });
  });
  it("confere unidade, mês, identificador e tamanho", async () => {
    await expect(E.salvarEscala(dono, escala("e1", "outra-unidade"))).rejects.toMatchObject({ status: 400 });
    await expect(E.salvarEscala(dono, escala("e1", "gama", 2026, 13))).rejects.toMatchObject({ status: 400 });
    await expect(E.salvarEscala(dono, escala("../x", "gama"))).rejects.toMatchObject({ status: 400 });
    await expect(E.salvarEscala(dono, escala("e1", "gama", 2026, 11, { config: { team: "inexistente" } }))).rejects.toMatchObject({ status: 400 });
    await expect(E.salvarEscala(dono, escala("e1", "gama", 2026, 11, { lixo: "x".repeat(500 * 1024) }))).rejects.toMatchObject({ status: 413 });
    await expect(E.lerEscala(dono, "../../acesso/usuarios")).rejects.toMatchObject({ status: 400 });
  });
});

describe("escalas: procurar", () => {
  it("acha a mais recente do mês; escala sem equipe conta como administrativa", async () => {
    await E.salvarEscala(dono, escala("a", "gama", 2026, 10, { config: {} }), { agora: t0 });
    await E.salvarEscala(dono, escala("b", "gama", 2026, 10, { config: { team: "tecnica" } }), { agora: depoisDe(1) });
    expect((await E.acharEscala(dono, { ano: 2026, mes: 10, unidade: "gama", equipe: "administrativa" })).id).toBe("a");
    expect((await E.acharEscala(dono, { ano: 2026, mes: 10, unidade: "gama", equipe: "tecnica" })).id).toBe("b");
    expect(await E.acharEscala(dono, { ano: 2026, mes: 9, unidade: "gama" })).toBeNull();
  });
  it("a última escala é a do mês mais perto antes do pedido", async () => {
    await E.salvarEscala(dono, escala("a", "gama", 2026, 8), { agora: t0 });
    await E.salvarEscala(dono, escala("b", "gama", 2026, 10), { agora: t0 });
    await E.salvarEscala(dono, escala("c", "gama", 2026, 12), { agora: t0 });
    expect((await E.ultimaEscala(dono, { antes: { year: 2026, month: 11 }, unidade: "gama" })).id).toBe("b");
    expect((await E.ultimaEscala(dono, { unidade: "gama" })).id).toBe("c");
    expect(await E.ultimaEscala(gestorAsa, { unidade: "asa-norte" })).toBeNull();
  });
  it("o painel do mês traz as escalas completas só das unidades que a pessoa enxerga", async () => {
    await E.salvarEscala(dono, escala("a", "gama", 2026, 11), { agora: t0 });
    await E.salvarEscala(dono, escala("b", "asa-norte", 2026, 11), { agora: t0 });
    expect((await E.escalasDoMes(gestorGama, 2026, 11)).map((x: { schedule: { id: string } }) => x.schedule.id)).toEqual(["a"]);
    expect((await E.escalasDoMes(master, 2026, 11)).length).toBe(2);
  });
  it("apagar tira a escala, o histórico e o item do índice", async () => {
    await E.salvarEscala(gestorGama, escala("a", "gama"), { agora: t0 });
    await E.apagarEscala(gestorGama, "a");
    expect(await E.lerEscala(dono, "a")).toBeNull();
    expect(await E.listarEscalas(dono)).toEqual([]);
    expect(await E.versoesDaEscala(dono, "a")).toEqual([]);
  });
});

describe("escalas: histórico de versões", () => {
  it("criar abre a versão 'criada'; mudança de situação e geração abrem versões com marco", async () => {
    await E.salvarEscala(gestorGama, escala("a", "gama"), { agora: t0 });
    await E.salvarEscala(gestorGama, escala("a", "gama", 2026, 11, { cells: { x: 1 } }), { agora: depoisDe(1) });
    await E.salvarEscala(gestorGama, escala("a", "gama", 2026, 11, { cells: { x: 1 }, status: "confirmada", confirmedAt: "2026-11-20T11:00:00Z" }), { agora: depoisDe(2) });
    const v = await E.versoesDaEscala(gestorGama, "a");
    expect(v.map((x: { milestone: string }) => x.milestone)).toEqual(["confirmada", "gerada", "criada"]);
    expect(v[0].author).toBe("Gestor Gama");
  });
  it("edições comuns da mesma pessoa em 15 minutos atualizam a última versão; depois disso, ou por outra pessoa, abrem uma nova", async () => {
    await E.salvarEscala(gestorGama, escala("a", "gama", 2026, 11, { cells: { x: 1 } }), { agora: t0 }); // criada
    await E.salvarEscala(gestorGama, escala("a", "gama", 2026, 11, { cells: { x: 2 } }), { agora: depoisDe(1) }); // edição: nova versão (a anterior tem marco)
    await E.salvarEscala(gestorGama, escala("a", "gama", 2026, 11, { cells: { x: 3 } }), { agora: depoisDe(5) }); // dentro de 15 min: atualiza a anterior
    expect((await E.versoesDaEscala(gestorGama, "a")).length).toBe(2);
    await E.salvarEscala(dono, escala("a", "gama", 2026, 11, { cells: { x: 4 } }), { agora: depoisDe(6) }); // outra pessoa: nova versão
    await E.salvarEscala(dono, escala("a", "gama", 2026, 11, { cells: { x: 5 } }), { agora: depoisDe(40) }); // passou de 15 min: nova versão
    expect((await E.versoesDaEscala(gestorGama, "a")).length).toBe(4);
  });
  it("salvar sem mudar nada não cria versão", async () => {
    await E.salvarEscala(gestorGama, escala("a", "gama"), { agora: t0 });
    await E.salvarEscala(gestorGama, escala("a", "gama"), { agora: depoisDe(1) });
    expect((await E.versoesDaEscala(gestorGama, "a")).length).toBe(1);
  });
  it("restaurar uma versão antiga devolve a escala dela e registra 'restaurada'", async () => {
    await E.salvarEscala(gestorGama, escala("a", "gama", 2026, 11, { cells: { x: 1 } }), { agora: t0 });
    await E.salvarEscala(gestorGama, escala("a", "gama", 2026, 11, { cells: { x: 9 }, status: "confirmada", confirmedAt: "2026-11-20T11:00:00Z" }), { agora: depoisDe(30) });
    const antiga = (await E.versoesDaEscala(gestorGama, "a")).find((x: { milestone: string }) => x.milestone === "criada");
    const restaurada = await E.restaurarVersao(gestorGama, "a", antiga.id, { agora: depoisDe(60) });
    expect(restaurada.cells).toEqual({ x: 1 });
    expect((await E.lerEscala(gestorGama, "a")).status).toBe("rascunho");
    expect((await E.versoesDaEscala(gestorGama, "a"))[0].milestone).toBe("restaurada");
    expect((await E.listarEscalas(gestorGama))[0].status).toBe("rascunho");
    await expect(E.restaurarVersao(gestorGama, "a", 999)).rejects.toMatchObject({ status: 404 });
    await expect(E.restaurarVersao(gestorAsa, "a", antiga.id)).rejects.toMatchObject({ status: 403 });
  });
});

describe("escalas: equipe, funcionamento e prazo", () => {
  it("o cadastro da equipe é da unidade", async () => {
    await E.salvarEquipe(gestorGama, "gama", "administrativa", { staff: [{ nome: "Fulana" }] }, { agora: t0 });
    expect((await E.lerEquipe(gestorGama, "gama", "administrativa")).roster).toEqual({ staff: [{ nome: "Fulana" }] });
    expect(await E.lerEquipe(dono, "gama", "tecnica")).toBeNull();
    await expect(E.lerEquipe(gestorAsa, "gama", "administrativa")).rejects.toMatchObject({ status: 403 });
    await expect(E.salvarEquipe(gestorGama, "gama", "outra", {})).rejects.toMatchObject({ status: 400 });
  });
  it("só dono e Master mudam as regras de jornada; o gestor grava o funcionamento e a jornada fica como está", async () => {
    const base = { operatingHours: { seg: "6-22" }, holidayHours: {}, localHolidays: [] };
    await E.salvarConfigUnidade(master, "gama", { ...base, labor: { diaria: "8h24" } }, { incluirJornada: true, agora: t0 });
    await E.salvarConfigUnidade(gestorGama, "gama", { ...base, operatingHours: { seg: "7-21" } }, { agora: depoisDe(1) });
    const c = await E.lerConfigUnidade(gestorGama, "gama");
    expect(c.settings.operatingHours).toEqual({ seg: "7-21" });
    expect(c.settings.labor).toEqual({ diaria: "8h24" });
    await expect(E.salvarConfigUnidade(gestorGama, "gama", { ...base, labor: { diaria: "10h" } }, { incluirJornada: true })).rejects.toMatchObject({ status: 403 });
    expect((await E.lerConfigUnidade(gestorGama, "gama")).settings.labor).toEqual({ diaria: "8h24" });
  });
  it("o prazo da rede é de 1 a 28, só dono e Master mudam e todos leem (padrão 20)", async () => {
    expect((await E.lerPrazo()).day).toBe(20);
    await E.salvarPrazo(master, 15, { agora: t0 });
    expect((await E.lerPrazo()).day).toBe(15);
    await expect(E.salvarPrazo(gestorGama, 10)).rejects.toMatchObject({ status: 403 });
    await expect(E.salvarPrazo(dono, 31)).rejects.toMatchObject({ status: 400 });
  });
});

describe("escalas: importar do sistema antigo", () => {
  const backup = {
    escalas: [
      { id: "x1", unidade: "gama", equipe: "administrativa", ano: 2026, mes: 10, status: "confirmada", confirmada_em: "2026-10-20T10:00:00Z", gerada: true, elaborada_por: "Fulana", atualizada_em: "2026-10-21T10:00:00Z", atualizada_por_nome: "Gestor Gama", dados: { id: "x1", unitId: "gama", year: 2026, month: 10, status: "confirmada", config: { team: "administrativa" }, cells: {} } },
      { id: "x2", unidade: "unidade-inexistente", ano: 2026, mes: 10, status: "rascunho", dados: {} },
    ],
    versoes: [
      { escala_id: "x1", status: "rascunho", gerada: false, dados: { v: 1 }, marco: "criada", autor_nome: "Gestor Gama", criada_em: "2026-10-01T10:00:00Z", atualizada_em: "2026-10-01T10:00:00Z" },
      { escala_id: "x1", status: "confirmada", gerada: true, dados: { v: 2 }, marco: "confirmada", autor_nome: "Gestor Gama", criada_em: "2026-10-20T10:00:00Z", atualizada_em: "2026-10-20T10:00:00Z" },
    ],
    equipes: [{ unidade: "gama", equipe: "administrativa", dados: { staff: [] }, atualizada_em: "2026-10-02T10:00:00Z", atualizada_por_nome: "Gestor Gama" }],
    unidades_config: [{ unidade: "gama", funcionamento: { operatingHours: {} }, jornada: { diaria: "8h24" }, atualizada_em: "2026-10-03T10:00:00Z", atualizada_por_nome: "Master" }],
    rede_config: [{ prazo_dia: 18, atualizada_em: "2026-11-12T10:00:00Z", atualizada_por_nome: "Dono" }],
  };
  it("só o dono importa; grava tudo e devolve só contagens", async () => {
    await expect(E.importarDoSistemaAntigo(master, backup)).rejects.toMatchObject({ status: 403 });
    const r = await E.importarDoSistemaAntigo(dono, backup);
    expect(r).toEqual({ escalas: 1, versoes: 2, equipes: 1, configs: 1, prazo: 1, ignoradas: 1 });
    expect((await E.lerEscala(gestorGama, "x1")).status).toBe("confirmada");
    expect((await E.listarEscalas(gestorGama)).length).toBe(1);
    expect((await E.versoesDaEscala(gestorGama, "x1")).map((v: { milestone: string }) => v.milestone)).toEqual(["confirmada", "criada"]);
    expect((await E.lerConfigUnidade(gestorGama, "gama")).settings.labor).toEqual({ diaria: "8h24" });
    expect((await E.lerPrazo()).day).toBe(18);
  });
  it("importar de novo não duplica nada", async () => {
    await E.importarDoSistemaAntigo(dono, backup);
    await E.importarDoSistemaAntigo(dono, backup);
    expect((await E.listarEscalas(dono)).length).toBe(1);
    expect((await E.versoesDaEscala(dono, "x1")).length).toBe(2);
  });
});
