import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { limitesDaSemana as limitesServidor, semanasNoMes as semanasServidor } from "../../../server/semanas.js";
import { BASE_PEQUENA, ID_CONVERSAO, ID_MES_ATE_AQUI, metaDoEscopo, serieSemanal, estadoDaSemana, limitesDaSemana, mesAnterior, montarRelatorioSemanal, rotuloDaSemana, semanasNoMes, temSemanas } from "@/data/relatorioSemana";
import { ID_BIG, ID_COMPL, resumoDosSlides } from "@/data/relatorio";
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

  it("evolução semanal: últimas semanas atravessando o mês, com a mesma semana do mês anterior marcada", () => {
    const m = montarRelatorioSemanal(meses, "2026-11", 2, ["fat"], ["Asa Norte"], 30)!;
    const s = m.rankings[0].cartao!.serie!;
    expect(s.rotulos).toEqual(["1-7 out", "8-14 out", "1-7 nov", "8-14 nov"]);
    expect(s.valores).toEqual([1000, 2000, 1100, 900]);
    expect(s.destaque).toBe(3);
    expect(s.comparada).toBe(1); // 8-14 out
    expect(s.parcial).toBe(false);
    const parcial = serieSemanal(meses, "2026-11", 2, "Asa Norte", (x) => x.faturamento, 10)!;
    expect(parcial.parcial).toBe(true);
    expect(serieSemanal(meses, "2026-11", 3, "Asa Norte", (x) => x.faturamento, 30)).toBeUndefined(); // sem número na semana pedida
  });

  it("O mês até aqui: acumulado das semanas contra o mesmo ponto do mês anterior e contra a meta (soma das unidades), com o ritmo do mês", () => {
    const metas = [
      { month: "2026-11", unit: "Asa Norte", key: "faturamento", prata: 4000, ouro: 5000 },
      { month: "2026-11", unit: "Gama", key: "faturamento", ouro: 3000 },
    ] as never[];
    const m = montarRelatorioSemanal(meses, "2026-11", 2, [ID_MES_ATE_AQUI], null, 30, metas)!;
    const a = m.mesAteAqui!;
    expect(a.periodo).toBe("1-14 nov/26");
    expect(a.dias).toBe(14);
    expect(a.ritmo).toBeCloseTo(46.67, 1);
    const fat = a.itens.find((i) => i.nome === "Faturamento")!;
    expect(fat.valor).toBe("R$ 3.100"); // 1100+900 + 450+650
    expect(fat.variacao).toBeCloseTo(-26.19, 1); // contra 4.200 (1000+2000+500+700)
    expect(fat.anterior).toBe("R$ 4.200 no mesmo ponto de out/26");
    expect(fat.meta!.texto).toBe("39% da meta ouro · R$ 8.000");
    expect(a.itens.find((i) => i.nome === "Novos contratos")!.meta).toBeUndefined(); // sem meta cadastrada
    expect(m.rankings).toHaveLength(0);
    // uma unidade só usa a meta dela; semana em andamento conta até onde os dados vão e não compara
    const um = montarRelatorioSemanal(meses, "2026-11", 2, [ID_MES_ATE_AQUI], ["Asa Norte"], 10, metas)!.mesAteAqui!;
    expect(um.dias).toBe(10);
    expect(um.itens[0].variacao).toBeNull();
    expect(um.itens[0].meta!.texto).toBe("40% da meta ouro · R$ 5.000");
  });

  it("meta do escopo: TOTAL para a rede; soma das unidades no nível que todas têm; nada se faltar uma", () => {
    const base = { month: "2026-11", key: "faturamento" };
    expect(metaDoEscopo([{ ...base, unit: "TOTAL", ouro: 9000 }] as never[], "2026-11", "faturamento", ["A", "B"], true)).toEqual({ nivel: "ouro", alvo: 9000 });
    expect(metaDoEscopo([{ ...base, unit: "A", ouro: 1, prata: 1 }, { ...base, unit: "B", prata: 2 }] as never[], "2026-11", "faturamento", ["A", "B"], false)).toEqual({ nivel: "prata", alvo: 3 });
    expect(metaDoEscopo([{ ...base, unit: "A", ouro: 1 }] as never[], "2026-11", "faturamento", ["A", "B"], false)).toBeUndefined();
  });
});

describe("relatório semanal: contratos vendidos, mês até aqui no Overview e receitas complementares", () => {
  const cv = month("2026-11", [
    com("Asa Norte", [{ faturamento: 1100, vendasContratos: 30, oportunidades: 10, cancelados: 3, novosContratos: 12, diarias: 100, personal: 50, kids: 20, plus: 10, proMais: 5, camisetas: 8, coqueteleiras: 7 }, { faturamento: 900, vendasContratos: 20, oportunidades: 8, cancelados: 2, diarias: 60, camisetas: 4 }]),
    com("Gama", [{ faturamento: 450, vendasContratos: 10, oportunidades: 5, cancelados: 1, novosContratos: 4, diarias: 40, personal: 30 }, { faturamento: 650, vendasContratos: 15, oportunidades: 4, cancelados: 2, diarias: 10 }]),
  ]);
  const antes = month("2026-10", [com("Asa Norte", [{ faturamento: 1000, vendasContratos: 25, diarias: 100, personal: 50 }]), com("Gama", [{ faturamento: 500, vendasContratos: 9, diarias: 50 }])]);

  it("contratos vendidos entra no Overview da semana e no mês até aqui, em letras menores no mesmo slide", () => {
    const m = montarRelatorioSemanal([antes, cv], "2026-11", 1, [ID_BIG, ID_MES_ATE_AQUI], null, 20, [])!;
    expect(m.big!.map((b) => b.nome)).toContain("Contratos vendidos");
    expect(m.big!.find((b) => b.nome === "Contratos vendidos")!.valor).toBe("40");
    // o mês até aqui soma as semanas 1 a N: aqui só a semana 1 (30 + 10)
    expect(m.mesAteAqui!.itens.find((i) => i.nome === "Contratos vendidos")!.valor).toBe("40");
    const m2 = montarRelatorioSemanal([antes, cv], "2026-11", 2, [ID_BIG, ID_MES_ATE_AQUI], null, 20, [])!;
    expect(m2.mesAteAqui!.itens.find((i) => i.nome === "Contratos vendidos")!.valor).toBe("75"); // 30 + 10 + 20 + 15
    // oportunidades e cancelamentos também têm o acumulado do mês: o número da semana (grande) não é o do mês
    expect(m2.big!.find((b) => b.nome === "Oportunidades")!.valor).toBe("12"); // semana 2: 8 + 4
    expect(m2.mesAteAqui!.itens.find((i) => i.nome === "Oportunidades")!.valor).toBe("27"); // semanas 1 e 2: 10 + 8 + 5 + 4
    expect(m2.mesAteAqui!.itens.find((i) => i.nome === "Cancelamentos")!.valor).toBe("8");
    expect(resumoDosSlides(m)).toEqual(["Capa", "Overview", "Encerramento"]); // o mês até aqui não é mais um slide à parte
    // marcar só "o mês até aqui" também gera os Overview (é neles que ele aparece)
    expect(montarRelatorioSemanal([antes, cv], "2026-11", 1, [ID_MES_ATE_AQUI], null, 20, [])!.big).not.toBeNull();
  });

  it("semana de um mês sem o número de contratos vendidos fica sem ele (não soma como zero)", () => {
    const m = montarRelatorioSemanal(meses, "2026-11", 1, [ID_BIG], null, 20, [])!;
    expect(m.big!.map((b) => b.nome)).not.toContain("Contratos vendidos");
  });

  it("receitas complementares: todas num slide só, com a legenda; sem os indicadores soltos", () => {
    const m = montarRelatorioSemanal([antes, cv], "2026-11", 1, [ID_COMPL], null, 20, [])!;
    const c = m.complementares!;
    expect(c.total).toBe(100 + 50 + 20 + 10 + 5 + 8 + 7 + 40 + 30); // 270
    expect(c.itens[0]).toEqual(["Diárias", 140]);
    expect(c.itens).toEqual([["Diárias", 140], ["Taxa de personal", 80], ["Brinquedoteca", 20], ["WG Plus", 10], ["Camisetas", 8], ["Coqueteleiras", 7], ["Pro+", 5]]); // da maior para a menor
    expect(c.participacao).toBeCloseTo((270 / 1550) * 100, 1);
    expect(c.legenda).toContain("além dos planos");
    expect(resumoDosSlides(m)).toContain("Receitas complementares");
    expect(m.rankings).toEqual([]); // diárias, personal, camisetas e coqueteleiras não são mais slides soltos
  });
});
