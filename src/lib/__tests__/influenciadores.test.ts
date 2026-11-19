import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulos JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import * as inf from "../../../server/influenciadores.js";
// @ts-expect-error módulo JS do servidor
import { filtrarInfluenciadores } from "../../../server/visibilidade.js";
// @ts-expect-error módulo JS do servidor
import instagramApi from "../../../api/instagram.js";
import { dasUnidades, ordenarInfluenciadores, situacaoDoContrato, textoEntregas, vigencia, type Influenciador } from "../../data/influenciadores";

const memoria = () => {
  const m = new Map<string, unknown>();
  return {
    m, async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); },
    async listar(p: string) { return [...m.keys()].filter((k) => k.startsWith(p)); }, async apagar(c: string) { m.delete(c); },
  };
};
const res = () => {
  const r: any = { headers: {} as Record<string, string>, code: 200, body: undefined };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.end = () => r;
  return r;
};
const ok = { usuario: "@Fulano.Fit", unidade: "Gama", inicio: "2026-11-01", fim: null, entregas: { stories: 12, feed: 4, reels: 2 } };
const chama = async (sessao: any, req: any) => { const r = res(); await inf.tratarInfluenciadores({ headers: {}, query: {}, ...req }, r, sessao, filtrarInfluenciadores); return r; };
const dono = { papel: "dono", id: "d" };
const master = { papel: "master", id: "m" };
const gama = { papel: "unidades", unidades: ["Gama"], id: "g" };

describe("cadastro de influenciadores (servidor)", () => {
  beforeEach(() => { definirArmazem(memoria()); inf.limparCacheInfluenciadores(); });
  afterEach(() => { definirArmazem(null); inf.limparCacheInfluenciadores(); });

  it("normaliza o @ (com @, maiúsculas, endereço do perfil) e recusa o que não é um @", () => {
    expect(inf.normalizarUsuario("@Fulano.Fit")).toBe("fulano.fit");
    expect(inf.normalizarUsuario("https://www.instagram.com/Fulano_Fit/?hl=pt")).toBe("fulano_fit");
    expect(inf.normalizarUsuario("instagram.com/a.b")).toBe("a.b");
    for (const ruim of ["", "   ", "com espaço", "a/b", "acentuação", "x".repeat(31), ".começa", "termina.", null, undefined]) expect(inf.normalizarUsuario(ruim as any)).toBeNull();
  });

  it("cria, lista e guarda só o necessário", async () => {
    const novo = await inf.criarInfluenciador({ ...ok, nome: "  Fulano  ", obs: "contrato anual" });
    expect(novo).toMatchObject({ usuario: "fulano.fit", nome: "Fulano", unidade: "Gama", inicio: "2026-11-01", fim: null, ativo: true, entregas: { stories: 12, feed: 4, reels: 2 }, obs: "contrato anual" });
    expect(novo.id).toBeTruthy();
    expect(await inf.listarInfluenciadores()).toHaveLength(1);
    expect(Object.keys(novo).sort()).toEqual(["ativo", "criadoEm", "entregas", "fim", "id", "inicio", "nome", "obs", "unidade", "usuario"]);
  });

  it("aceita a rede toda (unidade nula) e rejeita unidade, datas e quantidades inválidas", async () => {
    expect((await inf.criarInfluenciador({ ...ok, usuario: "rede.toda", unidade: null })).unidade).toBeNull();
    const recusa = (c: object, msg: RegExp) => expect(inf.criarInfluenciador({ ...ok, usuario: "outro", ...c })).rejects.toThrow(msg);
    await recusa({ unidade: "Unidade Inexistente" }, /Unidade desconhecida/);
    await recusa({ inicio: "01/11/2026" }, /data de início/i);
    await recusa({ inicio: "2026-02-30" }, /data de início/i);
    await recusa({ fim: "2026-10-31" }, /antes do início/);
    await recusa({ fim: "ontem" }, /Data de fim/);
    await recusa({ entregas: { stories: 0, feed: 0, reels: 0 } }, /ao menos uma entrega/);
    await recusa({ entregas: { stories: -1, feed: 1, reels: 0 } }, /inválida/);
    await recusa({ entregas: { stories: 1.5, feed: 1, reels: 0 } }, /inválida/);
    await recusa({ entregas: { stories: 1000, feed: 1, reels: 0 } }, /inválida/);
    await recusa({ usuario: "não vale!" }, /@ do Instagram/);
    await recusa({ obs: "x".repeat(201) }, /200 caracteres/);
  });

  it("início e fim são opcionais: dá para cadastrar sem nenhuma data, só com uma delas, e limpar depois", async () => {
    const a = await inf.criarInfluenciador({ ...ok, usuario: "sem.datas", inicio: "", fim: null });
    expect(a).toMatchObject({ inicio: null, fim: null });
    const b = await inf.criarInfluenciador({ ...ok, usuario: "so.fim", inicio: undefined, fim: "2027-01-31" });
    expect(b).toMatchObject({ inicio: null, fim: "2027-01-31" });
    const c = await inf.atualizarInfluenciador(b.id, { inicio: "2026-11-01" });
    expect(c).toMatchObject({ inicio: "2026-11-01", fim: "2027-01-31" });
    const d = await inf.atualizarInfluenciador(c.id, { inicio: "", fim: "" });
    expect(d).toMatchObject({ inicio: null, fim: null });
    await expect(inf.criarInfluenciador({ ...ok, usuario: "invertido", inicio: "2026-11-01", fim: "2026-10-31" })).rejects.toThrow(/antes do início/);
  });

  it("não deixa dois contratos ativos do mesmo @ na mesma unidade; em outra unidade pode; desativado libera", async () => {
    const a = await inf.criarInfluenciador(ok);
    await expect(inf.criarInfluenciador({ ...ok, usuario: "FULANO.fit" })).rejects.toMatchObject({ status: 409 });
    await inf.criarInfluenciador({ ...ok, unidade: "Asa Norte" }); // outra unidade
    await inf.atualizarInfluenciador(a.id, { ativo: false });
    await inf.criarInfluenciador(ok); // o anterior está desativado
    await expect(inf.atualizarInfluenciador(a.id, { ativo: true })).rejects.toMatchObject({ status: 409 });
  });

  it("atualiza só o que veio, remove e dá 404 para id desconhecido", async () => {
    const a = await inf.criarInfluenciador(ok);
    const b = await inf.atualizarInfluenciador(a.id, { entregas: { stories: 20, feed: 0, reels: 1 }, fim: "2027-01-31" });
    expect(b).toMatchObject({ id: a.id, usuario: "fulano.fit", unidade: "Gama", fim: "2027-01-31", entregas: { stories: 20, feed: 0, reels: 1 }, criadoEm: a.criadoEm });
    await inf.removerInfluenciador(a.id);
    expect(await inf.listarInfluenciadores()).toHaveLength(0);
    await expect(inf.removerInfluenciador(a.id)).rejects.toMatchObject({ status: 404 });
    await expect(inf.atualizarInfluenciador("nada", { ativo: false })).rejects.toMatchObject({ status: 404 });
  });

  it("visibilidade: dono e Master veem todos; unidades só os da sua unidade (nem os da rede toda)", async () => {
    await inf.criarInfluenciador(ok);
    await inf.criarInfluenciador({ ...ok, usuario: "asa", unidade: "Asa Norte" });
    await inf.criarInfluenciador({ ...ok, usuario: "rede", unidade: null });
    const nomes = async (s: any) => (await chama(s, { method: "GET" })).body.influenciadores.map((x: any) => x.usuario).sort();
    expect(await nomes(dono)).toEqual(["asa", "fulano.fit", "rede"]);
    expect(await nomes(master)).toEqual(["asa", "fulano.fit", "rede"]);
    expect(await nomes(gama)).toEqual(["fulano.fit"]);
  });

  it("rota: o dono grava tudo (cadastra, edita, remove, rede toda); ação inválida e método errado são recusados", async () => {
    const feito = await chama(dono, { method: "POST", body: { acao: "criar", ...ok } });
    expect(feito.code).toBe(200);
    const id = feito.body.influenciador.id;
    expect((await chama(dono, { method: "POST", body: JSON.stringify({ acao: "atualizar", id, ativo: false }) })).code).toBe(200);
    expect((await chama(dono, { method: "POST", body: { acao: "criar", ...ok, usuario: "rede", unidade: null } })).code).toBe(200);
    expect((await chama(dono, { method: "POST", body: { acao: "criar", ...ok, unidade: "Nenhuma" } })).code).toBe(400);
    expect((await chama(dono, { method: "POST", body: { acao: "faz-nada" } })).code).toBe(400);
    expect((await chama(dono, { method: "POST", body: { acao: "remover", id } })).code).toBe(200);
    expect((await chama(dono, { method: "PUT" })).code).toBe(405);
  });

  it("rota: o Master cadastra, edita e remove em qualquer unidade e na rede toda", async () => {
    const a = await chama(master, { method: "POST", body: { acao: "criar", ...ok } });
    expect(a.code).toBe(200);
    expect((await chama(master, { method: "POST", body: { acao: "criar", ...ok, usuario: "outra", unidade: "Asa Norte" } })).code).toBe(200);
    expect((await chama(master, { method: "POST", body: { acao: "criar", ...ok, usuario: "rede", unidade: null } })).code).toBe(200);
    const id = a.body.influenciador.id;
    expect((await chama(master, { method: "POST", body: { acao: "atualizar", id, entregas: { stories: 5, feed: 1, reels: 0 } } })).code).toBe(200);
    expect((await chama(master, { method: "POST", body: { acao: "atualizar", id, ativo: false } })).code).toBe(200);
    expect((await chama(master, { method: "POST", body: JSON.stringify({ acao: "remover", id }) })).code).toBe(200);
    expect(await inf.listarInfluenciadores()).toHaveLength(2);
  });

  it("rota: nível desconhecido não grava", async () => {
    expect((await chama({ papel: "visitante" }, { method: "POST", body: { acao: "criar", ...ok } })).code).toBe(403);
    expect(await inf.listarInfluenciadores()).toHaveLength(0);
  });

  it("rota: quem tem acesso por unidades cadastra, edita e remove só na sua unidade; rede toda e outras unidades não", async () => {
    // cadastra na própria unidade
    const meu = await chama(gama, { method: "POST", body: { acao: "criar", ...ok } });
    expect(meu.code).toBe(200);
    const id = meu.body.influenciador.id;
    // não cadastra em outra unidade nem na rede toda
    expect((await chama(gama, { method: "POST", body: { acao: "criar", ...ok, usuario: "outro", unidade: "Asa Norte" } })).code).toBe(403);
    expect((await chama(gama, { method: "POST", body: { acao: "criar", ...ok, usuario: "outro", unidade: null } })).code).toBe(403);
    // edita e desativa o seu; não passa o contrato para outra unidade
    expect((await chama(gama, { method: "POST", body: { acao: "atualizar", id, entregas: { stories: 8, feed: 2, reels: 1 } } })).code).toBe(200);
    expect((await chama(gama, { method: "POST", body: { acao: "atualizar", id, ativo: false } })).code).toBe(200);
    expect((await chama(gama, { method: "POST", body: { acao: "atualizar", id, unidade: "Asa Norte" } })).code).toBe(403);
    expect((await inf.listarInfluenciadores())[0]).toMatchObject({ unidade: "Gama", ativo: false, entregas: { stories: 8, feed: 2, reels: 1 } });
    // remove o seu
    expect((await chama(gama, { method: "POST", body: { acao: "remover", id } })).code).toBe(200);
    expect(await inf.listarInfluenciadores()).toHaveLength(0);
  });

  it("rota: a unidade não enxerga nem mexe no contrato de outra unidade (responde como se não existisse)", async () => {
    const asa = await inf.criarInfluenciador({ ...ok, usuario: "asa", unidade: "Asa Norte" });
    const rede = await inf.criarInfluenciador({ ...ok, usuario: "rede", unidade: null });
    for (const alvo of [asa, rede]) {
      expect((await chama(gama, { method: "POST", body: { acao: "atualizar", id: alvo.id, ativo: false } })).code).toBe(404);
    }
    for (const alvo of [asa, rede]) expect((await chama(gama, { method: "POST", body: { acao: "remover", id: alvo.id } })).code).toBe(404);
    expect(await inf.listarInfluenciadores()).toHaveLength(2);
    expect((await inf.listarInfluenciadores()).every((x: any) => x.ativo)).toBe(true);
    expect((await chama(gama, { method: "POST", body: { acao: "atualizar", id: "inexistente", ativo: false } })).code).toBe(404);
  });

  it("rota: o dono em 'ver como' uma unidade vale como essa unidade (só a dela)", async () => {
    const sim = { ...gama, papelReal: "dono" };
    expect((await chama(sim, { method: "POST", body: { acao: "criar", ...ok } })).code).toBe(200);
    expect((await chama(sim, { method: "POST", body: { acao: "criar", ...ok, usuario: "outro", unidade: "Asa Norte" } })).code).toBe(403);
  });
});

describe("rota /api/instagram segue pedindo login para o cadastro", () => {
  it("sem sessão não devolve nada", async () => {
    process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste";
    try {
      const r = res();
      await instagramApi({ method: "GET", headers: {}, query: { influenciadores: "1" } }, r);
      expect([401, 503]).toContain(r.code);
      expect(r.body?.influenciadores).toBeUndefined();
    } finally { delete process.env.DASHBOARD_PASSWORD; }
  });
});

describe("regras da tela de influenciadores", () => {
  const base = (p: Partial<Influenciador>): Influenciador => ({ id: p.usuario ?? "x", usuario: "a", unidade: "Gama", inicio: "2026-11-01", fim: null, entregas: { stories: 1, feed: 0, reels: 0 }, ativo: true, criadoEm: "2026-11-01T00:00:00Z", ...p });

  it("situação do contrato pela data e pelo desligamento", () => {
    expect(situacaoDoContrato(base({}), "2026-11-19")).toBe("vigente");
    expect(situacaoDoContrato(base({ inicio: "2026-12-01" }), "2026-11-19")).toBe("futuro");
    expect(situacaoDoContrato(base({ fim: "2026-11-18" }), "2026-11-19")).toBe("encerrado");
    expect(situacaoDoContrato(base({ fim: "2026-11-19" }), "2026-11-19")).toBe("vigente"); // o último dia ainda vale
    expect(situacaoDoContrato(base({ ativo: false }), "2026-11-19")).toBe("inativo");
    expect(situacaoDoContrato(base({ inicio: null }), "2026-11-19")).toBe("vigente"); // sem início: vale desde sempre
    expect(situacaoDoContrato(base({ inicio: null, fim: "2026-11-18" }), "2026-11-19")).toBe("encerrado");
  });

  it("texto das entregas só traz o que foi combinado, no singular e no plural", () => {
    expect(textoEntregas({ stories: 12, feed: 4, reels: 2 })).toBe("12 stories · 4 posts no feed · 2 reels por mês");
    expect(textoEntregas({ stories: 1, feed: 1, reels: 1 })).toBe("1 story · 1 post no feed · 1 reel por mês");
    expect(textoEntregas({ stories: 0, feed: 0, reels: 3 })).toBe("3 reels por mês");
    expect(textoEntregas({ stories: 0, feed: 0, reels: 0 })).toBe("Nada combinado");
  });

  it("vigência com e sem data de fim", () => {
    expect(vigencia({ inicio: "2026-11-01", fim: "2027-01-31" })).toBe("01/11/2026 a 31/01/2027");
    expect(vigencia({ inicio: "2026-11-01", fim: null })).toBe("desde 01/11/2026, sem data de fim");
    expect(vigencia({ inicio: null, fim: "2027-01-31" })).toBe("até 31/01/2027");
    expect(vigencia({ inicio: null, fim: null })).toBe("sem datas definidas");
  });

  it("ordena em vigor primeiro, depois por unidade (rede toda por último) e @; o filtro da unidade só deixa a dela", () => {
    const lista = [
      base({ usuario: "z", unidade: "Gama", fim: "2026-01-31" }), // encerrado
      base({ usuario: "b", unidade: null }),
      base({ usuario: "c", unidade: "Gama" }),
      base({ usuario: "a", unidade: "Asa Norte" }),
      base({ usuario: "d", unidade: "Gama", ativo: false }),
    ];
    expect(ordenarInfluenciadores(lista, "2026-11-19").map((i) => i.usuario)).toEqual(["a", "c", "b", "z", "d"]);
    expect(dasUnidades(lista, "Gama").map((i) => i.usuario).sort()).toEqual(["c", "d", "z"]);
    expect(dasUnidades(lista, null)).toHaveLength(5);
  });
});
