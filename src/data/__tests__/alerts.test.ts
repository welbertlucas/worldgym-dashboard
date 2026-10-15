import { describe, expect, it } from "vitest";
import { computeAlerts } from "@/data/alerts";
import { buildRecommendations } from "@/data/recommendations";
import { month, unit } from "./helpers";

const now = new Date(2026, 9, 14);
const base = (m: string, over = {}) => month(m, [unit("A", over), unit("B")]);
const history = [base("2026-06"), base("2026-07"), base("2026-08")];

describe("computeAlerts", () => {
  it("ignora o mês em andamento (mesmo com queda enorme)", () => {
    const data = [...history, base("2026-09"), base("2026-10", { faturamento: 10000, vendasOnline: 0 })];
    expect(computeAlerts(data, [], now)).toHaveLength(0);
  });

  it("queda de faturamento: atenção em -8% e crítico em -15%", () => {
    const warn = computeAlerts([...history, base("2026-09", { faturamento: 92000 })], [], now);
    expect(warn.find((a) => a.kind === "faturamento")?.severity).toBe("attention");
    const crit = computeAlerts([...history, base("2026-09", { faturamento: 85000 })], [], now);
    expect(crit.find((a) => a.kind === "faturamento")?.severity).toBe("critical");
  });

  it("não alerta com queda pequena", () => {
    expect(computeAlerts([...history, base("2026-09", { faturamento: 97000 })], [], now).filter((a) => a.kind === "faturamento")).toHaveLength(0);
  });

  it("unidade com menos de 3 meses de histórico fica fora dos alertas de variação", () => {
    const data = [month("2026-08", [unit("N")]), month("2026-09", [unit("N", { faturamento: 10000 })])];
    expect(computeAlerts(data, [], now)).toHaveLength(0);
  });

  it("vendas online compara com média de 3 meses e ignora base pequena", () => {
    const drop = computeAlerts([...history, base("2026-09", { vendasOnline: 1000 })], [], now);
    expect(drop.some((a) => a.kind === "vendasOnline")).toBe(true);
    const small = [...history.map((h) => month(h.month, [unit("A", { vendasOnline: 100 }), unit("B")])), month("2026-09", [unit("A", { vendasOnline: 0 }), unit("B")])];
    expect(computeAlerts(small, [], now).some((a) => a.kind === "vendasOnline")).toBe(false);
  });

  it("churn: alta ≥1,5 p.p. = atenção; acima de 8% e piorando = crítico; acima de 8% sem piora = atenção", () => {
    const up = computeAlerts([...history, base("2026-09", { churn: 5.6 })], [], now).find((a) => a.kind === "churn");
    expect(up?.severity).toBe("attention");
    const worse = computeAlerts([...history, base("2026-09", { churn: 9.5 })], [], now).find((a) => a.kind === "churn");
    expect(worse?.severity).toBe("critical");
    // já estava alto e melhorou: continua em atenção, sem dizer "em alta"
    const hist2 = [base("2026-06", { churn: 12 }), base("2026-07", { churn: 12 }), base("2026-08", { churn: 12 })];
    const better = computeAlerts([...hist2, base("2026-09", { churn: 9 })], [], now).find((a) => a.kind === "churn");
    expect(better?.severity).toBe("attention");
    expect(better?.fact).not.toMatch(/em alta/);
  });

  it("queda pequena de faturamento (-2%) não dispara a regra estatística", () => {
    const noisy = [base("2026-05", { faturamento: 100000 }), base("2026-06", { faturamento: 101000 }), base("2026-07", { faturamento: 100000 }), base("2026-08", { faturamento: 101000 })];
    expect(computeAlerts([...noisy, base("2026-09", { faturamento: 98900 })], [], now).filter((a) => a.kind === "faturamento")).toHaveLength(0);
  });

  it("inadimplência e recebimento baixo", () => {
    const a = computeAlerts([...history, base("2026-09", { inadimplenciaPerc: 6, recebimento: 80000 })], [], now);
    expect(a.some((x) => x.kind === "inadimplencia")).toBe(true);
    expect(a.some((x) => x.kind === "recebimento")).toBe(true);
  });

  it("metas: alerta só abaixo do nível mais baixo; severidade crítica se < 75% dele", () => {
    const data = [...history, base("2026-09", { faturamento: 70000, churn: 4 })];
    const metas = [
      { month: "2026-09", unit: "A", key: "faturamento" as const, bronze: 100000, prata: 120000, ouro: 150000 }, // 70% do bronze → crítico
      { month: "2026-09", unit: "A", key: "churn" as const, bronze: 8, prata: 6, ouro: 3 }, // churn 4 = prata → sem alerta
      { month: "2026-09", unit: "A", key: "recebimento" as const, bronze: 70000, prata: 80000 }, // recebimento 95000 já está na prata → sem alerta
    ];
    const al = computeAlerts(data, metas, now).filter((a) => a.kind === "meta");
    const fat = al.find((a) => a.metaKey === "faturamento");
    expect(fat?.severity).toBe("critical");
    expect(fat?.fact).toMatch(/abaixo da meta bronze/);
    expect(al.find((a) => a.metaKey === "churn")).toBeUndefined();
    expect(new Set(al.map((a) => a.id)).size).toBe(al.length);
  });

  it("metas: abaixo do bronze mas ≥ 75% dele = atenção", () => {
    const data = [...history, base("2026-09", { faturamento: 90000 })];
    const al = computeAlerts(data, [{ month: "2026-09", unit: "A", key: "faturamento" as const, bronze: 100000, ouro: 150000 }], now).filter((a) => a.kind === "meta");
    expect(al).toHaveLength(1);
    expect(al[0].severity).toBe("attention");
  });

  it("recomendação separa fato de hipótese e ordena por prioridade", () => {
    const al = computeAlerts([...history, base("2026-09", { faturamento: 85000, churn: 5.6 })], [], now);
    const recs = buildRecommendations(al);
    expect(recs[0].severity).toBe("critical");
    expect(recs[0].fact).toMatch(/Faturamento/);
    expect(recs[0].hypotheses.length).toBeGreaterThan(0);
  });
});

// ---------- comparativo com o mesmo mês do ano anterior ----------
import { type MonthData, type UnitData } from "@/data/dashboardData";

type Over = Record<string, Partial<UnitData>>; // "aaaa-mm" -> overrides da unidade A
const mk = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
/** Série contínua 2025-06 … 2026-09 com a unidade A (overrides por mês) e B neutra. */
function series(over: Over = {}, extra?: (m: string) => UnitData[]): MonthData[] {
  const out: MonthData[] = [];
  for (let i = 0; i < 16; i++) {
    const y = 2025 + Math.floor((5 + i) / 12), m = ((5 + i) % 12) + 1;
    const key = mk(y, m);
    out.push(month(key, [unit("A", over[key]), unit("B"), ...(extra ? extra(key) : [])]));
  }
  return out;
}

describe("comparativo com o mesmo mês do ano anterior", () => {
  it("piora nos dois comparativos: combina e eleva a severidade", () => {
    // MoM -8% (100k → 92k) e vs. set/25 (105k) = -12,4%
    const data = series({ "2025-09": { faturamento: 105000 }, "2026-09": { faturamento: 92000 } });
    const a = computeAlerts(data, [], now).filter((x) => x.unit === "A" && x.kind.toLowerCase().includes("faturamento"));
    expect(a).toHaveLength(1); // sem duplicar
    expect(a[0].severity).toBe("critical");
    expect(a[0].yoy?.reading).toBe("confirmed");
  });

  it("queda vs. mês anterior mas acima do ano anterior: reduz para informativo (sazonal)", () => {
    const data = series({ "2025-09": { faturamento: 80000 }, "2026-09": { faturamento: 92000 } });
    const a = computeAlerts(data, [], now).find((x) => x.unit === "A" && x.kind === "faturamento");
    expect(a?.severity).toBe("info");
    expect(a?.yoy?.reading).toBe("seasonal");
  });

  it("estável vs. mês anterior mas bem abaixo do ano anterior: alerta próprio", () => {
    const data = series({ "2025-09": { faturamento: 130000 } }); // 2026-09 = 100k → -23%
    const a = computeAlerts(data, [], now).find((x) => x.unit === "A" && x.kind === "yoyFaturamento");
    expect(a?.severity).toBe("critical");
    expect(a?.fact).toMatch(/Sem queda relevante vs\. o mês anterior/);
  });

  it("churn, inadimplência e renovação vs. ano anterior", () => {
    const data = series({ "2025-09": { churn: 2, inadimplenciaPerc: 1.5, renovacoes: 70 }, "2026-09": { churn: 4.5, inadimplenciaPerc: 4, renovacoes: 60 } });
    const kinds = computeAlerts(data, [], now).filter((x) => x.unit === "A").map((x) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(["yoyChurn", "yoyInadimplencia", "yoyRenovacao"]));
  });

  it("unidade sem o mês do ano anterior, ou em ramp-up nele, fica fora", () => {
    const novo = unit("N", { faturamento: 10000 });
    const data = series({}, (m) => (m >= "2026-06" ? [novo] : [])); // sem base em 2025-09
    expect(computeAlerts(data, [], now).filter((x) => x.unit === "N")).toHaveLength(0);
    // existia em 2025-09, mas só desde 2025-08 (menos de 3 meses antes do mês-base)
    const ramp = series({}, (m) => (m >= "2025-08" ? [unit("R", { faturamento: m === "2025-09" ? 30000 : 100000 })] : []));
    expect(computeAlerts(ramp, [], now).filter((x) => x.unit === "R" && x.kind.startsWith("yoy"))).toHaveLength(0);
  });

  it("novos contratos: alerta da rede (comparáveis) e unidade só se pior que a rede", () => {
    const over: Over = {};
    const data = series(over).map((m) => {
      if (m.month === "2025-09") return month(m.month, [unit("A", { novosContratos: 100 }), unit("B", { novosContratos: 100 })]);
      if (m.month === "2026-09") return month(m.month, [unit("A", { novosContratos: 30 }), unit("B", { novosContratos: 70 })]); // rede -50%, A -70%, B -30%
      return m;
    });
    const al = computeAlerts(data, [], now).filter((x) => x.kind === "yoyNovosContratos");
    expect(al.find((x) => x.unit === "Rede")?.severity).toBe("critical");
    expect(al.find((x) => x.unit === "A")).toBeDefined(); // -70% é 20 p.p. pior que -50%
    expect(al.find((x) => x.unit === "B")).toBeUndefined();
  });

  it("sem ano anterior na série, nenhum alerta anual", () => {
    const curto = series().slice(5); // começa em 2025-11: sem 2025-09
    expect(computeAlerts(curto, [], now).filter((x) => x.kind.startsWith("yoy"))).toHaveLength(0);
  });
});

describe("comparativo anual — refinamentos", () => {
  it("churn acima de 8% que já era alto no ano anterior não é rebaixado (problema persistente)", () => {
    const data = series({ "2025-09": { churn: 10 }, "2026-08": { churn: 8 }, "2026-09": { churn: 9.8 } });
    const a = computeAlerts(data, [], now).find((x) => x.unit === "A" && x.kind === "churn");
    expect(a?.severity).not.toBe("info");
    expect(a?.yoy?.reading).toBe("context");
    expect(a?.yoy?.fact).toMatch(/persistente/);
  });

  it("vendas online: queda vs. média de 3 meses + vs. ano anterior vira um alerta só", () => {
    const data = series({ "2025-09": { vendasOnline: 4000 }, "2026-09": { vendasOnline: 800 } }).map((m) =>
      m.month === "2025-09" ? month(m.month, [unit("A", { vendasOnline: 4000 }), unit("B", { vendasOnline: 2000 })]) : m);
    const al = computeAlerts(data, [], now).filter((x) => x.unit === "A" && x.kind.toLowerCase().includes("vendasonline"));
    expect(al).toHaveLength(1);
    expect(al[0].kind).toBe("vendasOnline");
    expect(al[0].yoy?.reading).toBe("confirmed");
  });
});
