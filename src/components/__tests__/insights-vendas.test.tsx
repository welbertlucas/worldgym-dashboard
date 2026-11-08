import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ContratosVendidos } from "@/components/ContratosVendidos";
import { somarContratosVendidos, somarTipoVenda, type UnitData } from "@/data/dashboardData";

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
import { acumularEntradas, fecharEntradas } from "../../../server/entradas.js";

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
import { somarFormas as somarFormasServidor } from "../../../server/pagamentos.js";
import { FormasPagamento, formasOrdenadas } from "@/components/FormasPagamento";
import { somarFormas } from "@/data/dashboardData";

describe("formas de pagamento", () => {
  it("soma o valor pago por forma, em português, sem cancelados nem títulos sem pagador", () => {
    const t = (nome: string | undefined, v: number, o: Record<string, unknown> = {}) => ({ paymentType: nome ? { id: 1, name: nome } : null, ammountPaid: v, idMemberPayer: 1, ...o });
    expect(somarFormasServidor([
      t("Credit card", 100), t("Credit card", 50.5), t("Deposit", 30), t("Debit card", 0),
      t("Credit card", 999, { cancellationDate: "2026-10-02" }), t("Deposit", 999, { idMemberPayer: null }), t(undefined, 5), t("Voucher X", 7),
    ])).toEqual({ "Cartão de crédito": 150.5, "Pix e depósito": 30, "Não informada": 5, "Voucher X": 7 });
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
  it("lista até 8 itens pelo valor", () => {
    const produtosVendidos = Array.from({ length: 10 }, (_, k) => [`P${k}`, 10 - k, 1000 - k * 50]);
    const h = limpo(renderToString(<ProdutosVendidos total={{ produtosVendidos } as unknown as UnitData} monthLabel="Out" partial={false} unitLabel="Rede" />));
    expect(h).toContain("P7");
    expect(h).not.toContain("P8");
  });
});
