import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvisoMesFechado } from "@/components/AvisoMesFechado";

const limpo = (h: string) => h.replace(/<!-- -->/g, "");

describe("aviso de mês fechado", () => {
  const agora = new Date(2026, 10, 15); // novembro/2026

  it("alertas: diz o mês fechado e aponta o mês em andamento para as Metas", () => {
    const h = limpo(renderToString(<AvisoMesFechado evalMonth="2026-10" oQue="alertas" agora={agora} />));
    expect(h).toContain("Estes alertas são de outubro de 2026, o último mês fechado");
    expect(h).toContain("novembro de 2026");
    expect(h).toContain("Metas");
  });

  it("plano: frase própria", () => {
    const h = limpo(renderToString(<AvisoMesFechado evalMonth="2026-10" oQue="plano" agora={agora} />));
    expect(h).toContain("Este plano sai do que aconteceu em outubro de 2026");
  });
});
