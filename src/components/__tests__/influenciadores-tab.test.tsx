import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { InfluenciadoresTab } from "@/components/tabs/InfluenciadoresTab";
import { NAV_ITEMS, SUBMENUS, buscarNoMenu, itensDeBusca } from "@/components/nav";

const sessao = vi.hoisted(() => ({ papel: "dono" as "dono" | "master" | "unidades" }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  ehDono: () => sessao.papel === "dono", papelAtual: () => sessao.papel, unidadesProprias: () => (sessao.papel === "unidades" ? ["Gama"] : null),
}));

const html = (unit: string | null) => renderToString(<InfluenciadoresTab unit={unit} />).replace(/<!-- -->/g, "");

describe("Marketing › Influenciadores", () => {
  it("a aba existe no menu de Marketing, depois do Instagram", () => {
    expect(SUBMENUS.campanhas.map((a) => a.id)).toEqual(["campanhas", "anuncios", "instagram", "influenciadores"]);
  });

  it("a busca do menu acha a aba por palavras como influencer e contrato", () => {
    const itens = itensDeBusca(NAV_ITEMS);
    for (const termo of ["influenciadores", "influencer", "contrato reels"]) expect(buscarNoMenu(itens, termo).some((i) => JSON.stringify(i).includes("influenciadores"))).toBe(true);
  });

  it("a tela abre sem quebrar e mostra o título enquanto carrega", () => {
    sessao.papel = "master";
    const h = html(null);
    expect(h).toContain("Contratos dos influenciadores");
    expect(h).toContain("Todas as unidades");
    expect(h).toContain("Carregando");
  });

  it("dono, Master e quem tem acesso por unidades veem o botão de cadastro", () => {
    for (const papel of ["dono", "master", "unidades"] as const) {
      sessao.papel = papel;
      expect(html(null)).toContain("Novo influenciador");
    }
  });

  it("com uma unidade escolhida, o subtítulo diz qual", () => {
    sessao.papel = "master";
    expect(html("Gama")).toContain("Unidade escolhida: Gama");
  });
});
