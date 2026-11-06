import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { movimentoDoMes, ativoNoDia } from "../../../server/ativos.js";
// @ts-expect-error módulo JS do servidor
import { resumirVendas, categoriaAvulsa } from "../../../server/vendas.js";
import { mergeEvo } from "@/data/dashboardData";
import { month, unit } from "./helpers";

// contrato: [início, fim, cancelamento, status]
const aluno = (...c: (string | null)[][]) => ({ id: 1, c });

describe("movimentoDoMes", () => {
  const alunos = [
    aluno(["2026-08-01", "2026-12-31", null, "active"]), // ativo o mês todo
    aluno(["2026-07-01", "2026-12-31", "2026-09-10", "canceled"]), // cancelou em setembro
    aluno(["2026-09-05", "2026-12-31", null, "active"]), // entrou em setembro
    aluno(["2026-01-01", "2026-08-31", null, "expired"]), // venceu antes
  ];
  it("conta ativos no início e no fim e cancelados do mês", () => {
    expect(movimentoDoMes(alunos, "2026-09", "2026-11-05")).toEqual({ ativosFim: 2, ativosIni: 3, cancelados: 1 });
  });
  it("mês em andamento corta em hoje", () => {
    expect(movimentoDoMes(alunos, "2026-09", "2026-09-07")).toEqual({ ativosFim: 3, ativosIni: 3, cancelados: 0 });
  });
  it("contrato cancelado no dia já não conta como ativo", () => {
    expect(ativoNoDia([["2026-01-01", "2026-12-31", "2026-09-10", "canceled"]], "2026-09-10")).toBe(false);
  });
});

describe("resumirVendas", () => {
  const venda = (o: Record<string, unknown>, itens: Record<string, unknown>[]) => ({ idBranch: 5, removed: null, saleSource: null, saleItens: itens, ...o });
  it("separa novos contratos, vendas online e avulsos; ignora removidas e unidades fora da tabela", () => {
    const por = resumirVendas([
      venda({}, [{ idMembership: 1, idMembershipRenewed: null, saleValue: 100 }]),
      venda({}, [{ idMembership: 1, idMembershipRenewed: 77, saleValue: 100 }]),
      venda({ saleSource: 2 }, [{ idMembership: 2, saleValue: 150 }, { item: "COQUETELEIRA", saleValue: 25 }]),
      venda({}, [{ item: "DIARIA 3 (R$ 50,00)", saleValue: 50 }, { item: "DIARIA KIDS", saleValue: 10 }, { item: "CAMISA PERSONAL (G)", saleValue: 89 }]),
      venda({ removed: true }, [{ idMembership: 3, saleValue: 999 }]),
      venda({ idBranch: 9 }, [{ idMembership: 3, saleValue: 999 }]),
    ]);
    expect(Object.keys(por)).toEqual(["Asa Norte"]);
    expect(por["Asa Norte"]).toEqual({ novosContratos: 2, vendasOnline: 175, diarias: 50, camisetas: 89, coqueteleiras: 25 });
  });
  it("contrato nunca vira avulso", () => {
    expect(categoriaAvulsa({ idMembership: 1, item: "DIARIA" })).toBeNull();
  });
});

describe("mergeEvo: movimento e vendas", () => {
  it("churn = cancelados ÷ ativos no início; vendas do EVO substituem a planilha", () => {
    const data = [month("2026-09", [unit("Asa Norte", { novosContratos: 109, vendasOnline: 149.9, cancelados: 88, churn: 6.9 })])];
    mergeEvo(data, [{ month: "2026-09", units: [{ name: "Asa Norte", faturamento: 1, recebimento: 1, cancelados: 90, ativosIni: 1800, novosContratos: 69, vendasOnline: 150, diarias: 1150 }] }]);
    const u = data[0].units[0];
    expect(u.churn).toBe(5);
    expect(u.cancelados).toBe(90);
    expect(u.novosContratos).toBe(69);
    expect(data[0].total.churn).toBe(5);
    expect(data[0].total.vendasEvo).toBe(true);
  });
});
