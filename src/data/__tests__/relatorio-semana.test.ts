import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { limitesDaSemana as limitesServidor, semanasNoMes as semanasServidor } from "../../../server/semanas.js";
import { BASE_PEQUENA, ID_CONVERSAO, estadoDaSemana, limitesDaSemana, mesAnterior, montarRelatorioSemanal, rotuloDaSemana, semanasNoMes, temSemanas } from "@/data/relatorioSemana";
import { ID_BIG } from "@/data/relatorio";
import { month, unit } from "./helpers";

const com = (name: string, semanas: Record<string, number>[]) => unit(name, { semanas } as never);
const out = month("2026-10", [
  com("Asa Norte", [{ faturamento: 1000, novosContratos: 10, oportunidades: 20, conversoes: 5, cancelados: 4 }, { faturamento: 2000, novosContratos: 20, oportunidades: 40, conversoes: 10, cancelados: 8 }]),
  com("Gama", [{ faturamento: 500, novosContratos: 5, oportunidades: 4, conversoes: 1, cancelados: 2 }, { faturamento: 700, novosContratos: 7, oportunidades: 8, conversoes: 2, cancelados: 3 }]),
]);
const nov = month("2026-11", [
  com("Asa Norte", [{ faturamento: 1100, novosContratos: 12, oportunidades: 25, conversoes: 10, cancelados: 3 }, { faturamento: 900, novosContratos: 9, oportunidades: 10, conversoes: 2, cancelados: 5 }]),
  com("Gama", [{ faturamento: 450, novosContratos: 4, oportunidades: 5, conversoes: 1, cancelados: 2 }, { faturamento: 650, novosContratos: 6, oportunidades: 6, conversoes: 3, cancelados: 1 }]),
]);
const meses = [out, nov];

describe("semanas no painel (mesmas regras do servidor)", () => {
  it("limites, número de semanas, rótulo e mês anterior", () => {
    for (const mes of ["2026-10", "2026-11", "2027-02", "2028-02"]) {
      expect(semanasNoMes(mes)).toBe(semanasServidor(mes));
      for (let n = 0; n <= 6; n++) expect(limitesDaSemana(mes, n)).toEqual(limitesServidor(mes, n));
    }
    expect(rotuloDaSemana("2026-11", 2)).toBe("8-14 nov/26");
    expect(rotuloDaSemana("2026-11", 5)).toBe("29-30 nov/26");
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(temSemanas(nov)).toBe(true);
    expect(temSemanas(month("2026-09", [unit("A")]))).toBe(false);
  });

  it("estado da semana pelos dias fechados (dados até a véspera)", () => {
    expect(estadoDaSemana("2026-11", 2, 16)).toBe("fechada");
    expect(estadoDaSemana("2026-11", 3, 16)).toBe("andamento");
    expect(estadoDaSemana("2026-11", 4, 16)).toBe("futura");
    expect(estadoDaSemana("2026-11", 1, 7)).toBe("fechada");
    expect(estadoDaSemana("2026-11", 2, 7)).toBe("futura");
  });
});

describe("relatório semanal", () => {
  it("semana fechada compara com a mesma semana do mês anterior", () => {
    const m = montarRelatorioSemanal(meses, "2026-11", 1, [ID_BIG, "fat", "canc"], null, 30)!;
    expect(m.tipo).toBe("semana");
    expect(m.periodo).toBe("1-7 nov/26");
    expect(m.mesAnteriorCurto).toBe("1-7 out/26");
    const fat = m.big![0];
    expect(fat.valor).toBe("R$ 1.550");
    expect(fat.variacao).toBeCloseTo(3.33, 1); // 1550 contra 1500
    expect(fat.anterior).toBe("R$ 1.500");
    const canc = m.big!.find((k) => k.nome === "Cancelamentos")!;
    expect(canc.menorMelhor).toBe(true);
    expect(m.rankings.map((r) => r.id)).toEqual(["fat", "canc"]);
    expect(m.rankings[0].itens[0]).toEqual(["Asa Norte", 1100]);
    expect(m.parcialAte).toBeNull();
  });

  it("semana em andamento sai sem comparação e avisa até quando vão os dados; semana futura não gera", () => {
    const parcial = montarRelatorioSemanal(meses, "2026-11", 2, [ID_BIG], null, 10)!;
    expect(parcial.parcialAte).toBe("10/11");
    expect(parcial.mesAnteriorCurto).toBeNull();
    expect(parcial.big!.every((k) => k.variacao === null && k.anterior === null)).toBe(true);
    expect(montarRelatorioSemanal(meses, "2026-11", 3, [ID_BIG], null, 10)).toBeNull();
    expect(montarRelatorioSemanal(meses, "2026-11", 3, [ID_BIG], null, 30)).toBeNull(); // sem números nessa semana
  });

  it("conversão sempre com a base e aviso de base pequena", () => {
    const m = montarRelatorioSemanal(meses, "2026-11", 1, [ID_CONVERSAO], null, 30)!;
    const r = m.rankings[0];
    expect(r.bases).toEqual({ "Asa Norte": "10 de 25", Gama: "1 de 5, base pequena" });
    expect(BASE_PEQUENA).toBe(10);
    expect(r.itens).toEqual([["Asa Norte", 40], ["Gama", 20]]);
  });

  it("uma unidade só vira cartão com variação, base e semana anterior", () => {
    const m = montarRelatorioSemanal(meses, "2026-11", 1, ["fat", ID_CONVERSAO, "canc"], ["Asa Norte"], 30)!;
    const [fat, conv, canc] = m.rankings;
    expect(fat.itens).toEqual([]);
    expect(fat.cartao).toMatchObject({ valor: "R$ 1.100", anterior: "R$ 1.000  ·  1-7 out/26" });
    expect(fat.cartao!.variacao).toBeCloseTo(10, 5);
    expect(conv.cartao!.valor).toBe("40,0%");
    expect(conv.cartao!.anterior).toContain("10 de 25 oportunidades");
    expect(conv.cartao!.anterior).toContain("antes: 25,0%");
    expect(conv.cartao!.variacao).toBeCloseTo(15, 5); // pontos percentuais
    expect(conv.cartao!.emPontos).toBe(true);
    expect(canc.cartao!.menorMelhor).toBe(true);
    expect(m.escopo).toBe("Asa Norte");
  });

  it("sem o mês anterior guardado não compara, e sem semanas no mês não há relatório", () => {
    const m = montarRelatorioSemanal([nov], "2026-11", 1, [ID_BIG], null, 30)!;
    expect(m.big!.every((k) => k.variacao === null)).toBe(true);
    expect(montarRelatorioSemanal([month("2026-11", [unit("A")])], "2026-11", 1, [ID_BIG], null, 30)).toBeNull();
  });

  it("rosca de conversão traz oportunidades e convertidas da semana", () => {
    const m = montarRelatorioSemanal(meses, "2026-11", 1, [ID_BIG], null, 30)!;
    expect(m.oportunidades).toBe(30);
    expect(m.convertidas).toBe(11);
    expect(m.conversao).toBeCloseTo(36.67, 1);
  });
});
