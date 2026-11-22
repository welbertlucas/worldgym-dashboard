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

// @ts-expect-error módulo JS do servidor
import { aplicarBairros, distanciaKm, RAIO_MAX_KM } from "../../../server/bairros.js";
// @ts-expect-error módulo JS do servidor
import { COORDENADAS_UNIDADES } from "../../../server/units.js";
describe("bairros perto da unidade", () => {
  const PLANALTINA_GO: [number, number] = [-15.4533562, -47.6078043];

  it("descarta o bairro achado longe da unidade e cai na cidade, perto dela", async () => {
    const consultas: Array<[string, unknown]> = [];
    // O OpenStreetMap não tem os setores de Planaltina-GO: a busca sem a cidade acha um "Setor Norte" a ~94 km
    const busca = async (q: string, ancora: unknown) => {
      consultas.push([q, ancora]);
      if (q === "Setor Norte, GO") return [-16.3, -48.2];
      if (q === "Planaltina, GO") return [-15.452, -47.614];
      return null;
    };
    const c = await coordenadasDoBairro({ bairro: "Setor Norte", cidade: "Planaltina", uf: "GO" }, busca, PLANALTINA_GO);
    expect(c).toEqual([-15.452, -47.614, 1]); // aproximado: centro da cidade
    expect(consultas.every(([, a]) => a === PLANALTINA_GO)).toBe(true); // toda busca vai com a caixa em volta da unidade
    expect(distanciaKm(PLANALTINA_GO, [-16.3, -48.2])).toBeGreaterThan(RAIO_MAX_KM);
  });

  it("sem nada perto, o bairro fica sem localização", async () => {
    const longe = async () => [-12.97, -38.5]; // Salvador
    expect(await coordenadasDoBairro({ bairro: "Centro", cidade: "Cidade Ocidental", uf: "GO" }, longe, PLANALTINA_GO)).toBeNull();
  });

  it("refaz a coordenada guardada longe da unidade, mantém a que está perto e marca a unidade no lugar certo", async () => {
    const geo: Record<string, unknown> = {
      [chaveBairro("Setor Norte", "Planaltina")]: [-16.3, -48.2], // guardada errada, a ~94 km
      [chaveBairro("Setor Leste", "Planaltina")]: [-15.455, -47.6], // certa
    };
    const buscas: string[] = [];
    const busca = async (q: string) => { buscas.push(q); return q === "Planaltina, GO" ? [-15.452, -47.614] : null; };
    const u: Record<string, unknown> = { name: "Planaltina-GO" };
    const foto = { lista: [{ bairro: "Setor Norte", cidade: "Planaltina", uf: "GO", n: 10 }, { bairro: "Setor Leste", cidade: "Planaltina", uf: "GO", n: 5 }], semBairro: 0, inativos: [], semBairroInativos: 0, acessos: [], perfil: {} };
    const r = await aplicarBairros(u, foto, geo, PLANALTINA_GO, busca);
    expect(r.falhou).toBe(false);
    expect(u.bairros).toEqual([["Setor Norte", "Planaltina", 10, -15.452, -47.614, 1], ["Setor Leste", "Planaltina", 5, -15.455, -47.6]]);
    expect(buscas.some((q) => q.startsWith("Setor Leste"))).toBe(false); // a que estava perto não foi buscada de novo
    expect(u.local).toEqual(PLANALTINA_GO);
  });

  it("toda unidade do painel tem a posição do Google Maps", async () => {
    // @ts-expect-error módulo JS do servidor
    const { UNIT_NAMES } = await import("../../../server/units.js");
    expect(Object.keys(COORDENADAS_UNIDADES).sort()).toEqual(Object.keys(UNIT_NAMES).sort());
  });
});
