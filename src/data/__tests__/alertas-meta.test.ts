import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { alertasDeCampanhas, alertasDeUnidades, buscaContato, LIMITES_META, origemMetaDe } from "../../../server/alertasMeta.js";
import { AlertasMeta, alertasDaEscolha } from "@/components/AlertasMeta";
// @ts-expect-error módulo JS do servidor
import { montarResumo } from "../../../server/resumo.js";

const camp = (o: Record<string, unknown>) => ({ unidade: "Gama", nome: "Leads Gama", objetivo: "OUTCOME_LEADS", fim: null, gasto7d: 0, leads7d: 0, conversas7d: 0, ...o }) as any;
const titulos = (l: { titulo: string }[]) => l.map((a) => a.titulo);

describe("alertas do tráfego pago: campanhas", () => {
  it("gastando sem contato só em campanha que busca contato e acima do limite", () => {
    expect(titulos(alertasDeCampanhas([camp({ gasto7d: 150 })]))).toEqual(["Campanha gastando sem trazer contato"]);
    expect(alertasDeCampanhas([camp({ gasto7d: 99 })])).toEqual([]);
    expect(alertasDeCampanhas([camp({ gasto7d: 500, objetivo: "OUTCOME_AWARENESS", nome: "Marca" })])).toEqual([]);
    expect(buscaContato({ objetivo: "OUTCOME_ENGAGEMENT", nome: "[ENGAJAMENTO] [DIRECT]" })).toBe(true);
    expect(alertasDeCampanhas([camp({ gasto7d: 150 })])[0]).toMatchObject({ quem: "Gama", gravidade: "critico" });
  });
  it("custo por contato alto contra a mediana da rede (sem a Institucional), com contatos mínimos", () => {
    const rede = [camp({ unidade: "A", gasto7d: 100, leads7d: 10 }), camp({ unidade: "B", gasto7d: 120, leads7d: 10 }), camp({ unidade: "C", gasto7d: 110, leads7d: 10 })];
    const cara = camp({ unidade: "D", nome: "Cara", gasto7d: 200, leads7d: 10 }); // R$ 20 contra mediana de R$ 11,50
    const r = alertasDeCampanhas([...rede, cara, camp({ unidade: null, gasto7d: 900, leads7d: 3 })]);
    expect(r.map((a) => [a.quem, a.titulo])).toEqual([["D", "Custo por contato alto"]]);
  });
  it("anúncio cansado e campanha terminando", () => {
    const r = alertasDeCampanhas([camp({ gasto7d: 50, leads7d: 5, frequencia7d: 4.2, fim: "2026-11-12" })], { hoje: "2026-11-10" });
    expect(titulos(r)).toEqual(["Anúncio cansado", "Campanha terminando"]);
    expect(r[1].fato).toContain("em 2 dias");
  });
  it("conta Institucional sai como 'Institucional'", () => {
    expect(alertasDeCampanhas([camp({ unidade: null, gasto7d: 300 })])[0].quem).toBe("Institucional");
  });
});

describe("alertas do tráfego pago: unidades", () => {
  const meta = (u: Record<string, [number, number, number]>) => ({ unidades: Object.fromEntries(Object.entries(u).map(([n, [investimento, leads, conversas]]) => [n, { investimento, leads, conversas, impressoes: 0, cliques: 0 }])) });
  const evo = (u: Record<string, Record<string, [number, number]>>) => ({ units: Object.entries(u).map(([name, origens]) => ({ name, origens })) });

  it("anunciou no mês passado e está sem campanha no ar", () => {
    const r = alertasDeUnidades({ metaMes: meta({ Gama: [0, 0, 0], Itapoã: [0, 0, 0] }), metaAnterior: meta({ Gama: [800, 0, 0], Itapoã: [0, 0, 0] }), evoMes: undefined, evoAnterior: undefined, campanhas: [] });
    expect(r.map((a) => [a.quem, a.titulo])).toEqual([["Gama", "Unidade sem campanha no ar"]]);
  });
  it("origem não marcada, conversão baixa e nada com poucos contatos", () => {
    const metaMes = meta({ A: [500, 40, 0], B: [500, 30, 20], C: [500, 10, 0], D: [500, 60, 0] });
    const evoMes = evo({ A: { Convite: [5, 2] }, B: { Instagram: [20, 1], Convite: [10, 5] }, C: {}, D: { Instagram: [5, 3], "Sem origem": [40, 30] } });
    const r = alertasDeUnidades({ metaMes, metaAnterior: undefined, evoMes, evoAnterior: undefined, campanhas: ["A", "B", "C", "D"].map((u) => camp({ unidade: u })) });
    // D: a maioria dos cadastros está "Sem origem", então o problema é a marcação, não a conversão
    expect(r.map((a) => [a.quem, a.titulo])).toEqual([["A", "Origem Meta não marcada no EVO"], ["B", "Contatos do Meta não viram alunos"], ["D", "Origem Meta não marcada no EVO"]]);
    expect(r[2].fato).toContain("89% dos cadastros do mês estão sem origem");
  });
  it("origens do Meta reconhecidas", () => {
    expect(origemMetaDe({ Instagram: [3, 1], "Facebook Ads": [2, 1], Convite: [9, 9] })).toEqual({ cadastradas: 5, convertidas: 2 });
    expect(LIMITES_META.gastoSemContato).toBe(100);
  });
});

describe("alertas do tráfego pago: quem vê o quê", () => {
  const l = [{ quem: "Gama" }, { quem: "Itapoã" }, { quem: "Institucional" }] as any;
  it("unidade vê só os dela; rede vê as unidades; Institucional à parte", () => {
    expect(alertasDaEscolha(l, "Gama").map((a) => a.quem)).toEqual(["Gama"]);
    expect(alertasDaEscolha(l, null).map((a) => a.quem)).toEqual(["Gama", "Itapoã"]);
    expect(alertasDaEscolha(l, "Institucional").map((a) => a.quem)).toEqual(["Institucional"]);
  });
  it("no e-mail, cada pessoa recebe só os alertas das unidades dela; a Institucional só para quem vê a rede", () => {
    const un = (name: string) => ({ name, faturamento: 100, recebimento: 100 });
    const meses = [{ month: "2026-11", generatedAt: "2026-11-10T04:00:00.000Z", units: [un("Gama"), un("Itapoã")] }];
    const alertas = [{ quem: "Gama", gravidade: "atencao", titulo: "G", fato: "", acao: "" }, { quem: "Itapoã", gravidade: "atencao", titulo: "I", fato: "", acao: "" }, { quem: "Institucional", gravidade: "atencao", titulo: "X", fato: "", acao: "" }];
    const gestor = montarResumo(meses, { papel: "unidades", unidades: ["Gama"] }, "2026-11-10", null, null, null, alertas);
    expect(gestor.alertas.map((a: { titulo: string }) => a.titulo)).toEqual(["G"]);
    const dono = montarResumo(meses, { papel: "dono" }, "2026-11-10", null, null, null, alertas);
    expect(dono.alertas.map((a: { titulo: string }) => a.titulo).sort()).toEqual(["G", "I", "X"]);
  });
  it("cartão renderiza o estado de espera sem quebrar", () => {
    expect(renderToString(createElement(AlertasMeta, { unit: null }))).toContain("Alertas do tráfego pago");
  });
});

describe("pixel sem vendas online", () => {
  it("avisa quem investiu no mês fechado sem venda pelo pixel e já vendeu antes; ignora quem nunca vendeu e a Institucional", async () => {
    const { alertasDoPixel } = await import("../../../server/alertasMeta.js");
    const u = (investimento: number, compras?: number) => ({ investimento, leads: 0, conversas: 0, ...(compras === undefined ? {} : { compras }) });
    const historico = {
      "2025-12": { unidades: { Gama: u(500, 9), Itapoã: u(300, 2) } },
      "2026-09": { unidades: { Gama: u(400, 0), Ceilândia: u(400, 12) } },
      "2026-10": { unidades: { Gama: u(651, 0), Itapoã: u(300, 0), Ceilândia: u(500, 4), "Asa Norte": u(0, 0), Rede: u(100, 0) } },
    };
    const r = alertasDoPixel(historico, "2026-11-11");
    expect(r.map((a: { quem: string }) => a.quem)).toEqual(["Gama"]);
    expect(r[0].fato).toContain("outubro de 2026");
    expect(r[0].fato).toContain("dezembro de 2025 foram 9 vendas");
    expect(alertasDoPixel(undefined, "2026-11-11")).toEqual([]);
  });
});
