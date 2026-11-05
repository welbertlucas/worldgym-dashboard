import { describe, expect, it } from "vitest";
import { mergeEvo } from "@/data/dashboardData";
import { month, unit } from "./helpers";

describe("mergeEvo", () => {
  it("troca faturamento e recebimento das unidades pelo EVO e refaz o total", () => {
    const data = [month("2026-09", [unit("Gama"), unit("Itapoã")])];
    mergeEvo(data, [
      { month: "2026-09", units: [{ name: "Gama", faturamento: 200, recebimento: 150 }, { name: "Itapoã", faturamento: 300, recebimento: 250 }] },
    ]);
    expect(data[0].units[0].faturamento).toBe(200);
    expect(data[0].units[1].recebimento).toBe(250);
    expect(data[0].total.faturamento).toBe(500);
    expect(data[0].total.recebimento).toBe(400);
  });

  it("não mexe nos outros indicadores (ticket, churn...) nem em meses sem EVO", () => {
    const data = [month("2026-08", [unit("Gama")]), month("2026-09", [unit("Gama", { churn: 7 })])];
    mergeEvo(data, [{ month: "2026-09", units: [{ name: "Gama", faturamento: 1, recebimento: 1 }] }]);
    expect(data[1].units[0].churn).toBe(7);
    expect(data[0].units[0].faturamento).toBe(100000);
    expect(data[0].total.faturamento).toBe(100000);
  });

  it("cria a unidade e o mês que o EVO tem e a planilha ainda não, com os outros indicadores zerados", () => {
    const data = [month("2026-09", [unit("Gama")])];
    mergeEvo(data, [
      { month: "2026-09", units: [{ name: "Gama", faturamento: 10, recebimento: 9 }, { name: "Nova", faturamento: 20, recebimento: 18 }] },
      { month: "2026-10", units: [{ name: "Gama", faturamento: 30, recebimento: 27 }] },
    ]);
    expect(data.map((m) => m.month)).toEqual(["2026-09", "2026-10"]);
    const nova = data[0].units.find((u) => u.name === "Nova")!;
    expect(nova.faturamento).toBe(20);
    expect(nova.churn).toBe(0);
    expect(data[0].total.faturamento).toBe(30);
    expect(data[1].units[0].recebimento).toBe(27);
    expect(data[1].total.faturamento).toBe(30);
  });

  it("mantém os meses em ordem mesmo quando o EVO traz um mês mais antigo que a planilha", () => {
    const data = [month("2026-09", [unit("Gama")])];
    mergeEvo(data, [{ month: "2024-05", units: [{ name: "Gama", faturamento: 5, recebimento: 4 }] }]);
    expect(data.map((m) => m.month)).toEqual(["2024-05", "2026-09"]);
  });

  it("ignora mês do EVO sem nenhuma unidade", () => {
    const data = [month("2026-09", [unit("Gama")])];
    mergeEvo(data, [{ month: "2030-01", units: [] }]);
    expect(data).toHaveLength(1);
  });
});
