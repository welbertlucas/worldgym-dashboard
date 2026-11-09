import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { NaoRenovados, linhasNaoRenovados } from "@/components/clientes/NaoRenovados";
import type { UnitData } from "@/data/dashboardData";
// @ts-expect-error módulo JS do servidor
import { tipoNaoRenovado } from "../../../server/renovacao.js";

const limpo = (h: string) => h.replace(/<!-- -->/g, "");

describe("contratos não renovados", () => {
  it("classifica o contrato vencido pelo tipo, com as diárias à parte", () => {
    expect(tipoNaoRenovado("11 - WG DIÁRIA 30,00")).toBe("Diárias");
    expect(tipoNaoRenovado("WG 30 | R$ 189,90")).toBe("WG 30");
    expect(tipoNaoRenovado("X - FREE PASS (1 DIA)")).toBe("Cortesias e promoções");
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
});
