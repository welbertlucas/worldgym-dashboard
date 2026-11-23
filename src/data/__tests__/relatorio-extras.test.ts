import { describe, expect, it } from "vitest";
import { ID_CAMPANHA, ID_PROJECAO, ID_SALDO, montarExtras, slideCampanha, slideProjecao, slideSaldo } from "@/data/relatorioExtras";
import { previaDoItem } from "@/data/relatorioOpcoes";
import { montarRelatorioSemanal } from "@/data/relatorioSemana";
import { month, unit } from "./helpers";

// Números inventados: 30 dias com 10 contratos por dia; 4 semanas iguais de faturamento
const dias = (n: number, v = 10) => Array.from({ length: n }, () => v);
const semanas = (v: number) => [1, 2, 3, 4, 5].map(() => ({ totalVendas: v }));
const ant = (ym: string, n: number) => month(ym, [unit("Alfa", { vendasDia: dias(n), semanas: semanas(1000) as never })]);

describe("projeção de fechamento", () => {
  const meses = [ant("2026-08", 31), ant("2026-09", 30), ant("2026-10", 31),
    month("2026-11", [unit("Alfa", { vendasDia: [...dias(15, 12), ...dias(15, 0)], faturamento: 60000, semanas: semanas(1000) as never })])];
  it("projeta novos contratos e faturamento pela curva dos meses anteriores, com a meta", () => {
    const metas = [{ unit: "Alfa", month: "2026-11", key: "novosContratos", ouro: 400 }] as never;
    const s = slideProjecao(meses, "2026-11", ["Alfa"], false, { fechados: 15, parcial: true, metas })!;
    expect(s.blocos[0].nome).toBe("Novos contratos");
    // 180 vendidos em 15 dias; os meses anteriores tinham ~49% vendido até o dia 15 → ~367
    expect(Number(s.blocos[0].valor.replace(/\./g, ""))).toBeGreaterThan(355);
    expect(s.blocos[0].detalhe).toContain("180 até 15/11");
    expect(s.blocos[0].detalhe).toMatch(/% da meta ouro \(400\)/);
    expect(s.blocos[1].nome).toBe("Faturamento");
    expect(s.nota).toContain("ago, set, out");
  });
  it("não projeta antes do dia 10 nem em mês fechado", () => {
    expect(slideProjecao(meses, "2026-11", ["Alfa"], false, { fechados: 9, parcial: true })).toBeNull();
    expect(slideProjecao(meses, "2026-11", ["Alfa"], false, { fechados: 30, parcial: false })).toBeNull();
  });
});

describe("saldo de alunos", () => {
  it("soma início, entradas, saídas e o saldo das unidades", () => {
    const m = [month("2026-10", [
      unit("Alfa", { ativosIni: 1000, ativosFim: 1030, fluxoNovos: 80, fluxoRetornos: 20, fluxoCancelados: 50, fluxoVencidos: 20 }),
      unit("Beta", { ativosIni: 500, ativosFim: 490, fluxoNovos: 30, fluxoRetornos: 5, fluxoCancelados: 35, fluxoVencidos: 10 }),
    ])];
    const s = slideSaldo(m, "2026-10", ["Alfa", "Beta"], { fechados: 31, parcial: false })!;
    expect(s.blocos.map((b) => [b.nome, b.valor])).toEqual([["Ativos no início", "1.500"], ["Entradas", "+135"], ["Saídas", "−115"], ["Saldo líquido", "+20"]]);
    expect(s.blocos[0].detalhe).toBe("em 30/09");
    expect(s.blocos[3].cor).toBe("bom");
  });
  it("sem os ativos do EVO o slide não sai", () => {
    expect(slideSaldo([month("2026-10", [unit("Alfa")])], "2026-10", ["Alfa"], { fechados: 31, parcial: false })).toBeNull();
  });
});

describe("campanha", () => {
  const v = dias(30, 10); v[26] = 40; v[27] = 30; // 27 e 28 com mais vendas
  const m = [month("2026-11", [unit("Alfa", { vendasDia: v })])];
  it("conta os contratos dos dias escolhidos e compara com o ritmo do resto do mês", () => {
    const s = slideCampanha(m, "2026-11", ["Alfa"], { fechados: 28, parcial: true, campanha: { nome: "Black Friday", de: 27, ate: 30 } })!;
    expect(s.titulo).toBe("Black Friday");
    expect(s.blocos[0]).toMatchObject({ valor: "70", detalhe: "de 27/11 a 28/11 (campanha em andamento)" });
    expect(s.blocos[1].valor).toBe("35");
    expect(s.blocos[2]).toMatchObject({ valor: "10", detalhe: "campanha +250% sobre o ritmo normal" });
  });
  it("sem período, ou com a campanha ainda por começar, o slide não sai", () => {
    expect(slideCampanha(m, "2026-11", ["Alfa"], { fechados: 20, parcial: true, campanha: null })).toBeNull();
    expect(slideCampanha(m, "2026-11", ["Alfa"], { fechados: 20, parcial: true, campanha: { nome: "BF", de: 27, ate: 30 } })).toBeNull();
    expect(slideCampanha(m, "2026-11", ["Alfa"], { fechados: 28, parcial: true, campanha: { nome: "BF", de: 30, ate: 27 } })).toBeNull();
  });
});

describe("no relatório", () => {
  it("só monta o que foi marcado e a prévia mostra os dois primeiros números", () => {
    const m = [month("2026-10", [unit("Alfa", { ativosIni: 100, ativosFim: 110, fluxoNovos: 20, fluxoRetornos: 0, fluxoCancelados: 8, fluxoVencidos: 2, vendasDia: dias(31), semanas: semanas(1000) as never })])];
    const ex = montarExtras(m, "2026-10", [ID_SALDO, ID_CAMPANHA], ["Alfa"], true, { fechados: 31, parcial: false, campanha: { nome: "", de: 1, ate: 7 } });
    expect(ex.map((x) => x.id)).toEqual([ID_SALDO, ID_CAMPANHA]);
    expect(ex[1].titulo).toBe("Campanha");
    const rel = { ...montarRelatorioSemanal(m, "2026-10", 1, ["fat"], null, 31)!, extras: ex };
    expect(previaDoItem(rel, ID_SALDO)).toBe("Ativos no início 100 · Entradas +20");
    expect(previaDoItem(rel, ID_PROJECAO)).toBeNull();
  });
});
