import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { campanhasDaUnidade, custoPorContato, INSTITUCIONAL, investimentoDoMes, nomeDoObjetivo, type Campanha } from "@/data/campanhas";
import { InvestimentoMeta } from "@/components/InvestimentoMeta";
import { CampanhasNoAr } from "@/components/CampanhasNoAr";

const c = (o: Partial<Campanha>): Campanha => ({ id: "1", unidade: "Gama", conta: "WG 2 - Gama", nome: "X", objetivo: null, inicio: null, fim: null, orcamentoDiario: null, gasto7d: 0, impressoes7d: 0, cliques7d: 0, leads7d: 0, conversas7d: 0, ...o });

describe("campanhas", () => {
  it("unidade mostra só as dela; rede soma as unidades; a Institucional fica separada", () => {
    const l = [c({ id: "a", gasto7d: 10 }), c({ id: "b", unidade: "Itapoã", gasto7d: 99 }), c({ id: "r", unidade: null, gasto7d: 50 })];
    expect(campanhasDaUnidade(l, "Gama").map((x) => x.id)).toEqual(["a"]);
    expect(campanhasDaUnidade(l, null).map((x) => x.id)).toEqual(["b", "a"]);
    expect(campanhasDaUnidade(l, INSTITUCIONAL).map((x) => x.id)).toEqual(["r"]);
  });
  it("custo por contato só existe com contatos", () => {
    expect(custoPorContato(c({ gasto7d: 100 }))).toBeNull();
    expect(custoPorContato(c({ gasto7d: 100, leads7d: 3, conversas7d: 1 }))).toBe(25);
  });
  it("traduz o objetivo e mantém o desconhecido legível", () => {
    expect(nomeDoObjetivo("OUTCOME_LEADS")).toBe("Geração de leads");
    expect(nomeDoObjetivo("OUTCOME_NOVO")).toBe("novo");
    expect(nomeDoObjetivo(null)).toBe("—");
  });
  it("antes de carregar mostra o estado de espera, sem quebrar", () => {
    expect(renderToString(<CampanhasNoAr unit="Gama" />)).toContain("Campanhas no ar");
  });
});

describe("investimento do Meta no mês", () => {
  it("investimento da unidade, da rede (sem a Institucional) e da Institucional", () => {
    const z = { impressoes: 0, cliques: 0, leads: 0, conversas: 0 };
    const mes = { geradoEm: "", erros: [], unidades: { Gama: { ...z, investimento: 300 }, Itapoã: { ...z, investimento: 200 }, Rede: { ...z, investimento: 50 } } };
    expect(investimentoDoMes(mes, "Gama")?.investimento).toBe(300);
    expect(investimentoDoMes(mes, null)?.investimento).toBe(500); // rede = unidades, sem a Institucional
    expect(investimentoDoMes(mes, INSTITUCIONAL)?.investimento).toBe(50);
    expect(investimentoDoMes(mes, "Sobradinho")).toBeNull();
    expect(investimentoDoMes(undefined, null)).toBeNull();
  });
  it("antes de carregar mostra o estado de espera, sem quebrar", () => {
    expect(renderToString(<InvestimentoMeta unit={null} month="2026-11" />)).toContain("Investimento no Meta");
    expect(renderToString(<InvestimentoMeta unit={INSTITUCIONAL} month="2026-11" />)).toContain("Investimento no Meta");
  });
});
