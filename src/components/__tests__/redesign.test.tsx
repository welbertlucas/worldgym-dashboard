import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { DollarSign } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { ExecutivaTab } from "@/components/tabs/ExecutivaTab";
import { dashboardData, dashboardDataRede } from "@/data/dashboardData";
import { priorYearValue, splitPartial } from "@/components/chartData";
import { partialDot } from "@/components/PartialDot";
import { monthKey } from "@/data/periods";
import { month, unit } from "@/data/__tests__/helpers";

afterEach(() => { dashboardData.length = 0; dashboardDataRede.length = 0; });
/** Em produção os dois conjuntos são preenchidos juntos (para dono e master são iguais). */
const carregar = (...ms: ReturnType<typeof month>[]) => { dashboardData.push(...ms); dashboardDataRede.push(...ms); };

describe("MetricCard (tile)", () => {
  it("mostra valor, valor anterior, chips de variação com a referência e marca a direção", () => {
    const html = renderToString(
      <MetricCard
        title="Churn" value="8,8%" icon={DollarSign} spark={[1, 2, 3]} sparkCompare={[2, null, 3]}
        previous={{ value: "9,5%", label: "ago. de 2026" }}
        details={[{ text: "-0,7 p.p. vs. mês anterior", tone: "good", direction: "down" }, { text: "+1,5 p.p. vs. set. de 2025", tone: "bad", direction: "up" }]}
      />,
    );
    expect(html).toContain("8,8%");
    expect(html).toContain("9,5%");
    expect(html).toContain("ago. de 2026");
    expect(html).toContain("-0,7 p.p. vs. mês anterior");
    expect(html).toContain("bg-success/10"); // melhora (churn caiu)
    expect(html).toContain("bg-destructive/10"); // piora vs. ano anterior
  });

  it("estado vazio é orientativo (não parece erro) e a variante bare não tem moldura de card", () => {
    const html = renderToString(<MetricCard bare title="Metas da rede" value="—" icon={DollarSign} empty={{ message: "Sem metas", hint: "Preencha a aba Metas" }} />);
    expect(html).toContain("Sem metas");
    expect(html).not.toContain("card-surface");
  });
});

describe("série do ano anterior", () => {
  it("lê o mesmo mês do ano anterior (rede e unidade) ou null", () => {
    carregar(month("2025-09", [unit("A", { churn: 5 })]), month("2026-09", [unit("A", { churn: 6 })]));
    expect(priorYearValue("2026-09", "A", (u) => u.churn)).toBe(5);
    expect(priorYearValue("2026-09", null, (u) => u.faturamento)).toBe(100000);
    expect(priorYearValue("2026-09", "Z", (u) => u.churn)).toBeNull();
    expect(priorYearValue("2025-09", null, (u) => u.churn)).toBeNull(); // 2024-09 não existe
  });
});

describe("Visão Executiva", () => {
  it("o Overview traz só os velocímetros: nada de gráfico, ranking, plano de ação nem comparação entre unidades", () => {
    const months = ["2025-09", "2026-07", "2026-08", "2026-09"].map((m) => month(m, [unit("A"), unit("B", { faturamento: 80000 })]));
    carregar(...months);
    const cur = months[3];
    const html = renderToString(
      <ExecutivaTab month={cur} prev={months[2]} metas={[]} />,
    ).replace(/<!-- -->/g, "");
    for (const s of ["Overview", "Faturamento", "Pagamentos dos clientes", "Churn", "Inadimplência", "Metas da rede"]) expect(html).toContain(s);
    for (const s of ["Faturamento da rede", "Maiores faturamentos", "Plano de ação", "Ver o plano completo", "Comparação entre unidades"]) expect(html).not.toContain(s);
    expect(html).toContain("vs. set. de 2025"); // comparativo anual quando o mês do ano anterior existe
    expect(html).toContain("vs. ago. de 2026"); // mês fechado: compara com o mês anterior, citando o mês
  });

});

describe("mês em andamento", () => {
  it("KPIs sinalizam 'Em andamento'; taxas comparam com o mês anterior de forma provisória e valores absolutos mostram o % do mês anterior", () => {
    const cur = monthKey(new Date());
    const prevDate = new Date(); prevDate.setMonth(prevDate.getMonth() - 1);
    const months = [month(monthKey(prevDate), [unit("A")]), month(cur, [unit("A")])];
    carregar(...months);
    const html = renderToString(
      <ExecutivaTab month={months[1]} prev={months[0]} metas={[]} />,
    ).replace(/<!-- -->/g, "");
    expect(html).toContain("em andamento");
    expect(html).toContain("Em andamento");
    expect(html).toMatch(/100% de R\$[^<]* de /); // faturamento parcial = quanto do mês anterior já foi alcançado
    expect(html).not.toContain("vs. set. de 2025"); // sem comparativo anual em mês parcial
  });
});

describe("churn e demais tendências no mês parcial", () => {
  it("o valor parcial sai da série da linha e vira um campo próprio (marcador isolado)", () => {
    expect(splitPartial("churn", false, 7.5)).toEqual({ churn: 7.5, parcial: null });
    expect(splitPartial("churn", true, 3)).toEqual({ churn: null, parcial: 3 });
  });

  it("o marcador só desenha onde há valor parcial, com o rótulo \"parcial\"", () => {
    const dot = partialDot((v) => `${v}%`);
    const none = renderToString(<svg>{dot({ cx: 10, cy: 10, payload: { parcial: null } })}</svg>);
    expect(none).not.toContain("circle");
    const some = renderToString(<svg>{dot({ cx: 10, cy: 10, payload: { parcial: 3 } })}</svg>);
    expect(some).toContain("circle");
    expect(some.replace(/<!-- -->/g, "")).toContain("parcial: 3%");
  });
});
