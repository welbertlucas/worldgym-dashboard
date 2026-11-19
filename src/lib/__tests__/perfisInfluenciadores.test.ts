import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulos JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import * as inf from "../../../server/influenciadores.js";
// @ts-expect-error módulo JS do servidor
import * as perfis from "../../../server/perfisInfluenciadores.js";
// @ts-expect-error módulo JS do servidor
import { filtrarInfluenciadores } from "../../../server/visibilidade.js";
import { seguidoresCompacto } from "../../data/influenciadores";

const memoria = () => {
  const m = new Map<string, unknown>();
  return {
    m, async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); },
    async listar(p: string) { return [...m.keys()].filter((k) => k.startsWith(p)); }, async apagar(c: string) { m.delete(c); },
  };
};
const erro = (codigo: number, mensagem = "erro do Meta") => Object.assign(new Error(mensagem), { codigo });

describe("Perfil do influenciador: leitura pelo Business Discovery", () => {
  it("lê seguidores, publicações e o endereço da foto, pedindo o campo da foto", async () => {
    const pedidos: string[] = [];
    const g = async (caminho: string) => { pedidos.push(decodeURIComponent(caminho)); return { business_discovery: { username: "fulano", followers_count: 14417, media_count: 320, profile_picture_url: "https://cdn/foto.jpg" } }; };
    const r = await perfis.lerPerfil("123", "fulano.fit", "TOKEN", g);
    expect(r).toEqual({ ok: true, seguidores: 14417, publicacoes: 320, fotoUrl: "https://cdn/foto.jpg", semFoto: false });
    expect(pedidos[0]).toContain("123?fields=business_discovery.username(fulano.fit){username,followers_count,media_count,profile_picture_url}");
    expect(pedidos).toHaveLength(1);
  });

  it("se o Meta recusa o campo da foto (erro 100), lê só os números e avisa que ficou sem foto", async () => {
    const campos: string[] = [];
    const g = async (caminho: string) => {
      campos.push(decodeURIComponent(caminho));
      if (campos.length === 1) throw erro(100, "Tried accessing nonexisting field (profile_picture_url)");
      return { business_discovery: { followers_count: 900, media_count: 12 } };
    };
    const r = await perfis.lerPerfil("123", "fulano", "T", g);
    expect(r).toEqual({ ok: true, seguidores: 900, publicacoes: 12, fotoUrl: null, semFoto: true });
    expect(campos[1]).not.toContain("profile_picture_url");
  });

  it("conta pessoal ou inexistente: falha definitiva com a mensagem para a tela; limite de uso: falha temporária", async () => {
    const pessoal = await perfis.lerPerfil("1", "x", "T", async () => { throw erro(110, "Invalid user id"); });
    expect(pessoal).toMatchObject({ ok: false, temporario: false, erro: perfis.MENSAGEM_NAO_LIDO });
    expect(pessoal.detalhe).toContain("Invalid user id");
    const limite = await perfis.lerPerfil("1", "x", "T", async () => { throw erro(4, "Application request limit reached"); });
    expect(limite).toMatchObject({ ok: false, temporario: true });
    const semDados = await perfis.lerPerfil("1", "x", "T", async () => ({}));
    expect(semDados).toMatchObject({ ok: false, temporario: false });
    // erro 100 e depois erro de novo: conta como falha, sem laço
    let n = 0;
    const duplo = await perfis.lerPerfil("1", "x", "T", async () => { n++; throw erro(100); });
    expect(duplo.ok).toBe(false);
    expect(n).toBe(2);
  });

  it("o segredo nunca vai nas mensagens guardadas", async () => {
    const r = await perfis.lerPerfil("1", "x", "SEGREDO-DO-TOKEN", async () => { throw erro(190, "Invalid OAuth access token"); });
    expect(JSON.stringify(r)).not.toContain("SEGREDO-DO-TOKEN");
  });
});

describe("Perfil do influenciador: o que fica guardado", () => {
  const agora = new Date("2026-11-19T12:00:00Z");
  const ok = { ok: true, seguidores: 1000, publicacoes: 10, fotoUrl: null, semFoto: false };

  it("leitura boa guarda os números e a foto; foto nova só quando falta ou passou de 7 dias", () => {
    expect(perfis.perfilNovo(undefined, ok, { foto: true, fotoEm: agora.toISOString() }, agora)).toEqual({ seguidores: 1000, publicacoes: 10, foto: true, fotoEm: agora.toISOString(), atualizadoEm: agora.toISOString() });
    expect(perfis.precisaDeFoto(undefined, agora)).toBe(true);
    expect(perfis.precisaDeFoto({ foto: false }, agora)).toBe(true);
    expect(perfis.precisaDeFoto({ foto: true, fotoEm: "2026-11-15T12:00:00Z" }, agora)).toBe(false);
    expect(perfis.precisaDeFoto({ foto: true, fotoEm: "2026-11-10T12:00:00Z" }, agora)).toBe(true);
  });

  it("sem foto no Meta: marca semFoto só quando também não há foto guardada", () => {
    expect(perfis.perfilNovo(undefined, { ...ok, semFoto: true }, { foto: false, fotoEm: null }, agora)).toMatchObject({ foto: false, semFoto: true });
    expect(perfis.perfilNovo(undefined, { ...ok, semFoto: true }, { foto: true, fotoEm: "x" }, agora).semFoto).toBeUndefined();
  });

  it("erro temporário repete o que já se sabia; erro definitivo guarda o aviso e mantém foto e seguidores antigos", () => {
    const velho = { seguidores: 500, publicacoes: 5, foto: true, fotoEm: "2026-11-18T00:00:00Z", atualizadoEm: "2026-11-18T00:00:00Z" };
    expect(perfis.perfilNovo(velho, { ok: false, temporario: true, erro: "x", detalhe: "d" }, { foto: true, fotoEm: velho.fotoEm }, agora)).toBe(velho);
    const def = perfis.perfilNovo(velho, { ok: false, temporario: false, erro: perfis.MENSAGEM_NAO_LIDO, detalhe: "d" }, { foto: true, fotoEm: velho.fotoEm }, agora);
    expect(def).toMatchObject({ seguidores: 500, foto: true, erro: perfis.MENSAGEM_NAO_LIDO });
    expect(perfis.perfilNovo(undefined, { ok: false, temporario: true, erro: "e", detalhe: "d" }, { foto: false, fotoEm: null }, agora)).toMatchObject({ seguidores: null, foto: false, erro: "e" });
  });

  it("o id da foto nunca é só número (não se confunde com post ou story)", () => { expect(perfis.idDaFoto("fulano.fit")).toBe("perfil-fulano.fit"); });
});

describe("Rotas: perfis na lista e a foto", () => {
  beforeEach(() => { definirArmazem(memoria()); inf.limparCacheInfluenciadores(); });
  afterEach(() => { definirArmazem(null); inf.limparCacheInfluenciadores(); });

  const res = () => {
    const r: any = { headers: {} as Record<string, string>, code: 200, body: undefined };
    r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
    r.status = (c: number) => { r.code = c; return r; };
    r.json = (b: unknown) => { r.body = b; return r; };
    r.send = (b: unknown) => { r.body = b; return r; };
    r.end = () => r;
    return r;
  };
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const imagem = async (id: string) => (id === "perfil-gama.fit" ? new Blob([JPEG]).stream() : null);
  const chama = async (sessao: any, query: any) => { const r = res(); await inf.tratarInfluenciadores({ method: "GET", headers: {}, query }, r, sessao, filtrarInfluenciadores, { imagem }); return r; };
  const ok = { inicio: null, fim: null, entregas: { stories: 1, feed: 0, reels: 0 } };
  const dono = { papel: "dono" };
  const gama = { papel: "unidades", unidades: ["Gama"] };

  beforeEach(async () => {
    await inf.criarInfluenciador({ ...ok, usuario: "gama.fit", unidade: "Gama" });
    await inf.criarInfluenciador({ ...ok, usuario: "asa.fit", unidade: "Asa Norte" });
    await perfis.gravarPerfis({
      "gama.fit": { seguidores: 14417, publicacoes: 300, foto: true, fotoEm: "2026-11-19T00:00:00Z", erro: null, detalhe: "não vai para a tela", atualizadoEm: "x" },
      "asa.fit": { seguidores: 100, publicacoes: 1, foto: true, erro: null },
      "velho.removido": { seguidores: 1, foto: true },
    });
  });

  it("a lista traz os perfis só de quem a pessoa vê, sem campos internos", async () => {
    const d = await chama(dono, { influenciadores: "1" });
    expect(Object.keys(d.body.perfis).sort()).toEqual(["asa.fit", "gama.fit"]);
    expect(d.body.perfis["gama.fit"]).toEqual({ seguidores: 14417, publicacoes: 300, foto: true, erro: null });
    const u = await chama(gama, { influenciadores: "1" });
    expect(Object.keys(u.body.perfis)).toEqual(["gama.fit"]);
    expect(JSON.stringify(u.body)).not.toContain("não vai para a tela");
  });

  it("a foto sai como JPEG para quem vê o influenciador; de outra unidade, sem imagem guardada ou fora do cadastro: 404", async () => {
    const r = await chama(gama, { perfil: "gama.fit" });
    expect(r.code).toBe(200);
    expect(r.headers["Content-Type"]).toBe("image/jpeg");
    expect([...r.body]).toEqual([...JPEG]);
    expect((await chama(gama, { perfil: "asa.fit" })).code).toBe(404); // de outra unidade
    expect((await chama(dono, { perfil: "asa.fit" })).code).toBe(404); // sem imagem guardada de verdade
    expect((await chama(dono, { perfil: "velho.removido" })).code).toBe(404); // saiu do cadastro
    expect((await chama(dono, { perfil: "nao.existe" })).code).toBe(404);
  });
});

describe("Seguidores em formato curto", () => {
  it("mil e milhão em português", () => {
    const normal = (t: string) => t.replace(/\u00a0/g, " "); // o formato do navegador usa espaço que não quebra linha
    expect(normal(seguidoresCompacto(14417))).toBe("14,4 mil");
    expect(normal(seguidoresCompacto(950))).toBe("950");
    expect(normal(seguidoresCompacto(2500000))).toBe("2,5 mi");
  });
});
