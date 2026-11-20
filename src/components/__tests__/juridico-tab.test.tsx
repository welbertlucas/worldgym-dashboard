import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { JuridicoConteudo } from "@/components/tabs/JuridicoTab";
import { itensDoMenu, TODOS_OS_MENUS, nomeDaTela } from "@/components/nav";
import type { Processo } from "@/data/juridico";

const limpo = (h: string) => h.replace(/<!-- -->/g, "").replace(/ /g, " ");
const P = (o: Partial<Processo>): Processo => ({ ano: 2026, numero: "1", empresa: "Alfa Ltda", polo: "Réu", natureza: "judicial", orgao: "TJDF", juizo: "", tipo: "Ação de Indenização", valor: 10000, sigiloso: false, status: "Ativo", ultimaMov: "2026-11-15", arquivado: false, ...o });
const MODELO = { atualizadoEm: "2026-11-20T12:00:00.000Z", processos: [P({}), P({ numero: "2", valor: null, sigiloso: true, ultimaMov: null }), P({ numero: "3", empresa: "Beta Ltda", orgao: "PROCON-GO", natureza: "extrajudicial", tipo: "Notificação", valor: 0, ultimaMov: "2026-08-01" }), P({ numero: "4", arquivado: true, status: "Arquivado" })] };

describe("Jurídico (menu e tela)", () => {
  it("o item só entra no menu para quem foi liberado", () => {
    expect(itensDoMenu(false, false, false, false, false).some((i) => i.id === "juridico")).toBe(false);
    expect(itensDoMenu(false, false, false, false, true).some((i) => i.id === "juridico")).toBe(true);
    expect(TODOS_OS_MENUS.some((i) => i.id === "juridico")).toBe(true);
    expect(nomeDaTela("juridico")).toBe("Jurídico");
  });

  it("mostra carregando, sem acesso, falha e 'ainda sem dados'", () => {
    expect(renderToString(<JuridicoConteudo estado={{ fase: "carregando" }} />)).toContain("Carregando");
    expect(renderToString(<JuridicoConteudo estado={{ fase: "erro", motivo: "permissao" }} />)).toContain("não tem acesso");
    expect(renderToString(<JuridicoConteudo estado={{ fase: "erro", motivo: "falha" }} />)).toContain("Não consegui carregar");
    expect(renderToString(<JuridicoConteudo estado={{ fase: "pronto", dados: { disponivel: false } }} />)).toContain("ainda não foram enviados");
  });

  it("com dados, mostra os cartões, os rankings e a lista (só ativos de início)", () => {
    const html = limpo(renderToString(<JuridicoConteudo hoje="2026-11-20" estado={{ fase: "pronto", dados: { disponivel: true, ...MODELO } }} />));
    for (const t of ["Processos", "Valor em causa", "Como réu", "Judiciais", "Sem andamento", "Por empresa", "Por órgão", "Por tipo de ação", "Alfa Ltda", "PROCON-GO", "Sigiloso"]) expect(html).toContain(t);
    expect(html).toContain("1 arquivado na planilha");
    expect(html).toContain("Exportar CSV");
    expect(html).toContain("nome da parte contrária");
    expect(html).not.toContain("Arquivado</");
  });
});
