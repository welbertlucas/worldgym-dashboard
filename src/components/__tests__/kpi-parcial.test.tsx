import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { KpiTile, type KpiSpec } from "@/components/kpi/KpiGrid";
import { month, unit } from "@/data/__tests__/helpers";

const spec: KpiSpec = { title: "Adimplentes", kind: "level", pick: (v) => v.total.adimplentes, fmt: (n) => String(n) };
const view = (m: string, adimplentes: number, extra = {}) => { const md = month(m, [unit("Gama", { adimplentes, ...extra })]); return { month: m, total: md.units[0], units: md.units }; };

describe("indicadores do mês em andamento", () => {
  it("zero no mês em andamento vira 'ainda não lançado', e não queda de 100%", () => {
    const html = renderToString(<KpiTile ctx={{ cur: view("2026-11", 0), prev: view("2026-10", 1900), partial: true }} spec={spec} />);
    expect(html).toContain("Ainda não lançado neste mês");
    expect(html).not.toContain("-100");
  });

  it("zero em mês fechado continua sendo zero", () => {
    const html = renderToString(<KpiTile ctx={{ cur: view("2026-10", 0), prev: view("2026-09", 1900), partial: false }} spec={spec} />);
    expect(html).not.toContain("Ainda não lançado");
  });

  it("mostra a fonte: planilha, ou EVO para faturamento e para inadimplência calculada pelo EVO", () => {
    const planilha = renderToString(<KpiTile ctx={{ cur: view("2026-10", 1900), partial: false }} spec={spec} />);
    expect(planilha).toContain("Fonte: <!-- -->planilha");
    const fat: KpiSpec = { title: "Faturamento", kind: "flow", pick: (v) => v.total.faturamento, fmt: (n) => String(n) };
    expect(renderToString(<KpiTile ctx={{ cur: view("2026-10", 1), partial: false }} spec={fat} />)).toContain("EVO");
    const inad: KpiSpec = { title: "Inadimplência", kind: "rate", rateKey: "inadimplenciaPerc", pick: (v) => v.total.inadimplenciaPerc, fmt: (n) => `${n}%` };
    expect(renderToString(<KpiTile ctx={{ cur: view("2026-10", 1, { inadimplenciaPerc: 5, inadimplenciaEvo: true }), partial: false }} spec={inad} />)).toContain("EVO");
    expect(renderToString(<KpiTile ctx={{ cur: view("2026-10", 1, { inadimplenciaPerc: 5 }), partial: false }} spec={inad} />)).toContain("planilha");
  });
});
