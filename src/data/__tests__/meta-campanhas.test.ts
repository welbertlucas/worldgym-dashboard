import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error módulo JS do servidor
import { campanhaDoMeta, campanhasDaRede, CONTAS, estaNoAr, listaDeMeses, mesesDaRede, mesesDaRotina } from "../../../server/meta.js";

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
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("act_2/") ? { ok: false, status: 400, json: async () => ({ error: { message: "sem permissão" } }) } : { ok: true, status: 200, json: async () => ({ data: [{ id: "c1", name: "A", insights: { data: [{ spend: "5" }] } }] }) }));
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

describe("investimento do mês por unidade (Meta)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("não conta o mesmo lead duas vezes quando o Meta manda o total e as partes", () => {
    const c = campanhaDoMeta({ id: "9", name: "X", insights: { data: [{ actions: [{ action_type: "lead", value: "10" }, { action_type: "onsite_conversion.lead_grouped", value: "6" }] }] } }, conta);
    expect(c.leads7d).toBe(10);
  });
  it("soma as contas da mesma unidade, põe a Institucional em Rede e pula meses futuros", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { urls.push(url); return { ok: true, status: 200, json: async () => ({ data: [{ spend: "100.5", impressions: "10", clicks: "2", actions: [{ action_type: "lead", value: "3" }] }] }) }; }));
    const contas = [{ ...conta, id: "1" }, { ...conta, id: "2" }, { ...conta, id: "3", unidade: null }];
    const r = await mesesDaRede({ DFGO: "x" }, ["2026-11", "2026-12"], contas, 0, "2026-11-10");
    expect(Object.keys(r)).toEqual(["2026-11"]);
    expect(r["2026-11"].unidades["Asa Norte"]).toEqual({ investimento: 201, impressoes: 20, cliques: 4, leads: 6, conversas: 0 });
    expect(r["2026-11"].unidades.Rede.investimento).toBe(100.5);
    // mês corrente vai só até hoje; todas as campanhas da conta (nível conta), não só as ativas
    expect(decodeURIComponent(urls[0])).toContain('"since":"2026-11-01","until":"2026-11-10"');
    expect(urls[0]).toContain("level=account");
  });
  it("lista de meses e meses da rotina diária", () => {
    expect(listaDeMeses("2025-11..2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(listaDeMeses("2026-10, 2026-11")).toEqual(["2026-10", "2026-11"]);
    expect(() => listaDeMeses("2026-1")).toThrow();
    expect(mesesDaRotina("2026-01-05")).toEqual(["2025-12", "2026-01"]);
  });
});

describe("campanha no ar (o Meta deixa 'ativa' campanha que já acabou)", () => {
  const base = { gasto7d: 0, impressoes7d: 0, inicio: "2025-03-14", fim: null };
  it("ativa no Meta, mas sem entrega há mais de 7 dias: fora", () => {
    expect(estaNoAr(base, "2026-11-10")).toBe(false);
  });
  it("data final já passou: fora, mesmo com gasto na semana", () => {
    expect(estaNoAr({ ...base, gasto7d: 50, fim: "2026-11-05" }, "2026-11-10")).toBe(false);
  });
  it("gastou ou apareceu na semana, ou começou nesta semana: no ar", () => {
    expect(estaNoAr({ ...base, gasto7d: 0.5 }, "2026-11-10")).toBe(true);
    expect(estaNoAr({ ...base, impressoes7d: 10, fim: "2026-11-30" }, "2026-11-10")).toBe(true);
    expect(estaNoAr({ ...base, inicio: "2026-11-09" }, "2026-11-10")).toBe(true);
  });
});
