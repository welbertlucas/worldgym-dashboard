import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { baseDoDia, mesesAnteriores, serieDoMes } from "../../../server/mesmoDia.js";

describe("mesmo dia dos meses anteriores", () => {
  // Outubro: 2 alunos com mensalidade no dia 5. O aluno 1 paga em dia; o aluno 2 só paga no dia 20 e o EVO muda o vencimento
  // do título para o dia 20 (o original fica no relatório de devedores, com a recuperação em chargeDate). O aluno 3 vence dia 25
  // e não paga. O aluno 4 vence dia 28 e paga só em novembro (o título foi para novembro; só aparece nos devedores).
  const due = [
    { idReceivable: 1, idMemberPayer: 1, dueDate: "2026-10-05T00:00:00", chargeDate: "2026-10-05T10:00:00", ammount: 100, ammountPaid: 100 },
    { idReceivable: 2, idMemberPayer: 2, dueDate: "2026-10-20T00:00:00", chargeDate: "2026-10-20T10:00:00", ammount: 100, ammountPaid: 100 },
    { idReceivable: 3, idMemberPayer: 3, dueDate: "2026-10-25T00:00:00", chargeDate: null, ammount: 200 },
  ];
  const paid = due.filter((r) => r.chargeDate);
  const devedores = [
    { receivableId: 2, memberId: 2, debtStatus: "Recovered", originalDueDate: "2026-10-05T00:00:00", dueDate: "2026-10-20T00:00:00", chargeDate: "2026-10-20T10:00:00", debtAmount: 100 },
    { receivableId: 3, memberId: 3, debtStatus: "open", originalDueDate: "2026-10-25T00:00:00", dueDate: "2026-10-25T00:00:00", chargeDate: null, debtAmount: 200 },
    { receivableId: 4, memberId: 4, debtStatus: "Recovered", originalDueDate: "2026-10-28T00:00:00", dueDate: "2026-11-03T00:00:00", chargeDate: "2026-11-03T09:00:00", debtAmount: 50 },
  ];
  const s = serieDoMes("2026-10", { due, paid, devedores });

  it("reconstrói a madrugada de cada dia pelo vencimento original", () => {
    expect(Object.keys(s)).toHaveLength(31);
    // Madrugada do dia 5: nada venceu antes de hoje; o título do aluno 2 vence hoje e aparece em aberto na cobrança.
    expect(s["05"]).toMatchObject({ pagantes: 0, inadimplentes: 0, faturamento: 200, recebimento: 0, cartaoAbertas: 1, previsaoFaturamento: 450 });
    // Dia 10: o aluno 2 deve (o vencimento original era dia 5); recebido 100.
    expect(s["10"]).toMatchObject({ pagantes: 2, inadimplentes: 1, inadimplenciaPerc: 50, recebimento: 100, cartaoAbertas: 1 });
    // Dia 21: o aluno 2 pagou no dia 20.
    expect(s["21"]).toMatchObject({ inadimplentes: 0, recebimento: 200, cartaoAbertas: 0 });
    // Dia 31: alunos 3 e 4 devendo, de 4 pagantes.
    expect(s["31"]).toMatchObject({ pagantes: 4, inadimplentes: 2, inadimplenciaPerc: 50 });
  });

  it("base do dia: média dos meses e, em mês mais curto, o último dia", () => {
    const set = { month: "2026-09", units: { A: { "30": { ...s["10"], inadimplenciaPerc: 10 } } } };
    const out = { month: "2026-10", units: { A: s } };
    const b = baseDoDia([out, set], "A", 31)!;
    expect(b.meses).toEqual(["2026-10", "2026-09"]);
    expect(b.inadimplenciaPerc).toBe(30); // (50 + 10) / 2
    expect(baseDoDia([out], "Z", 10)).toBeNull();
    expect(mesesAnteriores("2026-01", 3)).toEqual(["2025-12", "2025-11", "2025-10"]);
  });
});
