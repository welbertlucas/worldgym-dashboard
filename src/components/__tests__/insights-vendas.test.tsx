import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ContratosVendidos, fatiasPorTipo, linhasTipoVenda } from "@/components/ContratosVendidos";
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
  it("tipo de venda: matrículas, rematrículas e renovações de contrato (sem a recorrência automática), com o \"i\" explicativo", () => {
    const tv: TipoVenda = { novo: [80, 8000], remat: [20, 2000], renov: [500, 50000], auto: [470, 47000] };
    expect(linhasTipoVenda(tv).map((l) => [l.rotulo, l.n, l.v])).toEqual([
      ["Matrículas", 80, 8000], ["Rematrículas", 20, 2000], ["Renovações de contrato", 30, 3000],
    ]);
    const total = { contratosVendidos: [["WG 30", 100, 10000]] as [string, number, number][], tipoVenda: tv, duracaoVenda: [100, 0, 0, 0, 0] } as unknown as UnitData;
    const h = limpo(renderToString(<ContratosVendidos total={total} monthLabel="Outubro de 2026" partial={false} unitLabel="Rede" />));
    for (const t of ["Matrículas", "Rematrículas", "Renovações de contrato"]) expect(h).toContain(t);
    expect(h).not.toContain("Recorrência automática");
    expect(h).toContain("Como é calculado: tipo de venda"); // botão "i"
  });
  it("tipo de venda sem a divisão manual × automática (meses antigos): não mostra renovações (só matrículas e rematrículas)", () => {
    const tv: TipoVenda = { novo: [80, 8000], remat: [20, 2000], renov: [500, 50000] };
    expect(linhasTipoVenda(tv).map((l) => [l.rotulo, l.n])).toEqual([["Matrículas", 80], ["Rematrículas", 20]]);
  });
  it("a rede só traz a divisão automática se todas as unidades a trazem", () => {
    const a = { tipoVenda: { novo: [1, 1], remat: [1, 1], renov: [10, 10], auto: [8, 8] } } as unknown as UnitData;
    const b = { tipoVenda: { novo: [1, 1], remat: [1, 1], renov: [5, 5], auto: [4, 4] } } as unknown as UnitData;
    const velha = { tipoVenda: { novo: [1, 1], remat: [1, 1], renov: [5, 5] } } as unknown as UnitData;
    expect(somarTipoVenda([a, b]).auto).toEqual([12, 12]);
    expect(somarTipoVenda([a, velha]).auto).toBeUndefined();
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
import { somarFormas as somarFormasServidor, somarBandeiras, somarGateways, somarGatewaysDet } from "../../../server/pagamentos.js";
import { BandeirasCartao, FormasPagamento, GatewaysCartao, detalheDoGateway, formasOrdenadas } from "@/components/FormasPagamento";
import { somarFormas, nomeBandeira, nomeGateway, normalizarDet, normalizarNomes, somarDet } from "@/data/dashboardData";

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
  it("conta as cobranças e soma as taxas por gateway, só no cartão e só o que foi pago", () => {
    const t = (forma: string, acq: string | null, v: number, fees?: number) => ({ paymentType: { id: 1, name: forma }, cardAcquirer: acq, ammountPaid: v, fees, idMemberPayer: 1 });
    const det = somarGatewaysDet([t("Credit card", "Stone", 100, 1.7), t("Debit card", "Stone", 50, 0.55), t("Credit card", "Rede", 200, 0), t("Credit card", null, 10, 0.1), t("Deposit", "Stone", 99, 9), t("Credit card", "Stone", 0, 5)]);
    expect(det).toEqual({ Stone: [2, 2.25], Rede: [1, 0], "Não informada": [1, 0.1] });
    // o mesmo gateway escrito de jeitos diferentes e a soma entre unidades
    expect(normalizarDet({ Redecard: [2, 1], REDE: [3, 2] }, nomeGateway)).toEqual({ Rede: [5, 3] });
    expect(somarDet([{ Stone: [2, 1.5] }, undefined, { Stone: [1, 0.25], Rede: [4, 0] }])).toEqual({ Stone: [3, 1.75], Rede: [4, 0] });
  });
  it("o card de gateway mostra cobranças, ticket e taxas quando o mês tem o detalhe, e segue sem ele nos meses antigos", () => {
    const sp = (x?: string) => x?.replace(/\u00a0/g, " ");
    expect(sp(detalheDoGateway([689, 820], 109467))).toBe("689 cobranças · ticket R$ 159 · taxas R$ 820 (0,75%)");
    expect(sp(detalheDoGateway([1, 0], 50))).toBe("1 cobrança · ticket R$ 50");
    expect(detalheDoGateway(undefined, 100)).toBeUndefined();
    const com = renderToString(<GatewaysCartao total={{ gatewaysCartao: { Stone: 700, Rede: 300 }, gatewaysDet: { Stone: [7, 14] } } as unknown as UnitData} monthLabel="Out" unitLabel="Rede" />);
    expect(com).toContain("7 cobranças");
    expect(com).toContain("taxas");
    const sem = renderToString(<GatewaysCartao total={{ gatewaysCartao: { Stone: 700 } } as unknown as UnitData} monthLabel="Out" unitLabel="Rede" />);
    expect(sem).not.toContain("cobranças");
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
    // Todas as unidades na lista, sem "e mais N".
    const muitas = Array.from({ length: 12 }, (_, i) => [`Unidade ${i + 1}`, 12 - i, 30] as [string, number, number]);
    const h2 = limpo(renderToString(<OutrasUnidadesCard total={{ ...total, outrasUnidades: { foram: fx(muitas), vieram: fx([]) } } as UnitData} month="2026-10" monthLabel="Outubro de 2026" partial={false} unit="Itapoã" />));
    expect(h2).toContain("Unidade 12");
    expect(h2).not.toContain("e mais");
    expect(fluxosDaRede([{ name: "Gama", outrasUnidades: { foram: fx([]), vieram: fx([["Asa Norte", 5, 9], ["Itapoã", 8, 10]]) } }, { name: "Itapoã", outrasUnidades: { foram: fx([]), vieram: fx([["Gama", 30, 90]]) } }] as unknown as UnitData[]))
      .toEqual([["Gama", "Itapoã", 30, 90], ["Itapoã", "Gama", 8, 10], ["Asa Norte", "Gama", 5, 9]]);
  });
});

describe("oportunidades: tempo até converter, consultores e por unidade", () => {
  const total = {
    oportunidades: 100, conversoes: 60,
    tempoConversao: { n: 60, soma: 120, f: [30, 15, 8, 5, 2] },
    consultores: [["Bia Lima", 20, "Asa Norte"], ["Caio Reis", 12, "Gama"]],
  } as unknown as UnitData;
  it("tempo até converter mostra a média, o mesmo dia e as faixas", async () => {
    const { TempoParaConverter } = await import("@/components/TempoParaConverter");
    const h = limpo(renderToString(<TempoParaConverter total={total} monthLabel="Outubro de 2026" partial={false} unitLabel="Rede" />));
    expect(h).toContain("2 dias"); // 120 ÷ 60
    expect(h).toContain("50%"); // 30 de 60 no mesmo dia
    for (const f of ["No mesmo dia", "1 a 3 dias", "4 a 7 dias", "8 a 30 dias", "Mais de 30 dias"]) expect(h).toContain(f);
    expect(limpo(renderToString(<TempoParaConverter total={{} as UnitData} monthLabel="x" partial={false} unitLabel="Rede" />))).toContain("Sem conversões com o tempo calculado");
  });
  it("consultores: ordem, unidade só na rede e aviso de que o EVO não informa quem cadastrou", async () => {
    const { ConsultoresConversao } = await import("@/components/ConsultoresConversao");
    const h = limpo(renderToString(<ConsultoresConversao total={total} monthLabel="Outubro de 2026" partial={false} unitLabel="Rede" />));
    expect(h.indexOf("Bia Lima")).toBeLessThan(h.indexOf("Caio Reis"));
    // o usuário de suporte do EVO não é consultor: fica fora do ranking, mesmo nos meses gravados antes do filtro
    const comSuporte = { ...total, consultores: [["SUPORTEEVO", 296, "Gama"], ["Bia Lima", 20, "Asa Norte"], ["Suporte Evo", 5, "Gama"]] } as unknown as UnitData;
    const semSuporte = limpo(renderToString(<ConsultoresConversao total={comSuporte} monthLabel="x" partial={false} unitLabel="Rede" />));
    expect(semSuporte).toContain("Bia Lima");
    expect(semSuporte.replace("O usuário de suporte do EVO não aparece", "")).not.toMatch(/SUPORTEEVO/);
    expect(h).toContain("Asa Norte");
    expect(h).toContain("não informa quem cadastrou");
    const uma = limpo(renderToString(<ConsultoresConversao total={{ ...total, consultores: [["Bia Lima", 20, "Asa Norte"]] } as unknown as UnitData} monthLabel="x" partial={false} unitLabel="Asa Norte" />));
    expect(uma).not.toContain("· Asa Norte");
  });
  it("por unidade: ordena pelas cadastradas e mostra conversão, tempo e a origem principal sem contar 'Sem origem'", async () => {
    const { OportunidadesPorUnidade } = await import("@/components/OportunidadesPorUnidade");
    const us = [
      { name: "Gama", oportunidades: 50, conversoes: 10, origens: { "Sem origem": [30, 4], Instagram: [20, 6] }, tempoConversao: { n: 10, soma: 25, f: [0, 0, 0, 0, 0] } },
      { name: "Asa Norte", oportunidades: 80, conversoes: 40, origens: { "Sem origem": [10, 5], "Totem/Site": [70, 35] } },
    ] as unknown as UnitData[];
    const h = limpo(renderToString(<OportunidadesPorUnidade units={us} monthLabel="Outubro de 2026" partial={false} />));
    expect(h.indexOf("Asa Norte")).toBeLessThan(h.indexOf("Gama"));
    expect(h).toContain("50,0%");
    expect(h).toContain("Totem/Site");
    expect(h).toContain("Instagram");
    expect(h).toContain("2,5 d");
    expect(h).not.toContain("De cadastros antigos"); // mês sem o dado: a coluna não aparece
  });
  it("por unidade: coluna 'De cadastros antigos' à parte da conversão, quando o mês tem o dado", async () => {
    const { OportunidadesPorUnidade } = await import("@/components/OportunidadesPorUnidade");
    const us = [
      { name: "Gama", oportunidades: 50, conversoes: 10, conversoesAntigas: 17 },
      { name: "Asa Norte", oportunidades: 80, conversoes: 40 },
    ] as unknown as UnitData[];
    const h = limpo(renderToString(<OportunidadesPorUnidade units={us} monthLabel="Novembro de 2026" partial />));
    expect(h).toContain("De cadastros antigos");
    expect(h).toContain("+17");
    expect(h).toContain("20,0%"); // a taxa segue sendo só dos cadastrados no mês
    expect(h).toContain("Resumo gerencial do EVO");
  });
});

describe("vendas por dia: destaque", () => {
  it("o destaque é o dia do mês que mais vendeu (com o dia da semana), e não o dia da semana de maior soma", async () => {
    const { VendasPorDia } = await import("@/components/VendasPorDia");
    // outubro de 2026 começa numa quinta: dia 13 é terça. Três sextas somam mais que a terça, mas o maior dia é o 13.
    const vendasDia = Array(31).fill(0);
    vendasDia[1] = 3; vendasDia[8] = 3; vendasDia[15] = 3; vendasDia[22] = 3; // sextas 2, 9, 16, 23: soma 12
    vendasDia[12] = 8; // terça 13: o maior dia
    const total = { vendasDia } as unknown as UnitData;
    const h = limpo(renderToString(<VendasPorDia total={total} month="2026-10" partial={false} unit={null} atualizadoEm={null} metas={[]} />));
    expect(h).toContain("Dia que mais vendeu em outubro");
    expect(h).toContain("Terça, 13/10");
  });
});

describe("tela de carregar", () => {
  it("ao entrar pelo login a tela é azul, com a mensagem; sem forçar e sem sessão também é azul", async () => {
    const { Abertura } = await import("@/components/Abertura");
    const h = renderToString(<Abertura azul mensagem="Entrando no Atlas" />);
    expect(h).toContain("Entrando no Atlas");
    expect(h).toContain("#21398A"); // o fundo azul do login
    expect(h).not.toContain("#FAFAFB"); // e não o claro
  });
  it("com a regra de seguir azul ligada, mesmo com sessão guardada a tela continua azul; desligada, volta ao normal", async () => {
    const { Abertura, seguirComAbeturaAzul } = await import("@/components/Abertura");
    seguirComAbeturaAzul(true);
    expect(renderToString(<Abertura mensagem="Carregando" />)).toContain("#21398A");
    seguirComAbeturaAzul(false);
  });
});

describe("marketing: gráficos novos", () => {
  it("custo por contato por unidade: do mais barato ao mais caro, média da rede e unidades sem contato à parte", async () => {
    const { custosPorUnidade } = await import("@/components/CustoPorContatoUnidades");
    const mes = { geradoEm: "x", erros: [], unidades: {
      Gama: { investimento: 1000, impressoes: 0, cliques: 0, leads: 40, conversas: 10 }, // R$ 20
      "Asa Norte": { investimento: 600, impressoes: 0, cliques: 0, leads: 10, conversas: 0 }, // R$ 60
      Itapoã: { investimento: 300, impressoes: 0, cliques: 0, leads: 0, conversas: 0 }, // sem contato
      Rede: { investimento: 9999, impressoes: 0, cliques: 0, leads: 1, conversas: 1 }, // institucional: fora
    } } as never;
    const r = custosPorUnidade(mes);
    expect(r.linhas.map((l) => [l.nome, Math.round(l.custo)])).toEqual([["Gama", 20], ["Asa Norte", 60]]);
    expect(r.semContato).toEqual(["Itapoã"]);
    expect(Math.round((r.media ?? 0) * 100) / 100).toBe(26.67); // 1600 ÷ 60
    expect(custosPorUnidade(undefined)).toEqual({ linhas: [], semContato: [], media: null });
  });
  it("desempenho por tipo de conteúdo: média de interações por post, em ordem, com o melhor tipo destacado", async () => {
    const { desempenhoPorTipo, DesempenhoPorTipo } = await import("@/components/DesempenhoPorTipo");
    const p = (tipo: string, interacoes: number | null, curtidas = 0) => ({ tipo, interacoes, curtidas, comentarios: 0, salvos: 0, compartilhamentos: 0 }) as never;
    const posts = [p("REELS", 100), p("REELS", 50), p("REELS", 150), p("IMAGE", 30), p("IMAGE", null, 10), p("IMAGE", 20), p("CAROUSEL_ALBUM", 500)];
    const l = desempenhoPorTipo(posts);
    expect(l.map((x) => [x.rotulo, x.posts, Math.round(x.media)])).toEqual([["Carrossel", 1, 500], ["Reels", 3, 100], ["Foto", 3, 20]]);
    const h = limpo(renderToString(<DesempenhoPorTipo posts={posts} quem="Rede" />));
    expect(h).toContain("Reels");
    expect(h).toContain("com menos de 3 posts");
    expect(limpo(renderToString(<DesempenhoPorTipo posts={[]} quem="Rede" />))).toContain("Nenhum post guardado");
  });
});

describe("tela de trocar a senha", () => {
  it("primeiro acesso: sem cancelar, só sair; troca voluntária: com cancelar; regras locais", async () => {
    const { TrocarSenha, motivoLocal } = await import("@/components/TrocarSenha");
    const obrig = renderToString(<TrocarSenha obrigatoria onFeito={() => {}} onSair={() => {}} />);
    expect(obrig).toContain("Escolha a sua senha");
    expect(obrig).toContain("Senha provisória");
    expect(obrig).toContain("Sair");
    expect(obrig).not.toContain("Cancelar");
    const vol = renderToString(<TrocarSenha onFeito={() => {}} onCancelar={() => {}} />);
    expect(vol).toContain("Trocar senha");
    expect(vol).toContain("Cancelar");
    expect(vol).toContain('role="dialog"');
    expect(motivoLocal("curta", "curta", "x")).toContain("10 caracteres");
    expect(motivoLocal("uma-senha-bem-forte-9", "outra", "x")).toContain("não são iguais");
    expect(motivoLocal("igual-a-atual-123", "igual-a-atual-123", "igual-a-atual-123")).toContain("diferente da atual");
    expect(motivoLocal("uma-senha-bem-forte-9", "uma-senha-bem-forte-9", "provisoria")).toBeNull();
  });
  it("o e-mail de acesso avisa que a senha provisória será trocada", async () => {
    // @ts-expect-error módulo JS do servidor
    const { emailDeAcesso } = await import("../../../server/boasVindas.js");
    const { html } = emailDeAcesso({ nome: "Maria", email: "m@x.com" }, "ABC123def456", { novo: true });
    expect(html).toContain("escolha uma senha só sua");
  });
});
