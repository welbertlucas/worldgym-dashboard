import { describe, expect, it } from "vitest";
import { parseCSV } from "@/data/dashboardData";

const HEADER = "Mês,Unidade,Faturamento,Recebimento,Ticket Médio,Novos Contratos,Adimplentes,Inadimplentes,Inadimplência %,Churn,Cancelados,Renovações,Vendas Online,ICV";

describe("parseCSV", () => {
  it("lê valores em formato BR (R$, %, milhar com ponto)", () => {
    const csv = `${HEADER}\n2026-09,Gama," R$  297.000 "," R$  267.700 "," R$  156,04 ",303,1882,157,"7,6%","7,6%",112,"52,0%"," R$  909,00 ","63,6%"`;
    const [m] = parseCSV(csv);
    const g = m.units[0];
    expect(g.faturamento).toBe(297000);
    expect(g.ticketMedio).toBeCloseTo(156.04);
    expect(g.churn).toBeCloseTo(7.6);
    expect(g.vendasOnline).toBe(909);
  });

  it("normaliza mês sem zero (2026-4 → 2026-04) e separa a linha TOTAL", () => {
    const csv = `${HEADER}\n2026-4,Gama,100,90,10,1,1,1,1,1,1,1,1,1\n2026-4,TOTAL,100,90,10,1,1,1,1,1,1,1,1,1`;
    const [m] = parseCSV(csv);
    expect(m.month).toBe("2026-04");
    expect(m.units).toHaveLength(1);
    expect(m.total.faturamento).toBe(100);
  });

  it("não descarta linha com mês em branco: herda o mês da primeira linha com mês", () => {
    const csv = `${HEADER}\n ,Ceilândia,297000,0,0,0,0,0,0,0,0,0,0,0\n2024-05,Asa Norte,294000,0,0,0,0,0,0,0,0,0,0,0\n2024-05,TOTAL,591000,0,0,0,0,0,0,0,0,0,0,0`;
    const res = parseCSV(csv);
    expect(res).toHaveLength(1);
    expect(res[0].units.map((u) => u.name)).toEqual(["Ceilândia", "Asa Norte"]);
    expect(res[0].units.reduce((s, u) => s + u.faturamento, 0)).toBe(res[0].total.faturamento);
  });

  it("aceita linhas curtas (colunas finais ausentes)", () => {
    const csv = `${HEADER}\n2026-09,Gama,100,90,10,1,1,1,1,1,1,1,1`;
    expect(parseCSV(csv)[0].units[0].icv).toBe(0);
  });
});
