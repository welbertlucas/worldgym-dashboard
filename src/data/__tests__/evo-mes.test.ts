import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error módulo JS do servidor
import { unitMonth, hojeBR } from "../../../server/evo.js";
import { mergeEvo } from "@/data/dashboardData";
import { month, unit } from "./helpers";

const titulo = (o: Record<string, unknown>) => ({ ammount: 100, ammountPaid: 0, idMemberPayer: 1, cancellationDate: null, chargeDate: null, ...o });

function evoComTitulos(vencendo: unknown[], pagos: unknown[] = []) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes("dueDateStart") ? vencendo : pagos), { status: 200 })));
}

beforeEach(() => { process.env.EVO_DNS = "x"; process.env.EVO_TOKEN = "y"; });
afterEach(() => vi.unstubAllGlobals());

describe("unitMonth: faturamento só do que já venceu", () => {
  const titulos = [
    titulo({ idMemberPayer: 1, dueDate: "2026-11-02T00:00:00", chargeDate: "2026-11-02T10:00:00", ammountPaid: 100 }),
    titulo({ idMemberPayer: 2, dueDate: "2026-11-03T00:00:00" }), // venceu e não pagou: inadimplente
    titulo({ idMemberPayer: 3, dueDate: "2026-11-05T00:00:00" }), // vence hoje: conta no faturamento, ainda não é atraso
    titulo({ idMemberPayer: 4, dueDate: "2026-11-20T00:00:00", ammount: 300 }), // ainda vai vencer: só na previsão
  ];

  it("no mês em andamento separa faturamento (até hoje) da previsão (mês inteiro)", async () => {
    evoComTitulos(titulos);
    const r = await unitMonth(5, "2026-11", "2026-11-05");
    expect(r.faturamento).toBe(300);
    expect(r.previsaoFaturamento).toBe(600);
    expect(r.pagantes).toBe(2); // 1 e 2 (o título de hoje ainda não está em atraso)
    expect(r.inadimplentes).toBe(1);
  });

  it("em mês fechado faturamento e previsão são iguais", async () => {
    evoComTitulos(titulos);
    const r = await unitMonth(5, "2026-11", "2026-12-10");
    expect(r.faturamento).toBe(600);
    expect(r.previsaoFaturamento).toBe(600);
  });

  it("hojeBR usa o horário de Brasília", () => {
    expect(hojeBR(Date.parse("2026-11-06T02:00:00Z"))).toBe("2026-11-05");
  });
});

describe("mergeEvo: previsão de faturamento", () => {
  it("traz a previsão por unidade e refaz o total", () => {
    const data = [month("2026-11", [unit("Gama"), unit("Itapoã")])];
    mergeEvo(data, [{ month: "2026-11", units: [
      { name: "Gama", faturamento: 10, recebimento: 1, previsaoFaturamento: 40 },
      { name: "Itapoã", faturamento: 20, recebimento: 1, previsaoFaturamento: 50 },
    ] }]);
    expect(data[0].total.faturamento).toBe(30);
    expect(data[0].total.previsaoFaturamento).toBe(90);
  });
});
