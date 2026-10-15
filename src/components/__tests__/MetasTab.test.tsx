import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MetasTab } from "@/components/tabs/MetasTab";
import { month, unit } from "@/data/__tests__/helpers";
import { type Meta } from "@/data/metas";

const data = [month("2026-08", [unit("A"), unit("B")]), month("2026-09", [unit("A", { faturamento: 130000 }), unit("B", { faturamento: 90000 })])];
const metas: Meta[] = [
  { month: "2026-09", unit: "TOTAL", key: "faturamento", bronze: 200000, prata: 230000, ouro: 260000 },
  { month: "2026-09", unit: "A", key: "faturamento", bronze: 100000, prata: 120000, ouro: 150000 },
  { month: "2026-09", unit: "B", key: "faturamento", bronze: 100000, prata: 120000, ouro: 150000 },
  { month: "2026-09", unit: "TOTAL", key: "churn", bronze: 8, prata: 6, ouro: 4 },
];

describe("MetasTab", () => {
  it("renderiza as instruções quando não há metas", () => {
    const html = renderToString(<MetasTab data={data} metas={[]} month="2026-09" />);
    expect(html).toContain("Nenhuma meta cadastrada");
    expect(html).toContain("Bronze");
  });

  it("renderiza resumo da rede com nível atingido e quanto falta", () => {
    const html = renderToString(<MetasTab data={data} metas={metas} month="2026-09" />);
    expect(html).toContain("Faturamento");
    expect(html).toContain("Churn");
    expect(html).toMatch(/Prata|Bronze|Ouro|Abaixo do bronze/);
    expect(html).toContain("para o");
  });

  it("avisa sobre níveis fora de ordem", () => {
    const html = renderToString(<MetasTab data={data} metas={[{ ...metas[1], bronze: 999999 }]} month="2026-09" />);
    expect(html).toContain("fora de ordem");
  });
});
