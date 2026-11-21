import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
// @ts-expect-error módulo JS do servidor
import { agregarNpsPontos } from "../../../server/wehelp.js";
import { BASE_PEQUENA_PONTO, faixaDoNps, nomeDoPonto, npsDoPonto, pontosPresentes, rankingDePontos, serieDoPonto, somarPontos } from "@/data/npsPontos";
import { NpsPontosDeContato } from "@/components/retencao/NpsPontosDeContato";
import { month, unit } from "./helpers";

const linha = (unidade: string, tp: string, resp: number, prom: number, det: number) => ({ key: [unidade], tp_name: tp, nps: { total_responses: resp, total_promoters: prom, total_detractors: det } });

describe("NPS por ponto de contato", () => {
  it("o servidor soma as duas pesquisas filhas de cada unidade e ignora o que não é do Atlas", () => {
    const r = agregarNpsPontos([
      linha("World Gym Itapoã - Qrcode", "RECEPÇÃO", 10, 8, 1),
      linha("World Gym Itapoã - Relacionamento", "RECEPÇÃO", 30, 20, 4),
      linha("World Gym Itapoã - Relacionamento", "LIMPEZA E HIGIENIZAÇÃO", 20, 18, 0),
      linha("World Gym Itapoã - Relacionamento", "ESTACIONAMENTO", 0, 0, 0), // sem resposta: some
      linha("Unidade que não existe - Qrcode", "RECEPÇÃO", 99, 99, 0),
    ]);
    expect(r).toEqual({ "Itapoã": { "RECEPÇÃO": [40, 28, 5], "LIMPEZA E HIGIENIZAÇÃO": [20, 18, 0] } });
  });

  it("NPS do ponto = (promotores − detratores) ÷ respostas; faixas do WeHelp; nome legível", () => {
    expect(npsDoPonto({ resp: 40, prom: 28, det: 5 })).toBe(57.5);
    expect(npsDoPonto({ resp: 0, prom: 0, det: 0 })).toBeNull();
    expect([80, 75, 74.9, 50, 49.9, null].map(faixaDoNps)).toEqual(["otimo", "otimo", "bom", "bom", "melhorar", "sem"]);
    expect(nomeDoPonto("ATENDIMENTO PROFESSORES DE MUSCULAÇÃO")).toBe("Atendimento professores de musculação");
  });

  const a = { npsPontos: { RECEPÇÃO: [40, 28, 5], LIMPEZA: [20, 18, 0], ESTACIONAMENTO: [5, 5, 0] } as Record<string, [number, number, number]> };
  const b = { npsPontos: { RECEPÇÃO: [20, 10, 6], LIMPEZA: [10, 9, 1] } as Record<string, [number, number, number]> };

  it("a rede soma as unidades e o ranking vai do melhor ao pior, com os pontos de poucas respostas por último", () => {
    expect(somarPontos([a, b]).RECEPÇÃO).toEqual({ resp: 60, prom: 38, det: 11 });
    const r = rankingDePontos([a, b]);
    expect(r.map((x) => x.ponto)).toEqual(["LIMPEZA", "RECEPÇÃO", "ESTACIONAMENTO"]); // LIMPEZA 86,7 > RECEPÇÃO 45; ESTACIONAMENTO tem só 5 respostas
    expect(r[0]).toMatchObject({ nps: 86.7, resp: 30, neutros: 2 });
    expect(r[2].resp).toBeLessThan(BASE_PEQUENA_PONTO);
    expect(pontosPresentes([a, b])[0]).toBe("RECEPÇÃO"); // quem tem mais respostas primeiro
  });

  it("a série mensal de um ponto, da rede ou de uma unidade", () => {
    const meses = [
      { month: "2026-09", units: [{ name: "A", ...a }, { name: "B", ...b }] },
      { month: "2026-10", units: [{ name: "A", npsPontos: { RECEPÇÃO: [10, 10, 0] } }] },
      { month: "2026-11", units: [{ name: "A", npsPontos: {} }] },
    ];
    expect(serieDoPonto(meses as never, null, "RECEPÇÃO")).toEqual([{ month: "2026-09", nps: 45, resp: 60 }, { month: "2026-10", nps: 100, resp: 10 }, { month: "2026-11", nps: null, resp: 0 }]);
    expect(serieDoPonto(meses as never, "B", "RECEPÇÃO")[0]).toEqual({ month: "2026-09", nps: 20, resp: 20 });
  });

  it("a tela mostra o ranking e o mapa por unidade, sem nome de aluno", () => {
    const us = [unit("Asa Sul", a as never), unit("Gama", b as never)];
    const h = renderToString(<NpsPontosDeContato units={us} unit={null} monthLabel="outubro de 2026" />);
    for (const t of ["NPS por ponto de contato", "Limpeza", "Recepção", "base pequena", "Unidades × pontos de contato", "Asa Sul", "Gama", "Evolução do NPS por ponto de contato"]) expect(h).toContain(t);
    const so1 = renderToString(<NpsPontosDeContato units={[unit("Asa Sul", a as never)]} unit="Asa Sul" monthLabel="outubro de 2026" />);
    expect(so1).not.toContain("Unidades × pontos de contato"); // uma unidade só: sem mapa
    expect(renderToString(<NpsPontosDeContato units={[unit("Asa Sul", {})]} unit={null} monthLabel="x" />)).toContain("ainda não trouxe notas por ponto de contato");
    void month;
  });
});
