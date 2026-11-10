import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error módulo JS da função serverless
import despertador from "../../../api/despertador.js";
// @ts-expect-error módulo JS do servidor
import { transitorio } from "../../../server/evo.js";
import vercel from "../../../vercel.json";

const res = () => {
  const r: any = { code: 200 };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  return r;
};
const req = (rotina: string, auth?: string) => ({ query: { rotina }, headers: { authorization: auth } });

describe("despertador da Vercel (api/despertador)", () => {
  const fetchOriginal = globalThis.fetch;
  let chamadas: { url: string; init: any }[];
  beforeEach(() => {
    process.env.CRON_SECRET = "segredo-cron";
    process.env.GITHUB_DISPATCH_TOKEN = "token-github";
    chamadas = [];
    globalThis.fetch = vi.fn(async (url: any, init: any) => { chamadas.push({ url: String(url), init }); return new Response(null, { status: 204 }); }) as any;
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.GITHUB_DISPATCH_TOKEN;
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("recusa quem não manda o segredo da Vercel", async () => {
    for (const auth of [undefined, "Bearer errado", "segredo-cron"]) {
      const r = res();
      await despertador(req("evo-sync", auth), r);
      expect(r.code).toBe(401);
    }
    expect(chamadas).toHaveLength(0);
  });

  it("sem CRON_SECRET configurado, recusa tudo", async () => {
    delete process.env.CRON_SECRET;
    const r = res();
    await despertador(req("evo-sync", "Bearer "), r);
    expect(r.code).toBe(401);
  });

  it("dispara no GitHub só as rotinas conhecidas, no ramo main", async () => {
    const r = res();
    await despertador(req("evo-sync", "Bearer segredo-cron"), r);
    expect(r.code).toBe(200);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("https://api.github.com/repos/welbertlucas/worldgym-dashboard/actions/workflows/evo-sync.yml/dispatches");
    expect(chamadas[0].init.method).toBe("POST");
    expect(chamadas[0].init.headers.Authorization).toBe("Bearer token-github");
    expect(JSON.parse(chamadas[0].init.body)).toEqual({ ref: "main" });

    const r2 = res();
    await despertador(req("../../outra-coisa", "Bearer segredo-cron"), r2);
    expect(r2.code).toBe(400);
    expect(chamadas).toHaveLength(1);
  });

  it("avisa quando o GitHub recusa", async () => {
    globalThis.fetch = vi.fn(async () => new Response("Bad credentials", { status: 401 })) as any;
    const r = res();
    await despertador(req("resumo-diario", "Bearer segredo-cron"), r);
    expect(r.code).toBe(502);
  });

  it("vercel.json agenda as três rotinas nos horários de Brasília (UTC-3)", () => {
    const porRotina = Object.fromEntries(vercel.crons.map((c: { path: string; schedule: string }) => [new URL(c.path, "http://x").searchParams.get("rotina"), c.schedule]));
    expect(porRotina).toEqual({ "evo-sync": "37 3 * * *", "meta-sync": "30 9 * * *", "resumo-diario": "47 9 * * *" });
  });
});

describe("erros do EVO que valem nova tentativa (server/evo)", () => {
  it("429 e 5xx sempre", () => {
    expect(transitorio(429)).toBe(true);
    expect(transitorio(500, "500 ")).toBe(true);
    expect(transitorio(503)).toBe(true);
  });

  it("401 do EVO sobrecarregado ou sem conseguir logar no próprio banco", () => {
    expect(transitorio(401, "401 Timeout expired. The timeout period elapsed")).toBe(true);
    expect(transitorio(401, "401 A connection was successfully established with the server, but then an error occurred during the login process. (provide")).toBe(true);
  });

  it("credencial errada ou pedido inválido não", () => {
    expect(transitorio(401, "401 Unauthorized")).toBe(false);
    expect(transitorio(400, "400 Bad Request")).toBe(false);
    expect(transitorio(404)).toBe(false);
  });
});
