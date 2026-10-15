import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { DollarSign } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { TopUnits } from "@/components/executiva/TopUnits";
import { RevenueTrend } from "@/components/executiva/RevenueTrend";
import { ExecutivaTab } from "@/components/tabs/ExecutivaTab";
import { dashboardData } from "@/data/dashboardData";
import { priorYearValue, splitPartial } from "@/components/chartData";
import { partialDot } from "@/components/PartialDot";
import { monthKey } from "@/data/periods";
import { month, unit } from "@/data/__tests__/helpers";

afterEach(() => { dashboardData.length = 0; });

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

describe("TopUnits", () => {
  it("lista as maiores por faturamento, numeradas, com valores reais", () => {
    const units = ["A", "B", "C", "D"].map((n, i) => unit(n, { faturamento: (i + 1) * 100000 }));
    const html = renderToString(<TopUnits units={units} monthLabel="setembro de 2026" partial={false} onOpen={() => {}} limit={3} />).replace(/<!-- -->/g, "");
    expect(html.indexOf(">D<")).toBeLessThan(html.indexOf(">C<"));
    expect(html).not.toContain(">A<"); // fora do top 3
    expect(html.replace(/\s|&nbsp;/g, "")).toContain("R$400.000");
    expect(html).toContain("Ver todas as unidades");
  });
});

describe("série do ano anterior", () => {
  it("lê o mesmo mês do ano anterior (rede e unidade) ou null", () => {
    dashboardData.push(month("2025-09", [unit("A", { churn: 5 })]), month("2026-09", [unit("A", { churn: 6 })]));
    expect(priorYearValue("2026-09", "A", (u) => u.churn)).toBe(5);
    expect(priorYearValue("2026-09", null, (u) => u.faturamento)).toBe(100000);
    expect(priorYearValue("2026-09", "Z", (u) => u.churn)).toBeNull();
    expect(priorYearValue("2025-09", null, (u) => u.churn)).toBeNull(); // 2024-09 não existe
  });
});

describe("Visão Executiva", () => {
  it("renderiza indicadores, gráfico, ranking, prioridades e comparação sem quebrar", () => {
    const months = ["2025-09", "2026-07", "2026-08", "2026-09"].map((m) => month(m, [unit("A"), unit("B", { faturamento: 80000 })]));
    dashboardData.push(...months);
    const cur = months[3];
    const html = renderToString(
      <ExecutivaTab month={cur} prev={months[2]} alerts={[]} evalMonth="2026-09" deltas={[]} metas={[]} onOpenRiscos={() => {}} onOpenUnidades={() => {}} />,
    ).replace(/<!-- -->/g, "");
    for (const s of ["Visão executiva", "Faturamento", "Recebimento", "Churn", "Inadimplência", "Metas da rede", "Faturamento da rede", "Maiores faturamentos", "Prioridades da diretoria"]) expect(html).toContain(s);
    expect(html).toContain("vs. set. de 2025"); // comparativo anual quando o mês do ano anterior existe
    expect(html).toContain("vs. ago. de 2026"); // mês fechado: compara com o mês anterior, citando o mês
    expect(html).toContain("Nenhum alerta crítico");
  });

  it("RevenueTrend aceita séries sem o ano anterior", () => {
    const m = month("2026-08", [unit("A")]);
    expect(renderToString(<RevenueTrend closed={[m]} all={[m]} />)).toContain("Faturamento da rede");
  });
});

describe("mês em andamento", () => {
  it("KPIs sinalizam 'Em andamento'; taxas comparam com o mês anterior de forma provisória e valores absolutos mostram o % do mês anterior", () => {
    const cur = monthKey(new Date());
    const prevDate = new Date(); prevDate.setMonth(prevDate.getMonth() - 1);
    const months = [month(monthKey(prevDate), [unit("A")]), month(cur, [unit("A")])];
    dashboardData.push(...months);
    const html = renderToString(
      <ExecutivaTab month={months[1]} prev={months[0]} alerts={[]} evalMonth={null} deltas={[]} metas={[]} onOpenRiscos={() => {}} onOpenUnidades={() => {}} />,
    ).replace(/<!-- -->/g, "");
    expect(html).toContain("em andamento");
    expect(html).toContain("Em andamento");
    expect(html).toContain("provisória");
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
