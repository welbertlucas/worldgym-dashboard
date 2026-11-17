import { describe, expect, it } from "vitest";
import { ID_BIG, RANKINGS, mesDoAnoAnterior, rotuloDoPeriodo, serieMensal, mesesParaRelatorio, montarRelatorio, resumoDosSlides } from "@/data/relatorio";
import { month, unit } from "./helpers";

const dados = [
  month("2025-10", [unit("Asa Sul", { faturamento: 100000 }), unit("Gama", { faturamento: 50000 })]),
  month("2026-10", [unit("Asa Sul", { faturamento: 120000, nps: 80, notaGoogle: 4.6 }), unit("Gama", { faturamento: 40000 }), unit("Nova", { faturamento: 30000 })]),
];

describe("relatório", () => {
  it("mês do ano anterior e meses fechados", () => {
    expect(mesDoAnoAnterior("2026-10")).toBe("2025-10");
    expect(rotuloDoPeriodo("2026-11")).toBe("1-30 nov/26");
    expect(rotuloDoPeriodo("2026-02")).toBe("1-28 fev/26");
    expect(mesesParaRelatorio(["2026-09", "2026-10", "2026-11"], new Date(2026, 10, 17))).toEqual(["2026-10", "2026-09"]);
  });

  it("ranking de faturamento em ordem e crescimento só das unidades com base", () => {
    const m = montarRelatorio(dados, "2026-10", ["fat", "cresc"], null)!;
    expect(m.rankings[0].itens.map((i) => i[0])).toEqual(["Asa Sul", "Gama", "Nova"]);
    const c = m.rankings[1];
    expect(c.itens).toEqual([["Asa Sul", 20], ["Gama", -20]]);
    expect(c.nota).toContain("Nova");
  });

  it("notas zeradas ficam de fora e o escopo restringe as unidades", () => {
    const m = montarRelatorio(dados, "2026-10", ["nps", "google"], ["Asa Sul", "Gama"])!;
    expect(m.rankings.map((r) => [r.id, r.itens.length])).toEqual([["nps", 1], ["google", 1]]);
    expect(m.nUnidades).toBe(2);
    expect(m.escopo).toBe("2 unidades");
  });

  it("números gerais comparam com o ano anterior e o resumo lista os slides", () => {
    const m = montarRelatorio(dados, "2026-10", [ID_BIG, "fat"], ["Asa Sul", "Gama"])!;
    const fat = m.big![0];
    expect(fat.variacao).toBeCloseTo(6.67, 1);
    expect(fat.anterior).toContain("150");
    expect(resumoDosSlides(m)).toEqual(["Capa", "Números gerais", "Faturamento", "Encerramento"]);
  });

  it("sem o mês no painel ou sem unidade no escopo devolve nada; sem ano anterior não há crescimento", () => {
    expect(montarRelatorio(dados, "2024-01", ["fat"], null)).toBeNull();
    expect(montarRelatorio(dados, "2026-10", ["fat"], ["Inexistente"])).toBeNull();
    expect(montarRelatorio([dados[1]], "2026-10", ["cresc"], null)!.rankings).toHaveLength(0);
  });

  it("uma unidade só vira cartão de destaque, com variação e ano anterior", () => {
    const m = montarRelatorio(dados, "2026-10", ["fat", "inad", "cresc", "nps"], ["Asa Sul"])!;
    const [fat, cresc, inad, nps] = m.rankings;
    expect(fat.itens).toEqual([]);
    expect(fat.cartao!.valor).toBe("R$ 120.000");
    expect(fat.cartao!.variacao).toBeCloseTo(20, 5);
    expect(fat.cartao!.anterior).toContain("100.000");
    expect(inad.cartao!.emPontos).toBe(true);
    expect(inad.cartao!.menorMelhor).toBe(true);
    expect(cresc.cartao!.valor).toBe("+20,0%");
    expect(nps.cartao!.anterior).toBeNull(); // sem nota no ano anterior
    expect(montarRelatorio(dados, "2026-10", ["inad"], ["Nova"])!.rankings[0].cartao!.variacao).toBeNull(); // sem mês igual no ano anterior
    expect(montarRelatorio(dados, "2026-10", ["fat", "cresc"], ["Nova"])!.rankings.map((r) => r.id)).toEqual(["fat"]); // sem base: sem crescimento
  });

  it("cartão de uma unidade traz a barra da meta (nível mais alto cadastrado); inadimplência só diz se atingiu", () => {
    const metas = [
      { month: "2026-10", unit: "Asa Sul", key: "faturamento", bronze: 100000, ouro: 200000 },
      { month: "2026-10", unit: "Asa Sul", key: "inadimplenciaPerc", ouro: 5 },
    ] as never[];
    const m = montarRelatorio(dados, "2026-10", ["fat", "inad", "nc"], ["Asa Sul"], metas)!;
    const [fat, nc, inad] = m.rankings;
    expect(fat.cartao!.meta!.pct).toBeCloseTo(60, 5);
    expect(fat.cartao!.meta!.texto).toBe("60% da meta ouro · R$ 200.000");
    expect(inad.cartao!.meta!.texto).toBe("Meta ouro: 5,0% · atingida"); // 4% <= 5%
    expect(nc.cartao!.meta).toBeUndefined(); // sem meta cadastrada
    expect(montarRelatorio(dados, "2026-10", ["fat"], ["Asa Sul"])!.rankings[0].cartao!.meta).toBeUndefined();
  });

  it("evolução: até 6 meses terminando no do relatório, pulando mês sem dado, com a meta como linha", () => {
    const meses = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((m, i) =>
      month(m, [unit("Asa Sul", { faturamento: 100000 + i * 10000, ticketMedio: m === "2026-07" ? 0 : 130 })]));
    const fat = RANKINGS.find((r) => r.id === "fat")!;
    const s = serieMensal(meses, "2026-10", "Asa Sul", fat)!;
    expect(s.rotulos).toEqual(["mai/26", "jun/26", "jul/26", "ago/26", "set/26", "out/26"]);
    expect(s.valores.at(-1)).toBe(170000);
    expect(s.destaque).toBe(5);
    const tk = RANKINGS.find((r) => r.id === "tk")!;
    expect(serieMensal(meses, "2026-10", "Asa Sul", tk)!.rotulos).not.toContain("jul/26"); // ticket zerado = sem dado
    expect(serieMensal([meses[7]], "2026-10", "Asa Sul", fat)).toBeUndefined(); // um período só não é evolução
    const metas = [{ month: "2026-10", unit: "Asa Sul", key: "faturamento", prata: 150000, ouro: 220000 }] as never[];
    const m = montarRelatorio(meses, "2026-10", ["fat"], ["Asa Sul"], metas)!;
    expect(m.rankings[0].cartao!.serie!.metaLinha).toEqual({ valor: 220000, rotulo: "Meta ouro: R$ 220.000" });
    expect(montarRelatorio(meses, "2026-10", ["fat"], ["Asa Sul"])!.rankings[0].cartao!.serie!.metaLinha).toBeUndefined();
  });
});
