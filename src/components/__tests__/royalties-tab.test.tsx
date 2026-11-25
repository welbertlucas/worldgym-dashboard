import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RoyaltiesConteudo } from "@/components/tabs/RoyaltiesTab";
import { itensDoMenu, TODOS_OS_MENUS, nomeDaTela } from "@/components/nav";
import { MODELO } from "@/data/__tests__/royalties-fixture";
import { DetalheDaUnidade } from "@/components/royalties/DetalheDaUnidade";
import { contexto, filtroInicial, resumoDoPeriodo } from "@/data/royalties";
import { SeletorDeUnidades, rotuloDasUnidades } from "@/components/royalties/SeletorDeUnidades";

/** O React separa textos vizinhos com comentários vazios; tira para procurar a frase inteira. */
const limpo = (h: string) => h.replace(/<!-- -->/g, "").replace(/\u00a0/g, " ");

describe("Royalties (menu e tela)", () => {
  it("o item só entra no menu para quem pode ver, e a busca acha por 'royalties'", () => {
    expect(itensDoMenu(false, false, false, false).some((i) => i.id === "franqueadora")).toBe(false);
    expect(itensDoMenu(false, false, false, true).some((i) => i.id === "franqueadora")).toBe(true);
    expect(itensDoMenu(true, true, true, true).map((i) => i.id)).toContain("franqueadora");
    expect(TODOS_OS_MENUS.some((i) => i.id === "franqueadora")).toBe(true);
    expect(nomeDaTela("royalties")).toBe("Franqueadora › Royalties");
  });

  it("mostra carregando, sem acesso, falha e 'ainda sem dados'", () => {
    expect(renderToString(<RoyaltiesConteudo estado={{ fase: "carregando" }} />)).toContain("Carregando");
    expect(renderToString(<RoyaltiesConteudo estado={{ fase: "erro", motivo: "permissao" }} />)).toContain("não tem acesso");
    expect(renderToString(<RoyaltiesConteudo estado={{ fase: "erro", motivo: "falha" }} />)).toContain("Não consegui carregar");
    expect(renderToString(<RoyaltiesConteudo estado={{ fase: "pronto", dados: { disponivel: false } }} />)).toContain("ainda não foram enviados");
  });

  it("com dados, mostra os painéis: resumo (cartões), quem está devendo, matriz e notas", () => {
    const html = limpo(renderToString(<RoyaltiesConteudo estado={{ fase: "pronto", dados: { disponivel: true, ...MODELO } }} />));
    for (const t of ["Total recebido", "Quem está devendo", "Situação de pagamento mês a mês", "Notas e premissas"]) expect(html).toContain(t);
    expect(html).toContain("Alfa");
    expect(html).toContain("Exportar CSV");
    // a observação da planilha não vem aberta: só aparece ao clicar na unidade
    expect(html).not.toContain("Acordo em duas parcelas.");
    expect(html).toContain("abr/26 ainda é parcial");
    // a concentração foi fundida em "Quem está devendo"; análises extras e notas começam recolhidas
    expect(html).toContain("concentram todo o saldo devedor");
    expect(html).not.toContain("Concentração e risco");
    expect(html).toContain("Mais análises");
    expect(html).not.toContain("Esperado e recebido");
    expect(html).not.toContain("Taxa fixa é cobrada");
  });

  it("leitura que falhou na planilha mostra o aviso de versão antiga", () => {
    const modelo = { ...MODELO, meta: { ...MODELO.meta, stale: { motivo: "teste", tentativa: "21/11/2026 08:17" } } };
    const html = limpo(renderToString(<RoyaltiesConteudo estado={{ fase: "pronto", dados: { disponivel: true, ...modelo } }} />));
    expect(html).toContain("A leitura da planilha falhou em 21/11/2026 08:17");
  });

  it("o detalhe da unidade é um painel (dialog) com saldo, dados da cobrança, meses sem recebimento e observação", () => {
    const c = contexto(MODELO);
    const html = limpo(renderToString(<DetalheDaUnidade c={c} unidade="Alfa" onFechar={() => {}} />));
    expect(html).toContain('aria-modal="true"');
    for (const t of ["Alfa", "Taxa fixa", "Saldo devedor total", "R$ 200,00", "Dia 10", "Meses sem recebimento (2)", "mar/26", "Recebido mês a mês e situação", "Acordo em duas parcelas."]) expect(html).toContain(t);
    expect(limpo(renderToString(<DetalheDaUnidade c={c} unidade="Sigma" onFechar={() => {}} />))).toContain("Sem cobrança");
    expect(renderToString(<DetalheDaUnidade c={c} unidade="Inexistente" onFechar={() => {}} />)).toBe("");
  });

  it("as devedoras são botões que abrem o detalhe", () => {
    const html = limpo(renderToString(<RoyaltiesConteudo estado={{ fase: "pronto", dados: { disponivel: true, ...MODELO } }} />));
    expect(html).toContain("Alfa: deve R$ 200. Abrir o detalhe");
  });

  it("dá para escolher mais de uma unidade: o rótulo conta as marcadas e os totais somam só elas", () => {
    expect(rotuloDasUnidades([])).toBe("Todas as unidades");
    expect(rotuloDasUnidades(["Alfa"])).toBe("Alfa");
    expect(rotuloDasUnidades(["Alfa", "Beta", "Gama"])).toBe("3 unidades");
    const c = contexto(MODELO as never);
    const [a, b] = c.m.unidades.filter((u) => c.tipoDe[u.nome] === c.tipoDe[c.m.unidades[0].nome]).map((u) => u.nome);
    const um = (u: string) => resumoDoPeriodo(c, { ...filtroInicial(c), unidades: [u] }).total;
    expect(resumoDoPeriodo(c, { ...filtroInicial(c), unidades: [a, b] }).total).toBeCloseTo(um(a) + um(b), 2);
    const html = limpo(renderToString(<SeletorDeUnidades opcoes={["Alfa", "Beta"]} marcadas={["Alfa", "Beta"]} onChange={() => {}} />));
    expect(html).toContain("2 unidades");
  });
});
