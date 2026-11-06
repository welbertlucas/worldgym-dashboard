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
