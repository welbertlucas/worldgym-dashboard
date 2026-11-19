import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulos JS do servidor
import { definirArmazem, lerJson } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import * as acesso from "../../../server/acesso.js";
// @ts-expect-error módulo JS do servidor
import * as redef from "../../../server/redefinicao.js";
// @ts-expect-error módulo JS do servidor
import { criarTokenUsuario, sessaoDaRequisicao } from "../../../api/_auth.js";
// @ts-expect-error módulo JS do servidor
import login from "../../../api/login.js";

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
const chama = async (h: any, req: any) => { const r = res(); await h({ headers: {}, query: {}, ...req }, r); return r; };

const ENV = { SMTP_USUARIO: "atlas@exemplo.com", SMTP_SENHA: "x" };
const enviados: { para: string; assunto: string; html: string }[] = [];
const enviar = async (msg: { para: string; assunto: string; html: string }) => { enviados.push(msg); };
const opc = { env: ENV, enviar };
const ctx = { aparelho: "aparelho-aaaaaaaaaaaaaaaa", ua: "Mozilla/5.0 (Macintosh; Mac OS X) Chrome/120", ip: "1.2.3.4", headers: {} };
/** O código do link, tirado do e-mail enviado. */
const tokenDoEmail = (msg: { html: string }) => decodeURIComponent(/#redefinir=([^"&\s]+)/.exec(msg.html)![1]);
const MIN = 60_000;

describe("esqueci minha senha", () => {
  beforeEach(async () => {
    process.env.DASHBOARD_PASSWORD = "senha-unica-de-teste";
    process.env.SESSAO_SEGREDO = "segredo-de-teste";
    process.env.REDEFINICAO_ESPERA_MS = "0";
    definirArmazem(memoria());
    acesso.limparCache();
    acesso.limparFreio();
    enviados.length = 0;
    await acesso.criarDono({ nome: "Dono", email: "dono@exemplo.com", senha: "senha-do-dono-123" });
    const { usuario, senhaProvisoria } = await acesso.criarUsuario({ nome: "Maria Souza", email: "maria@exemplo.com", papel: "unidades", unidades: ["Gama"] });
    await acesso.definirNovaSenha(usuario.id, senhaProvisoria, "senha-antiga-da-conta");
    acesso.limparCache();
  });
  afterEach(() => { delete process.env.DASHBOARD_PASSWORD; delete process.env.SESSAO_SEGREDO; delete process.env.REDEFINICAO_ESPERA_MS; definirArmazem(null); acesso.limparCache(); });

  it("e-mail com acesso recebe o link; o código não fica guardado, só a versão embaralhada", async () => {
    const agora = Date.UTC(2026, 10, 19, 12);
    const r = await redef.pedirRedefinicao(" Maria@Exemplo.com ", ctx, { agora, ...opc });
    expect(r.enviado).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].para).toBe("maria@exemplo.com");
    expect(enviados[0].html).toContain("30 minutos");
    const [id, segredo] = tokenDoEmail(enviados[0]).split(".");
    const arq = await lerJson(`acessos/redefinicao/${id}.json`);
    expect(JSON.stringify(arq)).not.toContain(segredo);
    expect(arq.exp).toBe(agora + 30 * MIN);
  });

  it("e-mail sem acesso, desativado ou inventado: nada é enviado", async () => {
    expect((await redef.pedirRedefinicao("ninguem@exemplo.com", ctx, opc)).enviado).toBe(false);
    const maria = (await acesso.listarUsuarios()).find((u: any) => u.email === "maria@exemplo.com");
    await acesso.atualizarUsuario(maria.id, { ativo: false });
    expect((await redef.pedirRedefinicao("maria@exemplo.com", ctx, opc)).enviado).toBe(false);
    expect(enviados).toHaveLength(0);
  });

  it("o dono também pode usar", async () => {
    expect((await redef.pedirRedefinicao("dono@exemplo.com", ctx, opc)).enviado).toBe(true);
    const nova = "nova-senha-do-chefe-9";
    await redef.redefinirComToken(tokenDoEmail(enviados[0]), nova, ctx, opc);
    acesso.limparCache();
    expect(await acesso.autenticar("dono@exemplo.com", nova)).toMatchObject({ papel: "dono" });
    expect(await acesso.autenticar("dono@exemplo.com", "senha-do-dono-123")).toBeNull();
  });

  it("no máximo 3 pedidos por hora por pessoa; passada a hora, volta a enviar", async () => {
    const t0 = Date.UTC(2026, 10, 19, 12);
    for (let i = 0; i < 3; i++) expect((await redef.pedirRedefinicao("maria@exemplo.com", ctx, { agora: t0 + i * MIN, ...opc })).enviado).toBe(true);
    const quarto = await redef.pedirRedefinicao("maria@exemplo.com", ctx, { agora: t0 + 4 * MIN, ...opc });
    expect(quarto).toMatchObject({ enviado: false, limitado: true });
    expect(enviados).toHaveLength(3);
    expect((await redef.pedirRedefinicao("maria@exemplo.com", ctx, { agora: t0 + 62 * MIN, ...opc })).enviado).toBe(true);
  });

  it("redefinir troca a senha, o link morre, a antiga deixa de valer e a pessoa é avisada", async () => {
    const t0 = Date.UTC(2026, 10, 19, 12);
    await redef.pedirRedefinicao("maria@exemplo.com", ctx, { agora: t0, ...opc });
    const token = tokenDoEmail(enviados[0]);
    await redef.redefinirComToken(token, "senha-nova-da-conta-1", ctx, { agora: t0 + 5 * MIN, ...opc });
    acesso.limparCache();
    expect(await acesso.autenticar("maria@exemplo.com", "senha-nova-da-conta-1")).toMatchObject({ email: "maria@exemplo.com" });
    expect(await acesso.autenticar("maria@exemplo.com", "senha-antiga-da-conta")).toBeNull();
    expect(enviados.at(-1)!.assunto).toContain("alterada"); // aviso "senha alterada"
    await expect(redef.redefinirComToken(token, "outra-senha-qualquer-2", ctx, { agora: t0 + 6 * MIN, ...opc })).rejects.toBeInstanceOf(redef.ErroLink);
  });

  it("senha fraca não gasta o link: a pessoa tenta outra", async () => {
    const t0 = Date.UTC(2026, 10, 19, 12);
    await redef.pedirRedefinicao("maria@exemplo.com", ctx, { agora: t0, ...opc });
    const token = tokenDoEmail(enviados[0]);
    await expect(redef.redefinirComToken(token, "curta", ctx, { agora: t0 + MIN, ...opc })).rejects.toMatchObject({ status: 400 });
    await expect(redef.redefinirComToken(token, "1234567890", ctx, { agora: t0 + MIN, ...opc })).rejects.toMatchObject({ status: 400 });
    await redef.redefinirComToken(token, "senha-boa-da-conta-3", ctx, { agora: t0 + 2 * MIN, ...opc });
    acesso.limparCache();
    expect(await acesso.autenticar("maria@exemplo.com", "senha-boa-da-conta-3")).not.toBeNull();
  });

  it("link vencido (31 min), adulterado, de outra pessoa ou substituído por um pedido novo: recusa", async () => {
    const t0 = Date.UTC(2026, 10, 19, 12);
    await redef.pedirRedefinicao("maria@exemplo.com", ctx, { agora: t0, ...opc });
    const velho = tokenDoEmail(enviados[0]);
    await expect(redef.redefinirComToken(velho, "senha-valida-longa-4", ctx, { agora: t0 + 31 * MIN, ...opc })).rejects.toBeInstanceOf(redef.ErroLink);
    const [id, segredo] = velho.split(".");
    await expect(redef.redefinirComToken(`${id}.${segredo}x`, "senha-valida-longa-4", ctx, { agora: t0 + MIN, ...opc })).rejects.toBeInstanceOf(redef.ErroLink);
    await expect(redef.redefinirComToken(`${id}.`, "senha-valida-longa-4", ctx, opc)).rejects.toBeInstanceOf(redef.ErroLink);
    await expect(redef.redefinirComToken("lixo", "senha-valida-longa-4", ctx, opc)).rejects.toBeInstanceOf(redef.ErroLink);
    await expect(redef.redefinirComToken(null, "senha-valida-longa-4", ctx, opc)).rejects.toBeInstanceOf(redef.ErroLink);
    // o segredo de uma pessoa com o id de outra não serve
    const dono = (await acesso.listarUsuarios()).find((u: any) => u.papel === "dono");
    await expect(redef.redefinirComToken(`${dono.id}.${segredo}`, "senha-valida-longa-4", ctx, { agora: t0 + MIN, ...opc })).rejects.toBeInstanceOf(redef.ErroLink);
    // pedido novo: o link anterior para de valer
    await redef.pedirRedefinicao("maria@exemplo.com", ctx, { agora: t0 + 2 * MIN, ...opc });
    await expect(redef.redefinirComToken(velho, "senha-valida-longa-4", ctx, { agora: t0 + 3 * MIN, ...opc })).rejects.toBeInstanceOf(redef.ErroLink);
    await redef.redefinirComToken(tokenDoEmail(enviados.at(-1)!), "senha-valida-longa-4", ctx, { agora: t0 + 3 * MIN, ...opc });
  });

  it("as sessões abertas antes da redefinição caem; a entrada depois dela vale", async () => {
    const maria = (await acesso.listarUsuarios()).find((u: any) => u.email === "maria@exemplo.com");
    const t0 = Date.now();
    const antes = criarTokenUsuario(maria.id, t0 - 60_000, { papel: "unidades" }).token;
    const req = (t: string) => ({ headers: { authorization: `Bearer ${t}` } });
    expect(await sessaoDaRequisicao(req(antes), null, t0)).toMatchObject({ email: "maria@exemplo.com" });
    await acesso.definirSenhaPorRedefinicao(maria.id, "senha-nova-da-conta-5", t0);
    acesso.limparCache();
    expect(await sessaoDaRequisicao(req(antes), null, t0 + 1000)).toBeNull();
    const depois = criarTokenUsuario(maria.id, t0 + 5000, { papel: "unidades" }).token;
    expect(await sessaoDaRequisicao(req(depois), null, t0 + 6000)).toMatchObject({ email: "maria@exemplo.com" });
  });

  it("o registro do dono anota o pedido e a redefinição sem contá-los como entrada nem como senha errada", async () => {
    const t0 = Date.UTC(2026, 10, 19, 12);
    await redef.pedirRedefinicao("maria@exemplo.com", ctx, { agora: t0, ...opc });
    await redef.redefinirComToken(tokenDoEmail(enviados[0]), "senha-nova-da-conta-6", ctx, { agora: t0 + MIN, ...opc });
    const reg = await acesso.lerRegistro(t0 + 2 * MIN);
    expect(reg.map((e: any) => e.evento)).toEqual(["senha-redefinida", "redefinicao-pedida"]);
    expect(reg.every((e: any) => e.ok === false)).toBe(true);
    expect(JSON.stringify(reg)).not.toMatch(/senha-nova|segredo/);
  });

  it("rota: o pedido responde igual com e-mail que tem acesso e com e-mail inventado", async () => {
    const a = await chama(login, { method: "POST", body: { acao: "esqueci", email: "maria@exemplo.com" } });
    const b = await chama(login, { method: "POST", body: { acao: "esqueci", email: "inventado@exemplo.com" } });
    expect(a.code).toBe(200);
    expect(b.code).toBe(200);
    expect(b.body).toEqual(a.body);
  });

  it("rota: link inválido dá 400 e, depois de muitas tentativas, o endereço é bloqueado", async () => {
    const ruim = () => chama(login, { method: "POST", headers: { "x-real-ip": "9.9.9.9" }, body: { acao: "redefinir", token: "abc.def", nova: "senha-valida-longa-7" } });
    for (let i = 0; i < 20; i++) expect((await ruim()).code).toBe(400);
    const bloqueado = await ruim();
    expect(bloqueado.code).toBe(429);
    expect(bloqueado.headers["Retry-After"]).toBeDefined();
  }, 60_000);

  it("rota: enquanto não existem acessos por e-mail, o esqueci não se aplica", async () => {
    definirArmazem(memoria());
    acesso.limparCache();
    const r = await chama(login, { method: "POST", body: { acao: "esqueci", email: "x@exemplo.com" } });
    expect(r.code).toBe(400);
  });
});
