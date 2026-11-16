import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { horaBR, textoDoAviso } from "../../../server/avisoFalha.js";

describe("aviso de falha das rotinas", () => {
  it("diz qual rotina falhou, quando (hora de Brasília) e o que isso afeta", () => {
    const { assunto, html } = textoDoAviso({ rotina: "Atualizar indicadores do EVO", conclusao: "failure", link: "https://github.com/x/actions/runs/1", inicio: "2026-11-16T03:37:00Z" });
    expect(assunto).toBe("World Gym Atlas · falha: Atualizar indicadores do EVO");
    expect(html).toContain("começou em 16/11 às 00h37");
    expect(html).toContain("dados de ontem");
    expect(html).toContain('href="https://github.com/x/actions/runs/1"');
  });

  it("tempo esgotado tem outro texto; rotina desconhecida sai sem a linha do efeito", () => {
    const { html } = textoDoAviso({ rotina: "<Outra>", conclusao: "timed_out", link: "", inicio: "" });
    expect(html).toContain("passou do tempo limite");
    expect(html).toContain("&lt;Outra&gt;");
    expect(html).not.toContain("href");
    expect(horaBR("x")).toBe("");
  });
});
