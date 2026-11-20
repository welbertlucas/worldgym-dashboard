import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulos JS do servidor
import { definirArmazem, gravarJson } from "../../../server/armazem.js";
// @ts-expect-error módulos JS do servidor
import * as acesso from "../../../server/acesso.js";
// @ts-expect-error módulos JS do servidor
import { criarToken, criarTokenUsuario, lerToken, exigirLogin, sessaoDaRequisicao, INATIVIDADE_MS, INATIVIDADE_UNIDADES_MS, TETO_SESSAO_MS } from "../../../api/_auth.js";
// @ts-expect-error módulos JS do servidor
import login from "../../../api/login.js";
// @ts-expect-error módulos JS do servidor
import usuarios from "../../../api/usuarios.js";
// @ts-expect-error módulos JS do servidor
import senhaApi from "../../../api/senha.js";
// @ts-expect-error módulos JS do servidor
import atividadeApi from "../../../api/atividade.js";
// @ts-expect-error módulos JS do servidor
import royaltiesApi from "../../../api/royalties.js";
// @ts-expect-error módulos JS do servidor
import * as avisos from "../../../server/avisos.js";
// @ts-expect-error módulos JS do servidor
import * as vis from "../../../server/visibilidade.js";

const memoria = () => {
  const m = new Map<string, unknown>();
  return {
    m, async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); },
    async listar(p: string) { return [...m.keys()].filter((k) => k.startsWith(p)); }, async apagar(c: string) { m.delete(c); },
    async gravarBytes(c: string, b: Buffer) { m.set(c, b); }, async lerBytes(c: string) { return (m.get(c) as Buffer) ?? null; },
  };
};
const res = () => {
  const r: any = { headers: {} as Record<string, string>, code: 200, body: undefined };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.end = () => r;
  r.send = (b: unknown) => { r.body = b; return r; };
  return r;
};
const chama = async (h: any, req: any) => { const r = res(); await h({ headers: {}, query: {}, ...req }, r); return r; };
// Acesso novo nasce com senha provisória e só vê dados depois de escolher a própria.
const trocaSenha = (id: string, provisoria: string) => acesso.definirNovaSenha(id, provisoria, "senha-propria-de-teste-1");
const com = (token: string, extra: any = {}) => ({ headers: { authorization: `Bearer ${token}` }, ...extra });

describe("acessos, níveis e registro", () => {
  beforeEach(() => {
    process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste";
    definirArmazem(memoria());
    acesso.limparCache();
    acesso.limparFreio();
  });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; delete process.env.SESSAO_SEGREDO; definirArmazem(null); acesso.limparCache(); });

  it("senha embaralhada: confere a certa e recusa a errada", () => {
    const h = acesso.hashSenha("uma-senha-longa");
    expect(h).not.toContain("uma-senha-longa");
    expect(acesso.conferirSenha("uma-senha-longa", h)).toBe(true);
    expect(acesso.conferirSenha("outra", h)).toBe(false);
    expect(acesso.conferirSenha("x", "lixo")).toBe(false);
  });

  it("na transição a senha única ainda entra; criado o dono, ela e os tokens antigos deixam de valer", async () => {
    const antigo = criarToken().token;
    expect((await chama(login, { method: "POST", body: { senha: "senha-unica-de-teste" } })).code).toBe(200);
    expect(await exigirLogin(com(antigo), res())).toMatchObject({ papel: "dono" });

    await acesso.criarDono({ nome: "Dono", email: "Dono@Exemplo.com", senha: "senha-do-dono-123" });
    acesso.limparCache();
    expect((await chama(login, { method: "POST", body: { senha: "senha-unica-de-teste" } })).code).toBe(401);
    expect(await exigirLogin(com(antigo), res())).toBe(false);
  });

  it("login por e-mail e senha devolve token que identifica a pessoa; senha errada não entra", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const errado = await chama(login, { method: "POST", body: { email: "dono@exemplo.com", senha: "errada-errada" } });
    expect(errado.code).toBe(401);
    const ok = await chama(login, { method: "POST", body: { email: " DONO@exemplo.com ", senha: "senha-do-dono-123" } });
    expect(ok.code).toBe(200);
    expect(ok.body.usuario).toMatchObject({ papel: "dono", email: "dono@exemplo.com" });
    expect(JSON.stringify(ok.body)).not.toContain("hash");
    const sessao = await exigirLogin(com(ok.body.token), res());
    expect(sessao).toMatchObject({ papel: "dono", nome: "Dono" });
  });

  it("registra as entradas e as tentativas erradas de e-mail que existe (e ignora e-mail que não existe)", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    await chama(login, { method: "POST", body: { email: "dono@exemplo.com", senha: "errada-errada" } });
    await chama(login, { method: "POST", body: { email: "ninguem@exemplo.com", senha: "qualquer" } });
    await chama(login, { method: "POST", body: { email: "dono@exemplo.com", senha: "senha-do-dono-123" } });
    const reg = await acesso.lerRegistro();
    expect(reg.map((r: any) => [r.email, r.ok])).toEqual([["dono@exemplo.com", true], ["dono@exemplo.com", false]]);
  });

  it("registra a atividade em lote (telas e exportações) e só o dono a lê; evento inválido e ver como não entram", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const m = await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "criar", nome: "Maria", email: "maria@exemplo.com", papel: "master" } }));
    await trocaSenha(m.body.usuario.id, m.body.senhaProvisoria);
    const tokenMaria = criarTokenUsuario(m.body.usuario.id).token;
    const manda = (token: string, body: any, extra: any = {}) => chama(atividadeApi, com(token, { method: "POST", body, ...extra }));

    const agora = Date.now();
    const lote = await manda(tokenMaria, { eventos: [
      { tela: "comercial/vendas", unidade: "Gama", mes: "2026-10", em: agora - 60_000 },
      { tela: "benchmark/posicao", evento: "exportar", em: agora },
      { tela: "<script>" }, // inválida: ignorada
      { tela: "financeiro", evento: "apagar" }, // evento inválido: ignorado
    ] });
    expect(lote.code).toBe(200);
    expect(lote.body.gravados).toBe(2);
    expect((await manda(tokenMaria, { tela: "financeiro" })).code).toBe(400); // formato antigo (sem lista)
    expect((await chama(atividadeApi, { method: "POST", body: { eventos: [{ tela: "financeiro" }] } })).code).toBe(401);
    // O dono simulando outro nível ("ver como") não polui o registro.
    const vc = await manda(tokenDono, { eventos: [{ tela: "alunos/base" }] }, { headers: { authorization: `Bearer ${tokenDono}`, "x-atlas-ver-como": "master" } });
    expect(vc.body.gravados).toBe(0);
    // Horário do navegador no futuro ou muito antigo é limitado a agora / 24 horas atrás.
    await manda(tokenMaria, { eventos: [{ tela: "alunos/base", unidade: "<b>x</b>", mes: "outubro", em: agora + 9e9 }] });

    const lida = await chama(usuarios, com(tokenDono, { method: "GET", query: { atividade: "1" } }));
    expect(lida.code).toBe(200);
    expect(lida.body.atividade.map((a: any) => [a.tela, a.evento, a.unidade, a.mes])).toEqual([
      ["alunos/base", "tela", null, null], ["benchmark/posicao", "exportar", null, null], ["comercial/vendas", "tela", "Gama", "2026-10"],
    ]);
    expect(Date.parse(lida.body.atividade[0].em)).toBeLessThanOrEqual(Date.now());
    // Só o dono lê: nem Master sem a permissão, nem Master liberado a gerenciar acessos.
    expect((await chama(usuarios, com(tokenMaria, { method: "GET", query: { atividade: "1" } }))).code).toBe(403);
    await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "atualizar", id: m.body.usuario.id, gerenciaAcessos: true } }));
    acesso.limparCache();
    expect((await chama(usuarios, com(tokenMaria, { method: "GET", query: { atividade: "1" } }))).code).toBe(403);
    expect((await chama(usuarios, com(tokenMaria, { method: "GET", query: { registro: "1" } }))).code).toBe(200);
  });

  it("retenção: apaga atividade e entradas com mais de 90 dias, sem tocar em usuários nem backups", async () => {
    const mem = memoria();
    definirArmazem(mem);
    const agora = Date.parse("2026-11-15T15:00:00Z");
    const dia = (n: number) => new Date(agora - n * 86400000).toISOString().slice(0, 10);
    for (const n of [0, 30, 89, 91, 200]) mem.m.set(`acesso/atividade-${dia(n)}.json`, [{ x: 1 }]);
    for (const k of ["2026-11", "2026-08", "2026-07", "2026-06", "2025-01"]) mem.m.set(`acesso/log-${k}.json`, [{ x: 1 }]);
    mem.m.set("acesso/usuarios.json", [{ id: "u" }]);
    mem.m.set("backup/usuarios-2026-11-14.enc", "x");
    // Corte = 17/08/2026: o log de agosto ainda tem dias dentro dos 90; junho e julho saem.
    const apagados = await acesso.limparRegistrosAntigos(agora);
    expect(apagados.sort()).toEqual([`acesso/atividade-${dia(200)}.json`, `acesso/atividade-${dia(91)}.json`, "acesso/log-2025-01.json", "acesso/log-2026-06.json", "acesso/log-2026-07.json"].sort());
    expect([...mem.m.keys()].sort()).toEqual([
      "acesso/log-2026-08.json", "acesso/log-2026-11.json", `acesso/atividade-${dia(0)}.json`, `acesso/atividade-${dia(30)}.json`, `acesso/atividade-${dia(89)}.json`, "acesso/usuarios.json", "backup/usuarios-2026-11-14.enc",
    ].sort());
  });

  it("a limpeza roda sozinha no primeiro registro do dia", async () => {
    const mem = memoria();
    definirArmazem(mem);
    const agora = Date.parse("2026-11-15T15:00:00Z");
    mem.m.set("acesso/atividade-2026-05-01.json", [{ x: 1 }]);
    await acesso.registrarAtividade({ usuario: { id: "u1", nome: "A", email: "a@x.com" }, eventos: [{ tela: "financeiro" }] }, agora);
    expect(mem.m.has("acesso/atividade-2026-05-01.json")).toBe(false);
    expect(mem.m.has("acesso/atividade-2026-11-15.json")).toBe(true);
  });

  it("só o dono cria acessos; master e unidades levam 403; o dono não é rebaixado nem desativado", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const m = await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "criar", nome: "Maria", email: "maria@exemplo.com", papel: "master" } }));
    expect(m.code).toBe(200);
    expect(m.body.senhaProvisoria).toHaveLength(12);
    const u = await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "criar", nome: "João", email: "joao@exemplo.com", papel: "unidades", unidades: ["Itapoã", "Gama"] } }));
    expect(u.code).toBe(200);
    await trocaSenha(m.body.usuario.id, m.body.senhaProvisoria);
    await trocaSenha(u.body.usuario.id, u.body.senhaProvisoria);

    const tokenMaster = criarTokenUsuario(m.body.usuario.id).token;
    const tokenUni = criarTokenUsuario(u.body.usuario.id).token;
    expect((await chama(usuarios, com(tokenMaster, { method: "GET" }))).code).toBe(403);
    expect((await chama(usuarios, com(tokenUni, { method: "POST", body: { acao: "criar", nome: "X Y", email: "x@y.com", papel: "master" } }))).code).toBe(403);

    expect((await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "atualizar", id: dono.id, ativo: false } }))).code).toBe(403);
    expect((await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "atualizar", id: dono.id, papel: "master" } }))).code).toBe(403);
    expect((await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "criar", nome: "Outro", email: "outro@exemplo.com", papel: "dono" } }))).code).toBe(400);
  });

  it("só o dono libera 'gerar relatórios'; quem gerencia acessos não dá nem tira, e o login informa a permissão", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const post = (token: string, body: any) => chama(usuarios, com(token, { method: "POST", body }));
    const criadaAna = (await post(tokenDono, { acao: "criar", nome: "Ana Júlia", email: "ana@exemplo.com", papel: "master" })).body;
    const ana = criadaAna.usuario;
    await trocaSenha(ana.id, criadaAna.senhaProvisoria);
    const tokenAna = criarTokenUsuario(ana.id).token;
    expect(ana.geraRelatorios).toBe(false);
    expect((await chama(login, com(tokenAna, { method: "GET" }))).body.usuario.geraRelatorios).toBe(false);
    expect((await post(tokenDono, { acao: "atualizar", id: ana.id, geraRelatorios: true })).body.usuario.geraRelatorios).toBe(true);
    expect((await chama(login, com(tokenAna, { method: "GET" }))).body.usuario.geraRelatorios).toBe(true);
    // o dono sempre gera
    expect((await chama(login, com(tokenDono, { method: "GET" }))).body.usuario.geraRelatorios).toBe(true);
    // quem só gerencia acessos não mexe nessa permissão
    await post(tokenDono, { acao: "atualizar", id: ana.id, gerenciaAcessos: true });
    const bia = (await post(tokenDono, { acao: "criar", nome: "Bia", email: "bia@exemplo.com", papel: "master" })).body.usuario;
    expect((await post(tokenAna, { acao: "atualizar", id: bia.id, geraRelatorios: true })).code).toBe(403);
    expect((await post(tokenAna, { acao: "criar", nome: "Caio", email: "caio@exemplo.com", papel: "master", geraRelatorios: true })).code).toBe(403);
  });

  it("royalties: dono e Master veem sempre; quem tem acesso só a unidades, só se o dono liberar; ninguém além do dono libera", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const post = (token: string, body: any) => chama(usuarios, com(token, { method: "POST", body }));
    const criar = async (nome: string, email: string, papel: string, extra: any = {}) => {
      const c = (await post(tokenDono, { acao: "criar", nome, email, papel, ...extra })).body;
      await trocaSenha(c.usuario.id, c.senhaProvisoria);
      return { u: c.usuario, token: criarTokenUsuario(c.usuario.id).token };
    };
    const master = await criar("Ana Master", "ana@exemplo.com", "master");
    const uni = await criar("Caio Unidade", "caio@exemplo.com", "unidades", { unidades: ["Gama"] });
    const veLogin = async (token: string) => (await chama(login, com(token, { method: "GET" }))).body.usuario.verRoyalties;

    expect(await veLogin(tokenDono)).toBe(true);
    expect(await veLogin(master.token)).toBe(true);
    expect(await veLogin(uni.token)).toBe(false);
    expect(uni.u.verRoyalties).toBe(false);

    // sem liberação: 403; com liberação: 200
    expect((await chama(royaltiesApi, com(uni.token, { method: "GET" }))).code).toBe(403);
    expect((await post(tokenDono, { acao: "atualizar", id: uni.u.id, verRoyalties: true })).body.usuario.verRoyalties).toBe(true);
    expect(await veLogin(uni.token)).toBe(true);
    expect((await chama(royaltiesApi, com(uni.token, { method: "GET" }))).code).toBe(200);
    // tirar a liberação fecha de novo
    await post(tokenDono, { acao: "atualizar", id: uni.u.id, verRoyalties: false });
    expect((await chama(royaltiesApi, com(uni.token, { method: "GET" }))).code).toBe(403);

    // a marca só vale para quem tem acesso a unidades: no Master ela não fica gravada
    const m2 = (await post(tokenDono, { acao: "atualizar", id: master.u.id, verRoyalties: false })).body.usuario;
    expect(m2.verRoyalties).toBe(true);
    expect((await chama(royaltiesApi, com(master.token, { method: "GET" }))).code).toBe(200);

    // quem gerencia acessos (Master liberado) não dá nem tira essa permissão
    await post(tokenDono, { acao: "atualizar", id: master.u.id, gerenciaAcessos: true });
    expect((await post(master.token, { acao: "atualizar", id: uni.u.id, verRoyalties: true })).code).toBe(403);
    expect((await post(master.token, { acao: "criar", nome: "Bia", email: "bia@exemplo.com", papel: "unidades", unidades: ["Gama"], verRoyalties: true })).code).toBe(403);
  });

  it("jurídico: só o dono vê sem liberação; qualquer nível vê se o dono liberar; ninguém além do dono libera; a API usa a mesma regra", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const post = (token: string, body: any) => chama(usuarios, com(token, { method: "POST", body }));
    const criar = async (nome: string, email: string, papel: string, extra: any = {}) => {
      const c = (await post(tokenDono, { acao: "criar", nome, email, papel, ...extra })).body;
      await trocaSenha(c.usuario.id, c.senhaProvisoria);
      return { u: c.usuario, token: criarTokenUsuario(c.usuario.id).token };
    };
    const master = await criar("Ana Master", "ana@exemplo.com", "master");
    const uni = await criar("Caio Unidade", "caio@exemplo.com", "unidades", { unidades: ["Gama"] });
    const api = (token: string) => chama(royaltiesApi, com(token, { method: "GET", query: { modulo: "juridico" } }));
    const veLogin = async (token: string) => (await chama(login, com(token, { method: "GET" }))).body.usuario.verJuridico;

    expect(await veLogin(tokenDono)).toBe(true);
    expect(await veLogin(master.token)).toBe(false);
    expect(await veLogin(uni.token)).toBe(false);
    expect((await api(master.token)).code).toBe(403);
    expect((await api(tokenDono)).body).toEqual({ disponivel: false });

    // liberar o Master e a unidade
    expect((await post(tokenDono, { acao: "atualizar", id: master.u.id, verJuridico: true })).body.usuario.verJuridico).toBe(true);
    expect((await post(tokenDono, { acao: "atualizar", id: uni.u.id, verJuridico: true })).body.usuario.verJuridico).toBe(true);
    expect(await veLogin(master.token)).toBe(true);
    expect((await api(uni.token)).code).toBe(200);
    expect((await api(uni.token)).headers["Cache-Control"]).toBe("no-store");
    // os royalties continuam com a regra deles
    expect((await chama(royaltiesApi, com(uni.token, { method: "GET" }))).code).toBe(403);
    // tirar fecha de novo
    await post(tokenDono, { acao: "atualizar", id: master.u.id, verJuridico: false });
    expect((await api(master.token)).code).toBe(403);

    // quem gerencia acessos não dá nem tira essa permissão
    await post(tokenDono, { acao: "atualizar", id: master.u.id, gerenciaAcessos: true });
    expect((await post(master.token, { acao: "atualizar", id: uni.u.id, verJuridico: false })).code).toBe(403);
    expect((await post(master.token, { acao: "criar", nome: "Bia", email: "bia@exemplo.com", papel: "master", verJuridico: true })).code).toBe(403);
  });

  it("qualidade: só o dono e quem ele liberou; liberado cria checklist, registra visita com foto e vê a foto; ninguém além do dono libera", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const post = (token: string, body: any) => chama(usuarios, com(token, { method: "POST", body }));
    const criar = async (nome: string, email: string, papel: string, extra: any = {}) => {
      const c = (await post(tokenDono, { acao: "criar", nome, email, papel, ...extra })).body;
      await trocaSenha(c.usuario.id, c.senhaProvisoria);
      return { u: c.usuario, token: criarTokenUsuario(c.usuario.id).token };
    };
    const master = await criar("Ana Master", "ana@exemplo.com", "master");
    const q = (token: string, extra: any = {}) => chama(royaltiesApi, com(token, { method: "GET", query: { modulo: "qualidade" }, ...extra }));
    const qpost = (token: string, body: any) => q(token, { method: "POST", body });

    expect((await q(master.token)).code).toBe(403);
    expect((await qpost(master.token, { acao: "modelo", modelo: { nome: "x", itens: [{ texto: "a" }] } })).code).toBe(403);
    expect((await post(tokenDono, { acao: "atualizar", id: master.u.id, verQualidade: true })).body.usuario.verQualidade).toBe(true);
    expect((await chama(login, com(master.token, { method: "GET" }))).body.usuario.verQualidade).toBe(true);

    const m = (await qpost(master.token, { acao: "modelo", modelo: { nome: "Roteiro", itens: [{ texto: "Piso limpo", peso: 2, foto: "sempre" }] } })).body.modelo;
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]).toString("base64");
    const foto = (await qpost(master.token, { acao: "foto", dados: jpeg })).body.id;
    expect((await qpost(master.token, { acao: "foto", dados: "AAAA" })).code).toBe(400);
    const hoje = new Date().toISOString().slice(0, 10);
    const sem = await qpost(master.token, { acao: "visita", visita: { modeloId: m.id, unidade: "Asa Norte", data: hoje, respostas: [{ itemId: m.itens[0].id, conforme: true }] } });
    expect(sem.code).toBe(400); // item pede foto
    const ok = await qpost(master.token, { acao: "visita", visita: { modeloId: m.id, unidade: "Asa Norte", data: hoje, respostas: [{ itemId: m.itens[0].id, conforme: true, fotos: [foto] }] } });
    expect(ok.code).toBe(200);
    expect(ok.body.visita).toMatchObject({ nota: 100, avaliador: { nome: "Ana Master" } });

    const lista = (await q(master.token)).body;
    expect(lista.modelos).toHaveLength(1);
    expect(lista.visitas).toHaveLength(1);
    expect(lista.unidades).toContain("Asa Norte");
    expect((await q(master.token)).headers["Cache-Control"]).toBe("no-store");
    expect(Buffer.isBuffer((await q(master.token, { query: { modulo: "qualidade", foto } })).body)).toBe(true);
    expect((await q(master.token, { query: { modulo: "qualidade", foto: "../x" } })).code).toBe(400);
    // royalties e jurídico seguem com as regras deles; o POST só vale na qualidade
    expect((await chama(royaltiesApi, com(master.token, { method: "POST", body: {} }))).code).toBe(405);

    // quem gerencia acessos não dá nem tira a permissão; tirar fecha de novo
    await post(tokenDono, { acao: "atualizar", id: master.u.id, gerenciaAcessos: true });
    expect((await post(master.token, { acao: "atualizar", id: master.u.id, verQualidade: false })).code).toBe(403);
    await post(tokenDono, { acao: "atualizar", id: master.u.id, verQualidade: false });
    expect((await q(master.token)).code).toBe(403);
    // apagar a visita (dono) remove também a foto
    expect((await qpost(tokenDono, { acao: "visita-apagar", id: ok.body.visita.id, mes: ok.body.visita.mes })).code).toBe(200);
    expect((await q(tokenDono, { query: { modulo: "qualidade", foto } })).code).toBe(404);
  });

  it("api de royalties: sem login 401, só GET, avisa quando ainda não há dados, devolve o modelo e nunca vai para o cache", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    expect((await chama(royaltiesApi, { method: "GET" })).code).toBe(401);
    expect((await chama(royaltiesApi, com(tokenDono, { method: "POST" }))).code).toBe(405);
    const vazio = await chama(royaltiesApi, com(tokenDono, { method: "GET" }));
    expect(vazio.body).toEqual({ disponivel: false });
    expect(vazio.headers["Cache-Control"]).toBe("no-store");
    await gravarJson("royalties/dados.json", { meses: [{ key: "2026-11", label: "nov/26" }], unidades: [{ nome: "Gama", tipo: "Taxa fixa" }] });
    const cheio = await chama(royaltiesApi, com(tokenDono, { method: "GET" }));
    expect(cheio.code).toBe(200);
    expect(cheio.body).toMatchObject({ disponivel: true, meses: [{ key: "2026-11" }] });
    expect(cheio.headers["Cache-Control"]).toBe("no-store");
  });

  it("Master liberado pelo dono gerencia acessos, mas não mexe no dono, não passa a permissão adiante nem muda o próprio nível", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const post = (token: string, body: any) => chama(usuarios, com(token, { method: "POST", body }));
    const criadaAna = (await post(tokenDono, { acao: "criar", nome: "Ana Júlia", email: "ana@exemplo.com", papel: "master" })).body;
    const ana = criadaAna.usuario;
    await trocaSenha(ana.id, criadaAna.senhaProvisoria);
    const bia = (await post(tokenDono, { acao: "criar", nome: "Bia", email: "bia@exemplo.com", papel: "master" })).body.usuario;
    expect(ana.gerenciaAcessos).toBe(false);
    const tokenAna = criarTokenUsuario(ana.id).token;
    expect((await chama(usuarios, com(tokenAna, { method: "GET" }))).code).toBe(403);

    // o dono libera
    const lib = await post(tokenDono, { acao: "atualizar", id: ana.id, gerenciaAcessos: true });
    expect(lib.body.usuario.gerenciaAcessos).toBe(true);
    expect((await chama(login, com(tokenAna, { method: "GET" }))).body.usuario.gerenciaAcessos).toBe(true);

    // o que ela pode
    expect((await chama(usuarios, com(tokenAna, { method: "GET" }))).code).toBe(200);
    const novo = await post(tokenAna, { acao: "criar", nome: "Carlos", email: "carlos@exemplo.com", papel: "unidades", unidades: ["Gama"] });
    expect(novo.code).toBe(200);
    expect((await post(tokenAna, { acao: "atualizar", id: bia.id, ativo: false })).code).toBe(200);
    expect((await post(tokenAna, { acao: "redefinir", id: novo.body.usuario.id })).code).toBe(200);
    expect((await post(tokenAna, { acao: "atualizar", id: ana.id, resumo: false })).code).toBe(200);

    // o que ela não pode
    expect((await post(tokenAna, { acao: "atualizar", id: dono.id, nome: "Outro Nome" })).code).toBe(403);
    expect((await post(tokenAna, { acao: "redefinir", id: dono.id })).code).toBe(403);
    expect((await post(tokenAna, { acao: "criar", nome: "Novo Dono", email: "nd@exemplo.com", papel: "dono" })).code).toBe(400);
    expect((await post(tokenAna, { acao: "criar", nome: "Dani", email: "dani@exemplo.com", papel: "master", gerenciaAcessos: true })).code).toBe(403);
    expect((await post(tokenAna, { acao: "atualizar", id: bia.id, gerenciaAcessos: true })).code).toBe(403);
    expect((await post(tokenAna, { acao: "atualizar", id: ana.id, papel: "unidades", unidades: ["Gama"] })).code).toBe(403);
    expect((await post(tokenAna, { acao: "atualizar", id: ana.id, ativo: false })).code).toBe(403);
    expect((await post(tokenAna, { acao: "atualizar", id: ana.id, gerenciaAcessos: false })).code).toBe(403);

    // outro que também gerencia: só o dono altera
    await post(tokenDono, { acao: "atualizar", id: bia.id, ativo: true, gerenciaAcessos: true });
    expect((await post(tokenAna, { acao: "atualizar", id: bia.id, ativo: false })).code).toBe(403);
    expect((await post(tokenAna, { acao: "redefinir", id: bia.id })).code).toBe(403);

    // a permissão só vale para Master: rebaixada a Unidades, perde
    const rebaixa = await post(tokenDono, { acao: "atualizar", id: bia.id, papel: "unidades", unidades: ["Gama"] });
    expect(rebaixa.body.usuario.gerenciaAcessos).toBe(false);
    // o dono tira a permissão: volta o 403
    await post(tokenDono, { acao: "atualizar", id: ana.id, gerenciaAcessos: false });
    expect((await chama(usuarios, com(tokenAna, { method: "GET" }))).code).toBe(403);
  });

  it("valida e-mail repetido, unidade desconhecida e nível 'unidades' sem unidade", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    await expect(acesso.criarUsuario({ nome: "Ana", email: "dono@exemplo.com", papel: "master" })).rejects.toThrow(/Já existe/);
    await expect(acesso.criarUsuario({ nome: "Ana", email: "ana@exemplo.com", papel: "unidades", unidades: [] })).rejects.toThrow(/ao menos uma unidade/);
    await expect(acesso.criarUsuario({ nome: "Ana", email: "ana@exemplo.com", papel: "unidades", unidades: ["Lugar Nenhum"] })).rejects.toThrow(/desconhecida/);
    await expect(acesso.criarUsuario({ nome: "Ana", email: "sem-arroba", papel: "master" })).rejects.toThrow(/E-mail/);
  });

  it("resumo diário: marca e desmarca quem recebe; desativado nunca recebe; quem é antigo continua recebendo", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    expect(acesso.publico(dono).resumo).toBe(true);
    const { usuario: ana } = await acesso.criarUsuario({ nome: "Ana", email: "ana@exemplo.com", papel: "master", resumo: false });
    expect(ana.resumo).toBe(false);
    const { usuario: bia } = await acesso.criarUsuario({ nome: "Bia", email: "bia@exemplo.com", papel: "unidades", unidades: ["Gama"] });
    expect(bia.resumo).toBe(true);
    expect((await acesso.atualizarUsuario(ana.id, { resumo: true })).resumo).toBe(true);
    expect((await acesso.atualizarUsuario(dono.id, { resumo: false })).resumo).toBe(false); // o próprio dono pode deixar de receber
    const lista = await acesso.listarUsuarios();
    expect(lista.filter(acesso.recebeResumo).map((u: any) => u.nome)).toEqual(["Ana", "Bia"]);
    await acesso.atualizarUsuario(bia.id, { ativo: false });
    expect((await acesso.listarUsuarios()).filter(acesso.recebeResumo).map((u: any) => u.nome)).toEqual(["Ana"]);
    expect(acesso.recebeResumo({ ativo: true })).toBe(true); // cadastro de antes da opção
  });

  it("login cai após 12 horas sem uso e se renova a cada uso", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const h = 3600 * 1000, t0 = Date.parse("2026-11-10T08:00:00Z");
    const token = criarTokenUsuario(dono.id, t0).token;
    expect(INATIVIDADE_MS).toBe(12 * h);
    expect(lerToken(token, t0 + 12 * h - 1)).toBeTruthy();
    expect(lerToken(token, t0 + 12 * h)).toBeNull();

    // Uso logo depois de entrar: não gera token novo.
    const r1 = res();
    expect(await sessaoDaRequisicao(com(token), r1, t0 + 60 * 1000)).toBeTruthy();
    expect(r1.headers["X-Atlas-Token"]).toBeUndefined();

    // Uso 11 horas depois: token novo, que vale 12 horas a partir daí.
    const r2 = res();
    expect(await sessaoDaRequisicao(com(token), r2, t0 + 11 * h)).toBeTruthy();
    const renovado = r2.headers["X-Atlas-Token"];
    expect(lerToken(renovado, t0 + 22 * h)).toBeTruthy();
    expect(lerToken(renovado, t0 + 23 * h)).toBeNull();

    // Token antigo de 30 dias vira de 12 horas no primeiro uso.
    const r3 = res();
    const longo = criarTokenUsuario(dono.id, t0 + 30 * 24 * h - 12 * h).token; // vence 30 dias depois de t0
    expect(await sessaoDaRequisicao(com(longo), r3, t0)).toBeTruthy();
    expect(lerToken(r3.headers["X-Atlas-Token"], t0 + 12 * h)).toBeNull();
  });

  it("prazos: unidades caem com 4 horas sem uso; dono e Master, com 12; e há um teto de 7 dias desde a entrada", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario: uni } = await acesso.criarUsuario({ nome: "Gestor", email: "g@exemplo.com", papel: "unidades", unidades: ["Gama"] });
    const h = 3600 * 1000, d = 24 * h, t0 = Date.parse("2026-11-10T08:00:00Z");
    expect(INATIVIDADE_UNIDADES_MS).toBe(4 * h);
    expect(TETO_SESSAO_MS).toBe(7 * d);

    const tUni = criarTokenUsuario(uni.id, t0, { papel: "unidades" }).token;
    expect(lerToken(tUni, t0 + 4 * h - 1)).toBeTruthy();
    expect(lerToken(tUni, t0 + 4 * h)).toBeNull();
    const tDono = criarTokenUsuario(dono.id, t0, { papel: "dono" }).token;
    expect(lerToken(tDono, t0 + 12 * h - 1)).toBeTruthy();
    expect(lerToken(tDono, t0 + 12 * h)).toBeNull();

    // Uso renova pelo prazo do nível: unidades ganham mais 4 horas, não 12.
    const r1 = res();
    expect(await sessaoDaRequisicao(com(tUni), r1, t0 + 3.5 * h)).toBeTruthy();
    const renovado = r1.headers["X-Atlas-Token"];
    expect(lerToken(renovado, t0 + 7.5 * h - 1)).toBeTruthy();
    expect(lerToken(renovado, t0 + 7.5 * h)).toBeNull();

    // Teto: usando sem parar, a sessão acaba 7 dias depois da entrada, mesmo com o token renovado.
    let token = criarTokenUsuario(dono.id, t0, { papel: "dono" }).token;
    for (let t = t0 + 11 * h; t < t0 + 7 * d - h; t += 11 * h) {
      const r = res();
      expect(await sessaoDaRequisicao(com(token), r, t)).toBeTruthy();
      token = r.headers["X-Atlas-Token"] ?? token;
    }
    expect(lerToken(token, t0 + 7 * d - 1)).toBeTruthy();
    expect(lerToken(token, t0 + 7 * d)).toBeNull();
    expect(await sessaoDaRequisicao(com(token), res(), t0 + 7 * d)).toBeNull();

    // Token de antes do teto (sem início): no primeiro uso o relógio de 7 dias começa.
    const corpo = Buffer.from(JSON.stringify({ u: dono.id, e: t0 + 12 * h })).toString("base64url");
    const { createHmac } = await import("node:crypto");
    const chave = createHmac("sha256", "worldgym-dashboard-v2").update(process.env.SESSAO_SEGREDO || process.env.DASHBOARD_PASSWORD || "").digest();
    const antigo = `v2.${corpo}.${createHmac("sha256", chave).update(corpo).digest("base64url")}`;
    const r2 = res();
    expect(await sessaoDaRequisicao(com(antigo), r2, t0 + h)).toBeTruthy();
    const carimbado = r2.headers["X-Atlas-Token"];
    expect(carimbado).toBeTruthy();
    const inicio = JSON.parse(Buffer.from(carimbado.split(".")[1], "base64url").toString()).c;
    expect(inicio).toBe(t0 + h); // o relógio de 7 dias começou neste primeiro uso
  });

  it("desativar vale na hora; reativar e redefinir senha funcionam; a senha provisória antiga morre", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario, senhaProvisoria } = await acesso.criarUsuario({ nome: "Maria", email: "maria@exemplo.com", papel: "master" });
    expect(await acesso.autenticar("maria@exemplo.com", senhaProvisoria)).toBeTruthy();
    await trocaSenha(usuario.id, senhaProvisoria);
    const token = criarTokenUsuario(usuario.id).token;
    expect(await exigirLogin(com(token), res())).toBeTruthy();

    await acesso.atualizarUsuario(usuario.id, { ativo: false });
    expect(await exigirLogin(com(token), res())).toBe(false);
    expect(await acesso.autenticar("maria@exemplo.com", senhaProvisoria)).toBeNull();

    await acesso.atualizarUsuario(usuario.id, { ativo: true });
    const nova = await acesso.redefinirSenha(usuario.id);
    expect(await acesso.autenticar("maria@exemplo.com", senhaProvisoria)).toBeNull();
    expect(await acesso.autenticar("maria@exemplo.com", nova.senhaProvisoria)).toBeTruthy();
    expect(dono.papel).toBe("dono");
  });

  it("token adulterado ou de outro segredo não vale", () => {
    const { token } = criarTokenUsuario("abc");
    expect(lerToken(token)).toMatchObject({ tipo: "usuario", uid: "abc" });
    const [v, corpo, sig] = token.split(".");
    const outro = Buffer.from(JSON.stringify({ u: "outro", e: Date.now() + 1e9 })).toString("base64url");
    expect(lerToken(`${v}.${outro}.${sig}`)).toBeNull();
    process.env.SESSAO_SEGREDO = "outro-segredo";
    expect(lerToken(token)).toBeNull();
    expect(corpo).toBeTruthy();
  });

  it("com usuários cadastrados e sem a chave no servidor, recusa tudo em vez de abrir", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    delete process.env.DASHBOARD_PASSWORD;
    const r = res();
    expect(await exigirLogin({ headers: {} }, r)).toBe(false);
    expect(r.code).toBe(503);
  });
});

describe("o que o nível 'unidades' enxerga", () => {
  beforeEach(() => { process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste"; });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; });

  const sessao = { papel: "unidades", unidades: ["Itapoã"] };
  const mes = {
    month: "2026-10",
    units: [
      { name: "Itapoã", faturamento: 100, idBranch: 7, evoName: "WORLD GYM ITAPOÃ", latitude: -15.7, longitude: -47.7, bairros: [["Itapoã"]] },
      { name: "Gama", faturamento: 200, idBranch: 6, evoName: "WORLD GYM GAMA", latitude: -16, longitude: -48, local: [-16, -48], bairros: [["Gama"]], semBairro: 3, nps: 70, consultores: [["Fulana de Tal", 9]], tempoConversao: { n: 4, soma: 8, f: [1, 1, 1, 1, 0] } },
    ],
  };

  it("as unidades dele vêm completas; as outras só com números e nome escondido", () => {
    const f = vis.filtrarMes(mes, sessao);
    expect(f.units[0]).toEqual(mes.units[0]);
    const gama = f.units[1];
    expect(gama.name).toMatch(/^Unidade \d{2}$/);
    expect(gama).toMatchObject({ faturamento: 200, nps: 70 });
    const texto = JSON.stringify(gama);
    for (const pista of ["Gama", "GAMA", "idBranch", "evoName", "latitude", "longitude", "bairros", "local", "semBairro", "consultores", "Fulana"]) expect(texto).not.toContain(pista);
    expect(gama.tempoConversao).toEqual({ n: 4, soma: 8, f: [1, 1, 1, 1, 0] }); // só números: segue
  });

  it("o rótulo é fixo para a mesma unidade, diferente entre unidades, e não segue a ordem alfabética", () => {
    expect(vis.rotulo("Gama")).toBe(vis.rotulo("Gama"));
    const todos = ["Asa Norte", "Gama", "Itapoã", "Planaltina-GO", "Samambaia Norte", "Arniqueira", "São Sebastião", "Riacho Fundo II", "Ceilândia", "Sobradinho", "Águas Claras Pro", "Samambaia Sul", "Águas Lindas-GO", "Ponte Alta", "Goiânia Pro-GO", "Águas Claras Metrópole", "Planaltina-DF", "Novo Gama-GO", "Salvador Pro-BA", "Santa Maria", "Taguatinga", "Jardim Ingá-GO", "Valparaíso-GO"];
    const r = todos.map((n) => vis.rotulo(n));
    expect(new Set(r).size).toBe(todos.length);
    const sequencia = [...todos].sort((a, b) => a.localeCompare(b)).map((n) => vis.rotulo(n));
    expect(sequencia).not.toEqual([...sequencia].sort());
  });

  it("dono e master recebem tudo sem alteração", () => {
    expect(vis.filtrarMes(mes, { papel: "master", unidades: [] })).toBe(mes);
    expect(vis.filtrarMes(mes, { papel: "dono", unidades: [] })).toBe(mes);
  });

  it("planilha: troca o nome das outras unidades e mantém o total; metas ficam só das dele e da rede", () => {
    const linhas = [["Mês", "Unidade", "Faturamento"], ["2026-10", "Itapoã", "1"], ["2026-10", "Gama", "2"], ["2026-10", "TOTAL", "3"]];
    const f = vis.filtrarLinhasPlanilha(linhas, sessao);
    expect(f[1][1]).toBe("Itapoã");
    expect(f[2][1]).toMatch(/^Unidade \d{2}$/);
    expect(f[3][1]).toBe("TOTAL");
    const metas = [["Mês", "Unidade", "Indicador", "Ouro"], ["out", "Itapoã", "x", "1"], ["out", "Gama", "x", "2"], ["out", "REDE", "x", "3"]];
    expect(vis.filtrarLinhasMetas(metas, sessao).map((l: string[]) => l[1])).toEqual(["Unidade", "Itapoã", "REDE"]);
    expect(vis.filtrarLinhasPlanilha([["a", "b"], ["1", "2"]], sessao)).toHaveLength(1); // formato desconhecido: não mostra nada
  });

  it("campanhas: só as das unidades dele, sem as da rede toda nem os erros", () => {
    const z = { investimento: 1, impressoes: 0, cliques: 0, leads: 0, conversas: 0 };
    const meses = { "2026-11": { geradoEm: "y", erros: [{ conta: "c", erro: "e" }], unidades: { Itapoã: z, Gama: z, Rede: z } } };
    const foto = { geradoEm: "x", campanhas: [{ unidade: "Itapoã" }, { unidade: "Gama" }, { unidade: null }], erros: [{ conta: "c", erro: "e" }], meses };
    expect(vis.filtrarCampanhas(foto, sessao)).toEqual({ geradoEm: "x", campanhas: [{ unidade: "Itapoã" }], erros: [], meses: { "2026-11": { geradoEm: "y", erros: [], unidades: { Itapoã: z } } } });
  });
});

describe("horários dos contatos por nível", () => {
  it("quem vê só algumas unidades recebe só o calor delas", () => {
    const foto = { geradoEm: "x", campanhas: [], erros: [], calor: { de: "a", ate: "b", unidades: { Gama: [1], Itapoã: [2], Rede: [3] } } };
    const r = vis.filtrarCampanhas(foto, { papel: "unidades", unidades: ["Gama"] });
    expect(Object.keys(r.calor.unidades)).toEqual(["Gama"]);
  });
});

describe("freio de tentativas de login", () => {
  beforeEach(() => {
    process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste";
    definirArmazem(memoria());
    acesso.limparCache();
    acesso.limparFreio();
  });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; delete process.env.SESSAO_SEGREDO; definirArmazem(null); acesso.limparCache(); });

  it("depois de 5 senhas erradas bloqueia o e-mail, mesmo com a senha certa; erros de outro e-mail não contam", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tenta = (senha: string, ip = "1.1.1.1") => chama(login, { method: "POST", headers: { "x-real-ip": ip }, body: { email: "dono@exemplo.com", senha } });
    for (let i = 0; i < 5; i++) expect((await tenta("errada-errada", `9.9.9.${i}`)).code).toBe(401);
    const bloq = await tenta("senha-do-dono-123", "7.7.7.7");
    expect(bloq.code).toBe(429);
    expect(bloq.body.minutos).toBeGreaterThan(0);
    expect(bloq.headers["Retry-After"]).toBeDefined();
  }, 20000);

  it("login certo zera os erros do e-mail", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tenta = (senha: string) => chama(login, { method: "POST", headers: { "x-real-ip": "2.2.2.2" }, body: { email: "dono@exemplo.com", senha } });
    for (let i = 0; i < 4; i++) await tenta("errada-errada");
    expect((await tenta("senha-do-dono-123")).code).toBe(200);
    for (let i = 0; i < 4; i++) expect((await tenta("errada-errada")).code).toBe(401);
    expect((await tenta("senha-do-dono-123")).code).toBe(200);
  }, 20000);

  it("o bloqueio do endereço vale para qualquer e-mail", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    for (let i = 0; i < 20; i++) await chama(login, { method: "POST", headers: { "x-real-ip": "3.3.3.3" }, body: { email: `x${i}@exemplo.com`, senha: "qualquer" } });
    const r = await chama(login, { method: "POST", headers: { "x-real-ip": "3.3.3.3" }, body: { email: "dono@exemplo.com", senha: "senha-do-dono-123" } });
    expect(r.code).toBe(429);
  }, 40000);
});


describe("troca de senha no primeiro acesso", () => {
  beforeEach(() => {
    process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste";
    definirArmazem(memoria());
    acesso.limparCache();
    acesso.limparFreio();
  });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; delete process.env.SESSAO_SEGREDO; definirArmazem(null); acesso.limparCache(); });

  it("acesso novo e senha refeita exigem a troca; o dono não; e sem trocar não há dados", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    expect(dono.trocarSenha).toBe(false);
    const { usuario, senhaProvisoria } = await acesso.criarUsuario({ nome: "Maria", email: "maria@exemplo.com", papel: "master" });
    expect(usuario.trocarSenha).toBe(true);

    const login1 = await chama(login, { method: "POST", headers: { "x-real-ip": "5.5.5.5" }, body: { email: "maria@exemplo.com", senha: senhaProvisoria } });
    expect(login1.code).toBe(200);
    expect(login1.body.usuario.trocarSenha).toBe(true);
    const token = login1.body.token;
    const bloqueado = res();
    expect(await exigirLogin(com(token), bloqueado)).toBe(false);
    expect(bloqueado.code).toBe(403);
    expect(bloqueado.body).toMatchObject({ trocarSenha: true });
    // o servidor ainda diz quem ela é (para a tela pedir a troca)
    const quem = await chama(login, com(token, { method: "GET" }));
    expect(quem.body.usuario.trocarSenha).toBe(true);
  });

  it("troca: confere a atual, recusa senha fraca e, trocando, libera os dados; a provisória deixa de valer", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario, senhaProvisoria } = await acesso.criarUsuario({ nome: "Maria Souza", email: "maria.souza@exemplo.com", papel: "master" });
    const token = criarTokenUsuario(usuario.id).token;
    const troca = (body: any, ip = "6.6.6.6") => chama(senhaApi, com(token, { method: "POST", headers: { authorization: `Bearer ${token}`, "x-real-ip": ip }, body }));

    expect((await troca({ atual: "errada-errada-1", nova: "uma-senha-bem-forte-9" })).code).toBe(401);
    expect((await troca({ atual: senhaProvisoria, nova: "curta" })).code).toBe(400);
    expect((await troca({ atual: senhaProvisoria, nova: senhaProvisoria })).code).toBe(400); // igual à provisória
    expect((await troca({ atual: senhaProvisoria, nova: "1234567890" })).code).toBe(400); // óbvia
    expect((await troca({ atual: senhaProvisoria, nova: "maria.souza-2026-x" })).code).toBe(400); // contém o e-mail
    expect(await acesso.autenticar("maria.souza@exemplo.com", senhaProvisoria)).toBeTruthy(); // nada mudou até aqui

    const ok = await troca({ atual: senhaProvisoria, nova: "uma-senha-bem-forte-9" });
    expect(ok.code).toBe(200);
    expect(ok.body.usuario.trocarSenha).toBe(false);
    expect(JSON.stringify(ok.body)).not.toContain("hash");
    expect(await acesso.autenticar("maria.souza@exemplo.com", senhaProvisoria)).toBeNull();
    expect(await acesso.autenticar("maria.souza@exemplo.com", "uma-senha-bem-forte-9")).toBeTruthy();
    expect(await exigirLogin(com(token), res())).toBeTruthy(); // agora vê os dados

    // pode trocar de novo quando quiser, informando a atual
    expect((await troca({ atual: "uma-senha-bem-forte-9", nova: "outra-senha-ainda-melhor-7" })).code).toBe(200);
  }, 20000);

  it("errar a senha atual várias vezes bloqueia a troca (freio)", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario, senhaProvisoria } = await acesso.criarUsuario({ nome: "Maria", email: "maria@exemplo.com", papel: "master" });
    const token = criarTokenUsuario(usuario.id).token;
    const troca = (atual: string, ip: string) => chama(senhaApi, { method: "POST", headers: { authorization: `Bearer ${token}`, "x-real-ip": ip }, body: { atual, nova: "uma-senha-bem-forte-9" } });
    for (let i = 0; i < 5; i++) expect((await troca("errada-errada-1", `7.7.7.${i}`)).code).toBe(401);
    const r = await troca(senhaProvisoria, "7.7.7.9");
    expect(r.code).toBe(429);
  }, 20000);

  it("acessos criados antes da regra (sem o campo) também precisam trocar, menos o dono; sem login não troca", async () => {
    expect(acesso.precisaTrocarSenha({ papel: "master" })).toBe(true);
    expect(acesso.precisaTrocarSenha({ papel: "unidades" })).toBe(true);
    expect(acesso.precisaTrocarSenha({ papel: "dono" })).toBe(false);
    expect(acesso.precisaTrocarSenha({ papel: "master", trocarSenha: false })).toBe(false);
    expect(acesso.precisaTrocarSenha({ papel: "dono", trocarSenha: true })).toBe(true); // senha refeita do dono
    expect((await chama(senhaApi, { method: "POST", body: { atual: "x", nova: "y" } })).code).toBe(401);
  });
});


describe("avisos de segurança por e-mail", () => {
  const ENV = { SMTP_USUARIO: "atlas@exemplo.com", SMTP_SENHA: "x" };
  const UA_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  let enviados: { para: string; assunto: string; html: string }[];
  const enviar = async (m: any) => { enviados.push(m); };
  const ctx = (aparelho: string, ua = UA_MAC) => ({ aparelho, ua, ip: "177.1.2.3", headers: { "x-vercel-ip-city": encodeURIComponent("Águas Claras"), "x-vercel-ip-country-region": "DF", "x-vercel-ip-country": "BR" } });

  beforeEach(() => {
    process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste";
    definirArmazem(memoria());
    acesso.limparCache();
    acesso.limparFreio();
    enviados = [];
  });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; definirArmazem(null); acesso.limparCache(); });

  it("reconhece o navegador e o local aproximado a partir do que a Vercel informa", () => {
    expect(avisos.resumoDoNavegador(UA_MAC)).toBe("Chrome em macOS");
    expect(avisos.resumoDoNavegador(UA_IPHONE)).toBe("Safari em iPhone/iPad");
    expect(avisos.localAproximado(ctx("x").headers)).toBe("Águas Claras, DF");
    expect(avisos.localAproximado({})).toBeNull();
  });

  it("aparelho: o primeiro acesso de conta antiga só registra; o seguinte, de aparelho diferente, avisa a pessoa", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario } = await acesso.criarUsuario({ nome: "Maria Souza", email: "maria@exemplo.com", papel: "unidades", unidades: ["Gama"] });
    const antiga = { ...usuario, criadoEm: "2026-01-01T00:00:00Z" }; // conta de antes do recurso
    const agora = Date.parse("2026-11-20T10:00:00Z");
    expect((await avisos.avisarAcesso(antiga, ctx("aparelho-aaaaaaaaaaaaaaaa"), { agora, env: ENV, enviar })).enviados).toBe(0); // semeia
    expect(enviados).toHaveLength(0);
    expect((await avisos.avisarAcesso(antiga, ctx("aparelho-aaaaaaaaaaaaaaaa"), { agora: agora + 1000, env: ENV, enviar })).enviados).toBe(0); // conhecido
    const r = await avisos.avisarAcesso(antiga, ctx("aparelho-bbbbbbbbbbbbbbbb", UA_IPHONE), { agora: agora + 3 * 3600e3, env: ENV, enviar });
    expect(r.enviados).toBe(1);
    expect(enviados).toHaveLength(1); // unidades: só a própria pessoa, não o dono
    expect(enviados[0].para).toBe("maria@exemplo.com");
    expect(enviados[0].assunto).toContain("Novo acesso");
    expect(enviados[0].html).toContain("Safari em iPhone/iPad");
    expect(enviados[0].html).toContain("Águas Claras, DF");
    expect(enviados[0].html).toContain("177.1.2.3");
    expect(dono.papel).toBe("dono");
  });

  it("conta de Master: aparelho novo avisa a pessoa e o dono; sem código de aparelho não há aviso; throttle de 30 minutos", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario } = await acesso.criarUsuario({ nome: "Ana Júlia", email: "ana@exemplo.com", papel: "master" });
    const ana = { ...usuario, criadoEm: "2026-01-01T00:00:00Z" };
    const agora = Date.parse("2026-11-20T10:00:00Z");
    await avisos.avisarAcesso(ana, ctx("aparelho-aaaaaaaaaaaaaaaa"), { agora, env: ENV, enviar });
    await avisos.avisarAcesso(ana, ctx("aparelho-bbbbbbbbbbbbbbbb"), { agora: agora + 3600e3, env: ENV, enviar });
    expect(enviados.map((e) => e.para).sort()).toEqual(["ana@exemplo.com", "dono@exemplo.com"]);
    expect(enviados.find((e) => e.para === "dono@exemplo.com")!.assunto).toContain("Ana Júlia");
    enviados.length = 0;
    // outro aparelho novo logo em seguida (dentro de 30 minutos): registra, mas não manda de novo
    await avisos.avisarAcesso(ana, ctx("aparelho-cccccccccccccccc"), { agora: agora + 3600e3 + 60e3, env: ENV, enviar });
    expect(enviados).toHaveLength(0);
    // sem código de aparelho (navegador que não guarda nada): não dá para saber, não avisa
    expect((await avisos.avisarAcesso(ana, { ...ctx(""), aparelho: "" }, { agora: agora + 9e6, env: ENV, enviar })).enviados).toBe(0);
    expect(enviados).toHaveLength(0);
  });

  it("conta criada há pouco entrando pela primeira vez avisa só o dono; e sem SMTP configurado nada é enviado nem quebra", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario } = await acesso.criarUsuario({ nome: "Bia", email: "bia@exemplo.com", papel: "unidades", unidades: ["Gama"] });
    const r = await avisos.avisarAcesso(usuario, ctx("aparelho-aaaaaaaaaaaaaaaa"), { env: ENV, enviar });
    expect(r.enviados).toBe(1);
    expect(enviados[0].para).toBe("dono@exemplo.com");
    expect(enviados[0].assunto).toContain("primeira vez");
    const { usuario: outra } = await acesso.criarUsuario({ nome: "Caio", email: "caio@exemplo.com", papel: "unidades", unidades: ["Gama"] });
    enviados.length = 0;
    expect((await avisos.avisarAcesso(outra, ctx("aparelho-zzzzzzzzzzzzzzzz"), { env: {}, enviar })).enviados).toBe(0); // sem SMTP
    expect(enviados).toHaveLength(0);
  });

  it("bloqueio avisa a pessoa e o dono; senha alterada avisa a pessoa; e o login por e-mail dispara o aviso sem falhar", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario } = await acesso.criarUsuario({ nome: "Maria", email: "maria@exemplo.com", papel: "unidades", unidades: ["Gama"] });
    const b = await avisos.avisarBloqueio(usuario, ctx("x"), 15, { env: ENV, enviar });
    expect(b.enviados).toBe(2);
    expect(enviados.map((e) => e.para).sort()).toEqual(["dono@exemplo.com", "maria@exemplo.com"]);
    enviados.length = 0;
    expect((await avisos.avisarSenhaAlterada(usuario, ctx("x"), { env: ENV, enviar })).enviados).toBe(1);
    expect(enviados[0].para).toBe("maria@exemplo.com");
    expect(enviados[0].html).not.toMatch(/senha-nova|provis/i);

    // o login de verdade (sem SMTP no teste) continua funcionando com o código de aparelho no corpo
    const { senhaProvisoria } = await acesso.criarUsuario({ nome: "Duda", email: "duda@exemplo.com", papel: "master" });
    const ok = await chama(login, { method: "POST", headers: { "x-real-ip": "8.8.8.8", "user-agent": UA_MAC }, body: { email: "duda@exemplo.com", senha: senhaProvisoria, aparelho: "aparelho-aaaaaaaaaaaaaaaa" } });
    expect(ok.code).toBe(200);
  }, 20000);

  it("o freio avisa quando a tentativa é a que bloqueia", async () => {
    const { anotarErro } = await import("../../../server/freio.js" as any);
    const r: boolean[] = [];
    for (let i = 0; i < 5; i++) r.push(await anotarErro("email:teste@x.com", "email", 1_000_000 + i));
    expect(r).toEqual([false, false, false, false, true]);
  });
});

describe("lista de usuários: leitura vazia passageira", () => {
  it("se a leitura volta vazia mas já havia lista, relê e, se continuar vazia, mantém a anterior", async () => {
    const u = [{ id: "a", email: "a@x.com", papel: "dono" }];
    let chamadas = 0;
    let vazio = false;
    definirArmazem({ async ler() { chamadas++; return vazio ? null : structuredClone(u); }, async gravar() {} });
    acesso.limparCache();
    const t0 = 1_000_000;
    expect(await acesso.listarUsuarios(t0)).toEqual(u); // leitura normal
    vazio = true;
    const antes = chamadas;
    expect(await acesso.listarUsuarios(t0 + 61_000)).toEqual(u); // memória vencida, armazenamento vazio: segue com a anterior
    expect(chamadas - antes).toBe(2); // leu, esperou e releu
    definirArmazem(null);
    acesso.limparCache();
  });

  it("se a releitura traz a lista, usa a nova", async () => {
    const u = [{ id: "a", email: "a@x.com", papel: "dono" }];
    let n = 0;
    definirArmazem({ async ler() { n++; return n === 1 ? null : structuredClone(u); }, async gravar() {} });
    acesso.limparCache();
    expect(await acesso.listarUsuarios(1_000_000)).toEqual(u);
    definirArmazem(null);
    acesso.limparCache();
  });
});
