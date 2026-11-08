import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { campanhasDaUnidade, custoPorContato, nomeDoObjetivo, type Campanha } from "@/data/campanhas";
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
