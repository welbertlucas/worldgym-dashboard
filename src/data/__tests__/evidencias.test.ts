import { describe, expect, it } from "vitest";
import { buildEvidence } from "@/data/evidence";
import { buildRecommendations } from "@/data/recommendations";
import { recommendationText, DISCLAIMER } from "@/data/shareText";
import { type Alert } from "@/data/alerts";
import { month, unit } from "@/data/__tests__/helpers";

// Gama cai mês a mês (faturamento e novos contratos); Asa Norte fica estável; ticket e inadimplência da Gama não mudam.
const data = [
  month("2026-06", [unit("Gama", { faturamento: 100000, novosContratos: 100 }), unit("Asa Norte", { faturamento: 100000, novosContratos: 100 })]),
  month("2026-07", [unit("Gama", { faturamento: 95000, novosContratos: 90 }), unit("Asa Norte", { faturamento: 100000, novosContratos: 100 })]),
  month("2026-08", [unit("Gama", { faturamento: 90000, novosContratos: 80 }), unit("Asa Norte", { faturamento: 101000, novosContratos: 100 })]),
  month("2026-09", [unit("Gama", { faturamento: 80000, novosContratos: 55 }), unit("Asa Norte", { faturamento: 101000, novosContratos: 100 })]),
];
const alert = (over: Partial<Alert> = {}): Alert => ({ id: "a1", unit: "Gama", kind: "faturamento", severity: "critical", month: "2026-09", fact: "Faturamento caiu.", rule: "queda", weight: 0.4, ...over });

describe("evidências a partir da planilha", () => {
  it("encontra o sinal certo (novos contratos), lista o que está sem sinal e compara com a rede", () => {
    const ev = buildEvidence(alert(), data);
    expect(ev.signals.map((s) => s.key)).toEqual(["novos"]);
    expect(ev.signals[0].text).toContain("Novos contratos -31,3% vs. o mês anterior (80 → 55)");
    expect(ev.quiet).toEqual(expect.arrayContaining(["Cancelamentos", "Ticket médio", "Inadimplência"]));
    expect(ev.context.join(" ")).toContain("causa local");
  });

  it("conta meses seguidos de piora", () => {
    expect(buildEvidence(alert(), data).context.join(" ")).toContain("piorou 3 meses seguidos");
  });

  it("unidade que acompanha a rede é lida como movimento geral", () => {
    const flat = [data[2], month("2026-09", [unit("Gama", { faturamento: 86000 }), unit("Asa Norte", { faturamento: 97000 })])];
    const ev = buildEvidence(alert(), [month("2026-08", [unit("Gama", { faturamento: 90000 }), unit("Asa Norte", { faturamento: 101000 })]), flat[1]]);
    expect(ev.context.join(" ")).toMatch(/movimento mais geral|causa local/);
  });

  it("comparativo anual usa o mesmo mês do ano anterior", () => {
    const d = [month("2025-09", [unit("Gama", { novosContratos: 200 })]), month("2026-08", [unit("Gama", { novosContratos: 100 })]), month("2026-09", [unit("Gama", { novosContratos: 100 })])];
    const ev = buildEvidence(alert({ kind: "yoyFaturamento" }), d);
    expect(ev.signals[0].text).toContain("vs. o mesmo mês do ano anterior (200 → 100)");
  });

  it("sem mês anterior, sem unidade ou sem dados: não quebra e não inventa evidência", () => {
    expect(buildEvidence(alert({ month: "2026-06" }), data).signals).toEqual([]);
    expect(buildEvidence(alert({ unit: "Zeta" }), data).signals).toEqual([]);
    expect(buildEvidence(alert(), []).signals).toEqual([]);
    expect(buildEvidence(alert({ kind: "dado" }), data).context).toEqual([]);
  });

  it("base pequena não gera percentual enganoso", () => {
    const d = [month("2026-08", [unit("Gama", { novosContratos: 4 })]), month("2026-09", [unit("Gama", { novosContratos: 1 })])];
    expect(buildEvidence(alert(), d).signals).toEqual([]);
  });
});

describe("recomendações guiadas pelos dados", () => {
  const rec = () => buildRecommendations([alert()], data)[0];

  it("hipótese com indício sobe, hipótese testada sem sinal desce e o que não dá para testar fica no meio", () => {
    const h = rec().hypotheses;
    expect(h[0]).toMatchObject({ support: "indicio" });
    expect(h[0].text).toContain("novos contratos");
    expect(h.find((x) => x.text.startsWith("Aumento de cancelamentos"))!.support).toBe("sem-indicio");
    expect(h.find((x) => x.text.startsWith("Evento pontual"))!.support).toBe("neutro");
    expect(h[h.length - 1].support).not.toBe("indicio");
  });

  it("a ação prioritária acompanha o sinal dos dados (entrada x base)", () => {
    expect(rec().correct[0]).toContain("queda de entrada");
    expect(rec().correct.join(" ")).not.toContain("Os dados mostram perda de base");
  });

  it("sem dados, mantém o texto-padrão (sem evidências) e as hipóteses neutras", () => {
    const r = buildRecommendations([alert()])[0];
    expect(r.evidence).toEqual({ signals: [], quiet: [], context: [] });
    expect(r.hypotheses.every((h) => h.support === "neutro")).toBe(true);
    expect(r.correct[0]).toContain("Se for perda de entrada");
  });

  it("recalcula quando a planilha muda (mesmo alerta, dados diferentes)", () => {
    const changed = data.map((m) => ({ ...m, units: m.units.map((u) => (u.name === "Gama" && m.month === "2026-09" ? { ...u, novosContratos: 80, cancelados: 80 } : u)) }));
    const r = buildRecommendations([alert()], changed)[0];
    expect(r.evidence.signals.map((s) => s)).toEqual([expect.stringContaining("Cancelamentos")]);
    expect(r.hypotheses[0].text).toContain("cancelamentos");
  });

  it("texto compartilhado traz as evidências e termina com o aviso exigido", () => {
    const t = recommendationText(rec(), "2026-09");
    expect(t).toContain("*O que os dados indicam:*");
    expect(t).toContain("(indício nos dados)");
    expect(t.endsWith(DISCLAIMER)).toBe(true);
  });
});
