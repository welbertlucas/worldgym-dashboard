import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error módulo JS do servidor
import { anunciosDaConta, campanhaDoMeta, campanhasDaRede, CONTAS, estaNoAr, listaDeMeses, mesesDaRede, mesesDaRotina } from "../../../server/meta.js";

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
    expect(r["2026-11"].unidades["Asa Norte"]).toEqual({ investimento: 201, impressoes: 20, cliques: 4, leads: 6, conversas: 0, compras: 0, valorCompras: 0 });
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

describe("indicadores novos do Meta", () => {
  it("CTR e CPM", async () => {
    const { ctr, cpm } = await import("@/data/campanhas");
    expect(ctr(50, 10000)).toBeCloseTo(0.5);
    expect(cpm(30, 10000)).toBeCloseTo(3);
    expect(ctr(1, 0)).toBeNull();
    expect(cpm(1, 0)).toBeNull();
  });

  it("série mensal da unidade, da Institucional e da rede sem a Institucional", async () => {
    const { serieMensal, INSTITUCIONAL, mesAnterior, mesAnoAnterior } = await import("@/data/campanhas");
    const r = (investimento: number, leads: number, conversas = 0) => ({ investimento, impressoes: 1000, cliques: 10, leads, conversas });
    const meses = {
      "2026-10": { geradoEm: "", erros: [], unidades: { Gama: r(600, 100), Itapoã: r(400, 0), Rede: r(1000, 10) } },
      "2026-09": { geradoEm: "", erros: [], unidades: { Gama: r(300, 0, 50) } },
    };
    expect(serieMensal(meses, "Gama").map((p) => [p.ym, p.investimento, p.custo])).toEqual([["2026-09", 300, 6], ["2026-10", 600, 6]]);
    expect(serieMensal(meses, null).at(-1)).toMatchObject({ investimento: 1000, contatos: 100 });
    expect(serieMensal(meses, INSTITUCIONAL)).toHaveLength(1);
    expect(serieMensal(meses, "Itapoã")[0].custo).toBeNull();
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesAnoAnterior("2026-10")).toBe("2025-10");
  });

  it("ranking: mais baratos com contatos suficientes, e os que gastaram sem contato", async () => {
    const { rankingDeAnuncios, anunciosDaUnidade, INSTITUCIONAL } = await import("@/data/campanhas");
    const a = (id: string, unidade: string | null, gasto30d: number, leads30d: number) => ({ id, unidade, conta: "", nome: id, campanha: "", gasto30d, impressoes30d: 1000, cliques30d: 10, leads30d, conversas30d: 0, imagem: null });
    const lista = [a("caro", "Gama", 500, 10), a("barato", "Gama", 50, 10), a("acaso", "Gama", 2, 1), a("zero", "Gama", 150, 0), a("pouco", "Gama", 20, 0), a("inst", null, 10, 50)];
    const r = rankingDeAnuncios(anunciosDaUnidade(lista, "Gama"));
    expect(r.melhores.map((x) => x.id)).toEqual(["barato", "caro"]);
    expect(r.semContato.map((x) => x.id)).toEqual(["zero"]);
    expect(r.total).toBe(5);
    expect(anunciosDaUnidade(lista, null).some((x) => x.id === "inst")).toBe(false);
    expect(anunciosDaUnidade(lista, INSTITUCIONAL).map((x) => x.id)).toEqual(["inst"]);
  });
});

describe("anúncios do Meta (servidor)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("lê os anúncios com gasto nos últimos 30 dias e põe a miniatura", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes("/insights")) return { ok: true, status: 200, json: async () => ({ data: [
        { ad_id: "a1", ad_name: "Vídeo treino", campaign_name: "Captação", spend: "80", impressions: "4000", clicks: "40", actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "16" }] },
        { ad_id: "a2", ad_name: "Parado", campaign_name: "X", spend: "0" },
      ] }) };
      return { ok: true, status: 200, json: async () => ({ data: [{ id: "a1", creative: { thumbnail_url: "https://img/a1.jpg" } }] }) };
    }));
    const lista = await anunciosDaConta(conta, "tk", "2026-11-10");
    expect(lista).toEqual([expect.objectContaining({ id: "a1", unidade: "Asa Norte", gasto30d: 80, conversas30d: 16, imagem: "https://img/a1.jpg" })]);
    expect(decodeURIComponent(urls[0])).toContain('"since":"2026-10-12"');
    expect(urls[1]).toContain("act_1/ads?");
    expect(decodeURIComponent(urls[1])).toContain('"value":["a1"]');
  });

  it("anúncio apagado fica sem miniatura e continua no ranking", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/insights")
      ? { ok: true, status: 200, json: async () => ({ data: [{ ad_id: "a1", spend: "10" }, { ad_id: "apagado", spend: "5" }] }) }
      : { ok: true, status: 200, json: async () => ({ data: [{ id: "a1", creative: { image_url: "https://img/a1-grande.jpg", thumbnail_url: "https://img/a1.jpg" } }] }) })));
    const lista = await anunciosDaConta(conta, "tk", "2026-11-10");
    expect(lista.map((a: { id: string; imagem: string | null }) => [a.id, a.imagem])).toEqual([["a1", "https://img/a1-grande.jpg"], ["apagado", null]]);
  });

  it("sem miniatura o anúncio continua", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/insights")
      ? { ok: true, status: 200, json: async () => ({ data: [{ ad_id: "a1", spend: "10" }] }) }
      : { ok: false, status: 500, json: async () => ({}) })));
    expect((await anunciosDaConta(conta, "tk", "2026-11-10"))[0]).toMatchObject({ id: "a1", imagem: null });
  });
});

describe("compras pelo pixel", () => {
  it("não conta a mesma compra duas vezes e lê o valor", async () => {
    // @ts-expect-error módulo JS do servidor
    const { comprasDe } = await import("../../../server/meta.js");
    const acoes = [{ action_type: "purchase", value: "4" }, { action_type: "offsite_conversion.fb_pixel_purchase", value: "4" }, { action_type: "lead", value: "9" }];
    const valores = [{ action_type: "purchase", value: "519.6" }, { action_type: "omni_purchase", value: "519.6" }];
    expect(comprasDe(acoes, valores)).toEqual({ compras: 4, valorCompras: 519.6 });
    expect(comprasDe(undefined, undefined)).toEqual({ compras: 0, valorCompras: 0 });
  });

  it("soma as compras na rede e aceita meses antigos sem compras", async () => {
    const { investimentoDoMes } = await import("@/data/campanhas");
    const mes = { geradoEm: "", erros: [], unidades: {
      Gama: { investimento: 100, impressoes: 1, cliques: 1, leads: 1, conversas: 1, compras: 2, valorCompras: 200 },
      Itapoã: { investimento: 50, impressoes: 1, cliques: 1, leads: 1, conversas: 1 },
    } };
    expect(investimentoDoMes(mes, null)).toMatchObject({ investimento: 150, compras: 2, valorCompras: 200 });
  });
});

describe("investimento como parte do faturamento", () => {
  it("unidade, rede (só quem tem investimento lido) e Institucional", async () => {
    const { pctDoFaturamento, INSTITUCIONAL } = await import("@/data/campanhas");
    const r = (investimento: number) => ({ investimento, impressoes: 0, cliques: 0, leads: 0, conversas: 0 });
    const mes = { geradoEm: "", erros: [], unidades: { Gama: r(1000), Itapoã: r(500), Rede: r(9999), Ceilândia: r(0) } };
    const fat: Record<string, number> = { Gama: 100000, Itapoã: 50000, Ceilândia: 80000, Sobradinho: 200000 };
    const de = (n: string) => fat[n];
    expect(pctDoFaturamento(mes, "Gama", de)).toBeCloseTo(1);
    expect(pctDoFaturamento(mes, null, de)).toBeCloseTo(1); // 1.500 / 150.000 (Ceilândia sem investimento e Sobradinho sem conta não entram)
    expect(pctDoFaturamento(mes, INSTITUCIONAL, de)).toBeNull();
    expect(pctDoFaturamento(mes, "Sobradinho", de)).toBeNull();
  });
});
