import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Sidebar, MobileDrawer } from "@/components/Sidebar";
import { NAV_ITEMS } from "@/components/nav";

const noop = () => {};

describe("navegação", () => {
  it("mantém as 7 seções originais, na mesma ordem", () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual(["executiva", "comercial", "financeiro", "retencao", "unidades", "metas", "riscos"]);
  });

  it("sidebar lista todas as seções, marca a ativa e mostra o contador de críticos", () => {
    const html = renderToString(<Sidebar active="riscos" onChange={noop} criticalCount={15} collapsed={false} onToggleCollapsed={noop} />);
    for (const item of NAV_ITEMS) expect(html).toContain(item.label);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("15");
    expect(html).toContain("Recolher menu");
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
