import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS da função serverless
import { criarToken, tokenValido, senhaCorreta, protegido, exigirLogin } from "../../../api/_auth.js";

const res = () => {
  const r: any = { headers: {} as Record<string, string>, code: 200 };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  return r;
};

describe("senha do dashboard (api/_auth)", () => {
  beforeEach(() => { process.env.DASHBOARD_PASSWORD = "segredo-de-teste"; });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; });

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

  it("rotas de dados respondem 401 sem token e liberam com token", () => {
    const r1 = res();
    expect(exigirLogin({ headers: {} }, r1)).toBe(false);
    expect(r1.code).toBe(401);
    const { token } = criarToken();
    const r2 = res();
    expect(exigirLogin({ headers: { authorization: `Bearer ${token}` } }, r2)).toBe(true);
  });

  it("sem DASHBOARD_PASSWORD a proteção fica desligada", () => {
    delete process.env.DASHBOARD_PASSWORD;
    expect(protegido()).toBe(false);
    expect(exigirLogin({ headers: {} }, res())).toBe(true);
    expect(senhaCorreta("qualquer")).toBe(false);
  });
});
