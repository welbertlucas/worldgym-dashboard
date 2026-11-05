import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { Login } from "@/components/Login";
import { authFetch, entrar, getToken, precisaDeLogin } from "@/lib/auth";

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
});
vi.stubGlobal("window", { dispatchEvent: vi.fn() });
afterEach(() => { for (const k of Object.keys(store)) delete store[k]; });

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe("senha no navegador", () => {
  it("senha errada não guarda token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 401)));
    expect(await entrar("x")).toEqual({ ok: false, erro: "Senha incorreta." });
    expect(getToken()).toBe("");
  });

  it("senha certa guarda o token e ele vai nas chamadas de dados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ token: "t.s", expiraEm: 1 })));
    expect(await entrar("certa")).toEqual({ ok: true });
    const f = vi.fn().mockResolvedValue(json({}));
    vi.stubGlobal("fetch", f);
    await authFetch("https://x/api/indicadores");
    expect(f).toHaveBeenCalledWith("https://x/api/indicadores", { headers: { Authorization: "Bearer t.s" } });
  });

  it("401 em dados apaga o token e pede o login de novo", async () => {
    store["wg-dashboard-token"] = "velho";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 401)));
    await authFetch("https://x/api/indicadores");
    expect(getToken()).toBe("");
    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it("só pede login quando a senha está ligada e o visitante não está logado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ protegido: true, logado: false })));
    expect(await precisaDeLogin()).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ protegido: false, logado: true })));
    expect(await precisaDeLogin()).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    expect(await precisaDeLogin()).toBe(false);
  });

  it("a tela de login tem o campo de senha e o botão", () => {
    const html = renderToString(createElement(Login, { onEntrou: () => {} }));
    expect(html).toContain('type="password"');
    expect(html).toContain("Entrar");
  });
});
