import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulos JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulos JS do servidor
import * as acesso from "../../../server/acesso.js";
// @ts-expect-error módulos JS do servidor
import { COORDENADAS_UNIDADES, UNIT_NAMES } from "../../../server/units.js";
// @ts-expect-error módulos JS do servidor
import { criarTokenUsuario } from "../../../api/_auth.js";
// @ts-expect-error módulos JS do servidor
import usuarios from "../../../api/usuarios.js";
// @ts-expect-error módulos JS do servidor
import royaltiesApi from "../../../api/royalties.js";

// Pessoas INVENTADAS. A rota /api/estudos (horários e serviços das academias) com login de verdade e o armazém em memória.
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

describe("API de estudos: horários e serviços das academias", () => {
  beforeEach(() => { process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste"; delete process.env.GOOGLE_PLACES_KEY; definirArmazem(memoria()); acesso.limparCache(); acesso.limparFreio(); });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; delete process.env.SESSAO_SEGREDO; definirArmazem(null); acesso.limparCache(); });

  it("quem tem acesso a unidades só pede em volta da própria unidade; ids fora do formato são recusados", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const criar = async (nome: string, email: string, papel: string, extra: any = {}) => {
      const c = (await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "criar", nome, email, papel, ...extra } }))).body;
      await acesso.definirNovaSenha(c.usuario.id, c.senhaProvisoria, "senha-propria-de-teste-1");
      return criarTokenUsuario(c.usuario.id).token;
    };
    const master = await criar("Ana Master", "ana@exemplo.com", "master");
    const uni = await criar("Caio Gama", "caio@exemplo.com", "unidades", { unidades: ["Gama"] });
    const api = (token: string, body: any) => chama(royaltiesApi, com(token, { method: "POST", query: { modulo: "estudos" }, body }));
    const gama = COORDENADAS_UNIDADES[Object.entries(UNIT_NAMES).find(([, n]) => n === "Gama")![0]];
    const ids = ["places/ExemploAbcdefghij"];
    expect((await api(uni, { acao: "servicos-academias", c: [gama[0] + 0.3, gama[1]], raioKm: 2, ids })).code).toBe(403);
    // perto da própria unidade passa da trava (sem chave do Google no teste, para no 503)
    expect((await api(uni, { acao: "servicos-academias", c: gama, raioKm: 2, ids })).code).toBe(503);
    expect((await api(master, { acao: "servicos-academias", c: gama, raioKm: 2, ids: ["https://exemplo.com"] })).code).toBe(400);
  });
});
