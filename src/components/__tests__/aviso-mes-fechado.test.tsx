import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvisoMesFechado } from "@/components/AvisoMesFechado";

describe("aviso de mês fechado (Fechamento)", () => {
  it("diz o mês fechado e manda o que fazer agora para o mês em andamento", () => {
    const h = renderToString(<AvisoMesFechado evalMonth="2026-10" agora={new Date(2026, 10, 15)} />).replace(/<!-- -->/g, "");
    expect(h).toContain("Estes alertas são de outubro de 2026, o último mês fechado");
    expect(h).toContain("O que fazer em <b>novembro de 2026</b> está na aba Mês em andamento e no Plano de ação");
  });
});
