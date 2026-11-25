import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulos JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulos JS do servidor
import * as acesso from "../../../server/acesso.js";
// @ts-expect-error módulos JS do servidor
import { criarTokenUsuario } from "../../../api/_auth.js";
// @ts-expect-error módulos JS do servidor
import login from "../../../api/login.js";
// @ts-expect-error módulos JS do servidor
import usuarios from "../../../api/usuarios.js";
// @ts-expect-error módulos JS do servidor
import royaltiesApi from "../../../api/royalties.js";

// Pessoas e escalas INVENTADAS. A rota /api/escalas (rewrite de /api/royalties?modulo=escalas) com login de verdade e o armazém em memória.
const memoria = () => {
  const m = new Map<string, unknown>();
  return {
    async ler(c: string) { return m.has(c) ? structuredClone(m.get(c)) : null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); },
    async listar(p: string) { return [...m.keys()].filter((k) => k.startsWith(p)); }, async apagar(c: string) { m.delete(c); },
  };
};
const res = () => {
  const r: any = { headers: {} as Record<string, string>, code: 200, body: undefined };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.end = () => r;
  r.send = (b: unknown) => { r.body = b; return r; };
  return r;
};
const chama = async (h: any, req: any) => { const r = res(); await h({ headers: {}, query: {}, ...req }, r); return r; };
const com = (token: string, extra: any = {}) => ({ headers: { authorization: `Bearer ${token}` }, ...extra });

describe("API de escalas", () => {
  beforeEach(() => { process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste"; definirArmazem(memoria()); acesso.limparCache(); acesso.limparFreio(); });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; delete process.env.SESSAO_SEGREDO; definirArmazem(null); acesso.limparCache(); });

  async function cenario() {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const post = (token: string, body: any) => chama(usuarios, com(token, { method: "POST", body }));
    const criar = async (nome: string, email: string, papel: string, extra: any = {}) => {
      const c = (await post(tokenDono, { acao: "criar", nome, email, papel, ...extra })).body;
      await acesso.definirNovaSenha(c.usuario.id, c.senhaProvisoria, "senha-propria-de-teste-1");
      return { u: c.usuario, token: criarTokenUsuario(c.usuario.id).token };
    };
    const api = (token: string, body?: any) => chama(royaltiesApi, com(token, body ? { method: "POST", query: { modulo: "escalas" }, body } : { method: "GET", query: { modulo: "escalas" } }));
    return { tokenDono, post, criar, api };
  }
  const escala = (id: string, unitId: string) => ({ id, unitId, year: 2026, month: 11, status: "rascunho", confirmedAt: null, managerName: "Fulana", config: { team: "administrativa" } });

  it("dono e Master entram; quem tem só unidades só entra com a liberação do dono, e só uma pessoa dono libera", async () => {
    const { tokenDono, post, criar, api } = await cenario();
    const master = await criar("Ana Master", "ana@exemplo.com", "master");
    const gama = await criar("Caio Gama", "caio@exemplo.com", "unidades", { unidades: ["Gama"] });
    expect((await api(tokenDono)).code).toBe(200);
    expect((await api(master.token)).code).toBe(200);
    expect((await api(gama.token)).code).toBe(403); // sem a liberação
    expect((await post(master.token, { acao: "atualizar", id: gama.u.id, verEscalas: true })).code).toBe(403); // Master não libera
    expect((await post(tokenDono, { acao: "atualizar", id: gama.u.id, verEscalas: true })).body.usuario.verEscalas).toBe(true);
    expect((await api(gama.token)).code).toBe(200);
    expect((await chama(login, com(gama.token, { method: "GET" }))).body.usuario.verEscalas).toBe(true);
    await post(tokenDono, { acao: "atualizar", id: gama.u.id, verEscalas: false });
    expect((await api(gama.token)).code).toBe(403);
  });

  it("o gestor vê e grava só a própria unidade; o Master vê todas", async () => {
    const { tokenDono, criar, api, post } = await cenario();
    const master = await criar("Ana Master", "ana@exemplo.com", "master");
    const gama = await criar("Caio Gama", "caio@exemplo.com", "unidades", { unidades: ["Gama"], verEscalas: true });
    expect(gama.u.verEscalas).toBe(true);
    expect((await api(gama.token)).body.unidades).toEqual([{ id: "gama", nome: "Gama" }]);
    expect((await api(master.token)).body.unidades.length).toBe(9);
    expect((await api(gama.token, { acao: "salvar", escala: escala("a", "gama") })).code).toBe(200);
    expect((await api(gama.token, { acao: "salvar", escala: escala("b", "asa-norte") })).code).toBe(403);
    expect((await api(tokenDono, { acao: "salvar", escala: escala("b", "asa-norte") })).code).toBe(200);
    expect((await api(gama.token, { acao: "listar" })).body.escalas.map((x: { id: string }) => x.id)).toEqual(["a"]);
    expect((await api(gama.token, { acao: "ler", id: "b" })).code).toBe(403);
    expect((await api(master.token, { acao: "mes", ano: 2026, mes: 11 })).body.escalas.length).toBe(2);
    expect((await api(gama.token, { acao: "versoes", id: "a" })).body.versoes.length).toBe(1);
    expect((await api(gama.token, { acao: "inventada" })).code).toBe(400);
    // jornada e prazo: só dono e Master
    expect((await api(gama.token, { acao: "prazo-salvar", dia: 10 })).code).toBe(403);
    expect((await api(master.token, { acao: "prazo-salvar", dia: 10 })).body.prazo.day).toBe(10);
    expect((await api(gama.token)).body.prazo.day).toBe(10);
    void post;
  });

  it("importar o sistema antigo é só do dono", async () => {
    const { tokenDono, criar, api } = await cenario();
    const master = await criar("Ana Master", "ana@exemplo.com", "master");
    const backup = { escalas: [{ id: "x1", unidade: "gama", ano: 2026, mes: 10, status: "rascunho", gerada: false, atualizada_em: "2026-10-01T10:00:00Z", dados: { id: "x1", unitId: "gama", year: 2026, month: 10, status: "rascunho", config: {} } }] };
    expect((await api(master.token, { acao: "importar", backup })).code).toBe(403);
    expect((await api(tokenDono, { acao: "importar", backup })).body.importado).toMatchObject({ escalas: 1 });
    expect((await api(tokenDono, { acao: "listar" })).body.escalas.length).toBe(1);
  });

  it("sem login não entra", async () => {
    await cenario();
    const r = await chama(royaltiesApi, { method: "GET", query: { modulo: "escalas" } });
    expect([401, 403]).toContain(r.code);
  });
});
