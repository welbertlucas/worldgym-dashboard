import { describe, expect, it } from "vitest";
import {
  contexto, csvDeDevedoras, devedoras, filtroInicial, fraseDeAbertura, matrizDeSituacao, resumoDoPeriodo, saldoDe, semCobranca, serieMensal, temSaldoCalculado, unidadesFiltradas,
} from "@/data/royalties";
import { MODELO } from "./royalties-fixture";

const c = contexto(MODELO);
const f0 = filtroInicial(c);

describe("royalties: resumo do período", () => {
  it("soma recebido por modalidade; o que não tem unidade entra só na taxa fixa e no total", () => {
    const r = resumoDoPeriodo(c, f0);
    expect(r.fixa).toBe(100 + 100 + 50 * 4 + 7 + 3); // Alfa + Beta + Sigma + não mapeado
    expect(r.royalties).toBe(65 + 4);
    expect(r.total).toBe(r.fixa + r.royalties);
    expect(r.naoMapeado).toBe(3);
  });

  it("saldo devedor vem de Pendências; devedora é quem tem saldo; 'cobradas' inclui quem tem cobrança calculada", () => {
    const r = resumoDoPeriodo(c, f0);
    expect(r.saldoFixa).toBe(200);
    expect(r.saldoRoyalties).toBe(15);
    expect(r.saldoTotal).toBe(215);
    expect(r.devedoras).toEqual(["Alfa", "Gama"]);
    expect(r.cobradas).toEqual(["Alfa", "Beta", "Gama"]); // Delta (royalties sem valor esperado) e Sigma (sem Pendências) ficam de fora
    expect(semCobranca(c, "Sigma")).toBe(true);
    expect(temSaldoCalculado(c, "Delta")).toBe(false);
  });

  it("filtros: modalidade, só devedoras e unidade; o não mapeado some quando há unidade ou só royalties", () => {
    expect(unidadesFiltradas(c, { ...f0, tipo: "royalties" })).toEqual(["Gama", "Delta"]);
    expect(unidadesFiltradas(c, { ...f0, soDevedoras: true })).toEqual(["Alfa", "Gama"]);
    expect(resumoDoPeriodo(c, { ...f0, unidades: ["Alfa"] }).total).toBe(200);
    expect(resumoDoPeriodo(c, { ...f0, tipo: "royalties" }).naoMapeado).toBe(0);
    expect(resumoDoPeriodo(c, { ...f0, de: 1, ate: 3 }).naoMapeado).toBe(0); // o não mapeado é de jan
  });

  it("a frase de abertura muda com 0, 1 ou várias unidades", () => {
    expect(fraseDeAbertura(c, f0, resumoDoPeriodo(c, f0))).toMatch(/recebidos entre jan\/26 e abr\/26/);
    const um = { ...f0, unidades: ["Beta"] };
    expect(fraseDeAbertura(c, um, resumoDoPeriodo(c, um))).toMatch(/^Beta pagou .* Está em dia\.$/);
    const sem = { ...f0, unidades: ["Sigma"] };
    expect(fraseDeAbertura(c, sem, resumoDoPeriodo(c, sem))).toContain("Sem cobrança, sem saldo devedor.");
    const dois = { ...f0, unidades: ["Alfa", "Gama"] };
    expect(fraseDeAbertura(c, dois, resumoDoPeriodo(c, dois))).toMatch(/^2 unidades: .* em aberto em 2 unidades\.$/);
  });
});

describe("royalties: devedoras, série e matriz", () => {
  it("devedoras do maior saldo para o menor, e o CSV fecha com o total", () => {
    expect(devedoras(c, f0).map((d) => [d.unidade, d.saldo])).toEqual([["Alfa", 200], ["Gama", 15]]);
    const csv = csvDeDevedoras(c, f0).split("\r\n");
    expect(csv[0]).toContain("Saldo devedor (R$)");
    expect(csv[csv.length - 1]).toBe('"Total";;215,00;;;');
    expect(csv[1]).toContain('"Alfa";"Taxa fixa";200,00');
  });

  it("série mensal separa taxa fixa e royalties e marca o mês parcial", () => {
    const s = serieMensal(c, f0);
    expect(s.map((p) => p.label)).toEqual(["jan/26", "fev/26", "mar/26", "abr/26"]);
    expect(s[0]).toMatchObject({ fixa: 100 + 50 + 7 + 3, royalties: 11, naoMapeado: 3, parcial: false });
    expect(s[3].parcial).toBe(true);
    expect(serieMensal(c, { ...f0, tipo: "royalties" }).every((p) => p.fixa === 0)).toBe(true);
  });

  it("matriz: só unidades com cobrança no período, sem as ocultas, em ordem de saldo, com o ajuste marcado", () => {
    const m = matrizDeSituacao(c, f0);
    expect(m.map((l) => l.unidade)).toEqual(["Alfa", "Gama", "Beta"]); // Delta só tem traços; Oculta fica de fora
    expect(m[0]).toMatchObject({ naoPagos: 2, saldo: 200 });
    expect(m[2].celulas[1]).toMatchObject({ situacao: "pago", ajuste: true });
    expect(matrizDeSituacao(c, { ...f0, tipo: "fixa" }).map((l) => l.unidade)).toEqual(["Alfa", "Beta"]);
    expect(saldoDe(c, "Delta")).toBe(0);
  });
});
