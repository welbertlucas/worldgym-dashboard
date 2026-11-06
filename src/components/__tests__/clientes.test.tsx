import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { passosDoFluxo, FluxoClientesChart } from "@/components/clientes/FluxoClientesChart";
import { MotivosCancelamento, motivosOrdenados } from "@/components/clientes/MotivosCancelamento";
import { SaldoHeatmap, corDaCelula } from "@/components/clientes/SaldoHeatmap";
import { dashboardData } from "@/data/dashboardData";
import { month, unit } from "@/data/__tests__/helpers";

afterEach(() => { dashboardData.length = 0; });

describe("fluxo de clientes", () => {
  it("monta a cascata fechando início + entradas − saídas = fim", () => {
    const p = passosDoFluxo(unit("A", { ativosIni: 1000, fluxoNovos: 80, fluxoRetornos: 20, fluxoCancelados: 60, fluxoVencidos: 40, ativosFim: 1000 }))!;
    expect(p.map((x) => x.nome)).toEqual(["Início do mês", "Novos", "Retornos", "Cancelados", "Vencidos", "Fim do mês"]);
    expect(p[5].valor).toBe(1000); // 1000 + 80 + 20 − 60 − 40
    expect(p[3].base).toBe(1040); // cancelados descem de 1100 para 1040
  });
  it("sem dado do EVO mostra o estado vazio, sem quebrar", () => {
    const html = renderToString(<FluxoClientesChart total={unit("A")} monthLabel="outubro de 2026" partial={false} unitLabel="Rede" />);
    expect(html).toContain("Sem o fluxo de alunos do EVO");
  });
});

describe("motivos de cancelamento", () => {
  it("ordena do maior para o menor e junta a cauda em Demais motivos", () => {
    const m = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`Motivo ${i + 1}`, 100 - i]));
    const l = motivosOrdenados(m);
    expect(l).toHaveLength(9);
    expect(l[0][0]).toBe("Motivo 1");
    expect(l[8]).toEqual(["Demais motivos", 92 + 91 + 90]);
  });
  it("mostra o total, o percentual por inadimplência e cada motivo", () => {
    const t = unit("A", { motivosCancel: { "Inadimplência (cancelamento automático)": 50, "Mudou-se": 30, Outros: 20 } });
    const html = renderToString(<MotivosCancelamento total={t} monthLabel="outubro de 2026" partial={false} unitLabel="Rede" />).replace(/<!-- -->/g, "");
    expect(html).toContain("Alunos que cancelaram");
    expect(html).toContain("50,0%");
    expect(html).toContain("Mudou-se");
  });
  it("sem cancelamentos com motivo, mostra o estado vazio", () => {
    const html = renderToString(<MotivosCancelamento total={unit("A")} monthLabel="x" partial={false} unitLabel="Rede" />);
    expect(html).toContain("Sem cancelamentos com motivo");
  });
});

describe("saldo de alunos por unidade", () => {
  it("cor: verde quando cresce, vermelho quando encolhe, sem cor quando zero ou sem dado", () => {
    expect(corDaCelula(40, 1000)).toContain("142");
    expect(corDaCelula(-40, 1000)).toContain("0 72%");
    expect(corDaCelula(0, 1000)).toBeUndefined();
    expect(corDaCelula(undefined, 1000)).toBeUndefined();
  });
  it("lista as unidades com o saldo de cada mês e o acumulado, do pior para o melhor", () => {
    dashboardData.push(
      month("2026-08", [unit("Alfa", { ativosIni: 100, ativosFim: 90 }), unit("Beta", { ativosIni: 100, ativosFim: 110 })]),
      month("2026-09", [unit("Alfa", { ativosIni: 90, ativosFim: 85 }), unit("Beta", { ativosIni: 110, ativosFim: 120 })]),
    );
    const html = renderToString(<SaldoHeatmap selectedMonth="2026-09" selectedUnit={null} />).replace(/<!-- -->/g, "");
    expect(html.indexOf("Alfa")).toBeLessThan(html.indexOf("Beta"));
    expect(html).toContain("−15".replace("−", "-")); // Alfa: -10 + -5
    expect(html).toContain("+20"); // Beta acumulado
  });
});
