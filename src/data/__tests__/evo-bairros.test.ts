import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { chaveBairro, contarPorBairro, coordenadasDoBairro, tituloBairro } from "../../../server/bairros.js";

const membro = (neighborhood: string, city = "Brasília", fim = "2026-12-31") => ({
  neighborhood, city, state: "DF",
  memberships: [{ startDate: "2026-01-01T00:00:00", endDate: `${fim}T00:00:00`, cancelDate: null, membershipStatus: "active", valueNextMonth: 0 }],
});

describe("bairros dos alunos", () => {
  it("padroniza a escrita", () => {
    expect(tituloBairro("REGIÃO DOS LAGOS (SOBRADINHO)")).toBe("Região dos Lagos (Sobradinho)");
    expect(chaveBairro("Paranoá", "Brasília")).toBe(chaveBairro(" PARANOA ", "BRASÍLIA"));
  });

  it("conta só alunos ativos hoje, junta variações e separa os sem bairro", () => {
    const r = contarPorBairro([membro("Paranoá"), membro("PARANOA"), membro("Vale do Amanhecer", "Planaltina"), membro(""), membro("Paranoá", "Brasília", "2026-01-31")], "2026-11-06");
    expect(r.ativos).toBe(4);
    expect(r.semBairro).toBe(1);
    expect(r.lista.map((b: { bairro: string; n: number }) => [b.bairro, b.n])).toEqual([["Paranoá", 2], ["Vale do Amanhecer", 1]]);
  });

  it("geocodifica tentando de novo sem o que está entre parênteses", async () => {
    const consultas: string[] = [];
    const busca = async (q: string) => { consultas.push(q); return q.includes("(") ? null : [-15.6, -47.8]; };
    expect(await coordenadasDoBairro({ bairro: "Região dos Lagos (Sobradinho)", cidade: "Brasília", uf: "DF" }, busca)).toEqual([-15.6, -47.8]);
    expect(consultas).toEqual(["Região dos Lagos (Sobradinho), Brasília, DF", "Região dos Lagos, Brasília, DF"]);
  });
});

// @ts-expect-error módulo JS do servidor
import { contarUltimoAcesso } from "../../../server/bairros.js";
describe("último acesso", () => {
  it("separa os ativos em faixas pela data do último acesso", () => {
    const m = (la: string | null) => ({ ...membro("X"), lastAccessDate: la });
    const f = contarUltimoAcesso([m("2026-11-05T10:00:00"), m("2026-10-25T10:00:00"), m("2026-10-20T10:00:00"), m("2026-09-20T10:00:00"), m("2026-01-01T10:00:00"), m(null), { ...m("2026-11-05T10:00:00"), memberships: [] }], "2026-11-06");
    expect(f).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

import { afterEach } from "vitest";
import { dashboardData } from "@/data/dashboardData";
import { dadosDoMapa } from "@/data/mapaAlunos";
import { month, unit as umaUnidade } from "@/data/__tests__/helpers";
afterEach(() => { dashboardData.length = 0; });

describe("mapa dos alunos", () => {
  it("soma o mesmo bairro entre unidades na rede e cria um pino por unidade", () => {
    dashboardData.push(month("2026-11", [
      umaUnidade("A", { bairros: [["Paranoá", "Brasília", 10, -15.7, -47.7]], semBairro: 2, local: [-15.75, -47.72] } as never),
      umaUnidade("B", { bairros: [["Paranoá", "Brasília", 5, -15.7, -47.7], ["Itapoã", "Brasília", 3, -15.74, -47.76]], semBairro: 1, local: [-15.8, -47.9] } as never),
    ]));
    const rede = dadosDoMapa(null, ["A", "B"]);
    expect(rede.bairros.map((b) => [b[0], b[2]])).toEqual([["Paranoá", 15], ["Itapoã", 3]]);
    expect(rede.pinos.map((p) => p.nome)).toEqual(["A", "B"]);
    expect(rede.semBairro).toBe(3);
    expect(rede.alunos).toBe(18);
    expect(dadosDoMapa("B", ["A", "B"]).alunos).toBe(8);
  });
});
