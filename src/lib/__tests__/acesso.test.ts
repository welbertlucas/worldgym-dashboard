import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulos JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulos JS do servidor
import * as acesso from "../../../server/acesso.js";
// @ts-expect-error módulos JS do servidor
import { criarToken, criarTokenUsuario, lerToken, exigirLogin } from "../../../api/_auth.js";
// @ts-expect-error módulos JS do servidor
import login from "../../../api/login.js";
// @ts-expect-error módulos JS do servidor
import usuarios from "../../../api/usuarios.js";
// @ts-expect-error módulos JS do servidor
import * as vis from "../../../server/visibilidade.js";

const memoria = () => {
  const m = new Map<string, unknown>();
  return { m, async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar(c: string, d: unknown) { m.set(c, structuredClone(d)); } };
};
const res = () => {
  const r: any = { headers: {} as Record<string, string>, code: 200, body: undefined };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.end = () => r;
  return r;
};
const chama = async (h: any, req: any) => { const r = res(); await h({ headers: {}, query: {}, ...req }, r); return r; };
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

  it("só o dono cria acessos; master e unidades levam 403; o dono não é rebaixado nem desativado", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const tokenDono = criarTokenUsuario(dono.id).token;
    const m = await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "criar", nome: "Maria", email: "maria@exemplo.com", papel: "master" } }));
    expect(m.code).toBe(200);
    expect(m.body.senhaProvisoria).toHaveLength(12);
    const u = await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "criar", nome: "João", email: "joao@exemplo.com", papel: "unidades", unidades: ["Itapoã", "Gama"] } }));
    expect(u.code).toBe(200);

    const tokenMaster = criarTokenUsuario(m.body.usuario.id).token;
    const tokenUni = criarTokenUsuario(u.body.usuario.id).token;
    expect((await chama(usuarios, com(tokenMaster, { method: "GET" }))).code).toBe(403);
    expect((await chama(usuarios, com(tokenUni, { method: "POST", body: { acao: "criar", nome: "X Y", email: "x@y.com", papel: "master" } }))).code).toBe(403);

    expect((await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "atualizar", id: dono.id, ativo: false } }))).code).toBe(403);
    expect((await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "atualizar", id: dono.id, papel: "master" } }))).code).toBe(403);
    expect((await chama(usuarios, com(tokenDono, { method: "POST", body: { acao: "criar", nome: "Outro", email: "outro@exemplo.com", papel: "dono" } }))).code).toBe(400);
  });

  it("valida e-mail repetido, unidade desconhecida e nível 'unidades' sem unidade", async () => {
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    await expect(acesso.criarUsuario({ nome: "Ana", email: "dono@exemplo.com", papel: "master" })).rejects.toThrow(/Já existe/);
    await expect(acesso.criarUsuario({ nome: "Ana", email: "ana@exemplo.com", papel: "unidades", unidades: [] })).rejects.toThrow(/ao menos uma unidade/);
    await expect(acesso.criarUsuario({ nome: "Ana", email: "ana@exemplo.com", papel: "unidades", unidades: ["Lugar Nenhum"] })).rejects.toThrow(/desconhecida/);
    await expect(acesso.criarUsuario({ nome: "Ana", email: "sem-arroba", papel: "master" })).rejects.toThrow(/E-mail/);
  });

  it("desativar vale na hora; reativar e redefinir senha funcionam; a senha provisória antiga morre", async () => {
    const dono = await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario, senhaProvisoria } = await acesso.criarUsuario({ nome: "Maria", email: "maria@exemplo.com", papel: "master" });
    expect(await acesso.autenticar("maria@exemplo.com", senhaProvisoria)).toBeTruthy();
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
      { name: "Gama", faturamento: 200, idBranch: 6, evoName: "WORLD GYM GAMA", latitude: -16, longitude: -48, local: [-16, -48], bairros: [["Gama"]], semBairro: 3, nps: 70 },
    ],
  };

  it("as unidades dele vêm completas; as outras só com números e nome escondido", () => {
    const f = vis.filtrarMes(mes, sessao);
    expect(f.units[0]).toEqual(mes.units[0]);
    const gama = f.units[1];
    expect(gama.name).toMatch(/^Unidade \d{2}$/);
    expect(gama).toMatchObject({ faturamento: 200, nps: 70 });
    const texto = JSON.stringify(gama);
    for (const pista of ["Gama", "GAMA", "idBranch", "evoName", "latitude", "longitude", "bairros", "local", "semBairro"]) expect(texto).not.toContain(pista);
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
    const foto = { geradoEm: "x", campanhas: [{ unidade: "Itapoã" }, { unidade: "Gama" }, { unidade: null }], erros: [{ conta: "c", erro: "e" }] };
    expect(vis.filtrarCampanhas(foto, sessao)).toEqual({ geradoEm: "x", campanhas: [{ unidade: "Itapoã" }], erros: [] });
  });
});
