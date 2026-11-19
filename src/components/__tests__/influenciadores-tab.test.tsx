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

describe("Cartão do influenciador: perfil lido do Instagram", () => {
  const base = { id: "1", usuario: "larisse.sousaa_", nome: "Larisse", unidade: "Gama", inicio: null, fim: null, entregas: { stories: 6, feed: 1, reels: 1 }, ativo: true, criadoEm: "2026-11-19T00:00:00Z" };
  const cartao = async (perfil: { seguidores: number | null; publicacoes: number | null; foto: boolean; erro: string | null } | null) => {
    const { CartaoDoInfluenciador } = await import("@/components/tabs/InfluenciadoresTab");
    return renderToString(<ul><CartaoDoInfluenciador i={base} perfil={perfil} pode={false} onEditar={() => {}} onAtivo={() => {}} onRemover={() => {}} /></ul>).replace(/<!-- -->/g, "").replace(/\u00a0/g, " ");
  };
  it("com o perfil lido, mostra os seguidores em formato curto", async () => {
    const h = await cartao({ seguidores: 14417, publicacoes: 300, foto: false, erro: null });
    expect(h).toContain("14,4 mil");
    expect(h).toContain("seguidores");
    expect(h).not.toContain("Perfil não lido");
  });
  it("sem leitura ainda, não mostra seguidores nem aviso", async () => {
    const h = await cartao(null);
    expect(h).not.toContain("seguidores");
    expect(h).not.toContain("Perfil não lido");
  });
  it("perfil que não pôde ser lido avisa que talvez seja conta pessoal ou privada", async () => {
    const h = await cartao({ seguidores: null, publicacoes: null, foto: false, erro: "Perfil não lido: precisa ser uma conta profissional (Business ou Creator) e pública." });
    expect(h).toContain("Perfil não lido: conta pessoal ou privada?");
    expect(h).not.toContain("14,4");
  });
});
