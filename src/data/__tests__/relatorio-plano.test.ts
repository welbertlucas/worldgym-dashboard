import { describe, expect, it } from "vitest";
import { ITENS_POR_SLIDE, MAX_SLIDES_PLANO, paginasDoPlano, planoDaUnidade } from "@/data/relatorioPlano";
import { ID_PLANO, montarRelatorioSemanal } from "@/data/relatorioSemana";
import { resumoDosSlides } from "@/data/relatorio";
import type { AlertaVigente, ResultadoVigente } from "@/data/alertasVigentes";
import { month, unit } from "./helpers";

const alerta = (unit: string, kind: string, tipo: "pendencia" | "ritmo", severity: "critical" | "attention" | "info", title = kind): AlertaVigente =>
  ({ id: `${unit}-${kind}`, unit, kind, tipo, severity, month: "2026-11", title, fact: `fato ${kind}`, action: `fazer ${kind}`, tela: "financeiro/cobranca", weight: 1 } as unknown as AlertaVigente);
const res = (alertas: AlertaVigente[], mes: string | null = "2026-11"): ResultadoVigente => ({ month: mes, dias: 14, comRitmo: true, alertas });

describe("plano de ação da unidade no relatório", () => {
  it("só os itens da unidade, 'Resolver agora' antes de 'Acelerar o mês' e críticos primeiro", () => {
    const r = res([
      alerta("Gama", "ritmoContratos", "ritmo", "attention"),
      alerta("Gama", "inadAberta", "pendencia", "attention"),
      alerta("Gama", "cartaoRecusado", "pendencia", "critical"),
      alerta("Asa Norte", "detratores", "pendencia", "critical"),
    ]);
    const p = planoDaUnidade(r, "Gama", "2026-11", {}, null)!;
    expect(p.pendentes.map((i) => i.titulo)).toEqual(["cartaoRecusado", "inadAberta", "ritmoContratos"]);
    expect(p.pendentes[0]).toMatchObject({ grupo: "Resolver agora", gravidade: "critico", fato: "fato cartaoRecusado", acao: "fazer cartaoRecusado" });
    expect(p.pendentes[2].grupo).toBe("Acelerar o mês");
    expect(p.dias).toBe(14);
  });

  it("feito vale só se a marcação é mais nova que a leitura do EVO; senão volta a pendente", () => {
    const r = res([alerta("Gama", "a", "pendencia", "attention"), alerta("Gama", "b", "pendencia", "attention")]);
    const feitos = { "Gama|a": { por: "Ana", em: "2026-11-17T10:00:00Z" }, "Gama|b": { por: "Ana", em: "2026-11-16T10:00:00Z" } };
    const p = planoDaUnidade(r, "Gama", "2026-11", feitos, "2026-11-17T04:00:00Z")!;
    expect(p.feitos).toEqual(["a"]);
    expect(p.pendentes.map((i) => i.titulo)).toEqual(["b"]);
  });

  it("não é do mês em andamento: sem plano; sem itens: plano limpo", () => {
    const r = res([alerta("Gama", "a", "pendencia", "attention")]);
    expect(planoDaUnidade(r, "Gama", "2026-10", {}, null)).toBeNull();
    expect(planoDaUnidade(res([], null), "Gama", "2026-11", {}, null)).toBeNull();
    expect(planoDaUnidade(r, "Itapoã", "2026-11", {}, null)!.pendentes).toEqual([]);
  });

  it("slides de 3 itens, no máximo 2 slides; o resto vira '+N itens'", () => {
    const itens = Array.from({ length: 8 }, (_, i) => alerta("Gama", `k${i}`, "pendencia", "attention"));
    const p = planoDaUnidade(res(itens), "Gama", "2026-11", {}, null)!;
    const { paginas, excedente } = paginasDoPlano(p);
    expect(paginas.map((x) => x.length)).toEqual([ITENS_POR_SLIDE, ITENS_POR_SLIDE]);
    expect(excedente).toBe(8 - ITENS_POR_SLIDE * MAX_SLIDES_PLANO);
    expect(paginasDoPlano(planoDaUnidade(res([]), "Gama", "2026-11", {}, null)!).paginas).toEqual([]);
  });

  it("entra no relatório semanal só de uma unidade e quando pedido", () => {
    const sem = (f: number) => ({ semanas: [{ faturamento: f }, { faturamento: f }] } as never);
    const nov = month("2026-11", [unit("Gama", sem(100)), unit("Asa Norte", sem(200))]);
    const plano = planoDaUnidade(res([alerta("Gama", "a", "pendencia", "critical", "Cartões recusados")]), "Gama", "2026-11", {}, null)!;
    const uma = montarRelatorioSemanal([nov], "2026-11", 2, ["fat", ID_PLANO], ["Gama"], 30, [], plano)!;
    expect(uma.plano?.pendentes).toHaveLength(1);
    expect(resumoDosSlides(uma)).toContain("Plano de ação");
    expect(montarRelatorioSemanal([nov], "2026-11", 2, ["fat"], ["Gama"], 30, [], plano)!.plano).toBeNull(); // não pedido
    expect(montarRelatorioSemanal([nov], "2026-11", 2, ["fat", ID_PLANO], null, 30, [], plano)!.plano).toBeNull(); // rede: sem plano
    expect(montarRelatorioSemanal([nov], "2026-11", 2, ["fat", ID_PLANO], ["Asa Norte"], 30, [], plano)!.plano).toBeNull(); // plano de outra unidade
  });
});
