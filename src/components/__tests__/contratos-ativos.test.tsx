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

describe("Contratos ativos por plano", () => {
  const planos = Array.from({ length: 12 }, (_, i) => [`PLANO ${i + 1}`, 100 - i]);
  const units = [{ name: "Gama", contratosAtivos: 1000, contratosPlanos: planos }] as unknown as UnitData[];

  it("mostra os 10 maiores com quantidade e percentual, e oferece ver todos", async () => {
    const { ContratosPorPlano } = await import("@/components/unidades/ContratosPorPlano");
    const html = renderToString(<ContratosPorPlano units={units} foco="Gama" />);
    expect(html).toContain("Contratos ativos por plano");
    expect(html).toContain("PLANO 1");
    expect(html).toContain("PLANO 10");
    expect(html).not.toContain("PLANO 11");
    expect(html).toMatch(/10,0(<!-- -->)?%/);
    expect(html).toContain("Ver os 12 planos");
  });

  it("some quando não há a foto dos planos", async () => {
    const { ContratosPorPlano } = await import("@/components/unidades/ContratosPorPlano");
    expect(renderToString(<ContratosPorPlano units={[{ name: "Gama" } as unknown as UnitData]} />)).toBe("");
  });
});
