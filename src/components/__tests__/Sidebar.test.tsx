import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Sidebar, MobileDrawer } from "@/components/Sidebar";
import { enderecoAtual, GRUPOS_DO_MENU, NAV_ITEMS } from "@/components/nav";

const noop = () => {};

describe("navegação", () => {
  it("menu em grupos: painel, áreas, unidades (os ids antigos continuam, o mapa virou aba de Alunos)", () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual(["executiva", "plano", "metas", "riscos", "comercial", "financeiro", "alunos", "catraca", "retencao", "campanhas", "unidades", "benchmark"]);
    expect(NAV_ITEMS.map((i) => i.group)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2]);
  });

  it("endereços antigos levam para o lugar novo", () => {
    expect(enderecoAtual("mapa")).toBe("alunos/onde-moram");
    expect(enderecoAtual("alunos/frequencia")).toBe("catraca/frequencia");
    expect(enderecoAtual("comercial/oportunidades")).toBe("campanhas/leads");
    expect(enderecoAtual("financeiro/notas")).toBe("financeiro/notas");
  });

  it("sidebar lista todas as seções, marca a ativa e mostra o contador de críticos", () => {
    const html = renderToString(<Sidebar active="riscos" onChange={noop} criticalCount={15} collapsed={false} onToggleCollapsed={noop} />);
    for (const item of NAV_ITEMS) expect(html).toContain(item.label);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("15");
    expect(html).toContain("Recolher menu");
    for (const g of GRUPOS_DO_MENU.slice(0, 3)) expect(html).toContain(g);
  });

  it("recolhida, mantém rótulos acessíveis e o botão de expandir", () => {
    const html = renderToString(<Sidebar active="executiva" onChange={noop} criticalCount={0} collapsed onToggleCollapsed={noop} />);
    expect(html).toContain("Expandir menu");
    expect(html).toContain('class="flex-1 text-left sr-only"');
  });

  it("drawer só renderiza aberto e é um diálogo modal", () => {
    expect(renderToString(<MobileDrawer open={false} onClose={noop} active="executiva" onChange={noop} criticalCount={3} />)).toBe("");
    const html = renderToString(<MobileDrawer open onClose={noop} active="executiva" onChange={noop} criticalCount={3} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Fechar menu");
  });
});
