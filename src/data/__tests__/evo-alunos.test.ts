import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error módulo JS do servidor
import { fetchAll } from "../../../server/evo.js";
// @ts-expect-error módulo JS do servidor
import { aplicarBairros, chaveBairro } from "../../../server/bairros.js";

describe("leitura única dos alunos", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.EVO_DNS; delete process.env.EVO_TOKEN; });

  it("fetchAll pagina com o tamanho pedido e para na última página", async () => {
    process.env.EVO_DNS = "x"; process.env.EVO_TOKEN = "y";
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      const skip = Number(new URL(url).searchParams.get("skip"));
      const n = skip === 0 ? 1000 : 250;
      return { ok: true, status: 200, json: async () => Array.from({ length: n }, (_, i) => ({ i: skip + i })) };
    }));
    const r = await fetchAll("/receivables?idBranch=1", 1000);
    expect(r).toHaveLength(1250);
    expect(urls.map((u) => new URL(u).searchParams.get("take"))).toEqual(["1000", "1000"]);
    expect(urls.map((u) => new URL(u).searchParams.get("skip"))).toEqual(["0", "1000"]);
  });

  it("aplica bairros, acessos e perfil na unidade sem geocodificar o que já está guardado", async () => {
    const geo = { [chaveBairro("Centro", "Gama")]: [-16, -48] };
    const foto = { lista: [{ bairro: "Centro", cidade: "Gama", n: 10 }], semBairro: 2, inativos: [{ bairro: "Centro", cidade: "Gama", n: 3 }], semBairroInativos: 1, acessos: [1, 2, 3, 4, 5, 6], perfil: { genero: {} } };
    const u: Record<string, unknown> = { name: "Gama" };
    const r = await aplicarBairros(u, foto, geo, [-16.01, -48.06]);
    expect(r).toEqual({ novos: 0, falhou: false });
    expect(u).toMatchObject({ bairros: [["Centro", "Gama", 10, -16, -48]], bairrosInativos: [["Centro", "Gama", 3, -16, -48]], semBairro: 2, semBairroInativos: 1, acessos: [1, 2, 3, 4, 5, 6], local: [-16.01, -48.06] });
  });
});
