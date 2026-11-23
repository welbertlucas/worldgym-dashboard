import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { EmBreve } from "@/components/EmBreve";
import { ABAS_SO_DONO, TODOS_OS_MENUS, buscarNoMenu, itensDeBusca, itensDoMenu, nomeDaTela, ondeFica } from "@/components/nav";

describe("menus reservados ao dono (Em breve)", () => {
  it("Estudos de ponto e Unidades em obra só aparecem no menu do dono", () => {
    const ids = (dono: boolean) => itensDoMenu(false, false, true, true, true, true, dono).map((i) => i.id);
    expect(ids(true)).toEqual(expect.arrayContaining(["estudos-de-ponto", "unidades-em-obra"]));
    expect(ids(false)).not.toContain("estudos-de-ponto");
    expect(ids(false)).not.toContain("unidades-em-obra");
    expect(TODOS_OS_MENUS.map((m) => m.id)).toEqual(expect.arrayContaining(["estudos-de-ponto", "unidades-em-obra"])); // o endereço existe
    expect(nomeDaTela("estudos-de-ponto")).toBe("Estudos de ponto");
    expect(nomeDaTela("gerencial/despesas")).toBe("Gerencial › Despesas");
    expect(ondeFica("unidades-em-obra")).toBe("Menu › Unidades em obra");
  });

  it("o dono pode liberar cada menu separadamente para outra pessoa", () => {
    const ids = (e: { estudos?: boolean; obras?: boolean }) => itensDoMenu(false, false, false, false, false, false, e).map((i) => i.id);
    expect(ids({ estudos: true })).toContain("estudos-de-ponto");
    expect(ids({ estudos: true })).not.toContain("unidades-em-obra");
    expect(ids({ obras: true })).toContain("unidades-em-obra");
    expect(ids({ obras: true })).not.toContain("estudos-de-ponto");
    expect(ids({})).not.toContain("estudos-de-ponto");
  });

  it("a busca só acha esses menus e a aba Despesas para o dono", () => {
    const itens = itensDoMenu(false, true, true, true, true, true, true);
    const doDono = (q: string) => buscarNoMenu(itensDeBusca(itens, true), q).map((i) => i.destino);
    expect(doDono("geomarketing")).toContain("estudos-de-ponto");
    expect(doDono("obra")).toContain("unidades-em-obra");
    expect(doDono("contas a pagar")).toContain("gerencial/despesas");
    const semDono = itensDoMenu(false, true, true, true, true, true, false);
    const deOutro = (q: string) => buscarNoMenu(itensDeBusca(semDono, false), q).map((i) => i.destino);
    expect(deOutro("geomarketing")).toEqual([]);
    expect(deOutro("obra")).not.toContain("unidades-em-obra"); // "obra" casa com "cobrança" em outras telas, mas não com o menu reservado
    expect(deOutro("contas a pagar")).not.toContain("gerencial/despesas"); // outras telas podem casar com palavras soltas, mas não a Despesas
    expect(ABAS_SO_DONO.has("gerencial/despesas")).toBe(true);
  });

  it("a tela mostra o título, a descrição e o selo Em breve", () => {
    const h = renderToString(<EmBreve titulo="Despesas" descricao="Contas a pagar e pagas." />);
    for (const t of ["Despesas", "Contas a pagar e pagas.", "Em breve"]) expect(h).toContain(t);
  });
});
