import { beforeEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
// @ts-expect-error módulo JS do servidor
import { LIMITES, apagarDocumento, baixarArquivo, criarPasta, enviarArquivo, lerDocumentos, unidadesDosDocumentos } from "../../../server/documentos.js";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
// @ts-expect-error módulo JS do servidor
import { atualizarUsuario, criarDono, criarUsuario, publico, verDocumentos } from "../../../server/acesso.js";
import { ListaDeUnidades, PastaAberta } from "@/components/tabs/DocumentosTab";
import { caminhoDaPasta, problemaDoArquivo, tamanhoLegivel } from "@/lib/documentos";
import { itensDoMenu } from "@/components/nav";
import { artigosPara, secoesPara } from "@/data/ajuda";

const memoria = new Map<string, unknown>();
beforeEach(() => {
  memoria.clear();
  definirArmazem({
    ler: async (c: string) => (memoria.has(c) ? structuredClone(memoria.get(c)) : null),
    gravar: async (c: string, d: unknown) => { memoria.set(c, structuredClone(d)); },
    gravarBytes: async (c: string, b: Buffer) => { memoria.set(c, b); },
    lerBytes: async (c: string) => memoria.get(c) ?? null,
    apagar: async (c: string) => { memoria.delete(c); },
  });
});

const dono = { papel: "dono", nome: "Dona Teste", unidades: [], verDocumentos: true };
const master = { papel: "master", nome: "Mestre Teste", unidades: [], verDocumentos: true };
const gama = { papel: "unidades", nome: "Sócia do Gama", unidades: ["Gama"], verDocumentos: true };
const semMarca = { papel: "unidades", nome: "Sem liberação", unidades: ["Gama"], verDocumentos: false };
const pdf = (n = 100) => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(n)]);

describe("documentos das unidades: servidor", () => {
  it("dono e Master veem todas; unidades só as suas e só com a liberação", async () => {
    expect(unidadesDosDocumentos(dono).length).toBeGreaterThan(20);
    expect(unidadesDosDocumentos(master)).toEqual(unidadesDosDocumentos(dono));
    expect(unidadesDosDocumentos(gama)).toEqual(["Gama"]);
    expect(unidadesDosDocumentos(semMarca)).toEqual([]);
    expect((await lerDocumentos(gama)).unidades.map((u: { nome: string }) => u.nome)).toEqual(["Gama"]);
    expect((await lerDocumentos(gama)).podeApagar).toBe(false);
  });

  it("quem é de uma unidade não envia, não baixa nem cria pasta em outra", async () => {
    const a = await enviarArquivo(dono, { unidade: "Ceilândia", nome: "contrato.pdf" }, pdf());
    await expect(baixarArquivo(gama, { unidade: "Ceilândia", id: a.id })).rejects.toThrow(/permissão/);
    await expect(baixarArquivo(gama, { unidade: "Gama", id: a.id })).rejects.toThrow(/não encontrado/);
    await expect(enviarArquivo(gama, { unidade: "Ceilândia", nome: "x.pdf" }, pdf())).rejects.toThrow(/permissão/);
    await expect(criarPasta(gama, { unidade: "Ceilândia", nome: "x" })).rejects.toThrow(/permissão/);
    await expect(enviarArquivo(semMarca, { unidade: "Gama", nome: "x.pdf" }, pdf())).rejects.toThrow(/permissão/);
  });

  it("cria pasta, envia para dentro dela e baixa o mesmo conteúdo", async () => {
    const p = await criarPasta(gama, { unidade: "Gama", nome: "  Contrato / social " });
    expect(p.nome).toBe("Contrato - social");
    await expect(criarPasta(gama, { unidade: "Gama", nome: "contrato - SOCIAL" })).rejects.toThrow(/já existe/);
    const conteudo = pdf(500);
    const a = await enviarArquivo(gama, { unidade: "Gama", nome: "social.PDF", pastaId: p.id }, conteudo);
    expect(a).toMatchObject({ pastaId: p.id, tipo: "application/pdf", enviadoPor: "Sócia do Gama", tamanho: conteudo.length });
    expect((await baixarArquivo(master, { unidade: "Gama", id: a.id })).bytes).toEqual(conteudo);
    await expect(enviarArquivo(gama, { unidade: "Gama", nome: "y.pdf", pastaId: "sumiu" }, pdf())).rejects.toThrow(/não existe/);
  });

  it("barra tipo errado, arquivo disfarçado, vazio e grande demais", async () => {
    const env = (nome: string, b: unknown) => enviarArquivo(gama, { unidade: "Gama", nome }, b);
    await expect(env("virus.exe", pdf())).rejects.toThrow(/só entram/);
    await expect(env("pagina.html", pdf())).rejects.toThrow(/só entram/);
    await expect(env("falso.pdf", Buffer.from("<script>alert(1)</script>"))).rejects.toThrow(/conteúdo/);
    await expect(env("vazio.pdf", Buffer.alloc(0))).rejects.toThrow(/vazio/);
    await expect(env("texto.pdf", "isso não é um Buffer")).rejects.toThrow(/vazio/);
    await expect(env("grande.pdf", pdf(LIMITES.arquivo))).rejects.toThrow(/4 MB/);
  });

  it("respeita o limite de espaço da unidade", async () => {
    const quase = LIMITES.arquivo - 20;
    for (let i = 0; i < Math.floor(LIMITES.unidade / (quase + 9)); i += 1) await enviarArquivo(gama, { unidade: "Gama", nome: `a${i}.pdf` }, pdf(quase));
    await expect(enviarArquivo(gama, { unidade: "Gama", nome: "mais.pdf" }, pdf(quase))).rejects.toThrow(/espaço da unidade/);
  });

  it("limita os níveis de pasta", async () => {
    let pai: string | null = null;
    for (let i = 0; i < LIMITES.niveis; i += 1) pai = (await criarPasta(gama, { unidade: "Gama", nome: `n${i}`, pastaId: pai })).id;
    await expect(criarPasta(gama, { unidade: "Gama", nome: "fundo", pastaId: pai })).rejects.toThrow(/níveis/);
  });

  it("só o dono apaga, e pasta com coisa dentro não some", async () => {
    const p = await criarPasta(gama, { unidade: "Gama", nome: "Alvarás" });
    const a = await enviarArquivo(gama, { unidade: "Gama", nome: "alvara.pdf", pastaId: p.id }, pdf());
    await expect(apagarDocumento(gama, { unidade: "Gama", id: a.id })).rejects.toThrow(/só o dono/);
    await expect(apagarDocumento(master, { unidade: "Gama", id: a.id })).rejects.toThrow(/só o dono/);
    await expect(apagarDocumento(dono, { unidade: "Gama", id: p.id })).rejects.toThrow(/vazia/);
    await apagarDocumento(dono, { unidade: "Gama", id: a.id });
    await apagarDocumento(dono, { unidade: "Gama", id: p.id });
    expect((await lerDocumentos(gama)).unidades[0]).toMatchObject({ pastas: [], arquivos: [] });
    expect([...memoria.keys()].some((c) => c.includes("/arquivos/"))).toBe(false);
  });
});

describe("documentos das unidades: permissão", () => {
  it("é um campo próprio: só o dono dá, e vale só para quem tem acesso a unidades", async () => {
    await criarDono({ nome: "Dona Teste", email: "dona@exemplo.com", senha: "uma senha bem longa 123" }).catch(() => {});
    const { usuario } = await criarUsuario({ nome: "Pessoa Gama", email: "gama@exemplo.com", papel: "unidades", unidades: ["Gama"] });
    expect(usuario.acessaDocumentos).toBe(false);
    expect((await atualizarUsuario(usuario.id, { acessaDocumentos: true })).acessaDocumentos).toBe(true);
    await expect(atualizarUsuario(usuario.id, { acessaDocumentos: false }, { id: "m", papel: "master", gerenciaAcessos: true })).rejects.toThrow(/Só o dono/);
    const virouMaster = await atualizarUsuario(usuario.id, { papel: "master" });
    expect(virouMaster.acessaDocumentos).toBe(false);
    expect(verDocumentos(virouMaster)).toBe(true);
    // voltando a ser de unidades, não herda a marca antiga
    expect(publico((await atualizarUsuario(usuario.id, { papel: "unidades", unidades: ["Gama"] })) as never).acessaDocumentos).toBe(false);
    expect(verDocumentos({ papel: "unidades", verJuridico: true, verObras: true })).toBe(false);
  });
});

const unidade = {
  nome: "Gama", usado: 2048,
  pastas: [{ id: "p1", nome: "Contrato social", paiId: null, criadoPor: "A", criadoEm: "2026-11-25T12:00:00Z" }],
  arquivos: [{ id: "a1", nome: "alvara.pdf", pastaId: null, tamanho: 2048, tipo: "application/pdf", enviadoPor: "Pessoa Teste", enviadoEm: "2026-11-25T12:00:00Z" }],
};
const dados = { unidades: [unidade], limites: { arquivo: 4 * 1024 * 1024, unidade: 50 * 1024 * 1024, niveis: 3 }, podeApagar: false };
const nada = () => {};
const tela = (podeApagar: boolean) => renderToString(<PastaAberta u={unidade} dados={{ ...dados, podeApagar }} pastaId={null} ocupado={null} abrirPasta={nada} novaPasta={async () => true} enviar={nada} ver={nada} baixar={nada} apagar={nada} />);

describe("documentos das unidades: tela", () => {
  it("mostra pastas, arquivos e quem enviou; apagar só aparece para o dono", () => {
    const html = tela(false);
    for (const t of ["Contrato social", "alvara.pdf", "Pessoa Teste", "Enviar arquivo", "Nova pasta", "Baixar alvara.pdf", "Ver alvara.pdf"]) expect(html).toContain(t);
    expect(html).not.toContain("Apagar");
    expect(tela(true)).toContain("Apagar alvara.pdf");
    expect(renderToString(<ListaDeUnidades unidades={[unidade]} limite={dados.limites.unidade} abrir={nada} />)).toContain("Gama");
  });

  it("avisa antes de enviar o que não cabe", () => {
    expect(problemaDoArquivo({ name: "a.exe", size: 10 }, unidade, dados.limites)).toMatch(/só entram/);
    expect(problemaDoArquivo({ name: "a.pdf", size: 5 * 1024 * 1024 }, unidade, dados.limites)).toMatch(/limite/);
    expect(problemaDoArquivo({ name: "a.pdf", size: 3000 }, { ...unidade, usado: dados.limites.unidade }, dados.limites)).toMatch(/não cabe/);
    expect(problemaDoArquivo({ name: "A.PDF", size: 3000 }, unidade, dados.limites)).toBeNull();
    expect(tamanhoLegivel(1536 * 1024)).toBe("1,5 MB");
    expect(caminhoDaPasta(unidade.pastas, "p1").map((p) => p.nome)).toEqual(["Contrato social"]);
  });

  it("menu e ajuda só aparecem para quem acessa", () => {
    const ids = (documentos: boolean) => itensDoMenu(false, false, false, false, false, false, false, false, documentos).map((i) => i.id);
    expect(ids(true)).toContain("documentos");
    expect(ids(false)).not.toContain("documentos");
    expect(artigosPara(false, undefined, false, false, false, false, true).some((x) => x.secao === "documentos")).toBe(true);
    expect(artigosPara(false).some((x) => x.secao === "documentos")).toBe(false);
    expect(secoesPara(false).some((s) => s.id === "documentos")).toBe(false);
  });
});
