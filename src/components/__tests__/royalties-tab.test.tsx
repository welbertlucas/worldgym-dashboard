import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RoyaltiesConteudo } from "@/components/tabs/RoyaltiesTab";
import { itensDoMenu, TODOS_OS_MENUS, nomeDaTela } from "@/components/nav";
import { MODELO } from "@/data/__tests__/royalties-fixture";

/** O React separa textos vizinhos com comentários vazios; tira para procurar a frase inteira. */
const limpo = (h: string) => h.replace(/<!-- -->/g, "");

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

  it("com dados, mostra os painéis: resumo, recebido por mês, quem está devendo, matriz e notas", () => {
    const html = limpo(renderToString(<RoyaltiesConteudo estado={{ fase: "pronto", dados: { disponivel: true, ...MODELO } }} />));
    for (const t of ["Resumo", "Recebido por mês", "Quem está devendo", "Situação de pagamento mês a mês", "Notas e premissas"]) expect(html).toContain(t);
    expect(html).toContain("Alfa");
    expect(html).toContain("Exportar CSV");
    // a observação da planilha não vem aberta: só aparece ao clicar na unidade
    expect(html).not.toContain("Acordo em duas parcelas.");
    expect(html).toContain("abr/26 ainda é parcial");
    expect(html).toContain("Royalties por unidade");
    expect(html).toContain("Esperado e recebido");
  });

  it("leitura que falhou na planilha mostra o aviso de versão antiga", () => {
    const modelo = { ...MODELO, meta: { ...MODELO.meta, stale: { motivo: "teste", tentativa: "21/11/2026 08:17" } } };
    const html = limpo(renderToString(<RoyaltiesConteudo estado={{ fase: "pronto", dados: { disponivel: true, ...modelo } }} />));
    expect(html).toContain("A leitura da planilha falhou em 21/11/2026 08:17");
  });
});
