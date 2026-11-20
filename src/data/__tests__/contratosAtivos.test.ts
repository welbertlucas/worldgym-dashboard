import { describe, expect, it } from "vitest";
import { contratosView, planosDeContratos, somaContratos, pctTexto } from "@/data/contratosAtivos";

const gama = { contratosAtivos: 2000, contratosEspeciais: 20, contratosPersonal: 40, contratosLocal: 1000, contratosParcial: 500, contratosRede: 500 };
const itapoa = { contratosAtivos: 1000, contratosEspeciais: 10, contratosPersonal: 10, contratosLocal: 600, contratosParcial: 100, contratosRede: 300 };

describe("contratos ativos em fatias", () => {
  it("todo percentual é sobre o total de contratos ativos", () => {
    const v = contratosView(gama)!;
    expect(v.especiais).toEqual({ n: 20, pct: 1 });
    expect(v.personal).toEqual({ n: 40, pct: 2 });
    expect(v.local).toEqual({ n: 1500, pct: 75 }); // local = local + 2 a 9
    expect(v.local.pct + v.rede.pct).toBe(100);
  });

  it("parcial que sobrou de foto antiga não entra quando local + rede já fecham o total", () => {
    // Sobradinho, nov/2026: 3.633 contratos, local 3.633, rede 0 e 1.024 de "2 a 9 unidades" de uma foto antiga.
    const sobradinho = { contratosAtivos: 3633, contratosLocal: 3633, contratosParcial: 1024, contratosRede: 0 };
    expect(contratosView(sobradinho)!.local).toEqual({ n: 3633, pct: 100 });
    const r = somaContratos([sobradinho, gama])!;
    expect(r.local.n).toBe(3633 + 1500);
    expect(r.local.pct + r.rede.pct).toBeCloseTo(100);
  });

  it("sem contagem (mês sem foto do EVO) não há visão", () => {
    expect(contratosView({})).toBeNull();
    expect(somaContratos([{}, {}])).toBeNull();
  });

  it("a rede soma só as unidades que têm contagem", () => {
    const r = somaContratos([gama, itapoa, {}])!;
    expect(r.total).toBe(3000);
    expect(r.especiais.n).toBe(30);
    expect(r.rede).toEqual({ n: 800, pct: (800 / 3000) * 100 });
    expect(r.local.n).toBe(2200);
  });

  it("formata percentual com vírgula", () => {
    expect(pctTexto(17.44)).toBe("17,4%");
  });
});

describe("planosDeContratos", () => {
  const units = [
    { name: "Gama", contratosAtivos: 10, contratosPlanos: [["MENSAL", 6], ["FIT", 4]] },
    { name: "Itapoã", contratosAtivos: 8, contratosPlanos: [["MENSAL", 3], ["REDE", 5]] },
    { name: "Sem foto", contratosAtivos: 0 },
  ] as never;

  it("na rede soma planos de mesmo nome e ordena do maior para o menor", () => {
    expect(planosDeContratos(units)).toEqual({ planos: [["MENSAL", 9], ["REDE", 5], ["FIT", 4]], total: 18 });
  });

  it("com uma unidade em foco, só os planos dela", () => {
    expect(planosDeContratos(units, "Gama")).toEqual({ planos: [["MENSAL", 6], ["FIT", 4]], total: 10 });
  });

  it("sem a foto dos planos não devolve nada", () => {
    expect(planosDeContratos(units, "Sem foto")).toBeNull();
    expect(planosDeContratos([], null)).toBeNull();
  });
});
