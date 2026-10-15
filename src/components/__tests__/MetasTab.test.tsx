import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MetasTab } from "@/components/tabs/MetasTab";
import { month, unit } from "@/data/__tests__/helpers";
import { type Meta } from "@/data/metas";
import { monthKey } from "@/data/periods";
import { MetaCard } from "@/components/metas/TierGauge";

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

  it("renderiza cartões da rede com nível atingido, % da meta e quanto falta", () => {
    const html = renderToString(<MetasTab data={data} metas={metas} month="2026-09" />).replace(/<!-- -->/g, "");
    expect(html).toContain("Faturamento");
    expect(html).toContain("Churn");
    expect(html).toMatch(/Prata|Bronze|Ouro|Abaixo do bronze/);
    expect(html).toContain("da meta"); // % do próximo nível
    expect(html).toContain("Atingimento • Rede");
    expect(html).not.toContain("Mês em andamento"); // mês fechado: sem aviso de parcial
  });

  it("mostra os valores de bronze, prata e ouro de cada unidade", () => {
    const html = renderToString(<MetasTab data={data} metas={metas} month="2026-09" />).replace(/<!-- -->/g, "");
    const lista = html.slice(html.indexOf("metas-unidades"));
    expect((lista.match(/Bronze\s*<span[^>]*>[^<]*100/g) ?? []).length).toBeGreaterThanOrEqual(2); // unidades A e B
    expect(lista).toMatch(/Ouro\s*<span[^>]*>[^<]*150/);
  });

  it("rosca: unidade selecionada usa o realizado e a meta dela; rede soma só as unidades com meta", () => {
    const rede = renderToString(<MetasTab data={data} metas={metas.filter((m) => m.unit !== "TOTAL")} month="2026-09" />).replace(/<!-- -->/g, "");
    expect(rede).toContain("Atingimento • Rede");
    expect(rede).toContain("soma das 2 unidades com meta");
    const a = renderToString(<MetasTab data={data} metas={metas} month="2026-09" unit="A" />).replace(/<!-- -->/g, "");
    expect(a).toContain("Atingimento • A");
    expect(a).toMatch(/Realizado<\/span><span[^>]*>R\$\s?130/); // faturamento da unidade A
    const sem = renderToString(<MetasTab data={data} metas={metas} month="2026-09" unit="Z" />).replace(/<!-- -->/g, "");
    expect(sem).toContain("Z não tem meta cadastrada");
  });

  it("avisa sobre níveis fora de ordem", () => {
    const html = renderToString(<MetasTab data={data} metas={[{ ...metas[1], bronze: 999999 }]} month="2026-09" />);
    expect(html).toContain("fora de ordem");
  });

  it("mês em andamento: avisa que é parcial e não trata como 'abaixo do bronze' definitivo", () => {
    const cur = monthKey(new Date());
    const live = [month(cur, [unit("A", { faturamento: 30000 }), unit("B", { faturamento: 130000 })])];
    const ms: Meta[] = [
      { month: cur, unit: "TOTAL", key: "faturamento", bronze: 200000, prata: 230000, ouro: 260000 },
      { month: cur, unit: "A", key: "faturamento", bronze: 100000, prata: 120000, ouro: 150000 },
      { month: cur, unit: "B", key: "faturamento", bronze: 100000, prata: 120000, ouro: 150000 },
    ];
    const html = renderToString(<MetasTab data={live} metas={ms} month={cur} />).replace(/<!-- -->/g, "");
    expect(html).toContain("Mês em andamento");
    expect(html).toContain("a cada 5 minutos");
    expect(html).toContain("Realizado até agora");
    expect(html).toContain("Ainda abaixo do bronze");
    expect(html).not.toContain(">Abaixo do bronze<");
    // unidades ordenadas pelo nível: B (prata) antes de A (abaixo)
    expect(html.indexOf(">B<")).toBeLessThan(html.indexOf(">A<"));
  });
});

describe("MetaCard", () => {
  const meta: Meta = { month: "2026-10", unit: "A", key: "faturamento", bronze: 100, prata: 120, ouro: 150 };

  it("mostra o % do próximo nível e quanto falta (maior é melhor)", () => {
    const html = renderToString(<MetaCard metaKey="faturamento" actual={50} meta={meta} partial />).replace(/<!-- -->/g, "");
    expect(html).toContain("50%");
    expect(html).toContain("da meta Bronze");
    expect(html).toContain("faltam");
  });

  it("menor é melhor: pede para reduzir", () => {
    const churn: Meta = { month: "2026-10", unit: "A", key: "churn", bronze: 8, prata: 6, ouro: 4 };
    const html = renderToString(<MetaCard metaKey="churn" actual={10} meta={churn} partial={false} />).replace(/<!-- -->/g, "");
    expect(html).toContain("reduzir");
    expect(html).toContain("80%");
  });

  it("todos os níveis atingidos", () => {
    const html = renderToString(<MetaCard metaKey="faturamento" actual={160} meta={meta} partial={false} />);
    expect(html).toContain("Todos os níveis atingidos");
    expect(html).toContain("<svg"); // velocímetro
    expect(html).toContain("<line"); // ponteiro
  });

  it("nunca mostra 100% antes de atingir o nível; folga em % vira p.p. com casas suficientes", () => {
    const inad: Meta = { month: "2026-10", unit: "A", key: "inadimplenciaPerc", bronze: 8, prata: 6, ouro: 4 };
    const html = renderToString(<MetaCard metaKey="inadimplenciaPerc" actual={8.01} meta={inad} partial />).replace(/<!-- -->/g, "");
    expect(html).toContain("99%");
    expect(html).not.toContain("100%");
    expect(html).toContain("0,01 p.p.");
    expect(html).toContain("reduzir");
  });
});

describe("meta única da rede", () => {
  const unica: Meta[] = [{ month: "2026-09", unit: "TOTAL", key: "faturamento", ouro: 300000 }];
  it("chama de 'Meta' (sem Bronze/Prata/Ouro nem 'abaixo do bronze')", () => {
    const html = renderToString(<MetasTab data={data} metas={unica} month="2026-09" />).replace(/<!-- -->/g, "");
    expect(html).toContain("da meta");
    expect(html).toMatch(/Meta<\/span><span[^>]*>R\$\s?300/);
    expect(html).not.toMatch(/Bronze|Prata|abaixo do bronze/);
  });
});
