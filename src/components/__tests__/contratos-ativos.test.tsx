import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ContratosAtivos } from "@/components/unidades/ContratosAtivos";
import type { UnitData } from "@/data/dashboardData";

const u = (name: string, especiais: number) =>
  ({ name, contratosAtivos: 1000, contratosEspeciais: especiais, contratosPersonal: 10, contratosLocal: 600, contratosParcial: 100, contratosRede: 300 }) as unknown as UnitData;

describe("Contratos ativos (Alunos › Contratos)", () => {
  const units = [u("Gama", 50), u("Itapoã", 30), u("Taguatinga", 10)];
  const ordem = (html: string) => [...html.matchAll(/<h5[^>]*>.*?<\/h5>/g)].map((m) => m[0].replace(/<[^>]+>/g, ""));

  it("a unidade selecionada vem no primeiro card, mesmo não sendo a primeira da ordem", () => {
    const html = renderToString(<ContratosAtivos units={units} foco="Taguatinga" />);
    expect(ordem(html)).toEqual(["Taguatinga", "Gama", "Itapoã"]);
    expect(html.replace(/<!-- -->/g, "")).toContain("Taguatinga é a 3ª de 3");
    expect(html).not.toContain("Exportar PDF");
  });

  it("sem unidade selecionada, segue a ordem", () => {
    expect(ordem(renderToString(<ContratosAtivos units={units} />))).toEqual(["Gama", "Itapoã", "Taguatinga"]);
  });
});
