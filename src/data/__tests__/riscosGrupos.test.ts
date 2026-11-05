import { describe, expect, it } from "vitest";
import { agruparPorUnidade } from "@/data/riscosGrupos";
import { type Recommendation } from "@/data/recommendations";

const r = (id: string, unit: string, severity: "critical" | "attention" | "info") => ({ id, unit, severity }) as Recommendation;

describe("riscos agrupados por unidade", () => {
  const recs = [
    r("1", "Gama", "attention"), r("2", "Itapoã", "critical"), r("3", "Gama", "critical"), r("4", "Gama", "critical"),
    r("5", "Rede", "info"), r("6", "Asa Norte", "critical"), r("7", "Asa Norte", "info"),
  ];
  const g = agruparPorUnidade(recs);

  it("Rede vem primeiro; depois mais críticos, e desempata por atenção, informativos e nome", () => {
    expect(g.map((x) => x.unit)).toEqual(["Rede", "Gama", "Asa Norte", "Itapoã"]);
  });

  it("conta cada severidade e mantém a ordem dos itens dentro do grupo", () => {
    const gama = g.find((x) => x.unit === "Gama")!;
    expect([gama.criticos, gama.atencao, gama.informativos]).toEqual([2, 1, 0]);
    expect(gama.itens.map((i) => i.id)).toEqual(["1", "3", "4"]);
  });

  it("sem itens, sem grupos", () => {
    expect(agruparPorUnidade([])).toEqual([]);
  });
});
