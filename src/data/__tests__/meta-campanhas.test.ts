import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error módulo JS do servidor
import { campanhaDoMeta, campanhasDaRede, CONTAS } from "../../../server/meta.js";

const conta = { id: "1", conta: "WG 3 - Asa Norte", unidade: "Asa Norte", token: "DFGO" };

describe("campanhaDoMeta", () => {
  it("converte centavos em reais e soma leads e conversas dos últimos 7 dias", () => {
    const c = campanhaDoMeta({
      id: "9", name: "Black Friday", objective: "OUTCOME_LEADS", start_time: "2026-11-01T03:00:00-0300", daily_budget: "2500",
      insights: { data: [{ spend: "123.45", impressions: "1000", clicks: "50", actions: [{ action_type: "lead", value: "4" }, { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "7" }, { action_type: "link_click", value: "50" }] }] },
    }, conta);
    expect(c).toMatchObject({ unidade: "Asa Norte", nome: "Black Friday", inicio: "2026-11-01", fim: null, orcamentoDiario: 25, gasto7d: 123.45, cliques7d: 50, leads7d: 4, conversas7d: 7 });
  });
  it("campanha sem resultado ainda vem com zeros", () => {
    const c = campanhaDoMeta({ id: "9", name: "Nova" }, conta);
    expect(c).toMatchObject({ gasto7d: 0, leads7d: 0, orcamentoDiario: null });
  });
});

describe("campanhasDaRede", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uma conta com erro não derruba as outras, e conta sem token é avisada", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("act_2/") ? { ok: false, status: 400, json: async () => ({ error: { message: "sem permissão" } }) } : { ok: true, status: 200, json: async () => ({ data: [{ id: "c1", name: "A" }] }) }));
    const contas = [{ ...conta, id: "1" }, { ...conta, id: "2", conta: "B" }, { ...conta, id: "3", conta: "C", token: "BR01" }];
    const r = await campanhasDaRede({ DFGO: "x" }, contas, 0);
    expect(r.campanhas).toHaveLength(1);
    expect(r.erros.map((e: { conta: string }) => e.conta)).toEqual(["B", "C"]);
    expect(JSON.stringify(r.erros)).not.toContain("graph.facebook.com");
  });
  it("não há duas contas com o mesmo ID", () => {
    expect(new Set(CONTAS.map((c: { id: string }) => c.id)).size).toBe(CONTAS.length);
  });
});
