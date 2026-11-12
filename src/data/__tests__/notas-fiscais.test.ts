import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
// @ts-expect-error módulo JS do servidor
import { resumirNotas } from "../../../server/notas.js";
import { somarNotas, type UnitData } from "@/data/dashboardData";
import { NotasFiscaisCard, cobertura, mesSeguinte } from "@/components/NotasFiscais";

const nota = (idRecebimento: number, valorTotal: number, status = "Autorizada") => ({ idRecebimento, valorTotal, valorIss: valorTotal * 0.02, status });
const pago = (idReceivable: number, ammountPaid: number, extra: Record<string, unknown> = {}) => ({ idReceivable, ammountPaid, idMemberPayer: 1, cancellationDate: null, ...extra });

describe("notas fiscais", () => {
  it("cobertura liga cada nota ao pagamento; nota do mês seguinte também cobre", () => {
    const titulos = [pago(1, 100), pago(2, 100), pago(3, 50), pago(4, 80, { cancellationDate: "2026-10-05" }), pago(5, 0)];
    const doMes = [nota(1, 100), nota(9, 120), nota(2, 100, "Cancelada"), nota(7, 30, "Negada")];
    const seguinte = [nota(2, 100)]; // a do 2 saiu de novo no mês seguinte
    const r = resumirNotas(doMes, seguinte, titulos);
    expect(r.cobertura).toEqual([200, 250]); // 1 e 2 com nota; 3 sem; 4 cancelado e 5 sem valor ficam de fora
    expect(r.emitidas).toEqual([2, 220]); // só autorizadas emitidas no mês
    expect(r.outrosMeses).toEqual([1, 120]); // a 9 cobre pagamento de outro mês
    expect(r.canceladas).toBe(1);
    expect(r.negadas).toBe(1);
    expect(r.iss).toBeCloseTo(4.4);
  });

  it("soma da rede, cobertura e card", () => {
    const a = { emitidas: [10, 1000], iss: 20, canceladas: 1, negadas: 0, outrosMeses: [0, 0], cobertura: [900, 1000] } as UnitData["notas"];
    const b = { emitidas: [5, 400], iss: 8, canceladas: 0, negadas: 2, outrosMeses: [3, 300], cobertura: [100, 500] } as UnitData["notas"];
    const s = somarNotas([{ notas: a }, { notas: b }, {}]);
    expect(s).toMatchObject({ emitidas: [15, 1400], iss: 28, canceladas: 1, negadas: 2, outrosMeses: [3, 300], cobertura: [1000, 1500] });
    expect(cobertura(s)).toBeCloseTo(66.67, 1);
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    const h = renderToString(createElement(NotasFiscaisCard, { total: { notas: s } as UnitData, month: "2026-08", monthLabel: "agosto de 2026", partial: false, unit: "Gama" })).replace(/<!-- -->/g, "");
    expect(h).toContain("Recebido com nota");
    expect(h).toContain("66,7%");
    expect(h).toContain("cobrem pagamentos de outros meses");
    expect(renderToString(createElement(NotasFiscaisCard, { total: {} as UnitData, month: "2026-08", monthLabel: "x", partial: false, unit: null }))).toContain("ainda não foram carregadas");
  });
});
