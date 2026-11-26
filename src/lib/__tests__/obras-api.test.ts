import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulos JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulos JS do servidor
import * as acesso from "../../../server/acesso.js";
// @ts-expect-error módulos JS do servidor
import * as S from "../../../server/obras.js";
// @ts-expect-error módulos JS do servidor
import { criarTokenUsuario } from "../../../api/_auth.js";
// @ts-expect-error módulos JS do servidor
import usuarios from "../../../api/usuarios.js";
// @ts-expect-error módulos JS do servidor
import royaltiesApi from "../../../api/royalties.js";

// Pessoas, obra e modelo INVENTADOS. A rota /api/obras (rewrite de /api/royalties?modulo=obras) com login de verdade e o armazém em memória.
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
  return r;
};
const chama = async (h: any, req: any) => { const r = res(); await h({ headers: {}, query: {}, ...req }, r); return r; };
const com = (token: string, extra: any = {}) => ({ headers: { authorization: `Bearer ${token}` }, ...extra });

describe("API de obras: o que cada nível recebe", () => {
  beforeEach(() => { process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste"; definirArmazem(memoria()); acesso.limparCache(); acesso.limparFreio(); });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; delete process.env.SESSAO_SEGREDO; definirArmazem(null); acesso.limparCache(); });

  it("quem é de unidades e foi liberado vê a obra sem a próxima tarefa e sem modelos, e não lê nem muda tarefas; o Master lê", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const criar = async (nome: string, email: string, papel: string, extra: any = {}) => {
      const c = (await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "criar", nome, email, papel, ...extra } }))).body;
      await acesso.definirNovaSenha(c.usuario.id, c.senhaProvisoria, "senha-propria-de-teste-1");
      return criarTokenUsuario(c.usuario.id).token;
    };
    const master = await criar("Ana Master", "ana@exemplo.com", "master");
    const uni = await criar("Caio Gama", "caio@exemplo.com", "unidades", { unidades: ["Gama"], verObras: true });
    const api = (token: string, body?: any) => chama(royaltiesApi, com(token, body ? { method: "POST", query: { modulo: "obras" }, body } : { method: "GET", query: { modulo: "obras" } }));

    await S.gravarModelos([{ id: "low", nome: "Modelo Exemplo", fases: [{ nome: "Fase Um", marco: null, tarefas: [{ nome: "Tarefa Sigilosa", dias: 5 }] }] }]);
    expect((await api(master, { acao: "salvar", obra: { id: "o1", nome: "Obra Exemplo", modelo: "low", marcos: [] } })).code).toBe(200);
    const ap = await api(master, { acao: "aplicar-modelo", obraId: "o1", modelo: "low" });
    const [f] = ap.body.fases;
    await api(master, { acao: "tarefa-salvar", obraId: "o1", faseId: f.id, tarefa: { ...f.tarefas[0], inicio: "2026-11-01", fim: null } });

    const doMaster = (await api(master)).body;
    expect(doMaster.modelos).toHaveLength(1);
    expect(doMaster.obras[0].tarefas.proxima).toEqual({ nome: "Tarefa Sigilosa", fim: "2026-11-05" });

    const daUnidade = await api(uni);
    expect(daUnidade.code).toBe(200);
    expect(daUnidade.body.modelos).toBeUndefined();
    expect(daUnidade.body.podeEditar).toBe(false);
    expect(daUnidade.body.obras[0].tarefas).toMatchObject({ total: 1, proxima: null, fimPendente: { "2026-11-05": 1 } });
    expect(JSON.stringify(daUnidade.body)).not.toContain("Tarefa Sigilosa");
    expect((await api(uni, { acao: "tarefas", obraId: "o1" })).code).toBe(403);
    expect((await api(uni, { acao: "tarefa-salvar", obraId: "o1", faseId: f.id, tarefa: { nome: "X" } })).code).toBe(403);
  });
});
