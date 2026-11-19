import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { InfluenciadoresTab } from "@/components/tabs/InfluenciadoresTab";
import { NAV_ITEMS, SUBMENUS, buscarNoMenu, itensDeBusca } from "@/components/nav";

const sessao = vi.hoisted(() => ({ dono: true }));
vi.mock("@/lib/auth", async (original) => ({ ...(await original<typeof import("@/lib/auth")>()), ehDono: () => sessao.dono }));

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
    sessao.dono = false;
    const h = html(null);
    expect(h).toContain("Contratos dos influenciadores");
    expect(h).toContain("Todas as unidades");
    expect(h).toContain("Carregando");
  });

  it("só o dono vê o botão de cadastro", () => {
    sessao.dono = true;
    expect(html(null)).toContain("Novo influenciador");
    sessao.dono = false;
    expect(html(null)).not.toContain("Novo influenciador");
  });

  it("com uma unidade escolhida, o subtítulo diz qual", () => {
    sessao.dono = false;
    expect(html("Gama")).toContain("Unidade escolhida: Gama");
  });
});
