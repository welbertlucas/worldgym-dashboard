import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS da função serverless
import { criarToken, tokenValido, senhaCorreta, protegido, exigirLogin } from "../../../api/_auth.js";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import { limparCache } from "../../../server/acesso.js";

const memoria = () => {
  const m = new Map<string, unknown>();
  return { async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); } };
};

const res = () => {
  const r: any = { headers: {} as Record<string, string>, code: 200 };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  return r;
};

describe("senha do dashboard (api/_auth)", () => {
  beforeEach(() => { process.env.DASHBOARD_PASSWORD = "segredo-de-teste"; definirArmazem(memoria()); limparCache(); });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; definirArmazem(null); limparCache(); });

  it("aceita só a senha certa", () => {
    expect(senhaCorreta("segredo-de-teste")).toBe(true);
    expect(senhaCorreta("errada")).toBe(false);
    expect(senhaCorreta(undefined)).toBe(false);
  });

  it("token vale até vencer e não pode ser adulterado", () => {
    const { token } = criarToken(1000);
    expect(tokenValido(token, 2000)).toBe(true);
    expect(tokenValido(token, 1000 + 31 * 24 * 3600 * 1000)).toBe(false);
    const [corpo, sig] = token.split(".");
    expect(tokenValido(`${Number(corpo) + 999999999}.${sig}`, 2000)).toBe(false);
    expect(tokenValido("lixo", 2000)).toBe(false);
  });

  it("trocar a senha invalida os tokens antigos", () => {
    const { token } = criarToken();
    process.env.DASHBOARD_PASSWORD = "outra-senha";
    expect(tokenValido(token)).toBe(false);
  });

  it("rotas de dados respondem 401 sem token e liberam com token", async () => {
    const r1 = res();
    expect(await exigirLogin({ headers: {} }, r1)).toBe(false);
    expect(r1.code).toBe(401);
    const { token } = criarToken();
    const r2 = res();
    const sessao = await exigirLogin({ headers: { authorization: `Bearer ${token}` } }, r2);
    expect(sessao).toMatchObject({ papel: "dono" });
  });

  it("sem DASHBOARD_PASSWORD a proteção fica desligada", async () => {
    delete process.env.DASHBOARD_PASSWORD;
    expect(protegido()).toBe(false);
    expect(await exigirLogin({ headers: {} }, res())).toBeTruthy();
    expect(senhaCorreta("qualquer")).toBe(false);
  });
});
