import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
// @ts-expect-error módulo JS do servidor
import { resumirVendas, nomeVendedor, SEM_VENDEDOR } from "../../../server/vendas.js";
// @ts-expect-error módulo JS do servidor
import * as vis from "../../../server/visibilidade.js";
import { VendedoresVendas } from "@/components/VendedoresVendas";
import { somarVendedores, somarVendedoresTotal, type UnitData } from "@/data/dashboardData";

const venda = (quem: string | null, itens: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
  ({ idBranch: 5, removed: null, saleSource: null, saleDate: "2026-11-02T00:00:00", nameEmployeeSale: quem, nameCommissionedEmployee: "Outra Pessoa", saleItens: itens, ...extra });
const plano = (valor: number, renovado: number | null = null) => ({ idMembership: 1, idMembershipRenewed: renovado, saleValue: valor });

describe("ranking de vendedores (server/vendas.js)", () => {
  it("conta contratos novos e rematrículas por quem vendeu, com o valor; renovação fica de fora", () => {
    const por = resumirVendas([
      venda("Ana  Souza", [plano(100)]),
      venda("Ana Souza", [plano(150)]),
      venda("Bia Lima", [plano(80)]),
      venda("Bia Lima", [plano(60, 99)], { registrationKind: "renewal" }), // renovação: não conta
      venda("Caio Dias", [{ item: "CAMISETA", saleValue: 40 }]), // sem plano: não conta
    ], new Map(), 30)["Asa Norte"];
    expect(por.vendedores).toEqual([["Ana Souza", 2, 250], ["Bia Lima", 1, 80]]);
    expect(por.vendedoresTotal).toEqual([3, 330, 2, 0]);
    expect(JSON.stringify(por)).not.toContain("Outra Pessoa"); // o campo da comissão não é usado
    expect(por._vendedores).toBeUndefined();
  });

  it("venda sem vendedor entra no total, mas não no ranking", () => {
    expect(nomeVendedor({ nameEmployeeSale: null })).toBe(SEM_VENDEDOR);
    expect(nomeVendedor({ nameEmployeeSale: "  " })).toBe(SEM_VENDEDOR);
    const por = resumirVendas([venda("Ana Souza", [plano(100)]), venda(null, [plano(90)]), venda(null, [plano(90)])], new Map(), 30)["Asa Norte"];
    expect(por.vendedores).toEqual([["Ana Souza", 1, 100]]);
    expect(por.vendedoresTotal).toEqual([3, 280, 1, 2]);
  });

  it("guarda só os 10 maiores, em ordem, e o total traz todos", () => {
    const vendas = Array.from({ length: 12 }, (_, i) => Array.from({ length: i + 1 }, () => venda(`Vendedor ${String(i).padStart(2, "0")}`, [plano(10)]))).flat();
    const por = resumirVendas(vendas, new Map(), 30)["Asa Norte"];
    expect(por.vendedores).toHaveLength(10);
    expect(por.vendedores[0]).toEqual(["Vendedor 11", 12, 120]);
    expect(por.vendedoresTotal[2]).toBe(12);
  });
});

describe("rede e visibilidade", () => {
  it("a rede junta os vendedores das unidades com a unidade ao lado e soma os totais", () => {
    const us = [
      { name: "Gama", vendedores: [["Ana", 5, 500]], vendedoresTotal: [6, 600, 2, 1] },
      { name: "Itapoã", vendedores: [["Bia", 7, 700]], vendedoresTotal: [8, 800, 3, 1] },
    ] as unknown as UnitData[];
    expect(somarVendedores(us)).toEqual([["Bia", 7, 700, "Itapoã"], ["Ana", 5, 500, "Gama"]]);
    expect(somarVendedoresTotal(us)).toEqual([14, 1400, 5, 2]);
  });

  it("unidade de outra pessoa não recebe os nomes dos vendedores, só os totais", () => {
    const mes = { month: "2026-11", units: [
      { name: "Itapoã", faturamento: 1, vendedores: [["Bia Lima", 3, 300]], vendedoresTotal: [3, 300, 1, 0] },
      { name: "Gama", faturamento: 2, vendedores: [["Ana Souza", 5, 500]], vendedoresTotal: [5, 500, 1, 0] },
    ] };
    const f = vis.filtrarMes(mes, { papel: "unidades", unidades: ["Itapoã"] });
    expect(f.units[0].vendedores).toEqual([["Bia Lima", 3, 300]]);
    expect(f.units[1].vendedores).toBeUndefined();
    expect(JSON.stringify(f.units[1])).not.toContain("Ana Souza");
    expect(f.units[1].vendedoresTotal).toEqual([5, 500, 1, 0]);
    expect(vis.filtrarMes(mes, { papel: "master", unidades: [] })).toBe(mes);
  });
});

describe("card Vendedores que mais vendem", () => {
  const total = { vendedores: [["Ana Souza", 5, 500], ["Bia Lima", 2, 180]], vendedoresTotal: [10, 1000, 4, 1] } as unknown as UnitData;
  it("mostra a posição, o nome, os contratos, o valor e as notas de rodapé", () => {
    const h = renderToString(<VendedoresVendas total={total} monthLabel="nov/2026" partial={false} unitLabel="Itapoã" />);
    expect(h).toContain("Vendedores que mais vendem");
    expect(h).toContain("Ana Souza");
    expect(h.replace(/<!-- -->/g, "")).toContain("1º");
    expect(h).toContain("1 contrato, fora do ranking"); // singular
    expect(h).toContain("Outros vendedores: 2 contratos"); // 10 − 1 sem vendedor − 7 do ranking
    expect(h).toContain("Sem vendedor no EVO");
    expect(h.toLowerCase()).not.toContain("comiss");
  });
  it("sem dados mostra o aviso, sem quebrar", () => {
    const h = renderToString(<VendedoresVendas total={{} as UnitData} monthLabel="out/2026" partial={false} unitLabel="Rede" />);
    expect(h).toContain("Sem vendas de plano por vendedor");
  });
});

describe("contratos vendidos como no Gerencial do EVO (server/vendas.js)", () => {
  it("soma matrícula, rematrícula e renovação feitas na recepção ou online; fica de fora a recorrência automática, a diária e o personal", () => {
    const por = resumirVendas([
      venda("Ana", [plano(100)], { saleSource: 1, registrationKind: "enrollment" }), // matrícula
      venda("Ana", [plano(100)], { saleSource: 2, registrationKind: "re-enrollment" }), // online
      venda("Ana", [plano(100, 99)], { saleSource: 1, registrationKind: "renewal" }), // renovação na recepção: conta
      venda(null, [plano(100, 99)], { saleSource: 11, registrationKind: "renewal" }), // recorrência automática: não conta
      venda("Ana", [{ idMembership: 3, item: "TAXA DE PERSONAL", saleValue: 300 }], { saleSource: 1 }), // personal: não conta
      venda("Ana", [{ idMembership: 4, item: "WG DIÁRIA 30,00", saleValue: 30 }], { saleSource: 1 }), // diária: não conta
      venda("Ana", [{ item: "CAMISETA", saleValue: 40 }], { saleSource: 1 }), // sem contrato: não conta
    ], new Map(), 30)["Asa Norte"];
    expect(por.vendasContratos).toBe(3);
    expect(por.novosContratos).toBe(2 + 1 /* o personal sem renovação */); // a conta de "novos" segue como antes
  });

  it("nos meses fechados a recorrência vem sem origem: também fica de fora; venda manual e online (com origem) continua dentro", () => {
    const por = resumirVendas([
      venda("Ana", [plano(100)], { saleSource: 1, registrationKind: "enrollment" }), // manual: conta
      venda("Ana", [plano(100)], { saleSource: 2, registrationKind: "enrollment" }), // online: conta
      venda(null, [plano(100, 99)], { saleSource: null, registrationKind: "renewal", idSaleRecurrency: 7 }), // recorrência sem origem: não conta
      venda(null, [plano(100, 99)], { saleSource: 11, registrationKind: "renewal", idSaleRecurrency: 7 }), // recorrência com origem 11: não conta
    ], new Map(), 30)["Asa Norte"];
    expect(por.vendasContratos).toBe(2);
  });
});
