import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RoyaltiesConteudo } from "@/components/tabs/RoyaltiesTab";
import { itensDoMenu, TODOS_OS_MENUS, nomeDaTela } from "@/components/nav";

describe("Royalties (menu e tela)", () => {
  it("o item só entra no menu para quem pode ver, e a busca acha por 'royalties'", () => {
    expect(itensDoMenu(false, false, false, false).some((i) => i.id === "royalties")).toBe(false);
    expect(itensDoMenu(false, false, false, true).some((i) => i.id === "royalties")).toBe(true);
    expect(itensDoMenu(true, true, true, true).map((i) => i.id)).toContain("royalties");
    expect(TODOS_OS_MENUS.some((i) => i.id === "royalties")).toBe(true);
    expect(nomeDaTela("royalties")).toBe("Royalties");
  });

  it("mostra carregando, sem acesso, falha e 'ainda sem dados'", () => {
    expect(renderToString(<RoyaltiesConteudo estado={{ fase: "carregando" }} />)).toContain("Carregando");
    expect(renderToString(<RoyaltiesConteudo estado={{ fase: "erro", motivo: "permissao" }} />)).toContain("não tem acesso");
    expect(renderToString(<RoyaltiesConteudo estado={{ fase: "erro", motivo: "falha" }} />)).toContain("Não consegui carregar");
    expect(renderToString(<RoyaltiesConteudo estado={{ fase: "pronto", dados: { disponivel: false } }} />)).toContain("ainda não foram enviados");
  });

  it("com dados, resume quantos meses e unidades chegaram", () => {
    const html = renderToString(<RoyaltiesConteudo estado={{ fase: "pronto", dados: { disponivel: true, meses: [{ key: "2026-11", label: "nov/26" }], unidades: [{ nome: "Gama", tipo: "Taxa fixa" }, { nome: "Itapoã", tipo: "Royalties" }] } }} />);
    expect(html).toMatch(/1(<!-- -->)? meses e (<!-- -->)?2(<!-- -->)? unidades/);
  });
});
