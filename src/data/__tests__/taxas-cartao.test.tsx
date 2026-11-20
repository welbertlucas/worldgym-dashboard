import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { taxasPorUnidade } from "@/data/taxasCartao";
import { TaxaCartaoPorUnidade } from "@/components/TaxaCartaoPorUnidade";

const limpo = (h: string) => h.replace(/<!-- -->/g, "").replace(/ /g, " ");
const U = (name: string, gatewaysCartao: Record<string, number>, gatewaysDet: Record<string, [number, number, number?]>) => ({ name, gatewaysCartao, gatewaysDet });
const UNIDADES = [
  U("Gama", { Stone: 200000 }, { Stone: [1400, 2040, 1400] }), // 1,02%, completa
  U("Salvador", { Stone: 100000 }, { Stone: [700, 2000, 700] }), // 2,00%
  U("Itapoã", { Stone: 50000, Rede: 10000 }, { Stone: [300, 500, 150], Rede: [60, 0, 0] }), // Stone 1,00% com taxa em 50%; Rede sem taxa
  U("Sem dado", { Stone: 0 }, {}),
];

describe("taxa de cartão por unidade", () => {
  it("uma linha por unidade e adquirente, da taxa mais alta para a mais baixa, com a média da rede e a diferença para ela", () => {
    const { linhas, medias } = taxasPorUnidade(UNIDADES);
    expect(linhas.map((l) => [l.unidade, l.gateway])).toEqual([["Salvador", "Stone"], ["Gama", "Stone"], ["Itapoã", "Stone"], ["Itapoã", "Rede"]]);
    expect(linhas[0]).toMatchObject({ unidade: "Salvador", taxa: 2, cobertura: 100, incompleta: false });
    expect(linhas[1].taxa).toBeCloseTo(1.02, 2);
    // média da rede na Stone: só as unidades com a taxa completa, (2040 + 2000) / (200000 + 100000)
    expect(medias.map((m) => m.gateway)).toEqual(["Stone"]); // a Rede só tem uma linha, incompleta: sem média
    expect(medias[0].taxa).toBeCloseTo(1.3467, 3);
    expect(linhas[0].difMedia).toBeCloseTo(0.653, 2); // Salvador paga mais que a média
    expect(linhas[1].difMedia).toBeCloseTo(-0.327, 2);
    // taxa registrada em 50% das cobranças: incompleta, fora da média e sem diferença para ela
    expect(linhas[2]).toMatchObject({ unidade: "Itapoã", cobertura: 50, incompleta: true, difMedia: null });
    expect(linhas[3]).toMatchObject({ gateway: "Rede", taxa: 0, difMedia: null, incompleta: true });
  });

  it("meses lidos antes do dado de cobertura: sem cobertura, sem marcar incompleta; sem dados não quebra", () => {
    const { linhas } = taxasPorUnidade([U("Gama", { Stone: 1000 }, { Stone: [10, 15] })]);
    expect(linhas[0]).toMatchObject({ cobertura: null, incompleta: false });
    expect(taxasPorUnidade([])).toEqual({ linhas: [], medias: [] });
  });

  it("a tabela mostra as unidades lado a lado, a taxa, a diferença para a média e a cobertura; avisa quando não há dado", () => {
    const html = limpo(renderToString(<TaxaCartaoPorUnidade units={UNIDADES} monthLabel="novembro de 2026" />)).replace(/<[^>]+>/g, "");
    for (const t of ["Taxa de cartão por unidade", "Salvador", "Gama", "Itapoã", "2,00%", "1,02%", "+0,65 p.p. da média", "−0,33 p.p. da média", "Média Stone: 1,35%", "100% das cobranças", "50% das cobranças (incompleta)", "Só dono e Master"]) expect(html).toContain(t);
    expect(html).not.toContain("Média Rede"); // gateway sem taxa completa em nenhuma unidade não tem média
    expect(limpo(renderToString(<TaxaCartaoPorUnidade units={[]} monthLabel="x" />))).toContain("Sem taxas de cartão registradas");
  });
});
