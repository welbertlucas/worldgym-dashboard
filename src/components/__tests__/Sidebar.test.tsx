import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Sidebar, MobileDrawer } from "@/components/Sidebar";
import { enderecoAtual, NAV_ITEMS } from "@/components/nav";

const noop = () => {};

describe("navegação", () => {
  it("menu numa sequência só (os ids antigos continuam, o mapa virou aba de Alunos)", () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual(["executiva", "plano", "metas", "riscos", "gerencial", "alunos", "catraca", "retencao", "campanhas", "benchmark"]);
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

  it("sidebar lista as seções (Alertas fica no cabeçalho, não na barra) e marca a ativa", () => {
    const html = renderToString(<Sidebar active="riscos" onChange={noop} collapsed={false} onToggleCollapsed={noop} />);
    for (const item of NAV_ITEMS.filter((i) => !i.oculto)) expect(html).toContain(item.label);
    expect(html).not.toContain(">Alertas<");
    expect(html).toContain("Recolher menu");
    for (const g of ["Painel", "Áreas", "Administração"]) expect(html).not.toContain(`>${g}<`); // sem títulos de grupo
  });

  it("recolhida, mantém rótulos acessíveis e o botão de expandir", () => {
    const html = renderToString(<Sidebar active="executiva" onChange={noop} collapsed onToggleCollapsed={noop} />);
    expect(html).toContain("Expandir menu");
    expect(html).toContain('class="flex-1 text-left sr-only"');
  });

  it("drawer só renderiza aberto e é um diálogo modal", () => {
    expect(renderToString(<MobileDrawer open={false} onClose={noop} active="executiva" onChange={noop} />)).toBe("");
    const html = renderToString(<MobileDrawer open onClose={noop} active="executiva" onChange={noop} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Fechar menu");
  });
});

import { AlertasNoTopo, maisCriticos } from "@/components/AlertasNoTopo";
import type { Alert } from "@/data/alerts";

describe("alertas no cabeçalho", () => {
  const alerta = (id: string, severity: Alert["severity"], weight: number, unit = "Gama"): Alert =>
    ({ id, unit, kind: "faturamento", severity, month: "2026-10", fact: `fato ${id}`, rule: "r", weight }) as unknown as Alert;
  const lista = [alerta("a", "critical", 0.02), alerta("b", "attention", 0.5), alerta("c", "critical", 0.09, "Asa Norte"), alerta("d", "critical", 0.05)];

  it("o painel traz só críticos, os de maior peso primeiro, no máximo 5", () => {
    expect(maisCriticos(lista).map((a) => a.id)).toEqual(["c", "d", "a"]);
    const muitos = Array.from({ length: 9 }, (_, i) => alerta(`x${i}`, "critical", i / 100));
    expect(maisCriticos(muitos)).toHaveLength(5);
  });

  it("o botão mostra o número de críticos e fica com rótulo acessível", () => {
    const html = renderToString(<AlertasNoTopo alertas={lista} onVerTodos={noop} />);
    expect(html).toContain('aria-label="Alertas: 3 críticos"');
    expect(html).toContain(">3<");
    expect(renderToString(<AlertasNoTopo alertas={[]} onVerTodos={noop} />)).toContain('aria-label="Alertas: nenhum crítico"');
  });

  it("a busca do menu ainda acha Alertas, mesmo fora da barra lateral", async () => {
    const { itensDoMenu, itensDeBusca, buscarNoMenu } = await import("@/components/nav");
    expect(itensDoMenu(false).some((i) => i.id === "riscos")).toBe(false);
    expect(buscarNoMenu(itensDeBusca(itensDoMenu(false, true)), "alertas").map((r) => r.destino)).toContain("riscos");
  });
});
