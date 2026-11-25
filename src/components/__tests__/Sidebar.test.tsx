import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Sidebar, MobileDrawer } from "@/components/Sidebar";
import { enderecoAtual, NAV_ITEMS } from "@/components/nav";

const noop = () => {};

describe("navegação", () => {
  it("menu numa sequência só (os ids antigos continuam, o mapa virou aba de Alunos)", () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual(["executiva", "riscos", "plano", "metas", "gerencial", "alunos", "catraca", "retencao", "campanhas", "benchmark"]);
  });

  it("endereços antigos levam para o lugar novo", () => {
    expect(enderecoAtual("mapa")).toBe("alunos/onde-moram");
    expect(enderecoAtual("alunos/frequencia")).toBe("catraca/frequencia");
    expect(enderecoAtual("campanhas/leads")).toBe("gerencial/oportunidades");
    expect(enderecoAtual("unidades")).toBe("benchmark/posicao");
    expect(enderecoAtual("gerencial/notas")).toBe("gerencial/notas");
    // Comercial e Financeiro viraram Gerencial: links salvos continuam abrindo o lugar certo
    expect(enderecoAtual("financeiro/notas")).toBe("gerencial/notas");
    expect(enderecoAtual("comercial")).toBe("gerencial/vendas");
    expect(enderecoAtual("comercial/resumo")).toBe("gerencial/vendas");
    expect(enderecoAtual("financeiro/resumo")).toBe("gerencial/recebimento");
  });

  it("sidebar lista as seções (Alertas logo abaixo de Overview) e marca a ativa", () => {
    const html = renderToString(<Sidebar active="riscos" onChange={noop} collapsed={false} onToggleCollapsed={noop} />);
    for (const item of NAV_ITEMS.filter((i) => !i.oculto)) expect(html).toContain(item.label);
    expect(html).toContain(">Alertas<");
    expect(html.indexOf(">Alertas<")).toBeGreaterThan(html.indexOf(">Overview<"));
    expect(html.indexOf(">Alertas<")).toBeLessThan(html.indexOf(">Plano de ação<"));
    expect(html).toContain("Recolher menu");
    for (const g of ["Painel", "Áreas", "Administração"]) expect(html).not.toContain(`>${g}<`); // sem títulos de grupo
  });

  it("recolhida, mantém rótulos acessíveis e o botão de expandir", () => {
    const html = renderToString(<Sidebar active="executiva" onChange={noop} collapsed onToggleCollapsed={noop} />);
    expect(html).toContain("Expandir menu");
    expect(html).toContain('class="flex-1 whitespace-nowrap text-left sr-only"');
  });

  it("drawer só renderiza aberto e é um diálogo modal", () => {
    expect(renderToString(<MobileDrawer open={false} onClose={noop} active="executiva" onChange={noop} />)).toBe("");
    const html = renderToString(<MobileDrawer open onClose={noop} active="executiva" onChange={noop} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Fechar menu");
  });
});

describe("alertas no menu", () => {
  it("Alertas é o segundo item do menu, logo abaixo de Overview, e não está escondido", async () => {
    const { itensDoMenu } = await import("@/components/nav");
    expect(itensDoMenu(false).slice(0, 2).map((i) => i.id)).toEqual(["executiva", "riscos"]);
  });

  it("o número de alertas críticos aparece ao lado de Alertas, com rótulo acessível; sem críticos, não aparece", () => {
    const com = renderToString(<Sidebar active="executiva" onChange={noop} collapsed={false} onToggleCollapsed={noop} criticalCount={3} />);
    expect(com).toContain('aria-label="3 alertas críticos"');
    const um = renderToString(<Sidebar active="executiva" onChange={noop} collapsed={false} onToggleCollapsed={noop} criticalCount={1} />);
    expect(um).toContain('aria-label="1 alerta crítico"');
    const sem = renderToString(<Sidebar active="executiva" onChange={noop} collapsed={false} onToggleCollapsed={noop} criticalCount={0} />);
    expect(sem).not.toContain("alerta crítico");
    expect(sem).not.toContain("alertas críticos");
  });

  it("o drawer do celular também mostra o número", () => {
    const html = renderToString(<MobileDrawer open onClose={noop} active="executiva" onChange={noop} criticalCount={2} />);
    expect(html).toContain('aria-label="2 alertas críticos"');
  });

  it("a busca do menu acha Alertas", async () => {
    const { itensDoMenu, itensDeBusca, buscarNoMenu } = await import("@/components/nav");
    expect(buscarNoMenu(itensDeBusca(itensDoMenu(false)), "alertas").map((r) => r.destino)).toContain("riscos");
  });
});
