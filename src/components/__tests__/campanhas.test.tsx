import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { campanhasDaUnidade, custoPorContato, investimentoDoMes, nomeDoObjetivo, origemMeta, retornoDoMeta, type Campanha } from "@/data/campanhas";
import { RetornoMeta } from "@/components/RetornoMeta";
import { CampanhasNoAr } from "@/components/CampanhasNoAr";

const c = (o: Partial<Campanha>): Campanha => ({ id: "1", unidade: "Gama", conta: "WG 2 - Gama", nome: "X", objetivo: null, inicio: null, fim: null, orcamentoDiario: null, gasto7d: 0, impressoes7d: 0, cliques7d: 0, leads7d: 0, conversas7d: 0, ...o });

describe("campanhas", () => {
  it("filtra pela unidade e junta as da rede, as que mais gastam primeiro", () => {
    const l = [c({ id: "a", gasto7d: 10 }), c({ id: "b", unidade: "Itapoã", gasto7d: 99 }), c({ id: "r", unidade: null, gasto7d: 50 })];
    expect(campanhasDaUnidade(l, "Gama").map((x) => x.id)).toEqual(["r", "a"]);
    expect(campanhasDaUnidade(l, null).map((x) => x.id)).toEqual(["b", "r", "a"]);
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

describe("CAC e ROI do Meta", () => {
  it("conta como Meta só as origens de Instagram, Facebook e anúncio", () => {
    const o = origemMeta({ Instagram: [10, 4], "Facebook/Instagram": [5, 1], Convite: [20, 9], "Anúncio Pago": [2, 1], Passante: [3, 3] });
    expect(o.nomes).toEqual(["Anúncio Pago", "Facebook/Instagram", "Instagram"]);
    expect(o).toMatchObject({ cadastradas: 17, convertidas: 6 });
  });
  it("CAC = investimento ÷ alunos; ROI pelo LTV; sem aluno ou sem LTV fica sem número", () => {
    expect(retornoDoMeta(1000, 4, 1500)).toEqual({ cac: 250, retorno: 6000, roi: 5 });
    expect(retornoDoMeta(1000, 0, 1500)).toMatchObject({ cac: null, roi: null });
    expect(retornoDoMeta(1000, 4, 0)).toMatchObject({ cac: 250, roi: null });
  });
  it("investimento da unidade ou da rede (com a Institucional)", () => {
    const z = { impressoes: 0, cliques: 0, leads: 0, conversas: 0 };
    const mes = { geradoEm: "", erros: [], unidades: { Gama: { ...z, investimento: 300 }, Itapoã: { ...z, investimento: 200 }, Rede: { ...z, investimento: 50 } } };
    expect(investimentoDoMes(mes, "Gama")?.investimento).toBe(300);
    expect(investimentoDoMes(mes, null)?.investimento).toBe(550);
    expect(investimentoDoMes(mes, "Sobradinho")).toBeNull();
    expect(investimentoDoMes(undefined, null)).toBeNull();
  });
  it("antes de carregar mostra o estado de espera, sem quebrar", () => {
    expect(renderToString(<RetornoMeta unit={null} month="2026-11" />)).toContain("CAC e ROI");
  });
});
