import { describe, expect, it } from "vitest";
import { gruposVigentes } from "@/data/planoVigente";
import { rankingDoPlano } from "@/data/rankingPlano";
import type { AlertaVigente } from "@/data/alertasVigentes";

const a = (unit: string, kind: string) => ({ unit, kind, severity: "attention", tipo: "pendencia", weight: 1 }) as unknown as AlertaVigente;
const LEITURA = "2026-11-16T03:00:00Z";
const ANTES = "2026-11-15T12:00:00Z"; // marcado antes da leitura do EVO
const DEPOIS = "2026-11-16T12:00:00Z"; // marcado depois da leitura do EVO
const f = (em: string) => ({ por: "Ana", em });

describe("ranking do plano", () => {
  it("unidade sem nenhum item vai para 'plano limpo', fora da disputa e nunca abaixo de quem tem itens", () => {
    const grupos = gruposVigentes([a("A", "inadAberta"), a("A", "renovacao"), a("A", "sumidos")]);
    const r = rankingDoPlano(["A", "B", "Rede"], grupos, {}, LEITURA);
    expect(r.limpas.map((p) => p.unit)).toEqual(["B"]);
    expect(r.disputa.map((p) => p.unit)).toEqual(["A"]);
    expect(r.disputa[0]).toMatchObject({ resolvidos: 0, pendentes: 3, pct: 0, posicao: 1 });
  });

  it("resolvido = marcado e o alerta saiu da leitura do EVO (o feito fica gravado mesmo sem o alerta)", () => {
    const grupos = gruposVigentes([a("A", "sumidos")]);
    const feitos = { "A|inadAberta": f(ANTES), "A|renovacao": f(ANTES) };
    const [p] = rankingDoPlano(["A"], grupos, feitos, LEITURA).disputa;
    expect(p).toMatchObject({ resolvidos: 2, pendentes: 1, total: 3 });
    expect(Math.round(p.pct!)).toBe(67);
  });

  it("marcado depois da leitura aguarda; marcado antes e o alerta continuou volta a pendente", () => {
    const grupos = gruposVigentes([a("A", "inadAberta"), a("A", "renovacao"), a("A", "sumidos"), a("A", "conversao")]);
    const feitos = { "A|inadAberta": f(DEPOIS), "A|renovacao": f(ANTES) };
    const [p] = rankingDoPlano(["A"], grupos, feitos, LEITURA).disputa;
    expect(p).toMatchObject({ aguardando: 1, pendentes: 3, resolvidos: 0, total: 3 });
  });

  it("item que sumiu sem marcação não conta a favor nem contra", () => {
    const r = rankingDoPlano(["A"], gruposVigentes([]), {}, LEITURA);
    expect(r.limpas.map((p) => p.unit)).toEqual(["A"]);
  });

  it("ordena pela proporção e não pela quantidade; empate divide a posição; poucos itens ficam fora da disputa", () => {
    // Grande resolveu 3 de 6 (50%); Média e Gêmea resolveram 2 de 3 (67%): ganham de Grande mesmo resolvendo menos itens.
    const grupos = gruposVigentes([
      a("Pequena", "inadAberta"),
      a("Grande", "renovacao"), a("Grande", "sumidos"), a("Grande", "conversao"),
      a("Média", "sumidos"),
      a("Gêmea", "sumidos"),
    ]);
    const feitos = {
      "Pequena|renovacao": f(ANTES),
      "Grande|inadAberta": f(ANTES), "Grande|detratores": f(ANTES), "Grande|cartaoRecusado": f(ANTES),
      "Média|inadAberta": f(ANTES), "Média|renovacao": f(ANTES),
      "Gêmea|inadAberta": f(ANTES), "Gêmea|renovacao": f(ANTES),
    };
    const r = rankingDoPlano(["Pequena", "Grande", "Média", "Gêmea", "Livre"], grupos, feitos, LEITURA);
    expect(r.disputa.map((p) => [p.unit, p.posicao])).toEqual([["Gêmea", 1], ["Média", 1], ["Grande", 3]]);
    expect(r.poucos.map((p) => p.unit)).toEqual(["Pequena"]);
    expect(r.limpas.map((p) => p.unit)).toEqual(["Livre"]);
  });
});
