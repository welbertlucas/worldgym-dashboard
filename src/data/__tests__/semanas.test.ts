import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { datasDaSemana, limitesDaSemana, mesclarSemanas, semanaDaData, semanaDoDia, semanasDeCancelados, semanasFinanceiro, semanasNoMes } from "../../../server/semanas.js";
// @ts-expect-error módulo JS do servidor
import { resumirVendas } from "../../../server/vendas.js";
// @ts-expect-error módulo JS do servidor
import { semanasDeProspects, convertidosDoCartao, ehPlanoVip, visitantesDoCartao } from "../../../server/prospects.js";

describe("semanas fixas do mês", () => {
  it("1-7, 8-14, 15-21, 22-28 e a 5ª do 29 ao fim (só em mês com mais de 28 dias)", () => {
    expect([1, 7, 8, 14, 15, 21, 22, 28, 29, 30, 31].map(semanaDoDia)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5]);
    expect(semanasNoMes("2026-11")).toBe(5);
    expect(semanasNoMes("2026-10")).toBe(5);
    expect(semanasNoMes("2027-02")).toBe(4);
    expect(semanasNoMes("2028-02")).toBe(5); // bissexto: dia 29 existe
    expect(limitesDaSemana("2026-11", 5)).toEqual({ de: 29, ate: 30 });
    expect(limitesDaSemana("2026-10", 5)).toEqual({ de: 29, ate: 31 });
    expect(limitesDaSemana("2027-02", 5)).toBeNull();
    expect(limitesDaSemana("2026-11", 0)).toBeNull();
    expect(datasDaSemana("2026-11", 2)).toEqual({ de: "2026-11-08", ate: "2026-11-14" });
    expect(semanaDaData("2026-11-15T10:00:00", "2026-11")).toBe(3);
    expect(semanaDaData("2026-10-31T10:00:00", "2026-11")).toBeNull();
    expect(semanaDaData(null, "2026-11")).toBeNull();
  });

  it("faturamento e recebimento por semana fecham com o total do mês", () => {
    const venc = [
      { dueDate: "2026-11-02T00:00:00", ammount: 100 }, { dueDate: "2026-11-07T00:00:00", ammount: 50.5 },
      { dueDate: "2026-11-08T00:00:00", ammount: 70 }, { dueDate: "2026-11-30T00:00:00", ammount: 30 },
    ];
    const pagos = [{ chargeDate: "2026-11-03T09:00:00", ammountPaid: 100 }, { chargeDate: "2026-11-29T09:00:00", ammountPaid: 25.25 }];
    const s = semanasFinanceiro(venc, pagos, "2026-11");
    expect(s).toHaveLength(5);
    expect(s.map((x: { faturamento: number }) => x.faturamento)).toEqual([150.5, 70, 0, 0, 30]);
    expect(s.map((x: { recebimento: number }) => x.recebimento)).toEqual([100, 0, 0, 0, 25.25]);
    expect(s.reduce((n: number, x: { faturamento: number }) => n + x.faturamento, 0)).toBeCloseTo(250.5, 5);
  });

  it("vendas: novos contratos, vendas online e diárias na semana do dia da venda", () => {
    const venda = (saleDate: string, itens: Record<string, unknown>[], saleSource: number | null = null) => ({ idBranch: 5, removed: null, saleSource, saleDate, saleItens: itens });
    const por = resumirVendas([
      venda("2026-11-02T00:00:00", [{ idMembership: 1, idMembershipRenewed: null, saleValue: 100 }]),
      venda("2026-11-09T00:00:00", [{ idMembership: 2, idMembershipRenewed: null, saleValue: 150 }], 2),
      venda("2026-11-10T00:00:00", [{ item: "DIARIA 3 (R$ 50,00)", saleValue: 50 }]),
      venda("2026-11-30T00:00:00", [{ idMembership: 3, idMembershipRenewed: null, saleValue: 90 }]),
    ], new Map(), 30);
    const sem = por["Asa Norte"].semanas;
    expect(sem).toHaveLength(5);
    expect(sem.map((w: { novosContratos: number }) => w.novosContratos)).toEqual([1, 1, 0, 0, 1]);
    expect(sem[1]).toMatchObject({ vendasOnline: 150, diarias: 50 });
    expect(por["Asa Norte"].novosContratos).toBe(3);
    // "Total de vendas" por semana: só vendas de contrato, pelo dia da venda (a diária não entra); a soma das semanas fecha com a do mês
    expect(sem.map((w: { totalVendas: number }) => w.totalVendas)).toEqual([100, 150, 0, 0, 90]);
    const u = por["Asa Norte"];
    expect(sem.reduce((n: number, w: { totalVendas: number }) => n + w.totalVendas, 0)).toBe(u.vendasManuais + u.vendasRecorrentes + u.vendasOnlineContratos);
  });

  it("contratos especiais (VIP, valor R$ 0) ficam fora dos contratos vendidos, por mês e por semana, como no EVO", () => {
    const venda = (saleDate: string, itens: Record<string, unknown>[]) => ({ idBranch: 5, removed: null, saleSource: 1, saleDate, saleItens: itens });
    const por = resumirVendas([
      venda("2026-11-02T00:00:00", [{ idMembership: 1, idMembershipRenewed: null, saleValue: 100 }]),
      venda("2026-11-03T00:00:00", [{ idMembership: 2, idMembershipRenewed: null, saleValue: 0, item: "WORLD GYM MENSAL VIP" }]),
      venda("2026-11-10T00:00:00", [{ idMembership: 2, idMembershipRenewed: 9, saleValue: 0, item: "WORLD GYM MENSAL VIP" }]),
    ], new Map(), 30)["Asa Norte"];
    expect(por.vendasContratos).toBe(1);
    expect(por.semanas.map((w: { vendasContratos: number }) => w.vendasContratos)).toEqual([1, 0, 0, 0, 0]);
  });

  it("prospects: cadastradas e convertidas dentro de cada semana; semana que ainda não começou fica fora", () => {
    const l = (cad: string, conv: string) => ({ IdFilial: "5", DtCadastro: cad, DtConversao: conv });
    const rows = [l("02/11/2026", "03/11/2026"), l("06/11/2026", "10/11/2026"), l("09/11/2026", ""), l("12/11/2026", "13/11/2026"), l("16/11/2026", "")];
    const sem = semanasDeProspects(rows, "2026-11", "2026-11-16")["Asa Norte"];
    expect(sem[0]).toEqual({ oportunidades: 2, conversoes: 1, conversoesAntigas: 0 }); // a de 06/11 converteu na semana seguinte: só cadastro
    expect(sem[1]).toEqual({ oportunidades: 2, conversoes: 1, conversoesAntigas: 1 }); // mais a de 06/11, cadastrada na semana 1 e convertida na 2
    expect(sem[2]).toEqual({ oportunidades: 1, conversoes: 0, conversoesAntigas: 0 });
    expect(sem[3]).toEqual({}); // semana 4 ainda não começou
  });

  it("cancelamentos: alunos diferentes por semana, pela data do cancelamento", () => {
    const c = (idMember: number, cancelDate: string, idBranch = 5) => ({ idBranch, idMember, cancelDate });
    const por = semanasDeCancelados([c(1, "2026-11-02T00:00:00"), c(1, "2026-11-03T00:00:00"), c(2, "2026-11-09T00:00:00"), c(3, "2026-10-30T00:00:00"), c(4, "2026-11-09T00:00:00", 9)], "2026-11", (id: number) => ({ 5: "Asa Norte" } as Record<number, string>)[id]);
    expect(Object.keys(por)).toEqual(["Asa Norte"]);
    expect(por["Asa Norte"].map((w: { cancelados: number }) => w.cancelados)).toEqual([1, 1, 0, 0, 0]);
  });

  it("mesclar: cada rotina preenche a sua parte sem apagar a dos outros", () => {
    expect(mesclarSemanas([{ faturamento: 1 }, { faturamento: 2 }], [{ oportunidades: 5 }, { oportunidades: 6 }, { oportunidades: 7 }]))
      .toEqual([{ faturamento: 1, oportunidades: 5 }, { faturamento: 2, oportunidades: 6 }, { oportunidades: 7 }]);
    expect(mesclarSemanas(undefined, [{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(mesclarSemanas([{ a: 1, b: 2 }], [{ a: 9 }])).toEqual([{ a: 9, b: 2 }]);
  });

  it("visitantes x convertidos como no cartão do EVO: presenciais não convertidos + todos os convertidos; só contrato vendido sem VIP conta como conversão", () => {
    expect(["WORLD GYM GAMA SEMESTRAL VIP", "X - WG V.I.P", "MENSAL VIP"].every(ehPlanoVip)).toBe(true);
    expect(["WG LOCAL 139,90", "WG EXPERIMENTAL R$ 97,00", "VIPER"].some(ehPlanoVip)).toBe(false);
    const l = (conv: string, contrato: string, cad = "02/11/2026") => ({ IdFilial: "5", DtCadastro: cad, DtConversao: conv, PrimeiroContrato: contrato });
    const rows = [
      l("03/11/2026", "WG LOCAL 139,90"),   // converteu com contrato: visita e conversão (semana 1)
      l("09/11/2026", ""),                   // converteu sem contrato: só visita (semana 2)
      l("10/11/2026", "SEMESTRAL VIP"),     // VIP: só visita (semana 2)
      l("16/11/2026", "WG 30", "20/10/2026"), // cadastrado antes do mês: conta (semana 3)
      l("", ""),                             // ainda não converteu (não vem como visita aqui; o presencial vem da rota /prospects)
    ];
    expect(convertidosDoCartao(rows, "2026-11-01", "2026-11-20")["Asa Norte"]).toEqual({ todos: 4, convertidos: 2 });
    const naoConv = { "Asa Norte": [1, 0, 0, 0, 0, 0, 0, 0, 2, ...Array(21).fill(0)] }; // 1 presencial no dia 1 (semana 1) e 2 no dia 9 (semana 2)
    const c = visitantesDoCartao(rows, naoConv, "2026-11", "2026-11-20")["Asa Norte"];
    expect(c.visitantes).toBe(3 + 4); // 3 presenciais não convertidos + 4 convertidos
    expect(c.convertidos).toBe(2);
    expect(c.semanas.slice(0, 3)).toEqual([{ visitantes: 2, convertidos: 1 }, { visitantes: 4, convertidos: 0 }, { visitantes: 1, convertidos: 1 }]);
    expect(c.semanas[3]).toEqual({}); // semana que ainda não começou
    expect(c.semanas.reduce((n: number, w: { visitantes?: number }) => n + (w.visitantes ?? 0), 0)).toBe(c.visitantes); // as semanas fecham com o mês
  });
});
