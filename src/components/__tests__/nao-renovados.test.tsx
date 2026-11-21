import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { NaoRenovados, linhasNaoRenovados } from "@/components/clientes/NaoRenovados";
import { listaSemDiarias, outrosEmPromocoes, type UnitData } from "@/data/dashboardData";
import { MotivosCancelamento, contratosCancelados } from "@/components/clientes/MotivosCancelamento";
// @ts-expect-error módulo JS do servidor
import { resumirCancelados } from "../../../server/cancelamentos.js";
// @ts-expect-error módulo JS do servidor
import { tipoNaoRenovado } from "../../../server/renovacao.js";

const limpo = (h: string) => h.replace(/<!-- -->/g, "");

describe("contratos não renovados", () => {
  it("classifica o contrato vencido pelo tipo, com as diárias à parte", () => {
    expect(tipoNaoRenovado("11 - WG DIÁRIA 30,00")).toBe("Diárias");
    expect(tipoNaoRenovado("WG 30 | R$ 189,90")).toBe("WG 30");
    expect(tipoNaoRenovado("X - FREE PASS (1 DIA)")).toBe("Free pass e experimental");
    expect(tipoNaoRenovado("06 - WG EXPERIMENTAL (R$ 97,00)")).toBe("Free pass e experimental");
    expect(tipoNaoRenovado("WORLD GYM GAMA GIFT CARD 129,90")).toBe("Promoções");
    expect(tipoNaoRenovado("WG JARDIM INGÁ LOCAL | R$ 139,90")).toBe("WG Local");
  });
  it("lista por tipo na rede e por plano na unidade, com a cauda em Demais", () => {
    const t = { naoRenovados: 20, naoRenovadosTipos: { "WG 30": 8, Diárias: 10, "WG Local": 2 }, naoRenovadosPlanos: [["WG 30 | R$ 189,90", 8], ["DIÁRIA", 7]] as [string, number][] };
    expect(linhasNaoRenovados(t, true)).toEqual([["Diárias", 10], ["WG 30", 8], ["WG Local", 2]]);
    expect(linhasNaoRenovados(t, false)).toEqual([["WG 30 | R$ 189,90", 8], ["DIÁRIA", 7], ["Demais planos", 5]]);
  });
  it("mostra vencidos, renovados e não renovados", () => {
    const total = { aVencer: 100, naoRenovados: 30, renovacoesEvo: true, naoRenovadosTipos: { Diárias: 20, "WG 30": 10 } } as unknown as UnitData;
    const h = limpo(renderToString(<NaoRenovados total={total} monthLabel="Out" partial={false} unitLabel="Rede" porTipo />));
    expect(h).toContain(">100<");
    expect(h).toContain(">70<");
    expect(h).toContain("Renovados (70,0%)");
    expect(h).toContain("Não renovados (30,0%)");
    expect(h).toContain("Diárias");
  });
  it("diária, free pass e experimental saem só da lista; a conta continua a do EVO", () => {
    const u = { naoRenovadosTipos: { Diárias: 20, "Free pass e experimental": 10, "WG 30": 15, Promoções: 5 }, naoRenovadosPlanos: [["11 - WG DIÁRIA 30,00", 20], ["WG 30", 15], ["X - FREE PASS", 10]] as [string, number][] };
    expect(listaSemDiarias(u)).toEqual({ naoRenovadosFora: 30, naoRenovadosTipos: { "WG 30": 15, Promoções: 5 }, naoRenovadosPlanos: [["WG 30", 15]] });
    expect(listaSemDiarias({ naoRenovadosTipos: { "Cortesias e promoções": 30 } })).toEqual({});
    expect(linhasNaoRenovados({ naoRenovados: 50, naoRenovadosFora: 30, naoRenovadosTipos: { "WG 30": 15, Promoções: 5 } }, true)).toEqual([["WG 30", 15], ["Promoções", 5]]);
  });
});

describe("contratos cancelados", () => {
  it("conta cada aluno uma vez, pelo tipo e pelo plano do contrato cancelado", () => {
    const r = (idMember: number, nameMembership: string, reasonCancellation = "Mudança") => ({ idBranch: 5, idMember, nameMembership, reasonCancellation });
    const u = resumirCancelados([r(1, "01 - WG LOCAL | R$ 129,90"), r(1, "WG 30"), r(2, "WG 30 | R$ 189,90", "Inadimplência"), r(3, "WG LOCAL MILITAR")])["Asa Norte"];
    expect(u.tipos).toEqual({ "WG Local": 1, "WG 30": 1, Promoções: 1 });
    expect(u.planos).toEqual([["01 - WG LOCAL | R$ 129,90", 1], ["WG 30 | R$ 189,90", 1], ["WG LOCAL MILITAR", 1]]);
  });
  it("cancelados: plano barato (primeira parcela abaixo de R$ 129,90, pelo catálogo) e plano sem tipo viram Promoções", () => {
    const r = (idMember: number, idMembership: number, nameMembership: string) => ({ idBranch: 5, idMember, idMembership, nameMembership, reasonCancellation: "Mudança" });
    const catalogo = new Map([[10, { primeira: 99 }], [11, { primeira: 189.9 }]]);
    const u = resumirCancelados([r(1, 10, "WG LOCAL | R$ 139,90"), r(2, 11, "WG LOCAL | R$ 189,90"), r(3, 99, "WG 30"), r(4, 98, "PLANO ESTRANHO")], catalogo)["Asa Norte"];
    expect(u.tipos).toEqual({ Promoções: 2, "WG Local": 1, "WG 30": 1 });
  });
  it("meses antigos: 'Outros planos' é somado em Promoções", () => {
    expect(outrosEmPromocoes({ "WG Local": 5, "Outros planos": 3, Promoções: 2 })).toEqual({ "WG Local": 5, Promoções: 5 });
    expect(outrosEmPromocoes({ "WG Local": 5, "Outros planos": 3 })).toEqual({ "WG Local": 5, Promoções: 3 });
    const sem = { "WG Local": 1 };
    expect(outrosEmPromocoes(sem)).toBe(sem);
  });
  it("mostra os contratos cancelados ao lado dos motivos", () => {
    const total = { motivosCancel: { Mudança: 6, "Inadimplência (cancelamento automático)": 4 }, canceladosTipos: { "WG Local": 7, "WG 30": 3 } } as unknown as UnitData;
    expect(contratosCancelados(total, true, 10)).toEqual([["WG Local", 7], ["WG 30", 3]]);
    const h = limpo(renderToString(<MotivosCancelamento total={total} monthLabel="Out" partial={false} unitLabel="Rede" porTipo />));
    expect(h).toContain("Contratos cancelados por tipo");
    expect(h).toContain("WG Local");
  });
});
