import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MetasTab } from "@/components/tabs/MetasTab";
import { month, unit } from "@/data/__tests__/helpers";
import { type Meta } from "@/data/metas";
import { monthKey } from "@/data/periods";

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

  it("sem metas: explica a estrutura com um exemplo ilustrativo, sem confundir com dados reais", () => {
    const html = renderToString(<MetasTab data={data} metas={[]} month="2026-09" />).replace(/<!-- -->/g, "");
    expect(html).toContain("Como funciona a meta");
    expect(html).toContain("pode enviar a meta para a <b>World Gym Brasil</b>, que faz o cadastro");
    expect(html).not.toContain("planilha"); // sem instruções de planilha
    expect(html).toContain("Exemplo ilustrativo. Os valores apresentados não representam a meta desta unidade.");
    for (const t of ["Bronze", "Prata", "Ouro", "1º nível", "2º nível", "Maior nível"]) expect(html).toContain(t);
    // premiação = faturamento × percentual
    expect(html).toMatch(/0,33%\s*→\s*<span[^>]*>R\$\s?1\.254/);
    expect(html).toMatch(/0,41%\s*→\s*<span[^>]*>R\$\s?1\.722/);
    expect(html).toMatch(/0,58%\s*→\s*<span[^>]*>R\$\s?2\.668/);
    // meta coletiva: o total é dividido pelo número de recepcionistas (4 no exemplo)
    expect(html).toContain("<b>coletiva</b>");
    expect(html).toContain("dividido pelo número de recepcionistas");
    for (const v of ["313,50", "430,50", "667,00"]) expect(html).toContain(v);
    for (const v of ["R$ 900", "R$ 1.200", "R$ 1.600", "R$ 2.400"].map((x) => x.replace(" ", "\u00a0"))) expect(html).toContain(v);
  });

  it("unidade sem meta (a rede tem): mostra o aviso e o exemplo; com meta, não mostra o exemplo", () => {
    const sem = renderToString(<MetasTab data={data} metas={metas} month="2026-09" unit="Z" />).replace(/<!-- -->/g, "");
    expect(sem).toContain("Z não tem meta cadastrada");
    expect(sem).toContain("Como funciona a meta");
    expect(sem).toContain("pode enviar a meta para a <b>World Gym Brasil</b>, que faz o cadastro");
    const com = renderToString(<MetasTab data={data} metas={metas} month="2026-09" unit="A" />).replace(/<!-- -->/g, "");
    expect(com).not.toContain("Como funciona a meta");
    expect(com).not.toContain("World Gym Brasil</b>");
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

  it("mês em andamento: mostra a projeção de fechamento de faturamento contra a meta", () => {
    const cur = monthKey(new Date());
    // A: já venceu 30 mil e o EVO tem 110 mil lançados no mês (prata, 120 mil, ainda não); B: 130 mil e 160 mil lançados (ouro).
    const live = [month(cur, [unit("A", { faturamento: 30000, previsaoFaturamento: 110000 }), unit("B", { faturamento: 130000, previsaoFaturamento: 160000 })])];
    const ms: Meta[] = [
      { month: cur, unit: "A", key: "faturamento", bronze: 100000, prata: 120000, ouro: 150000 },
      { month: cur, unit: "B", key: "faturamento", bronze: 100000, prata: 120000, ouro: 150000 },
    ];
    const html = renderToString(<MetasTab data={live} metas={ms} month={cur} />).replace(/<!-- -->/g, "").replace(/\u00a0/g, " ");
    expect(html).toContain("Projeção de fechamento");
    expect(html).toContain("nível Bronze"); // A: 110 mil
    expect(html).toContain("nível Ouro"); // B: 160 mil
    expect(html).toContain("a conta fica em Financeiro");
    // mês fechado: sem projeção
    expect(renderToString(<MetasTab data={data} metas={metas} month="2026-09" />)).not.toContain("Projeção de fechamento");
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
