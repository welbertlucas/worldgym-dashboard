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
  it("pendências: sem a base do mesmo dia, inadimplência e cartões só informativos; detratores com nível", () => {
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

  it("com a base do mesmo dia: inadimplência e cartões ganham nível; recebido não vira alerta", () => {
    const md = { dia: 15, meses: ["2026-10", "2026-09", "2026-08"], inadimplenciaPerc: 9, recebidoSobreFaturado: 96, cartaoSobrePrevisao: 3 };
    const nov = mes("2026-11", [
      // A: 14% contra 9% (+5 p.p.) = crítico; cartões 4,5% da previsão (+1,5 p.p.) = sem nível; recebido 80% contra 96%: sem alerta
      u("A", { mesmoDia: md, inadimplentes: 80, inadimplenciaPerc: 14, recebimento: 80000, previsaoFaturamento: 200000,
        cobrancas: { falhas: 50, recuperadas: 10, abertas: 40, valorAberto: 9000, valorRecuperado: 1 } as any }),
      // B: 12,1% contra 9% = atenção; cartões 9% da previsão (+6 p.p.) = crítico
      u("B", { mesmoDia: md, inadimplentes: 50, inadimplenciaPerc: 12.1, recebimento: 93000, previsaoFaturamento: 200000,
        cobrancas: { falhas: 50, recuperadas: 10, abertas: 40, valorAberto: 18000, valorRecuperado: 1 } as any }),
      // C: 11,5% contra 9% (+2,5 p.p.) = dentro da variação normal
      u("C", { mesmoDia: md, inadimplentes: 50, inadimplenciaPerc: 11.5, previsaoFaturamento: 200000 }),
    ]);
    const r = computeAlertasVigentes([...fechados, nov], [], { atualizadoEm: lido, now, incluirRede: false });
    const de = (unit: string, kind: string) => r.alertas.find((a) => a.unit === unit && a.kind === kind);
    expect(de("A", "inadAberta")?.severity).toBe("critical");
    expect(de("A", "inadAberta")?.fact).toContain("No dia 15 dos 3 meses anteriores a unidade costumava ter 9,0%");
    expect(de("B", "inadAberta")?.severity).toBe("attention");
    expect(de("C", "inadAberta")?.severity).toBe("info");
    expect(de("A", "cartaoRecusado")?.severity).toBe("info");
    expect(de("B", "cartaoRecusado")?.severity).toBe("critical");
    expect(r.alertas.some((a) => (a.kind as string) === "recebimento")).toBe(false);
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

  it("cancelamentos e renovação contra o mesmo dia; alunos sem vir como item para fazer", () => {
    const base = { meses: 3, churnPct: 2, naoRenovadosPct: 40, venceram: 30 };
    const nov = mes("2026-11", [
      u("A", { ritmoAlunos: { dia: 15, cancelados: 45, churnPct: 4.5, venceram: 30, naoRenovados: 21, naoRenovadosPct: 70, vencem7: 12, base }, acessos: [800, 100, 90, 60, 40, 5] }),
      u("B", { ritmoAlunos: { dia: 15, cancelados: 25, churnPct: 2.5, venceram: 30, naoRenovados: 13, naoRenovadosPct: 43.3, vencem7: 0, base } }),
    ]);
    const r = computeAlertasVigentes([...fechados, nov], [], { atualizadoEm: lido, now, incluirRede: false });
    const de = (unit: string, kind: string) => r.alertas.find((a) => a.unit === unit && a.kind === kind);
    expect(de("A", "cancelRitmo")?.severity).toBe("critical"); // +2,5 p.p.
    expect(de("A", "cancelRitmo")?.fact).toContain("costumava estar em 2,0%");
    expect(de("B", "cancelRitmo")).toBeUndefined(); // +0,5 p.p.: dentro da variação normal
    expect(de("A", "renovacao")?.severity).toBe("critical"); // 70% contra 40%
    expect(de("A", "renovacao")?.fact).toContain("12 contratos vencem nos próximos 7 dias");
    expect(de("B", "renovacao")?.severity).toBe("info");
    expect(de("A", "sumidos")).toMatchObject({ severity: "info", tipo: "pendencia" });
    expect(de("A", "sumidos")?.fact).toContain("150 alunos ativos não vêm à academia há 16 a 60 dias");
  });

  it("conversão das oportunidades contra o mesmo dia: só com 40 ou mais oportunidades", () => {
    const rc = (oportunidades: number, conversoes: number, taxa: number) => ({ dia: 15, oportunidades, conversoes, taxa, base: { meses: 3, taxa: 75 } });
    const nov = mes("2026-11", [
      u("A", { ritmoConversao: rc(80, 40, 50) }), // −25 p.p.
      u("B", { ritmoConversao: rc(100, 60, 60) }), // −15 p.p.
      u("C", { ritmoConversao: rc(100, 68, 68) }), // −7 p.p.: normal
      u("D", { ritmoConversao: rc(30, 10, 33.3) }), // poucas oportunidades
    ]);
    const r = computeAlertasVigentes([...fechados, nov], [], { atualizadoEm: lido, now, incluirRede: false });
    const de = (unit: string) => r.alertas.find((a) => a.unit === unit && a.kind === "conversao");
    expect(de("A")).toMatchObject({ severity: "critical", tipo: "ritmo", tela: "comercial/oportunidades" });
    expect(de("A")?.fact).toContain("40 de 80 oportunidades");
    expect(de("A")?.fact).toContain("convertia 75,0%");
    expect(de("B")?.severity).toBe("attention");
    expect(de("C")).toBeUndefined();
    expect(de("D")).toBeUndefined();
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

describe("uso do plano", () => {
  it("quem nunca marcou vem primeiro; conta marcados e a última marcação; a Rede fica de fora", async () => {
    const { usoDoPlano } = await import("@/data/planoVigente");
    const a = (unit: string, kind: string, severity = "attention") => ({ unit, kind, severity, tipo: "pendencia", weight: 1 }) as unknown as import("@/data/alertasVigentes").AlertaVigente;
    const { gruposVigentes } = await import("@/data/planoVigente");
    const grupos = gruposVigentes([a("Rede", "fatRitmo"), a("A", "inadAberta"), a("A", "renovacao"), a("B", "inadAberta", "critical"), a("C", "renovacao")]);
    const feitos = { "A|inadAberta": { por: "Ana Souza", em: "2026-11-10T12:00:00Z" }, "C|renovacao": { por: "Caio", em: "2026-11-12T12:00:00Z" }, "A|antigo": { por: "Bia", em: "2026-11-14T12:00:00Z" } };
    const u = usoDoPlano(grupos, feitos);
    expect(u.map((x) => x.unit)).toEqual(["B", "A", "C"]);
    expect(u[0]).toMatchObject({ marcados: 0, itens: 1, ultima: null });
    expect(u[1]).toMatchObject({ marcados: 1, itens: 2, ultima: { por: "Bia" } });
  });
});
