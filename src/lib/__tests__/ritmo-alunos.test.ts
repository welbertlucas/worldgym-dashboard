import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { ritmoAteODia, ritmoAlunosDoMes, vencemEmBreve } from "../../../server/ritmoAlunos.js";

// Contratos: [início, fim, cancelamento, status, recorrente, trancamentos]
const c = (ini: string, fim: string, cancel: string | null = null, rec = false) => [ini, fim, cancel, "active", rec, []];
const alunos = [
  { id: 1, c: [c("2026-01-01", "2026-12-31", "2026-11-05", true)] }, // cancela dia 5 de novembro
  { id: 2, c: [c("2026-01-01", "2026-12-31", "2026-10-03", true)] }, // cancela dia 3 de outubro
  { id: 3, c: [c("2026-05-01", "2026-11-08")] }, // vence dia 8 e não renova
  { id: 4, c: [c("2026-05-01", "2026-11-09"), c("2026-11-10", "2027-05-09")] }, // vence dia 9 e renova dia 10
  { id: 5, c: [c("2026-05-01", "2026-11-18")] }, // vence dia 18: entra no "vence em 7 dias"
  { id: 6, c: [c("2026-05-01", "2026-11-19"), c("2026-11-20", "2027-05-19")] }, // vence dia 19, já renovou adiantado
  { id: 7, c: [c("2026-01-01", "2026-12-31", null, true)] },
];

describe("ritmo dos alunos até o dia", () => {
  it("cancelados até a véspera e renovações", () => {
    const r = ritmoAteODia(alunos, "2026-11", "2026-11-15");
    expect(r.cancelados).toBe(1);
    expect(r.ativosIni).toBe(6); // o aluno 2 cancelou em outubro
    expect(r).toMatchObject({ venceram: 2, naoRenovados: 1 });
    // Na madrugada do dia 10, o contrato novo do aluno 4 (começa no dia 10) já conta como renovação.
    expect(ritmoAteODia(alunos, "2026-11", "2026-11-10")).toMatchObject({ venceram: 2, naoRenovados: 1 });
    expect(ritmoAteODia(alunos, "2026-11", "2026-11-09")).toMatchObject({ venceram: 1, naoRenovados: 1 });
  });

  it("vencem em 7 dias sem renovação, ignorando quem renovou adiantado", () => {
    expect(vencemEmBreve(alunos, "2026-11-15", 7)).toBe(1);
  });

  it("junta o mês atual e a média do mesmo dia dos meses anteriores", () => {
    const r = ritmoAlunosDoMes(alunos, "2026-11-15");
    expect(r).toMatchObject({ dia: 15, cancelados: 1, venceram: 2, naoRenovados: 1, naoRenovadosPct: 50, vencem7: 1 });
    expect(r.base.meses).toBe(3);
    // Outubro: 1 de 7 ativos no início cancelou até o dia 14; agosto e setembro sem cancelamento.
    expect(r.base.churnPct).toBe(4.8);
  });
});
