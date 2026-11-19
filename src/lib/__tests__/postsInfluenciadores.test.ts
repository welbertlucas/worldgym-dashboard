import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import * as p from "../../../server/postsInfluenciadores.js";

const erro = (codigo: number, mensagem = "erro do Meta") => Object.assign(new Error(mensagem), { codigo });
const AGORA = new Date("2026-11-19T12:00:00Z");

describe("Posts do influenciador: tipo e menção às contas da rede", () => {
  it("reels pelo tipo do Meta ou pelo endereço; o resto é feed", () => {
    expect(p.tipoDoPost({ media_product_type: "REELS" })).toBe("reels");
    expect(p.tipoDoPost({ media_product_type: "FEED", permalink: "https://www.instagram.com/p/abc/" })).toBe("feed");
    expect(p.tipoDoPost({ permalink: "https://www.instagram.com/reel/abc/" })).toBe("reels");
    expect(p.tipoDoPost({ permalink: "https://www.instagram.com/reels/abc/" })).toBe("reels");
    expect(p.tipoDoPost({})).toBe("feed");
  });

  it("cita a conta como @conta, sem confundir com outra conta nem com texto solto", () => {
    const h = ["worldgym.gama", "worldgymbrasil", "worldgym.itapoa"];
    expect(p.contasCitadas("Treinando na @worldgym.gama hoje!", h)).toEqual(["worldgym.gama"]);
    expect(p.contasCitadas("Parceria com @WorldGymBrasil e @worldgym.itapoa.", h).sort()).toEqual(["worldgym.itapoa", "worldgymbrasil"]); // ponto final da frase
    expect(p.contasCitadas("@worldgym.gama.br não é a mesma conta", h)).toEqual([]);
    expect(p.contasCitadas("meuworldgymbrasil @outro", h)).toEqual([]);
    expect(p.contasCitadas("sem arroba: worldgym.gama", h)).toEqual([]);
    expect(p.contasCitadas("email fulano@worldgym.gama.com", h)).toEqual([]);
    expect(p.contasCitadas("(@worldgym.gama)", h)).toEqual(["worldgym.gama"]);
    expect(p.contasCitadas(null, h)).toEqual([]);
  });
});

describe("Posts do influenciador: leitura pelo Business Discovery", () => {
  const post = (id: string, ts: string, extra: object = {}) => ({ id, timestamp: ts, permalink: `https://instagram.com/p/${id}/`, media_product_type: "FEED", caption: "x", ...extra });

  it("lê a primeira página e para quando chega a posts mais antigos que o limite", async () => {
    const pedidos: string[] = [];
    const g = async (c: string) => { pedidos.push(decodeURIComponent(c)); return { business_discovery: { media: { data: [post("a", "2026-11-18T10:00:00+0000"), post("b", "2026-08-01T10:00:00+0000")], paging: { cursors: { after: "CUR" } } } } }; };
    const r = await p.lerPostsDoPerfil("123", "fulano", "T", "2026-08-21T00:00:00Z", g);
    expect(r.ok).toBe(true);
    expect(r.posts.map((x: any) => x.id)).toEqual(["a"]); // o de agosto é mais velho que o limite
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toContain("business_discovery.username(fulano){media.limit(50){id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count}}");
  });

  it("segue a paginação pelo cursor até 3 páginas", async () => {
    let n = 0;
    const pedidos: string[] = [];
    const g = async (c: string) => {
      pedidos.push(decodeURIComponent(c));
      n++;
      return { business_discovery: { media: { data: [post(`p${n}`, "2026-11-10T10:00:00+0000")], paging: { cursors: { after: `C${n}` } } } } };
    };
    const r = await p.lerPostsDoPerfil("123", "fulano", "T", "2026-08-21T00:00:00Z", g);
    expect(r.posts).toHaveLength(3);
    expect(pedidos[1]).toContain("media.after(C1).limit(50)");
    expect(pedidos[2]).toContain("media.after(C2).limit(50)");
  });

  it("se o Meta recusa um campo (erro 100), repete só com o essencial", async () => {
    const campos: string[] = [];
    const g = async (c: string) => {
      campos.push(decodeURIComponent(c));
      if (campos.length === 1) throw erro(100, "field not allowed");
      return { business_discovery: { media: { data: [post("a", "2026-11-18T10:00:00+0000")] } } };
    };
    const r = await p.lerPostsDoPerfil("123", "fulano", "T", "2026-08-21T00:00:00Z", g);
    expect(r.ok).toBe(true);
    expect(campos[1]).toContain("{id,caption,media_type,timestamp,permalink}");
    expect(campos[1]).not.toContain("like_count");
  });

  it("falha do Meta: devolve o motivo sem o segredo; limite de uso é temporário", async () => {
    const r = await p.lerPostsDoPerfil("1", "x", "SEGREDO", "2026-01-01T00:00:00Z", async () => { throw erro(110, "Invalid user id"); });
    expect(r).toMatchObject({ ok: false, temporario: false });
    expect(JSON.stringify(r)).not.toContain("SEGREDO");
    expect((await p.lerPostsDoPerfil("1", "x", "T", "2026-01-01T00:00:00Z", async () => { throw erro(4); })).temporario).toBe(true);
  });

  it("marcações: lê a rota /tags da conta e normaliza", async () => {
    const g = async (c: string) => { expect(decodeURIComponent(c)).toContain("1/tags?fields=id,username,permalink,timestamp&limit=50"); return { data: [{ id: 7, username: "Fulano", permalink: "https://instagram.com/p/7/" }, { id: 8 }] }; };
    expect(await p.lerMarcacoes("1", "T", g)).toEqual([{ id: "7", link: "https://instagram.com/p/7/", usuario: "fulano" }, { id: "8", link: null, usuario: "" }]);
  });
});

describe("Posts do influenciador: o que fica guardado", () => {
  it("guarda o essencial, corta a legenda, e junta o que a legenda cita com o que o post marca", () => {
    const crus = [
      { id: "1", timestamp: "2026-11-18T10:00:00+0000", permalink: "https://instagram.com/reel/1/", media_product_type: "REELS", caption: "Treino na @worldgym.gama\n\n  top!  " + "y".repeat(300), like_count: 80, comments_count: 5 },
      { id: "2", timestamp: "2026-11-17T10:00:00+0000", permalink: "https://instagram.com/p/2/", media_product_type: "FEED", caption: "sem citar", like_count: 3, comments_count: 0 },
      { id: "3", timestamp: "2026-05-01T10:00:00+0000", permalink: "https://instagram.com/p/3/", caption: "muito antigo" },
    ];
    const marcacoes = p.indexarMarcacoes({ "worldgymbrasil": [{ id: "2", link: "https://instagram.com/p/2/", usuario: "fulano" }, { id: "99", link: null, usuario: "outra.pessoa" }] }, ["fulano"]);
    const posts = p.montarPosts(crus, ["worldgym.gama", "worldgymbrasil"], marcacoes, AGORA);
    expect(posts.map((x: any) => x.id)).toEqual(["1", "2"]); // o de maio passou de 90 dias
    expect(posts[0]).toMatchObject({ tipo: "reels", citou: ["worldgym.gama"], curtidas: 80, comentarios: 5, link: "https://instagram.com/reel/1/" });
    expect(posts[0].legenda.length).toBe(160);
    expect(posts[0].legenda.startsWith("Treino na @worldgym.gama top!")).toBe(true);
    expect(posts[1]).toMatchObject({ tipo: "feed", citou: ["worldgymbrasil"] }); // marcado na imagem, não na legenda
    expect(posts.every((x: any) => x.citou)).toBe(true);
  });

  it("marcação de quem não é influenciador cadastrado é ignorada", () => {
    const m = p.indexarMarcacoes({ "worldgym.gama": [{ id: "5", link: null, usuario: "desconhecido" }] }, ["fulano"]);
    expect(m.size).toBe(0);
  });
});
