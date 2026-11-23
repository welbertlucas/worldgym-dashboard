import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enviados: any[] = [];
vi.mock("@/lib/auth", () => ({
  API_BASE: "https://exemplo/api",
  getUsuario: () => ({ nome: "Maria", email: "maria@exemplo.com", papel: "master", unidades: [] }),
  authFetch: vi.fn(async (_url: string, init: { body: string }) => { enviados.push(...JSON.parse(init.body).eventos); return { ok: true }; }),
}));

import { registrarTela, registrarExportacao, enviarAgora, ENVIAR_A_CADA_MS, _limpar } from "@/lib/atividade";
import { MarcaDagua } from "@/components/MarcaDagua";
import { nomeDaTela, DetalheDoAcesso, filtrarAcessos } from "@/components/tabs/AcessosTab";

describe("registro de atividade (cliente)", () => {
  beforeEach(() => { enviados.length = 0; _limpar(); });

  it("a mesma tela, unidade e mês só entram de novo depois de 5 minutos; exportar sempre entra e envia a fila na hora", () => {
    registrarTela("comercial/vendas", { unidade: "Gama", mes: "2026-11" }, 1_000);
    registrarTela("comercial/vendas", { unidade: "Gama", mes: "2026-11" }, 1_000 + 60_000);
    registrarTela("comercial/vendas", { unidade: null, mes: "2026-11" }, 1_000 + 60_000); // outra unidade na mesma tela: conta
    registrarTela("comercial/vendas", { unidade: "Gama", mes: "2026-11" }, 1_000 + 6 * 60_000);
    expect(enviados).toEqual([]); // ainda na fila: nada foi ao servidor
    registrarExportacao("benchmark/posicao");
    registrarExportacao("benchmark/posicao");
    expect(enviados.map((e) => [e.tela, e.evento, e.unidade, e.mes])).toEqual([
      ["comercial/vendas", "tela", "Gama", "2026-11"], ["comercial/vendas", "tela", null, "2026-11"], ["comercial/vendas", "tela", "Gama", "2026-11"],
      ["benchmark/posicao", "exportar", null, null], ["benchmark/posicao", "exportar", null, null],
    ]);
  });

  it("junta as telas e manda tudo de uma vez a cada 5 minutos", () => {
    vi.useFakeTimers();
    try {
      for (const t of ["financeiro", "alunos/base", "retencao/renovacao"]) registrarTela(t, { mes: "2026-11" });
      vi.advanceTimersByTime(ENVIAR_A_CADA_MS - 1000);
      expect(enviados).toHaveLength(0);
      vi.advanceTimersByTime(1000);
      expect(enviados.map((e) => e.tela)).toEqual(["financeiro", "alunos/base", "retencao/renovacao"]);
      enviarAgora(); // fila vazia: não manda nada
      expect(enviados).toHaveLength(3);
    } finally { vi.useRealTimers(); }
  });

  it("nome da tela legível", () => {
    expect(nomeDaTela("gerencial/vendas")).toBe("Gerencial › Vendas");
    expect(nomeDaTela("comercial/vendas")).toBe("Gerencial › Vendas"); // registro antigo, com o nome de hoje
    expect(nomeDaTela("executiva")).toBe("Overview");
    expect(nomeDaTela("xyz")).toBe("xyz");
  });
});

describe("marca d'água", () => {
  it("leva o e-mail e a data, não recebe cliques; sem e-mail não aparece", () => {
    const h = renderToString(<MarcaDagua email="maria@exemplo.com" />);
    expect(h).toContain("maria@exemplo.com");
    expect(h).toContain("pointer-events-none");
    expect(h).toContain("data-marca-dagua");
    expect(renderToString(<MarcaDagua email="" />)).toBe("");
  });
});

describe("detalhe do acesso (clicar no nome)", () => {
  const u = { id: "u1", nome: "Maria", email: "maria@exemplo.com", papel: "master" as const, unidades: [], ativo: true, resumo: true, criadoEm: "2026-11-01T00:00:00Z" };
  const entradas = [{ em: "2026-11-15T12:00:00Z", email: u.email, usuarioId: "u1", nome: "Maria", ok: false }, { em: "2026-11-14T12:00:00Z", email: u.email, usuarioId: "u1", nome: "Maria", ok: true }];
  const ativ = [{ em: "2026-11-15T13:00:00Z", usuarioId: "u1", nome: "Maria", email: u.email, tela: "comercial/vendas", evento: "tela" as const, unidade: "Gama", mes: "2026-10" }];

  it("dono: último acesso, entradas e telas com unidade e mês", () => {
    const h = renderToString(<DetalheDoAcesso usuario={u} entradas={entradas} atividade={ativ} onFechar={() => {}} />).replace(/<!-- -->/g, "");
    expect(h).toContain("Último acesso");
    expect(h).toContain("Senha errada");
    expect(h).toContain("Gerencial › Vendas"); // registro antigo (comercial/vendas) com o nome de hoje
    expect(h).toContain("Gama");
    expect(h).toContain("outubro de 2026");
  });

  it("quem não é dono não vê as telas abertas; sem entrada aparece 'nunca entrou'", () => {
    const h = renderToString(<DetalheDoAcesso usuario={u} entradas={[]} atividade={null} onFechar={() => {}} />).replace(/<!-- -->/g, "");
    expect(h).toContain("nunca entrou");
    expect(h).not.toContain("Telas abertas e exportações");
  });
});

describe("busca na lista de acessos", () => {
  const base = { ativo: true, resumo: true, criadoEm: "2026-11-01" };
  const lista = [
    { ...base, id: "1", nome: "Maria Souza", email: "maria@x.com", papel: "unidades" as const, unidades: ["Itapoã"] },
    { ...base, id: "2", nome: "João Lima", email: "joao@x.com", papel: "master" as const, unidades: [] },
  ];
  it("acha por nome, e-mail, nível ou unidade, sem acento; vazia mostra todos", () => {
    expect(filtrarAcessos(lista, "")).toHaveLength(2);
    expect(filtrarAcessos(lista, "joao").map((u) => u.id)).toEqual(["2"]);
    expect(filtrarAcessos(lista, "itapoa").map((u) => u.id)).toEqual(["1"]);
    expect(filtrarAcessos(lista, "master").map((u) => u.id)).toEqual(["2"]);
    expect(filtrarAcessos(lista, "ninguem")).toEqual([]);
  });
});
