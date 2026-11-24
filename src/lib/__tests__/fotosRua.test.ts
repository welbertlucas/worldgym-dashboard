import { describe, expect, it } from "vitest";
import { comFotosDaRegiao, mesAno, paginaDeFotos } from "@/components/estudos/fotosRua";

// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
import { afterEach, beforeEach } from "vitest";

const guardado = new Map<string, unknown>();
beforeEach(() => { guardado.clear(); definirArmazem({ ler: async (c: string) => guardado.get(c) ?? null, gravar: async (c: string, d: unknown) => { guardado.set(c, d); } }); });
afterEach(() => definirArmazem(null));

describe("fotos de rua (Street View) do último slide", () => {
  it("trava do mês: conta as fotos e para antes de passar do limite", async () => {
    // @ts-expect-error módulo JS do servidor
    const { fotosDaRua } = await import("../../../server/fotosRua.js");
    const fetcher = async (url: string) => url.includes("/metadata")
      ? { ok: true, json: async () => ({ status: "OK", pano_id: "p", location: { lat: -10, lng: -50 }, copyright: "© Google" }) }
      : { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
    const agora = Date.UTC(2026, 10, 23);
    const a = await fotosDaRua({ c: [-10, -50] }, { chave: "k", fetcher, agora, limite: 8 });
    expect(a.fotos).toHaveLength(4);
    expect(guardado.get("estudos/fotos-rua/uso-2026-11.json")).toEqual({ fotos: 4 });
    await fotosDaRua({ c: [-10, -50] }, { chave: "k", fetcher, agora, limite: 8 });
    const c = await fotosDaRua({ c: [-10, -50] }, { chave: "k", fetcher, agora, limite: 8 });
    expect(c).toMatchObject({ fotos: [], motivo: "limite" });
    // mês novo: zera
    const d = await fotosDaRua({ c: [-10, -50] }, { chave: "k", fetcher, agora: Date.UTC(2026, 11, 1), limite: 8 });
    expect(d.fotos).toHaveLength(4);
  });

  it("acha a foto mais próxima, vira de frente para o lugar e pede as 4 vistas", async () => {
    // @ts-expect-error módulo JS do servidor
    const { fotosDaRua } = await import("../../../server/fotosRua.js");
    const pedidos: string[] = [];
    const fetcher = async (url: string) => {
      pedidos.push(url);
      if (url.includes("/metadata")) return { ok: true, json: async () => ({ status: "OK", pano_id: "abc", location: { lat: -10.0, lng: -50.0 }, date: "2024-03", copyright: "© Google" }) };
      return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    };
    // lugar 100 m ao norte da foto: a primeira vista olha para o norte (0°)
    const r = await fotosDaRua({ c: [-10.0 + 100 / 111195, -50.0] }, { chave: "k", fetcher });
    expect(r.fotos).toHaveLength(4);
    expect(r.distanciaM).toBe(100);
    expect(r.data).toBe("2024-03");
    expect(r.fotos[0].dados.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(pedidos.filter((u) => !u.includes("/metadata")).map((u) => Number(u.match(/heading=(\d+)/)![1]))).toEqual([0, 90, 270, 180]);
    expect(pedidos.every((u) => !u.includes("undefined"))).toBe(true);
  });

  it("pula panorama de usuário (ex.: dentro de shopping) e procura foto oficial em volta", async () => {
    // @ts-expect-error módulo JS do servidor
    const { fotosDaRua, ehDoGoogle } = await import("../../../server/fotosRua.js");
    expect(ehDoGoogle("© Google")).toBe(true);
    expect(ehDoGoogle("© 2024 Google")).toBe(true);
    expect(ehDoGoogle("© Fulano Fotos")).toBe(false);
    // a consulta do centro acha um panorama de usuário; a 5ª acha uma foto oficial a ~20 m; as outras, uma oficial a ~80 m
    let n = 0;
    const fetcher = async (url: string) => {
      if (url.includes("/metadata")) {
        n++;
        const m = n === 1 ? { status: "OK", pano_id: "usuario", location: { lat: -10, lng: -50 }, copyright: "© Loja Exemplo" }
          : n === 5 ? { status: "OK", pano_id: "perto", location: { lat: -10 - 20 / 111195, lng: -50 }, copyright: "© 2026 Google", date: "2024-11" }
          : { status: "OK", pano_id: "longe", location: { lat: -10 + 80 / 111195, lng: -50 }, copyright: "© Google", date: "2025-05" };
        return { ok: true, json: async () => m };
      }
      expect(url).toContain("pano=perto");
      return { ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer };
    };
    const r = await fotosDaRua({ c: [-10, -50] }, { chave: "k", fetcher });
    expect(n).toBe(17); // centro + 2 anéis de 8
    expect(r.fotos).toHaveLength(4);
    expect(r.distanciaM).toBe(20);
    expect(r.data).toBe("2024-11");
  });

  it("de frente: o zoom fecha quando a foto está longe", async () => {
    // @ts-expect-error módulo JS do servidor
    const { vistas } = await import("../../../server/fotosRua.js");
    expect(vistas(0, 10)[0].fov).toBe(80);
    expect(vistas(0, 56)[0].fov).toBe(36);
    expect(vistas(0, 300)[0].fov).toBe(30);
  });

  it("sem Street View perto: sem fotos e com o motivo; API desligada: indisponível", async () => {
    // @ts-expect-error módulo JS do servidor
    const { fotosDaRua } = await import("../../../server/fotosRua.js");
    const sem = await fotosDaRua({ c: [-10, -50] }, { chave: "k", fetcher: async () => ({ ok: true, json: async () => ({ status: "ZERO_RESULTS" }) }) });
    expect(sem).toMatchObject({ fotos: [], motivo: "sem-imagem" });
    const negado = await fotosDaRua({ c: [-10, -50] }, { chave: "k", fetcher: async () => ({ ok: true, json: async () => ({ status: "REQUEST_DENIED" }) }) });
    expect(negado).toMatchObject({ fotos: [], motivo: "indisponivel" });
    await expect(fotosDaRua({ c: [-10, -50] }, { chave: "" })).rejects.toThrow(/configuradas/);
    await expect(fotosDaRua({ c: ["x", 1] }, { chave: "k" })).rejects.toThrow(/inválida/);
  });

  it("monta a página do PDF com a data e o crédito, e só entra quando há o que mostrar", () => {
    expect(mesAno("2024-03")).toBe("mar/2024");
    expect(mesAno(null)).toBeNull();
    const pg = paginaDeFotos({ fotos: [{ rotulo: "De frente para o lugar", dados: "data:image/jpeg;base64,AA" }], data: "2023-11", distanciaM: 35, motivo: null }, "Fotos da Região", "A. Ponto");
    expect(pg?.nota).toContain("Imagens © Google Street View, de nov/2023");
    expect(pg?.nota).toContain("a 35 m do lugar");
    expect(paginaDeFotos({ fotos: [], data: null, distanciaM: null, motivo: "indisponivel" }, "Fotos")).toBeNull();
    expect(paginaDeFotos({ fotos: [], data: null, distanciaM: null, motivo: "sem-imagem" }, "Fotos")?.nota).toMatch(/não tem fotos de rua/);
    const base = { arquivo: "x.pdf", cabecalho: "x", foto: null, paginas: [] };
    expect(comFotosDaRegiao(base, null)).toBe(base);
    expect(comFotosDaRegiao(base, pg).fotosDaRegiao).toHaveLength(1);
  });
});

describe("redes de academia", () => {
  it("reconhece Evolve, Corpo e Saúde e Ultra (pedido do dono, 23/11/2026), sem pegar nomes parecidos", async () => {
    // @ts-expect-error módulo JS do servidor
    const { redeDe } = await import("../../../server/pois.js");
    expect(redeDe("Academia Evolve - Unidade Centro")).toBe("Evolve");
    expect(redeDe("Corpo & Saúde Academia")).toBe("Corpo e Saúde");
    expect(redeDe("Academia Corpo e Saude")).toBe("Corpo e Saúde");
    expect(redeDe("Ultra Academia")).toBe("Ultra");
    expect(redeDe("Clínica Ultrassom")).toBeNull();
    expect(redeDe("Academia do Bairro")).toBeNull();
  });
});
