import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS da função serverless
import { aplicarVerComo, ehSoConsulta, sessaoComoPessoa } from "../../../api/_auth.js";
import { cabecalhoVerComo } from "@/lib/auth";

const dono = { id: "1", nome: "Dono", email: "d@x", papel: "dono", unidades: [], legado: false };
const nomes = ["Gama", "Itapoã", "Asa Norte"];

describe("ver como (dono simulando outro nível)", () => {
  it("dono vira master ou o acesso de unidades válidas, com papelReal", () => {
    expect(aplicarVerComo(dono, "master", nomes)).toMatchObject({ papel: "master", unidades: [], papelReal: "dono" });
    expect(aplicarVerComo(dono, cabecalhoVerComo({ papel: "unidades", unidades: ["Itapoã", "Inventada"] })["X-Atlas-Ver-Como"], nomes))
      .toMatchObject({ papel: "unidades", unidades: ["Itapoã"], papelReal: "dono" });
  });

  it("o dono simulando continua vendo o menu Relatórios (com os dados do nível simulado)", () => {
    const comRelatorios = { ...dono, geraRelatorios: true, gerenciaAcessos: true };
    expect(aplicarVerComo(comRelatorios, "master", nomes)).toMatchObject({ geraRelatorios: true, gerenciaAcessos: false });
    expect(aplicarVerComo(comRelatorios, "unidades:Gama", nomes)).toMatchObject({ papel: "unidades", geraRelatorios: true, gerenciaAcessos: false });
  });

  it("royalties na simulação: como Master o dono continua vendo; como quem tem acesso a unidades, não", () => {
    const dono = { id: "d", nome: "Dono", email: "d@x.com", papel: "dono", unidades: [], verRoyalties: true, geraRelatorios: true } as any;
    expect(aplicarVerComo(dono, "master", nomes).verRoyalties).toBe(true);
    // como Master o dono vê o Jurídico e a Qualidade (só consulta); a edição e o checklist da unidade são liberações de cada pessoa
    expect(aplicarVerComo({ ...dono, verJuridico: true, verQualidade: true, editaQualidade: true }, "master", nomes)).toMatchObject({ verJuridico: true, verQualidade: true, editaQualidade: false });
    expect(aplicarVerComo({ ...dono, preencheChecklist: true }, "master", nomes).preencheChecklist).toBe(false);
    expect(aplicarVerComo({ ...dono, verJuridico: true, verQualidade: true, editaQualidade: true }, cabecalhoVerComo({ papel: "unidades", unidades: ["Itapoã"] })["X-Atlas-Ver-Como"], nomes)).toMatchObject({ verJuridico: false, verQualidade: false, editaQualidade: false });
    expect(aplicarVerComo(dono, cabecalhoVerComo({ papel: "unidades", unidades: ["Itapoã"] })["X-Atlas-Ver-Como"], nomes).verRoyalties).toBe(false);
  });

  it("ignora pedido inválido e quem não é dono não consegue simular", () => {
    expect(aplicarVerComo(dono, "unidades:Inventada", nomes)).toBe(dono);
    expect(aplicarVerComo(dono, "admin", nomes)).toBe(dono);
    expect(aplicarVerComo(dono, undefined, nomes)).toBe(dono);
    const master = { ...dono, papel: "master" };
    expect(aplicarVerComo(master, "unidades:Gama", nomes)).toBe(master);
    const unidade = { ...dono, papel: "unidades", unidades: ["Gama"] };
    expect(aplicarVerComo(unidade, "master", nomes)).toBe(unidade); // não sobe de nível
  });

  it("o cabeçalho leva os nomes com acento codificados", () => {
    expect(cabecalhoVerComo(null)).toEqual({});
    expect(cabecalhoVerComo({ papel: "master" })).toEqual({ "X-Atlas-Ver-Como": "master" });
    expect(cabecalhoVerComo({ papel: "unidades", unidades: ["Itapoã", "Gama"] })["X-Atlas-Ver-Como"]).toBe("unidades:Itapo%C3%A3%7CGama");
  });

  it("ver como uma pessoa: o dono recebe o nível, as unidades e as liberações dela, só para consulta; pedido inválido é ignorado", () => {
    const gerente = { id: "g1", nome: "Gerente Gama", email: "g@x.com", papel: "unidades", unidades: ["Gama"], ativo: true, preencheChecklist: true, trocarSenha: true };
    const inativo = { ...gerente, id: "g2", ativo: false };
    const outroDono = { ...dono, id: "d2" };
    const lista = [dono, gerente, inativo, outroDono];
    const s = sessaoComoPessoa({ ...dono, papel: "dono" }, "pessoa:g1", lista);
    expect(s).toMatchObject({ id: "g1", papel: "unidades", unidades: ["Gama"], preencheChecklist: true, verQualidade: false, papelReal: "dono", somenteLeitura: true, simulaNome: "Gerente Gama", trocarSenha: false });
    expect(sessaoComoPessoa({ ...dono }, "pessoa:g2", lista)).toBeNull(); // inativa
    expect(sessaoComoPessoa({ ...dono }, "pessoa:d2", lista)).toBeNull(); // outro dono
    expect(sessaoComoPessoa({ ...dono }, "pessoa:nao-existe", lista)).toBeNull();
    expect(sessaoComoPessoa({ ...dono, papel: "master" }, "pessoa:g1", lista)).toBeNull(); // só o dono simula
    expect(sessaoComoPessoa({ ...dono }, "master", lista)).toBeNull();
    expect(cabecalhoVerComo({ papel: "pessoa", id: "g1", nome: "Gerente Gama" })).toEqual({ "X-Atlas-Ver-Como": "pessoa:g1" });
  });
  it("no Ver como, só a busca de academias concorrentes passa como consulta; salvar estudos continua bloqueado", () => {
    expect(ehSoConsulta({ query: { modulo: "estudos" }, body: { acao: "pois" } })).toBe(true);
    expect(ehSoConsulta({ query: { modulo: "estudos" }, body: JSON.stringify({ acao: "pois" }) })).toBe(true);
    expect(ehSoConsulta({ query: { modulo: "estudos" }, body: { acao: "pontos" } })).toBe(false);
    expect(ehSoConsulta({ query: { modulo: "qualidade" }, body: { acao: "pois" } })).toBe(false);
    expect(ehSoConsulta({ query: {}, body: "{" })).toBe(false);
  });
});
