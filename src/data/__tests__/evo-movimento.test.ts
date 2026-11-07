import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { movimentoDoMes, ativoNoDia, fluxoDoMes } from "../../../server/ativos.js";
// @ts-expect-error módulo JS do servidor
import { resumirVendas, categoriaAvulsa } from "../../../server/vendas.js";
// @ts-expect-error módulo JS do servidor
import { agregarNps } from "../../../server/wehelp.js";
// @ts-expect-error módulo JS do servidor
import { categoriaMotivo, resumirMotivos } from "../../../server/cancelamentos.js";
// @ts-expect-error módulo JS do servidor
import { resumirProspects, origemDaOportunidade } from "../../../server/prospects.js";
// @ts-expect-error módulo JS do servidor
import { categoriaRecusa, resumirDevedores } from "../../../server/cobrancas.js";
import { mergeEvo } from "@/data/dashboardData";
import { fracaoDoMes, projetarFechamento } from "@/data/periods";
import { month, unit } from "./helpers";

// contrato: [início, fim, cancelamento, status, recorrente]
const aluno = (...c: (string | boolean | null)[][]) => ({ id: 1, c });

describe("movimentoDoMes", () => {
  const alunos = [
    aluno(["2026-08-01", "2026-12-31", null, "active"]), // ativo o mês todo
    aluno(["2026-07-01", "2026-12-31", "2026-09-10", "canceled"]), // cancelou em setembro
    aluno(["2026-09-05", "2026-12-31", null, "active"]), // entrou em setembro
    aluno(["2026-01-01", "2026-08-31", null, "expired"]), // venceu antes
  ];
  it("conta ativos no início e no fim e cancelados do mês", () => {
    expect(movimentoDoMes(alunos, "2026-09", "2026-11-05")).toEqual({ ativosFim: 2, ativosIni: 3, cancelados: 1, aVencer: 0 });
  });
  it("mês em andamento corta em hoje", () => {
    expect(movimentoDoMes(alunos, "2026-09", "2026-09-07")).toEqual({ ativosFim: 3, ativosIni: 3, cancelados: 0, aVencer: 0 });
  });
  it("contrato cancelado no dia já não conta como ativo", () => {
    expect(ativoNoDia([["2026-01-01", "2026-12-31", "2026-09-10", "canceled"]], "2026-09-10")).toBe(false);
  });
});

describe("a vencer (renovação)", () => {
  const alunos = [
    aluno(["2026-09-01", "2026-09-30", null, "expired", false]), // prazo fixo, vence em setembro: conta
    aluno(["2026-09-01", "2026-09-30", null, "expired", true]), // recorrente: fora
    aluno(["2026-08-01", "2026-09-12", "2026-09-05", "canceled", false]), // cancelado: fora
    aluno(["2026-06-01", "2026-09-10", null, "expired", false]), // conta
    aluno(["2026-08-01", "2026-10-02", null, "active", false]), // vence em outubro: fora
  ];
  it("só prazo fixo, não cancelado, com fim no mês", () => {
    expect(movimentoDoMes(alunos, "2026-09", "2026-11-05").aVencer).toBe(2);
  });
  it("mês em andamento conta só até hoje", () => {
    expect(movimentoDoMes(alunos, "2026-09", "2026-09-20").aVencer).toBe(1);
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
    expect(por["Asa Norte"]).toEqual({ novosContratos: 2, vendasOnline: 175, diarias: 50, camisetas: 89, coqueteleiras: 25, personal: 0, kids: 10 });
  });
  it("contrato não vira camiseta nem coqueteleira", () => {
    expect(categoriaAvulsa({ idMembership: 1, item: "CAMISA PLANO" })).toBeNull();
    expect(categoriaAvulsa({ idMembership: 1, item: "PLANO COM SHAKER" })).toBeNull();
  });
  it("diária conta em qualquer grafia e também quando é vendida como contrato; kids fica de fora", () => {
    for (const nome of ["DIARIA", "DIÁRIA", "Diárias", "WG Pró Diaria", "11 - WG DIÁRIA 30,00", "WG PRO DIÁRIA | R$70,00"]) {
      expect(categoriaAvulsa({ item: nome })).toBe("diarias");
      expect(categoriaAvulsa({ idMembership: 9, item: nome })).toBe("diarias");
    }
    expect(categoriaAvulsa({ item: "DIARIA KIDS WG PONTE ALTA" })).toBe("kids");
  });
  it("brinquedoteca: diária kids e brinquedoteca avulsa; mensalidade kids e luta infantil são contratos normais", () => {
    for (const nome of ["BRINQUEDOTECA", "DIARIA KIDS WG JARDIM INGÁ| R$ 10,00"]) {
      expect(categoriaAvulsa({ item: nome })).toBe("kids");
      expect(categoriaAvulsa({ idMembership: 4, item: nome })).toBe("kids");
    }
    for (const nome of ["WG PONTE ALTA LOCAL KIDS MENSAL I R$80,00", "WG JARDIM INGÁ KIDS MENSAL", "WG LUTA INFANTIL 99,90"]) {
      expect(categoriaAvulsa({ idMembership: 4, item: nome })).toBeNull();
    }
  });
  it("mensalidade kids conta como contrato novo e não como brinquedoteca", () => {
    const por = resumirVendas([{ idBranch: 5, removed: null, saleSource: null, saleItens: [
      { idMembership: 1, idMembershipRenewed: null, item: "WG JARDIM INGÁ KIDS MENSAL", saleValue: 80 },
      { item: "DIARIA KIDS WG JARDIM INGÁ| R$ 10,00", saleValue: 10 },
    ] }]);
    expect(por["Asa Norte"].novosContratos).toBe(1);
    expect(por["Asa Norte"].kids).toBe(10);
  });
  it("diária vendida como contrato não conta como contrato novo", () => {
    const por = resumirVendas([{ idBranch: 5, removed: null, saleSource: null, saleItens: [
      { idMembership: 1, idMembershipRenewed: null, item: "11 - WG DIÁRIA 30,00", saleValue: 30 },
      { idMembership: 2, idMembershipRenewed: null, item: "WG LOCAL | R$ 129,90", saleValue: 129.9 },
    ] }]);
    expect(por["Asa Norte"].novosContratos).toBe(1);
    expect(por["Asa Norte"].diarias).toBe(30);
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
  it("o total da rede leva os alunos do início do mês (o cartão de fluxo precisa dele)", () => {
    const data = [month("2026-09", [unit("Asa Norte", {}), unit("Gama", {})])];
    mergeEvo(data, [{ month: "2026-09", units: [
      { name: "Asa Norte", faturamento: 1, recebimento: 1, cancelados: 90, ativosIni: 1800 },
      { name: "Gama", faturamento: 1, recebimento: 1, cancelados: 40, ativosIni: 2200 },
    ] }]);
    expect(data[0].total.ativosIni).toBe(4000);
  });
});

describe("mergeEvo: renovação", () => {
  it("taxa = (a vencer − não renovados) ÷ a vencer, por unidade e no total", () => {
    const data = [month("2026-10", [unit("Asa Norte", { renovacoes: 50 }), unit("Gama", { renovacoes: 50 })])];
    mergeEvo(data, [{ month: "2026-10", units: [
      { name: "Asa Norte", faturamento: 1, recebimento: 1, aVencer: 140, naoRenovados: 50 },
      { name: "Gama", faturamento: 1, recebimento: 1, aVencer: 60, naoRenovados: 10 },
    ] }]);
    expect(data[0].units[0].renovacoes).toBe(64.3);
    expect(data[0].units[1].renovacoes).toBe(83.3);
    expect(data[0].total.renovacoes).toBe(70); // (200 − 60) ÷ 200
    expect(data[0].total.renovacoesEvo).toBe(true);
  });
  it("sem contratos a vencer, a taxa fica em 0 (sem dado)", () => {
    const data = [month("2026-10", [unit("Asa Norte", { renovacoes: 50 })])];
    mergeEvo(data, [{ month: "2026-10", units: [{ name: "Asa Norte", faturamento: 1, recebimento: 1, aVencer: 0, naoRenovados: 0 }] }]);
    expect(data[0].units[0].renovacoes).toBe(0);
  });
});

describe("NPS do WeHelp", () => {
  const linha = (nome: string, p: number, d: number, r: number) => ({ key: [nome], nps: { total_promoters: p, total_detractors: d, total_responses: r } });
  it("soma as pesquisas Qrcode e Relacionamento de cada unidade e ignora as que não estão no dashboard", () => {
    const por = agregarNps([
      linha("World Gym Ceilândia - Qrcode", 10, 2, 20),
      linha("World Gym Ceilândia - Relacionamento", 5, 3, 10),
      linha("World Gym Goiânia", 1, 0, 1),
      linha("World Gym Outra Cidade - Qrcode", 9, 0, 9),
    ]);
    expect(por).toEqual({ Ceilândia: { promotores: 15, detratores: 5, respostas: 30 }, "Goiânia Pro-GO": { promotores: 1, detratores: 0, respostas: 1 } });
  });
  it("NPS = (promotores − detratores) ÷ respostas; total ponderado; mês sem respostas mantém a planilha", () => {
    const data = [month("2026-10", [unit("Asa Norte", { nps: 10 }), unit("Gama", { nps: 33 }), unit("Itapoã", { nps: 44 })])];
    mergeEvo(data, [{ month: "2026-10", units: [
      { name: "Asa Norte", faturamento: 1, recebimento: 1, npsPromotores: 30, npsDetratores: 10, npsRespostas: 50 },
      { name: "Gama", faturamento: 1, recebimento: 1, npsPromotores: 20, npsDetratores: 10, npsRespostas: 50 },
      { name: "Itapoã", faturamento: 1, recebimento: 1 },
    ] }]);
    expect(data[0].units[0].nps).toBe(40);
    expect(data[0].units[1].nps).toBe(20);
    expect(data[0].units[2].nps).toBe(44); // sem WeHelp: segue a planilha
    expect(data[0].total.nps).toBe(30); // (50 − 20) ÷ 100
    expect(data[0].total.npsEvo).toBe(true);
  });
});

describe("taxa de personal (vendas do EVO)", () => {
  it("soma o valor dos itens de contrato com PERSONAL no nome; avulsos e outros contratos ficam de fora", () => {
    const venda = (itens: object[]) => ({ idBranch: 5, saleSource: 1, itens, saleItens: itens });
    const por = resumirVendas([
      venda([{ idMembership: 7, item: "PERSONAL WG LOCAL | R$ 200,00", saleValue: 200 }, { idMembership: 8, item: "WG REDE | 169,90", saleValue: 169.9 }]),
      venda([{ item: "AULA PERSONAL AVULSA", saleValue: 78 }]),
    ]);
    expect(por["Asa Norte"].personal).toBe(200);
  });
  it("mergeEvo usa o valor do EVO quando o mês o tem; senão mantém a planilha", () => {
    const data = [month("2026-09", [unit("Asa Norte", { personal: 1 }), unit("Gama", { personal: 4950 })])];
    mergeEvo(data, [{ month: "2026-09", units: [
      { name: "Asa Norte", faturamento: 1, recebimento: 1, novosContratos: 1, personal: 7550 },
      { name: "Gama", faturamento: 1, recebimento: 1, novosContratos: 1 },
    ] }]);
    expect(data[0].units[0].personal).toBe(7550);
    expect(data[0].units[1].personal).toBe(4950);
    expect(data[0].total.personalEvo).toBe(true);
  });
});

describe("conversão de cadastros (prospects do EVO)", () => {
  const linha = (IdFilial: string, DtCadastro: string, DtConversao: string) => ({ IdFilial, DtCadastro, DtConversao });
  it("cadastrados no mês e, desses, convertidos dentro do mês; conversões de cadastros antigos ou futuras ficam de fora", () => {
    const por = resumirProspects([
      linha("5", "02/10/2026", "05/10/2026"), // conta: cadastro e conversão no mês
      linha("5", "10/10/2026", ""), // cadastro sem conversão
      linha("5", "20/10/2026", "03/11/2026"), // converteu depois do mês: só cadastro
      linha("5", "15/09/2026", "04/10/2026"), // cadastro anterior: não entra
      linha("9", "02/10/2026", "05/10/2026"), // unidade fora do dashboard
    ], "2026-10-01", "2026-10-31");
    expect(por).toEqual({ "Asa Norte": { oportunidades: 3, conversoes: 1, origens: { "Sem origem": [3, 1] } } });
  });
  it("mergeEvo: taxa por unidade e total ponderado; mês sem prospects mantém a planilha", () => {
    const data = [month("2026-10", [unit("Asa Norte", { icv: 10 }), unit("Gama", { icv: 20 }), unit("Itapoã", { icv: 30 })])];
    mergeEvo(data, [{ month: "2026-10", units: [
      { name: "Asa Norte", faturamento: 1, recebimento: 1, oportunidades: 295, conversoes: 257 },
      { name: "Gama", faturamento: 1, recebimento: 1, oportunidades: 100, conversoes: 50 },
      { name: "Itapoã", faturamento: 1, recebimento: 1 },
    ] }]);
    expect(data[0].units[0].icv).toBe(87.1);
    expect(data[0].units[1].icv).toBe(50);
    expect(data[0].units[2].icv).toBe(30);
    expect(data[0].total.icv).toBe(77.7); // 307 ÷ 395
    expect(data[0].total.icvEvo).toBe(true);
  });
});

describe("receita complementar total", () => {
  it("soma as cinco receitas; kids ausente (meses antigos) vale 0", async () => {
    const { receitaComplementar } = await import("@/data/dashboardData");
    expect(receitaComplementar({ diarias: 100, personal: 200, camisetas: 30, coqueteleiras: 20, kids: 50 })).toBe(400);
    expect(receitaComplementar({ diarias: 100, personal: 200, camisetas: 30, coqueteleiras: 20 })).toBe(350);
  });
});

describe("fluxo de alunos e permanência", () => {
  const alunos = [
    aluno(["2026-08-01", "2026-12-31", null, "active", false]), // fica ativo o mês todo
    aluno(["2026-09-05", "2026-12-31", null, "active", false]), // primeiro contrato em setembro: novo
    aluno(["2026-01-01", "2026-07-31", null, "expired", false], ["2026-09-10", "2026-12-31", null, "active", false]), // voltou
    aluno(["2026-07-01", "2026-12-31", "2026-09-10", "canceled", false]), // cancelou
    aluno(["2026-06-01", "2026-09-15", null, "expired", false]), // venceu
  ];
  it("entradas e saídas fecham com ativosIni e ativosFim", () => {
    const f = fluxoDoMes(alunos, "2026-09", "2026-11-05");
    const m = movimentoDoMes(alunos, "2026-09", "2026-11-05");
    expect(f).toMatchObject({ fluxoNovos: 1, fluxoRetornos: 1, fluxoCancelados: 1, fluxoVencidos: 1 });
    expect(m.ativosIni + f.fluxoNovos + f.fluxoRetornos - f.fluxoCancelados - f.fluxoVencidos).toBe(m.ativosFim);
  });
  it("permanência = média de meses desde o primeiro contrato dos ativos no fim", () => {
    expect(fluxoDoMes(alunos, "2026-09", "2026-11-05").permanenciaMeses).toBe(3.9);
  });
});

describe("motivos de cancelamento", () => {
  it("agrupa o texto livre em categorias", () => {
    expect(categoriaMotivo("Contrato cancelado automaticamente por inadimpl?ncia")).toBe("Inadimplência (cancelamento automático)");
    expect(categoriaMotivo("Cancelamento autom?tico por inadimpl?ncia")).toBe("Inadimplência (cancelamento automático)");
    expect(categoriaMotivo("Outros (especificar) - VAI USAR GYM PASS")).toBe("Outros");
    expect(categoriaMotivo("Outros - Viagem")).toBe("Outros");
    expect(categoriaMotivo("Mudou-se ")).toBe("Mudou-se");
    expect(categoriaMotivo(null)).toBe("Sem motivo informado");
  });
  it("conta cada aluno uma vez por unidade e ignora unidades fora do dashboard", () => {
    const por = resumirMotivos([
      { idBranch: 5, idMember: 1, reasonCancellation: "Mudou-se" },
      { idBranch: 5, idMember: 1, reasonCancellation: "Outros" }, // mesmo aluno: só o primeiro motivo
      { idBranch: 5, idMember: 2, reasonCancellation: "Contrato cancelado automaticamente por inadimpl?ncia" },
      { idBranch: 9, idMember: 3, reasonCancellation: "Mudou-se" }, // unidade fora
    ]);
    expect(por).toEqual({ "Asa Norte": { "Mudou-se": 1, "Inadimplência (cancelamento automático)": 1 } });
  });
});

describe("LTV e saldo de alunos", () => {
  it("LTV = ticket médio × permanência; saldo = fim − início", async () => {
    const { ltv, saldoAlunos, somarMotivos } = await import("@/data/dashboardData");
    expect(ltv({ ticketMedio: 143.36, permanenciaMeses: 14 })).toBe(2007);
    expect(ltv({ ticketMedio: 143.36, permanenciaMeses: 0 })).toBe(0);
    expect(saldoAlunos({ ativosIni: 100, ativosFim: 90 })).toBe(-10);
    expect(saldoAlunos({ ativosFim: 90 })).toBeUndefined();
    expect(somarMotivos([{ motivosCancel: { A: 2, B: 1 } }, { motivosCancel: { A: 3 } }, {}])).toEqual({ A: 5, B: 1 });
  });
  it("mergeEvo soma o fluxo da rede e pondera a permanência pelos alunos ativos", () => {
    const data = [month("2026-10", [unit("Asa Norte"), unit("Gama")])];
    mergeEvo(data, [{ month: "2026-10", units: [
      { name: "Asa Norte", faturamento: 1, recebimento: 1, ativosFim: 300, fluxoNovos: 30, fluxoRetornos: 5, fluxoCancelados: 10, fluxoVencidos: 5, permanenciaMeses: 10, motivosCancel: { A: 4 } },
      { name: "Gama", faturamento: 1, recebimento: 1, ativosFim: 100, fluxoNovos: 10, fluxoRetornos: 0, fluxoCancelados: 4, fluxoVencidos: 1, permanenciaMeses: 20, motivosCancel: { A: 1, B: 2 } },
    ] }]);
    const t = data[0].total;
    expect([t.fluxoNovos, t.fluxoRetornos, t.fluxoCancelados, t.fluxoVencidos]).toEqual([40, 5, 14, 6]);
    expect(t.permanenciaMeses).toBe(12.5); // (10×300 + 20×100) ÷ 400
    expect(t.motivosCancel).toEqual({ A: 5, B: 2 });
  });
});

describe("origem das oportunidades", () => {
  it("normaliza o texto do cadastro", () => {
    expect(origemDaOportunidade("TOTEM/SITE/ ")).toBe("Totem/Site");
    expect(origemDaOportunidade("Convite/ ")).toBe("Convite");
    expect(origemDaOportunidade("AMIGO/PARENTE/ ")).toBe("Amigo/Parente");
    expect(origemDaOportunidade("")).toBe("Sem origem");
    expect(origemDaOportunidade(undefined)).toBe("Sem origem");
  });
  it("conta cadastradas e convertidas no mês por origem", () => {
    const linha = (Marketing: string, DtConversao: string) => ({ IdFilial: "5", DtCadastro: "05/10/2026", DtConversao, Marketing });
    const por = resumirProspects([linha("TOTEM/SITE/ ", "07/10/2026"), linha("TOTEM/SITE/ ", ""), linha("Convite/ ", "09/10/2026")], "2026-10-01", "2026-10-31");
    expect(por["Asa Norte"].origens).toEqual({ "Totem/Site": [2, 1], Convite: [1, 1] });
  });
  it("mergeEvo soma as origens da rede", () => {
    const data = [month("2026-10", [unit("Asa Norte"), unit("Gama")])];
    mergeEvo(data, [{ month: "2026-10", units: [
      { name: "Asa Norte", faturamento: 1, recebimento: 1, origens: { Convite: [10, 5] } },
      { name: "Gama", faturamento: 1, recebimento: 1, origens: { Convite: [4, 1], Instagram: [2, 0] } },
    ] }]);
    expect(data[0].total.origens).toEqual({ Convite: [14, 6], Instagram: [2, 0] });
  });
});

describe("cobranças com falha e motivos de recusa", () => {
  it("agrupa os textos em português e inglês, com e sem código", () => {
    expect(categoriaRecusa("Refused(Cod. 51)")).toBe("Não autorizada pelo emissor");
    expect(categoriaRecusa("Não autorizada")).toBe("Não autorizada pelo emissor");
    expect(categoriaRecusa("Estabelecimento entrar em contato com adquirente(Cod. 1040)")).toBe("Contatar o adquirente");
    expect(categoriaRecusa("Fraud or security (Mastercard use only)(Cod. 83)")).toBe("Dados do cartão ou suspeita de fraude");
    expect(categoriaRecusa("Declined by Rede: Excessive Reattempts;(Cod. N02)")).toBe("Excesso de tentativas");
    expect(categoriaRecusa("")).toBeNull();
    expect(categoriaRecusa("Algo novo(Cod. 99)")).toBe("Algo novo");
  });
  it("resume recuperadas, em aberto e valores; cancelados ficam fora", () => {
    const r = resumirDevedores([
      { debtStatus: "Recovered", debtAmount: 100, lastAcquirerDeclineReason: "Refused" },
      { debtStatus: "open", debtAmount: 150.5, lastAcquirerDeclineReason: "Refused(Cod. 51)" },
      { debtStatus: "open", debtAmount: 50, lastAcquirerDeclineReason: null },
      { debtStatus: "Canceled", debtAmount: 999, lastAcquirerDeclineReason: "Refused" },
    ]);
    expect(r).toMatchObject({ falhas: 3, recuperadas: 1, abertas: 2, valorAberto: 200.5, valorRecuperado: 100 });
    expect(r.motivos["Não autorizada pelo emissor"]).toEqual({ n: 2, abertas: 1, valorAberto: 150.5 });
  });
});

describe("treinos e projeção", () => {
  it("mergeEvo soma os treinos da rede", () => {
    const data = [month("2026-11", [unit("Asa Norte"), unit("Gama")])];
    mergeEvo(data, [{ month: "2026-11", units: [
      { name: "Asa Norte", faturamento: 1, recebimento: 1, treinoAtivo: 100, treinoVencido: 300, treinoFuturo: 5 },
      { name: "Gama", faturamento: 1, recebimento: 1, treinoAtivo: 50, treinoVencido: 150, treinoFuturo: 0 },
    ] }]);
    expect([data[0].total.treinoAtivo, data[0].total.treinoVencido, data[0].total.treinoFuturo]).toEqual([150, 450, 5]);
  });
  it("projeção linear: ritmo atual repetido até o fim do mês, só depois de 10% do mês", () => {
    const meio = new Date(2026, 10, 16); // 15 de 30 dias passados
    expect(fracaoDoMes("2026-11", meio)).toBeCloseTo(0.5, 2);
    expect(projetarFechamento(500, 0.5)).toBe(1000);
    expect(projetarFechamento(500, 0.05)).toBeNull(); // cedo demais
    expect(projetarFechamento(0, 0.5)).toBeNull();
    expect(fracaoDoMes("2026-11", new Date(2026, 11, 20))).toBe(1); // mês já passou
  });
});
