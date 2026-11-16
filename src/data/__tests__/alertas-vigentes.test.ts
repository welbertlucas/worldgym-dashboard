import { describe, expect, it } from "vitest";
import { computeAlertasVigentes } from "@/data/alertasVigentes";
import { continuaFeito, gruposVigentes, planoVigenteTexto, resumoVigenteTexto } from "@/data/planoVigente";
import type { MonthData, UnitData } from "@/data/dashboardData";
import type { Meta } from "@/data/metas";

const now = new Date(2026, 10, 15, 12); // 15/11/2026
const lido = "2026-11-15T09:00:00Z"; // leitura do EVO na madrugada do dia 15: 14 dias fechados
const u = (name: string, o: Partial<UnitData> = {}) => ({
  name, faturamento: 100000, recebimento: 95000, ticketMedio: 100, novosContratos: 100, adimplentes: 0, inadimplentes: 0, inadimplenciaPerc: 0,
  churn: 5, cancelados: 50, ativosIni: 1000, ...o,
}) as UnitData;
const mes = (month: string, units: UnitData[]) => ({ month, units, total: units[0] }) as unknown as MonthData;
const fechados = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((m) => mes(m, [u("A"), u("B")]));
// Novembro: 14 dias com 3 contratos por dia (42 até agora; linear ≈ 90 no mês).
const vendasDia = Array.from({ length: 30 }, (_, i) => (i < 14 ? 3 : 0));

describe("alertas do mês vigente", () => {
  it("pendências: inadimplência e cartões só informativos; detratores e liberações com nível", () => {
    const nov = mes("2026-11", [
      u("A", { inadimplentes: 80, inadimplenciaPerc: 12, cobrancas: { falhas: 50, recuperadas: 10, abertas: 40, valorAberto: 9000, valorRecuperado: 1 } as any, npsDetratores: 5, npsRespostas: 20, previsaoFaturamento: 200000 }),
      u("B", { npsDetratores: 1, npsRespostas: 30, previsaoFaturamento: 200000 }),
    ]);
    const r = computeAlertasVigentes([...fechados, nov], [], { atualizadoEm: lido, now, incluirRede: false });
    expect(r.month).toBe("2026-11");
    expect(r.dias).toBe(14);
    const de = (unit: string, kind: string) => r.alertas.find((a) => a.unit === unit && a.kind === kind);
    expect(de("A", "inadAberta")?.severity).toBe("info"); // 12% no meio do mês não vira crítico
    expect(de("A", "cartaoRecusado")?.severity).toBe("info");
    expect(de("A", "detratores")?.severity).toBe("critical"); // 25%
    expect(de("B", "detratores")?.severity).toBe("info"); // 1 detrator: só para fazer
    expect(de("A", "inadAberta")?.tipo).toBe("pendencia");
  });

  it("ritmo: só a partir do dia 10; contratos abaixo do bronze e cancelamentos acima do normal", () => {
    const metas: Meta[] = [{ month: "2026-11", unit: "A", key: "novosContratos", bronze: 150, prata: 170 }];
    const nov = mes("2026-11", [u("A", { vendasDia, novosContratos: 42, churn: 6, cancelados: 60 }), u("B", { vendasDia, novosContratos: 42, churn: 2, cancelados: 20 })]);
    const r = computeAlertasVigentes([...fechados, nov], metas, { atualizadoEm: lido, now, incluirRede: false });
    const a = r.alertas.find((x) => x.unit === "A" && x.kind === "contratosRitmo")!;
    expect(a.severity).toBe("critical"); // ≈ 90 < 75% de 150
    expect(a.fact).toContain("abaixo do Bronze (150)");
    expect(a.fact).toContain("faltam 108");
    // B sem meta: ≈ 90 contra a média de 100 = −10%: dentro do limite de −20%.
    expect(r.alertas.find((x) => x.unit === "B" && x.kind === "contratosRitmo")).toBeUndefined();
    expect(r.alertas.find((x) => x.unit === "A" && x.kind === "cancelRitmo")?.severity).toBe("attention"); // 6% > mediana 5%
    expect(r.alertas.find((x) => x.unit === "B" && x.kind === "cancelRitmo")).toBeUndefined();
    // Dia 5: sem ritmo.
    const cedo = computeAlertasVigentes([...fechados, nov], metas, { atualizadoEm: "2026-11-06T09:00:00Z", now: new Date(2026, 10, 6), incluirRede: false });
    expect(cedo.comRitmo).toBe(false);
    expect(cedo.alertas.some((x) => x.tipo === "ritmo")).toBe(false);
  });

  it("sem o mês corrente nos dados: nada", () => {
    expect(computeAlertasVigentes(fechados, [], { atualizadoEm: lido, now }).month).toBeNull();
  });
});

describe("plano do mês vigente", () => {
  const nov = mes("2026-11", [u("A", { inadimplentes: 8, inadimplenciaPerc: 3, npsDetratores: 5, npsRespostas: 20 }), u("B", { inadimplentes: 2, inadimplenciaPerc: 1 })]);
  const r = computeAlertasVigentes([...fechados, nov], [], { atualizadoEm: lido, now, incluirRede: false });

  it("agrupa por unidade, quem tem crítico primeiro, e monta o texto com as duas partes", () => {
    const g = gruposVigentes(r.alertas);
    expect(g[0].unit).toBe("A");
    const t = planoVigenteTexto(g[0], "2026-11", 14, new Set(["inadAberta"]));
    expect(t).toContain("*📋 Plano de ação • A*");
    expect(t).toContain("novembro de 2026, com os dados até 14/11");
    expect(t).toContain("*Resolver agora*");
    expect(t).toContain("Detratores do NPS");
    expect(t).toContain("☑️ *Já feito:* Inadimplência em aberto.");
    expect(resumoVigenteTexto(g, "2026-11", 14)).toContain("*A*: Detratores do NPS (+1)");
  });

  it("feito volta a pendente quando a leitura do EVO é mais nova que a marcação", () => {
    expect(continuaFeito("2026-11-15T12:00:00Z", "2026-11-15T09:00:00Z")).toBe(true);
    expect(continuaFeito("2026-11-14T12:00:00Z", "2026-11-15T09:00:00Z")).toBe(false);
    expect(continuaFeito(undefined, null)).toBe(false);
  });
});
