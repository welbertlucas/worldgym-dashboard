import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
// @ts-expect-error módulo JS do servidor
import { CONTAS_IG, descobrirContas, imagemDe, insightsDe, mesclar, postDoGraph, postsDesde, storyDoGraph, valoresDeInsights } from "../../../server/instagram.js";
// @ts-expect-error módulo JS do servidor
import { filtrarInstagram } from "../../../server/visibilidade.js";
import { contasDaEscolha, resumoDasContas, storiesPorDia, type DadosInstagram } from "@/data/instagram";
import { InstagramTab } from "@/components/tabs/InstagramTab";

const conta = { id: "1", usuario: "worldgym.gama", nome: "World Gym Gama", seguidores: 5400, posts: 300, foto: null };

describe("Instagram: leitura do Meta", () => {
  it("descobre as contas pelas páginas, seguindo a paginação", async () => {
    const respostas: Record<string, unknown> = {
      inicio: { data: [{ name: "World Gym Gama", instagram_business_account: { id: "1", username: "worldgym.gama", followers_count: 5400, media_count: 300 } }, { name: "Página sem Instagram" }], paging: { next: "https://graph/p2" } },
      "https://graph/p2": { data: [{ name: "World Gym Brasil", instagram_business_account: { id: "2", username: "worldgymbrasil" } }] },
    };
    const g = async (url: string) => respostas[url.startsWith("me/accounts") ? "inicio" : url];
    const contas = await descobrirContas("t", g);
    expect(contas.map((c: { usuario: string }) => c.usuario)).toEqual(["worldgym.gama", "worldgymbrasil"]);
    expect(contas[0].seguidores).toBe(5400);
  });

  it("insights: cai para a próxima lista quando o Meta recusa uma métrica, lembra a que funcionou, e story pequeno fica sem número", async () => {
    const pedidas: string[] = [];
    const g = async (url: string) => {
      pedidas.push(url);
      if (url.includes("reach")) throw Object.assign(new Error("Meta 400: metric reach is not supported"), { codigo: 100 });
      return { data: [{ name: "views", values: [{ value: 120 }] }, { name: "saved", values: [{ value: 3 }] }] };
    };
    const lembrar: Record<string, number> = {};
    expect(await insightsDe("m1", "post", "t", lembrar, g)).toEqual({ views: 120, saved: 3 });
    expect(lembrar.post).toBe(1);
    pedidas.length = 0;
    await insightsDe("m2", "post", "t", lembrar, g);
    expect(pedidas).toHaveLength(1); // já começa pela lista aceita
    const pequeno = async () => { throw Object.assign(new Error("Meta 400"), { codigo: 10 }); };
    expect(await insightsDe("s1", "story", "t", {}, pequeno)).toBeNull();
    expect(valoresDeInsights({ data: [{ name: "views", total_value: { value: 7 } }] })).toEqual({ views: 7 });
  });

  it("posts desde a data: para de paginar quando passa do limite", async () => {
    let chamadas = 0;
    const g = async (url: string) => {
      chamadas++;
      return url.includes("pagina2")
        ? { data: [{ id: "c", timestamp: "2026-09-01T10:00:00+0000" }] }
        : { data: [{ id: "a", timestamp: "2026-11-10T10:00:00+0000" }, { id: "b", timestamp: "2026-10-20T10:00:00+0000" }], paging: { next: "pagina2" } };
    };
    const lidos = await postsDesde("1", "2026-10-15T00:00:00.000Z", "t", g);
    expect(lidos.map((m: { id: string }) => m.id)).toEqual(["a", "b"]); // "c" é de antes do limite
    expect(chamadas).toBe(2); // a 1ª página ainda terminava dentro do período
    chamadas = 0;
    await postsDesde("1", "2026-11-01T00:00:00.000Z", "t", g);
    expect(chamadas).toBe(1); // a 1ª página já passou do limite: não pede a próxima
  });

  it("converte post e story, com a unidade da conta e o tipo Reels", () => {
    const p = postDoGraph({ id: "9", media_type: "VIDEO", media_product_type: "REELS", caption: "x".repeat(400), permalink: "https://ig/p/9", timestamp: "2026-11-10T10:00:00+0000", like_count: 50, comments_count: 4 }, conta, { views: 900, reach: 700 });
    expect(p).toMatchObject({ unidade: "Gama", tipo: "REELS", curtidas: 50, visualizacoes: 900, alcance: 700, salvos: null });
    expect(p.legenda.length).toBe(280);
    const s = storyDoGraph({ id: "8", media_type: "IMAGE", timestamp: "2026-11-12T13:00:00+0000" }, { ...conta, usuario: "worldgymbrasil" }, null);
    expect(s).toMatchObject({ unidade: null, visualizacoes: null });
    expect(imagemDe({ media_type: "VIDEO", media_url: "v.mp4" })).toBeNull();
    expect(imagemDe({ media_type: "VIDEO", thumbnail_url: "capa.jpg" })).toBe("capa.jpg");
    expect(CONTAS_IG["worldgym.aguaslindas"]).toBe("Águas Lindas-GO");
  });

  it("mescla: stories que saíram do ar ficam, números novos substituem, antigos são descartados, seguidores por dia", () => {
    const agora = new Date("2026-11-12T15:00:00Z");
    const antigo = {
      posts: [{ id: "p1", data: "2026-11-01T10:00:00Z", curtidas: 10, midia: true }, { id: "velho", data: "2026-06-01T10:00:00Z", midia: true }],
      stories: [{ id: "s1", data: "2026-11-11T10:00:00Z", visualizacoes: 80, midia: true }],
      seguidores: { "worldgym.gama": { "2026-11-11": 5390 } },
    };
    const { dados, descartados } = mesclar(antigo, { contas: [conta], posts: [{ id: "p1", data: "2026-11-01T10:00:00Z", curtidas: 25 }], stories: [{ id: "s2", data: "2026-11-12T10:00:00Z", visualizacoes: 30 }] }, agora);
    expect(dados.posts).toEqual([{ id: "p1", data: "2026-11-01T10:00:00Z", curtidas: 25, midia: true }]);
    expect(dados.stories.map((s: { id: string }) => s.id)).toEqual(["s2", "s1"]);
    expect(descartados).toEqual(["velho"]);
    expect(dados.seguidores["worldgym.gama"]).toEqual({ "2026-11-11": 5390, "2026-11-12": 5400 });
  });

  it("nível unidades vê só as contas das suas unidades, sem a da marca", () => {
    const dados = { contas: [{ usuario: "worldgym.gama", unidade: "Gama" }, { usuario: "worldgymbrasil", unidade: null }, { usuario: "worldgym.itapoa", unidade: "Itapoã" }], seguidores: { "worldgym.gama": {}, worldgymbrasil: {} }, posts: [{ id: "1", unidade: "Gama" }, { id: "2", unidade: null }], stories: [{ id: "3", unidade: "Itapoã" }], erros: [{ conta: "x" }] };
    const v = filtrarInstagram(dados, { papel: "unidades", unidades: ["Gama"] });
    expect(v.contas.map((c: { usuario: string }) => c.usuario)).toEqual(["worldgym.gama"]);
    expect(Object.keys(v.seguidores)).toEqual(["worldgym.gama"]);
    expect(v.posts.map((p: { id: string }) => p.id)).toEqual(["1"]);
    expect(v.stories).toEqual([]);
    expect(filtrarInstagram(dados, { papel: "dono" })).toBe(dados);
  });
});

const dados: DadosInstagram = {
  geradoEm: "2026-11-12T15:00:00Z",
  contas: [
    { id: "1", usuario: "worldgym.gama", nome: "Gama", unidade: "Gama", seguidores: 5400, posts: 300, foto: null },
    { id: "2", usuario: "worldgymbrasil", nome: "Brasil", unidade: null, seguidores: 90000, posts: 900, foto: null },
  ],
  seguidores: { "worldgym.gama": { "2026-10-20": 5300, "2026-11-12": 5400 } },
  posts: [
    { id: "p1", conta: "worldgym.gama", unidade: "Gama", tipo: "REELS", legenda: "Treino", link: null, data: "2026-11-01T10:00:00Z", curtidas: 40, comentarios: 3, visualizacoes: 1000, alcance: null, salvos: null, compartilhamentos: null, interacoes: null },
    { id: "p2", conta: "worldgym.gama", unidade: "Gama", tipo: "IMAGE", legenda: "", link: null, data: "2026-10-01T10:00:00Z", curtidas: 10, comentarios: 0, visualizacoes: 500, alcance: null, salvos: null, compartilhamentos: null, interacoes: null },
  ],
  stories: [
    { id: "s1", conta: "worldgym.gama", unidade: "Gama", tipo: "IMAGE", link: null, data: "2026-11-12T13:00:00Z", visualizacoes: 80, alcance: null, respostas: 2, compartilhamentos: null, interacoes: null },
    { id: "s2", conta: "worldgym.gama", unidade: "Gama", tipo: "IMAGE", link: null, data: "2026-11-12T01:00:00Z", visualizacoes: 60, alcance: null, respostas: 0, compartilhamentos: null, interacoes: null },
  ],
  erros: [],
};

describe("Instagram: tela", () => {
  it("rede mostra a marca primeiro; unidade só a conta dela", () => {
    expect(contasDaEscolha(dados, null).map((c) => c.usuario)).toEqual(["worldgymbrasil", "worldgym.gama"]);
    expect(contasDaEscolha(dados, "Gama").map((c) => c.usuario)).toEqual(["worldgym.gama"]);
  });

  it("resumo dos últimos 30 dias: posts, stories, dias sem post, ganho de seguidores e média de visualizações", () => {
    const [r] = resumoDasContas(dados, contasDaEscolha(dados, "Gama"), new Date("2026-11-12T15:00:00Z"));
    expect(r).toMatchObject({ postsNoPeriodo: 1, storiesNoPeriodo: 2, diasSemPost: 11, ganhoSeguidores: 100, mediaVisualizacoes: 1000 });
  });

  it("stories por dia de Brasília (01:00 UTC ainda é o dia anterior)", () => {
    expect(storiesPorDia(dados.stories).map(([d, l]) => [d, l.length])).toEqual([["2026-11-12", 1], ["2026-11-11", 1]]);
  });

  it("sem leitura ainda, a tela explica o que falta", () => {
    expect(renderToString(createElement(InstagramTab, { unit: null }))).toContain("Carregando");
  });
});
