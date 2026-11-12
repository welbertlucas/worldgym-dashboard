import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ContratosVendidos, fatiasPorTipo } from "@/components/ContratosVendidos";
import { somarContratosVendidos, somarEntradas, somarTipoVenda, type TipoVenda, type UnitData } from "@/data/dashboardData";
import { LiberacoesCard } from "@/components/clientes/LiberacoesCard";
import { fluxosDaRede, OutrasUnidadesCard } from "@/components/clientes/OutrasUnidadesCard";

const limpo = (h: string) => h.replace(/<!-- -->/g, "");

describe("contratos mais vendidos", () => {
  it("a rede junta os planos de mesmo nome e soma o tipo de venda", () => {
    const us = [
      { contratosVendidos: [["WG 30", 10, 1899], ["ANUAL", 2, 2400]] as [string, number, number][], tipoVenda: { novo: [8, 2000], remat: [4, 2299], renov: [100, 1] } as UnitData["tipoVenda"] },
      { contratosVendidos: [["WG 30", 5, 949.5]] as [string, number, number][], tipoVenda: { novo: [5, 949.5], remat: [0, 0], renov: [0, 0] } as UnitData["tipoVenda"] },
    ];
    expect(somarContratosVendidos(us)).toEqual([["WG 30", 15, 2848.5], ["ANUAL", 2, 2400]]);
    expect(somarTipoVenda(us)).toEqual({ novo: [13, 2949.5], remat: [4, 2299], renov: [100, 1] });
  });
  it("mostra os 5 primeiros, a participação e o tipo de venda", () => {
    const total = {
      contratosVendidos: [["A", 50, 5000], ["B", 30, 3000], ["C", 10, 1000], ["D", 5, 500], ["E", 3, 300], ["F", 2, 200]],
      tipoVenda: { novo: [80, 8000], remat: [20, 2000], renov: [500, 50000] },
      duracaoVenda: [70, 10, 5, 15, 0],
    } as unknown as UnitData;
    const h = limpo(renderToString(<ContratosVendidos total={total} monthLabel="Outubro de 2026" partial={false} unitLabel="Rede" />));
    expect(h).toContain("Contratos mais vendidos");
    expect(h).toContain("5º");
    expect(h).not.toContain(">F<");
    expect(h).toContain("Rematrícula");
    expect(h).toContain("98%"); // os 5 primeiros somam 98 de 100
  });
  it("sem dados mostra o estado vazio", () => {
    const h = renderToString(<ContratosVendidos total={{} as UnitData} monthLabel="Jan" partial={false} unitLabel="Rede" />);
    expect(h).toContain("Sem vendas de planos");
  });
});

import { MapaCalorEntradas, horarioDePico, mediaPorHora, ocorrenciasDaSemana } from "@/components/clientes/MapaCalorEntradas";
// @ts-expect-error módulo JS do servidor
import { acumularEntradas, fecharEntradas, motivoDoBloqueio } from "../../../server/entradas.js";

describe("entradas na catraca", () => {
  it("conta só entradas liberadas, por dia da semana e hora, e pessoas diferentes sem guardar quem", () => {
    const e = (date: string, o: Record<string, unknown> = {}) => ({ idBranch: 5, date, entryType: "Controle de acesso", entryAction: "entry", idMember: 1, ...o });
    const por = acumularEntradas({}, [
      e("2026-11-06T18:10:00"), e("2026-11-06T18:50:00", { idMember: 2 }), e("2026-11-07T07:00:00"),
      e("2026-11-06T18:20:00", { entryAction: "output" }), e("2026-11-06T18:20:00", { entryAction: "Blocked" }),
      e("2026-11-06T18:20:00", { entryType: "Impressão de treino" }), e("2026-11-06T09:00:00", { entryAction: "Manual Entry", idMember: null, idProspect: 9 }),
      e("2026-11-06T18:20:00", { idBranch: 999 }),
    ], 30);
    const u = fecharEntradas(por)["Asa Norte"];
    expect(u.entradas).toBe(4);
    expect(u.frequentadores).toBe(3);
    expect(u.calor[5 * 24 + 18]).toBe(2); // sexta 18h
    expect(u.calor[6 * 24 + 7]).toBe(1); // sábado 7h
    expect(u.entradasDia[5]).toBe(3);
    expect(u._pessoas).toBeUndefined();
  });
  it("liberação manual: conta à parte, com o motivo do bloqueio da mesma pessoa até 30 min antes", () => {
    const e = (date: string, o: Record<string, unknown> = {}) => ({ idBranch: 5, date, entryType: "Controle de acesso", entryAction: "entry", idMember: 1, ...o });
    const u = fecharEntradas(acumularEntradas({}, [
      // pessoa 1: barrada 2x (o mais recente vale), liberada na mão
      e("2026-11-09T19:33:07", { entryAction: "Blocked", blockReason: "PARQ sem preenchimento" }),
      e("2026-11-09T19:33:46", { entryAction: "Blocked", blockReason: "Saldo devedor" }),
      e("2026-11-09T19:34:37", { entryAction: "Manual Entry" }),
      // pessoa 2: o bloqueio foi há mais de 30 min, ou em outra unidade -> sem bloqueio antes
      e("2026-11-09T10:00:00", { idMember: 2, entryAction: "Blocked", blockReason: "Aluno inativo" }),
      e("2026-11-09T11:00:00", { idMember: 2, idBranch: 8, entryAction: "Blocked", blockReason: "Aluno inativo" }),
      e("2026-11-09T11:00:30", { idMember: 2, entryAction: "Manual Entry" }),
      // pessoa 3: barrada DEPOIS da liberação não conta
      e("2026-11-09T12:00:00", { idMember: 3, entryAction: "Manual Entry" }),
      e("2026-11-09T12:00:10", { idMember: 3, entryAction: "Blocked", blockReason: "Duplo acesso. aguarde. " }),
    ], 30))["Asa Norte"];
    expect(u.liberacoes).toBe(3);
    expect(u.entradas).toBe(3); // a liberação manual também é entrada
    expect(u.liberacoesMotivos).toEqual([["Sem bloqueio antes", 2], ["Saldo devedor", 1]]);
    expect(u._motivos).toBeUndefined();
    expect(u.liberacoesGrupos).toEqual([2, 1, 0, 0]); // 1 aluno devendo (saldo devedor); 2 alunos com pendência ou sem bloqueio
  });
  it("liberação manual por grupo: visitante com e sem venda no dia", () => {
    const e = (o: Record<string, unknown>) => ({ idBranch: 5, date: "2026-11-11T18:00:00", entryType: "Controle de acesso", entryAction: "Manual Entry", ...o });
    const u = fecharEntradas(acumularEntradas({}, [
      e({ idProspect: 10 }), // comprou a diária no dia
      e({ idProspect: 11 }), // sem venda
      e({ idMember: 7 }), // aluno sem bloqueio antes
    ], 30, new Set(["p10"])))["Asa Norte"];
    expect(u.liberacoesGrupos).toEqual([1, 0, 1, 1]);
  });
  it("quem treina em outra unidade: cruza a entrada com a unidade do cadastro", () => {
    // 5 = Asa Norte, 6 = Gama
    const e = (idMember: number, idBranch: number, hora = "10") => ({ idBranch, idMember, date: `2026-11-11T${hora}:00:00`, entryType: "Controle de acesso", entryAction: "entry" });
    const origem = new Map([[1, 5], [2, 5], [3, 6]]);
    const por = fecharEntradas(acumularEntradas({}, [e(1, 6), e(1, 6, "18"), e(2, 6), e(2, 5), e(3, 6), e(9, 6)], 30, new Set(), origem), true);
    expect(por["Gama"].outrasUnidades.vieram).toEqual({ pessoas: 2, entradas: 3, unidades: [["Asa Norte", 2, 3]] });
    expect(por["Asa Norte"].outrasUnidades.foram).toEqual({ pessoas: 2, entradas: 3, unidades: [["Gama", 2, 3]] });
    expect(por["Gama"].outrasUnidades.foram.pessoas).toBe(0); // o 3 é de Gama e treinou em Gama; o 9 não está no mapa
    expect(fecharEntradas(acumularEntradas({}, [e(1, 6)], 30))["Gama"]).not.toHaveProperty("outrasUnidades"); // sem mapa
  });
  it("motivos do EVO em poucas palavras", () => {
    expect(motivoDoBloqueio("PARQ pendente atestado")).toBe("PAR-Q pendente");
    expect(motivoDoBloqueio("Duplo acesso. aguarde. ")).toBe("Duplo acesso");
    expect(motivoDoBloqueio("O contrato do cliente não permite acesso a esta catraca")).toBe("Catraca fora do plano");
    expect(motivoDoBloqueio("Nenhum check-in encontrado para este aluno Wellhub")).toBe("Agregador sem check-in");
    expect(motivoDoBloqueio("Personal com o CREF vencido ou sem data de validade.")).toBe("Personal irregular");
    expect(motivoDoBloqueio("Algo novo")).toBe("Outros");
  });
  it("rede soma as liberações e junta os motivos; mês sem a carga fica sem o campo", () => {
    const a = { calor: Array(168).fill(0), entradasDia: [], entradas: 100, frequentadores: 10, liberacoes: 3, liberacoesMotivos: [["Saldo devedor", 2], ["PAR-Q pendente", 1]] as [string, number][] };
    const b = { ...a, liberacoes: 2, liberacoesMotivos: [["PAR-Q pendente", 2]] as [string, number][] };
    expect(somarEntradas([a, b])).toMatchObject({ liberacoes: 5, liberacoesMotivos: [["PAR-Q pendente", 3], ["Saldo devedor", 2]] });
    expect(somarEntradas([{ ...a, liberacoes: undefined, liberacoesMotivos: undefined }])).not.toHaveProperty("liberacoes");
    const ga = { ...a, liberacoesGrupos: [1, 2, 0, 0] as [number, number, number, number] }, gb = { ...b, liberacoesGrupos: [1, 0, 0, 1] as [number, number, number, number] };
    expect(somarEntradas([ga, gb]).liberacoesGrupos).toEqual([2, 2, 0, 1]);
    expect(somarEntradas([ga, b])).not.toHaveProperty("liberacoesGrupos"); // uma unidade sem os grupos: a rede fica sem
  });
  it("card das liberações: total, parte de quem não estava em dia e aviso sem dado", () => {
    const total = { entradas: 2000, liberacoes: 40, liberacoesMotivos: [["PAR-Q pendente", 20], ["Saldo devedor", 10], ["Sem bloqueio antes", 8], ["Aluno inativo", 2]] } as unknown as UnitData;
    const h = limpo(renderToString(<LiberacoesCard total={total} month="2026-11" monthLabel="Novembro de 2026" partial={false} unit="Asa Norte" />));
    expect(h).toContain("40"); // total no mês
    expect(h).toContain("Sem pagamento registrado · 30%"); // saldo devedor + inativo = 12 de 40 (mês sem grupos)
    expect(h).toContain("ainda não separa os visitantes");
    const comGrupos = limpo(renderToString(<LiberacoesCard total={{ ...total, liberacoesGrupos: [26, 12, 1, 1] } as UnitData} month="2026-11" monthLabel="Novembro de 2026" partial={false} unit="Asa Norte" />));
    expect(comGrupos).toContain("Visitante sem venda no dia");
    expect(comGrupos).toContain("Sem pagamento registrado · 33%"); // 12 + 1 de 40
    expect(h).not.toContain("a cada 100 entradas");
    expect(h).toContain("PAR-Q pendente");
    expect(h).toContain("Quem liberou não sai pela API");
    const vazio = limpo(renderToString(<LiberacoesCard total={{} as UnitData} month="2026-11" monthLabel="Novembro de 2026" partial={false} unit={null} />));
    expect(vazio).toContain("ainda não foram carregadas");
  });
  it("média por hora divide pelo número de dias daquele tipo no mês", () => {
    const oc = ocorrenciasDaSemana("2026-11", 30); // nov/2026 começa num domingo: 5 domingos e 5 segundas
    expect(oc).toEqual([5, 5, 4, 4, 4, 4, 4]);
    const calor = Array(168).fill(0); calor[1 * 24 + 18] = 50; calor[5 * 24 + 7] = 44;
    const media = mediaPorHora(calor, oc);
    expect(media[1 * 24 + 18]).toBe(10);
    expect(horarioDePico(media)).toEqual({ sem: 5, hora: 7, media: 11 });
  });
  it("desenha o mapa com o horário de pico", () => {
    const calor = Array(168).fill(0); calor[1 * 24 + 18] = 100; calor[2 * 24 + 6] = 10;
    const h = limpo(renderToString(<MapaCalorEntradas total={{ calor, entradasDia: Array(30).fill(1), entradas: 110, frequentadores: 20 } as unknown as UnitData} month="2026-11" monthLabel="Novembro de 2026" partial={false} unitLabel="Rede" />));
    expect(h).toContain("Seg 18h");
    expect(h).toContain("5,5"); // idas por aluno
    expect(h).toContain(">6h<");
    expect(h).toContain(">18h<");
  });
});

// @ts-expect-error módulo JS do servidor
import { somarFormas as somarFormasServidor, somarBandeiras, somarGateways } from "../../../server/pagamentos.js";
import { BandeirasCartao, FormasPagamento, GatewaysCartao, formasOrdenadas } from "@/components/FormasPagamento";
import { somarFormas, nomeBandeira, nomeGateway, normalizarNomes } from "@/data/dashboardData";

describe("formas de pagamento", () => {
  it("soma o valor pago por forma, em português, sem cancelados nem títulos sem pagador", () => {
    const t = (nome: string | undefined, v: number, o: Record<string, unknown> = {}) => ({ paymentType: nome ? { id: 1, name: nome } : null, ammountPaid: v, idMemberPayer: 1, ...o });
    expect(somarFormasServidor([
      t("Credit card", 100), t("Credit card", 50.5), t("Deposit", 30), t("Debit card", 0),
      t("Credit card", 999, { cancellationDate: "2026-10-02" }), t("Deposit", 999, { idMemberPayer: null }), t(undefined, 5), t("Voucher X", 7),
    ])).toEqual({ "Cartão de crédito": 150.5, "Pix e depósito": 30, "Não informada": 5, "Voucher X": 7 });
  });
  it("soma o pago em cartão por bandeira, sem Pix nem cancelados", () => {
    const t = (forma: string, flag: string | null, v: number, o: Record<string, unknown> = {}) => ({ paymentType: { id: 1, name: forma }, cardFlag: flag, ammountPaid: v, idMemberPayer: 1, ...o });
    expect(somarBandeiras([
      t("Credit card", "Visa", 100), t("Debit card", "Visa", 20), t("Credit card", "Mastercard", 50), t("Credit card", null, 5),
      t("Pix", null, 300), t("Credit card", "Elo", 999, { cancellationDate: "2026-10-02" }),
    ])).toEqual({ Visa: 120, Mastercard: 50, "Não informada": 5 });
    const h = renderToString(<BandeirasCartao total={{ bandeirasCartao: { Visa: 600, Mastercard: 400 } } as unknown as UnitData} monthLabel="Out" unitLabel="Rede" />);
    expect(h).toContain("Visa");
    expect(h).toContain("por bandeira");
  });
  it("unifica nomes de bandeira e gateway escritos de jeitos diferentes", () => {
    expect(normalizarNomes({ VISA: 1, Visa: 2, "VISA ELETRON": 3, MASTERCARD: 4, AmericanExpress: 5, OutrasBandeiras: 6 }, nomeBandeira))
      .toEqual({ Visa: 6, Mastercard: 4, Amex: 5, "Outras bandeiras": 6 });
    expect(["Redecard", "Rede", "STONE", "VISA", "Outros", "cielo"].map(nomeGateway)).toEqual(["Rede", "Rede", "Stone", "Não identificado", "Não identificado", "Cielo"]);
  });
  it("soma o pago em cartão por gateway (adquirente)", () => {
    const t = (forma: string, acq: string | null, v: number) => ({ paymentType: { id: 1, name: forma }, cardAcquirer: acq, ammountPaid: v, idMemberPayer: 1 });
    expect(somarGateways([t("Credit card", "Stone", 100), t("Debit card", "Rede", 30), t("Credit card", "Stone", 5), t("Deposit", null, 50)])).toEqual({ Stone: 105, Rede: 30 });
    const h = renderToString(<GatewaysCartao total={{ gatewaysCartao: { Stone: 700, Rede: 300 } } as unknown as UnitData} monthLabel="Out" unitLabel="Rede" />);
    expect(h).toContain("Stone");
    expect(h).toContain("por gateway");
  });
  it("a rede soma as unidades e a lista agrupa a cauda em Outras", () => {
    expect(somarFormas([{ formasPagamento: { A: 1 } }, { formasPagamento: { A: 2, B: 3 } }, {}])).toEqual({ A: 3, B: 3 });
    expect(formasOrdenadas({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }).map(([n]) => n)).toEqual(["g", "f", "e", "d", "c", "Outras"]);
    const h = renderToString(<FormasPagamento total={{ formasPagamento: { "Cartão de crédito": 900, "Pix e depósito": 100 } } as unknown as UnitData} monthLabel="Out" unitLabel="Rede" />);
    expect(h).toContain("Cartão de crédito");
    expect(h).toContain("90");
  });
});

import { ProdutosVendidos } from "@/components/ContratosVendidos";
describe("produtos e serviços mais vendidos", () => {
  it("lista até 5 itens pelo valor", () => {
    const produtosVendidos = Array.from({ length: 10 }, (_, k) => [`P${k}`, 10 - k, 1000 - k * 50]);
    const h = limpo(renderToString(<ProdutosVendidos total={{ produtosVendidos } as unknown as UnitData} monthLabel="Out" partial={false} unitLabel="Rede" />));
    expect(h).toContain("P4");
    expect(h).not.toContain("P5");
  });
});

import { TaxasCobradas } from "@/components/ContratosVendidos";
import { somarFamiliasVendidas, reagruparFamilias, reagruparProdutos, incluirWg90 } from "@/data/dashboardData";
// @ts-expect-error módulo JS do servidor
import { ehTaxa, familiaPlano, resumirVendas } from "../../../server/vendas.js";

describe("planos por família e taxas fora dos produtos", () => {
  it("agrupa os nomes de plano de cada unidade pelo tipo do plano", () => {
    expect(familiaPlano("WG JARDIM INGÁ LOCAL | R$ 139,90 (Sessões Ilimitadas)")).toBe("WG Local");
    expect(familiaPlano("WORLD GYM CEILÂNDIA WG- 30 R$ 189,90")).toBe("WG 30");
    expect(familiaPlano("03 - WG LOCAL FLEX (R$157,00)")).toBe("WG Local");
    expect(familiaPlano("WG LOCAL 3X R$ 79,90")).toBe("WG Local");
    expect(familiaPlano("02 - WG REDE SOBRADINHO - R$169,90")).toBe("WG Rede");
    expect(familiaPlano("06 - WG LOCAL EX- ALUNOS 1º MÊS R$ 49,90 (ONLINE)")).toBe("Cortesias e promoções");
    expect(familiaPlano("07 - WG LOCAL MILITAR TAGUATINGA (119,90)")).toBe("Cortesias e promoções");
    expect(familiaPlano("WG PRO SALVADOR ANUAL | R$ 319,90")).toBe("WG Rede");
    expect(familiaPlano("WORLD GYM CEILANDIA FIT R$ 129,90 (40 sessões)")).toBe("WG Rede");
    expect(familiaPlano("WORLD GYM GAMA ANUAL VIP")).toBe("Outros planos");
    expect(familiaPlano("WORLD GYM SAMAMBAIA ANUAL VI (Sessões Ilimitadas)")).toBe("Outros planos");
    expect(familiaPlano("WG PONTE ALTA ANUAL LOCAL | 119,90 A VISTA")).toBe("WG Local");
    expect(familiaPlano("WG CEILÂNDIA COMBO DUO ANUAL")).toBe("Aquática");
    expect(familiaPlano("WG PRO - ANUAL | VIP (Sessões Ilimitadas)")).toBe("WG Rede");
    expect(familiaPlano("WG PRO 30 | R$329,90")).toBe("WG Rede");
    expect(familiaPlano("WG CEILÂNDIA AQUA (2X) DUO ANUAL")).toBe("Aquática");
    expect(familiaPlano("X - FREE PASS (3 DIAS)")).toBe("Cortesias e promoções");
    expect(familiaPlano("AULA EXPERIMENTAL")).toBe("Cortesias e promoções");
    expect(familiaPlano("ALGO NOVO")).toBe("Outros planos");
  });
  it("WG 90 conta como WG 30, inclusive nos meses gravados quando ele ficava fora", () => {
    expect(familiaPlano("WG90 | R$357,00 (À VISTA)")).toBe("WG 30");
    expect(familiaPlano("WG 90 REDE")).toBe("WG 30");
    const tv = { novo: [10, 1300], remat: [2, 200], renov: [0, 0] } as TipoVenda;
    expect(incluirWg90([["WG Local", 8, 1000], ["WG 30", 2, 300]], tv)).toEqual([["WG Local", 8, 1000], ["WG 30", 4, 500]]);
    expect(incluirWg90([["WG Local", 12, 1500]], tv)).toEqual([["WG Local", 12, 1500]]);
  });
  it("reagrupa os tipos antigos já gravados nos meses carregados", () => {
    expect(reagruparFamilias([["WG Local", 10, 1000], ["WG Rede", 3, 500], ["WG PRO", 2, 600], ["Free pass", 4, 0], ["Promoção 1º mês", 1, 50], ["Outros planos", 1, 10]]))
      .toEqual([["WG Local", 10, 1000], ["WG Rede", 5, 1100], ["Cortesias e promoções", 5, 50], ["Outros planos", 1, 10]]);
  });
  it("rosca por tipo: quatro tipos e o resto em Outros, fechando o total", () => {
    const f = fatiasPorTipo([["WG Local", 6, 600], ["Cortesias e promoções", 3, 30], ["WG Rede", 1, 200], ["Outros planos", 1, 50]], 12, 980);
    expect(f.map((x) => [x.rotulo, x.n, x.v])).toEqual([["WG Local", 6, 600], ["WG Rede", 1, 200], ["Outros", 5, 180]]);
  });
  it("cortesias e promoções contam no total, mas não aparecem na lista por tipo", () => {
    const total = { familiasVendidas: [["WG Local", 6, 600], ["Cortesias e promoções", 3, 30], ["WG Rede", 1, 200]], contratosVendidos: [], tipoVenda: { novo: [8, 700], remat: [2, 130], renov: [0, 0] }, duracaoVenda: [0, 0, 0, 0, 0] } as unknown as UnitData;
    const h = renderToString(<ContratosVendidos total={total} monthLabel="Out" partial={false} unitLabel="Rede" porFamilia />);
    expect(h).not.toContain("Cortesias e promoções<");
    expect(h).toContain(">10<");
    expect(h).toContain("Outros");
    expect(h).toContain("30,0%");
    expect(h).toContain("60%");
  });
  it("agrupa diárias (separando as das unidades PRO), brinquedoteca e personal na lista de produtos", () => {
    expect(reagruparProdutos([["DIARIA R$ 30,00", 10, 300], ["DIARIA KIDS WG X | R$ 10,00", 5, 50], ["DIÁRIA NATAÇÃO", 1, 45], ["COQUETELEIRA", 2, 60]]))
      .toEqual([["Diária", 11, 345], ["COQUETELEIRA", 2, 60], ["Brinquedoteca", 5, 50]]);
    expect(reagruparProdutos([["WG PRO DIÁRIA | R$70,00", 21, 1470], ["Diária WG PRO Salvador", 9, 630]])).toEqual([["Diária", 30, 2100]]);
    const venda = (item: string, v: number, o: Record<string, unknown> = {}) => ({ idBranch: 5, saleItens: [{ item, saleValue: v, quantity: 1, ...o }] });
    const u = Object.values(resumirVendas([venda("DIARIA 30,00", 30), venda("11 - WG DIÁRIA 30,00", 30, { idMembership: 9 }), venda("DIARIA KIDS | R$ 10", 10), venda("PERSONAL MENSAL", 100, { idMembership: 8 }), venda("COQUETELEIRA", 25),
      venda("PRO+", 277), venda("WG PRO+ MENSAL", 300, { idMembership: 7 }), venda("WG PLUS 2X", 40, { idMembership: 6 })]))[0] as { produtosVendidos: unknown[] };
    expect(u.produtosVendidos).toEqual([["Pro+", 2, 577], ["Taxa de personal", 1, 100], ["Diária", 2, 60], ["WG Plus", 1, 40], ["COQUETELEIRA", 1, 25], ["Brinquedoteca", 1, 10]]);
    expect(reagruparProdutos([["PRO+", 9, 2493], ["WG PLUS", 2, 80]])).toEqual([["Pro+", 9, 2493], ["WG Plus", 2, 80]]);
  });
  it("separa multas, taxas e ajustes dos produtos", () => {
    expect(ehTaxa("MULTA DE CANCELAMENTO DE CONTRATO")).toBe(true);
    expect(ehTaxa("Pró-rata - Alteração de dia de cobrança")).toBe(true);
    expect(ehTaxa("INADIMPLÊNCIA - 149,90")).toBe(true);
    expect(ehTaxa("PRO+")).toBe(false);
    expect(ehTaxa("COQUETELEIRA")).toBe(false);
    const item = (item: string, saleValue: number, o: Record<string, unknown> = {}) => ({ item, saleValue, quantity: 1, ...o });
    const u = resumirVendas([{ idBranch: 5, registrationKind: "enrollment", saleItens: [
      item("WG LOCAL | R$ 129,90", 129.9, { idMembership: 1 }), item("WG90 | R$357,00 (À VISTA)", 357, { idMembership: 4 }),
      item("WORLD GYM PLUS 3X R$ 329,90", 329.9, { idMembership: 5 }), item("PRO+ SEMESTRAL 2X | R$447,00", 447, { idMembership: 6 }), item("PRO+", 277), item("WG 30 | R$ 189,90", 189.9, { idMembership: 2 }), item("01 - WG LOCAL RIACHO", 139.9, { idMembership: 3 }),
      item("MULTA DE CANCELAMENTO DE CONTRATO", 300), item("MULTA DE CANCELAMENTO 319,80", 319.8), item("TAXA DE ADESÃO", 50), item("COQUETELEIRA", 30),
    ] }])["Asa Norte"];
    expect(u.familiasVendidas).toEqual([["WG 30", 2, 546.9], ["WG Local", 2, 269.8]]);
    expect(u.produtosVendidos).toEqual([["Pro+", 2, 724], ["WG Plus", 1, 329.9], ["COQUETELEIRA", 1, 30]]);
    expect(u.taxasCobradas.map((r: unknown[]) => r[0])).toEqual(["MULTA DE CANCELAMENTO 319,80", "MULTA DE CANCELAMENTO DE CONTRATO", "TAXA DE ADESÃO"]);
    expect(u.taxasResumo).toEqual([669.8, 2, 619.8]);
    expect(u.plus).toBe(329.9);
    expect(u.proMais).toBe(724);
    expect(u.contratosVendidos.map((r: unknown[]) => r[0])).not.toContain("PRO+ SEMESTRAL 2X | R$447,00");
  });
  it("a rede mostra as famílias; a unidade, os nomes", () => {
    const fam = somarFamiliasVendidas([{ familiasVendidas: [["WG Local", 10, 1000], ["WG 30", 2, 380]] }, { familiasVendidas: [["WG 30", 5, 950]] }]);
    expect(fam).toEqual([["WG Local", 10, 1000], ["WG 30", 7, 1330]]);
    const total = { contratosVendidos: [["01 - WG LOCAL RIACHO", 10, 1000]], familiasVendidas: fam, tipoVenda: { novo: [17, 2330], remat: [0, 0], renov: [0, 0] }, duracaoVenda: [17, 0, 0, 0, 0] } as unknown as UnitData;
    const rede = limpo(renderToString(<ContratosVendidos total={total} monthLabel="Out" partial={false} unitLabel="Rede" porFamilia />));
    expect(rede).toContain("Planos mais vendidos por tipo");
    expect(rede).toContain("WG Local responde por");
    expect(rede).not.toContain("RIACHO");
    const un = limpo(renderToString(<ContratosVendidos total={total} monthLabel="Out" partial={false} unitLabel="Riacho" />));
    expect(un).toContain("RIACHO");
  });
  it("cartão de multas, taxas e ajustes", () => {
    const h = limpo(renderToString(<TaxasCobradas total={{ taxasCobradas: [["MULTA X", 2, 619.8]], taxasResumo: [669.8, 2, 619.8] } as unknown as UnitData} monthLabel="Out" partial={false} unitLabel="Rede" />));
    expect(h).toContain("Multas, taxas e ajustes");
    expect(h).toContain("670");
  });
});

describe("card de quem treina em outra unidade", () => {
  it("unidade: para onde foram e de onde vieram; rede: maiores fluxos", () => {
    const fx = (unidades: [string, number, number][]) => ({ pessoas: unidades.reduce((s, x) => s + x[1], 0), entradas: unidades.reduce((s, x) => s + x[2], 0), unidades });
    const total = { ativosFim: 1000, frequentadores: 800, outrasUnidades: { foram: fx([["Gama", 30, 90]]), vieram: fx([["Asa Norte", 12, 20]]) } } as unknown as UnitData;
    const h = limpo(renderToString(<OutrasUnidadesCard total={total} month="2026-10" monthLabel="Outubro de 2026" partial={false} unit="Itapoã" />));
    expect(h).toContain("Alunos daqui que treinaram em outra · 3,0% dos ativos");
    expect(h).toContain("Para onde foram os alunos de Itapoã");
    expect(fluxosDaRede([{ name: "Gama", outrasUnidades: { foram: fx([]), vieram: fx([["Asa Norte", 5, 9], ["Itapoã", 8, 10]]) } }, { name: "Itapoã", outrasUnidades: { foram: fx([]), vieram: fx([["Gama", 30, 90]]) } }] as unknown as UnitData[]))
      .toEqual([["Gama", "Itapoã", 30, 90], ["Itapoã", "Gama", 8, 10], ["Asa Norte", "Gama", 5, 9]]);
  });
});
