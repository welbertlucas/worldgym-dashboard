import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { InfluenciadoresTab } from "@/components/tabs/InfluenciadoresTab";
import { NAV_ITEMS, SUBMENUS, buscarNoMenu, itensDeBusca } from "@/components/nav";
import { entregasDoMes, type ContasDaRede, type PostInfluenciador } from "@/data/entregas";
import type { Influenciador } from "@/data/influenciadores";

const CONTAS: ContasDaRede = { marca: "worldgymbrasil", porUnidade: { Gama: "worldgym.gama" } };

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
  const cartao = async (perfil: { seguidores: number | null; publicacoes: number | null; foto: boolean; erro: string | null } | null, posts?: PostInfluenciador[], i: Influenciador = base as Influenciador) => {
    const { CartaoDoInfluenciador } = await import("@/components/tabs/InfluenciadoresTab");
    const entrega = entregasDoMes(i, posts ? { lidoEm: "2026-11-19T12:00:00Z", posts } : undefined, CONTAS, "2026-11", "2026-11-19");
    return renderToString(<ul><CartaoDoInfluenciador i={i} perfil={perfil} entrega={entrega} pode={false} onEditar={() => {}} onAtivo={() => {}} onRemover={() => {}} /></ul>).replace(/<!-- -->/g, "").replace(/\u00a0/g, " ");
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

describe("Cartão do influenciador: entregue contra combinado", () => {
  const base = { id: "1", usuario: "larisse.sousaa_", nome: "Larisse", unidade: "Gama", inicio: null, fim: null, entregas: { stories: 6, feed: 4, reels: 2 }, contagem: "marcando", ativo: true, criadoEm: "2026-11-19T00:00:00Z" } as Influenciador;
  let n = 0;
  const post = (tipo: "feed" | "reels", data: string, citou = ["worldgym.gama"]): PostInfluenciador => ({ id: `p${++n}`, tipo, data, link: `https://instagram.com/p/${n}/`, legenda: "Treino na Gama", curtidas: 5, comentarios: 1, citou });
  const cartao = async (posts?: PostInfluenciador[], i: Influenciador = base) => {
    const { CartaoDoInfluenciador } = await import("@/components/tabs/InfluenciadoresTab");
    const entrega = entregasDoMes(i, posts ? { lidoEm: "x", posts } : undefined, CONTAS, "2026-11", "2026-11-19");
    return renderToString(<ul><CartaoDoInfluenciador i={i} perfil={null} entrega={entrega} pode={false} onEditar={() => {}} onAtivo={() => {}} onRemover={() => {}} /></ul>).replace(/<!-- -->/g, "");
  };

  it("sem leitura de posts: mostra só o combinado e avisa", async () => {
    const h = await cartao(undefined);
    expect(h).toContain("Combinado por mês");
    expect(h).toContain("Ainda sem leitura do Instagram");
    expect(h).toContain("ainda não leu os posts");
    expect(h).not.toContain("Entregas de");
  });

  it("atrasado: mostra entregue / combinado, o que falta e o que o ritmo pedia", async () => {
    const h = await cartao([post("reels", "2026-11-05T15:00:00+0000"), post("reels", "2026-11-12T15:00:00+0000"), post("feed", "2026-11-10T15:00:00+0000")]);
    expect(h).toContain("Entregas de novembro (até hoje)");
    expect(h).toContain("Atrasado");
    expect(h).toContain("Faltam 3 posts no feed. No ritmo do contrato, já deveriam ter saído 2 posts no feed e 1 reel.");
    expect(h).toContain("/ 4"); // feed 1 / 4
    expect(h).toContain("combinado, não conferido"); // stories
    expect(h).toContain("Ver os 3 posts que contaram");
    expect(h).toContain("https://instagram.com/p/");
  });

  it("cumprido: sem texto de falta; post que não cita a unidade aparece como aviso fora da conta", async () => {
    const tudo = [post("feed", "2026-11-02T15:00:00+0000"), post("feed", "2026-11-03T15:00:00+0000"), post("feed", "2026-11-04T15:00:00+0000"), post("feed", "2026-11-05T15:00:00+0000"), post("reels", "2026-11-06T15:00:00+0000"), post("reels", "2026-11-07T15:00:00+0000"), post("feed", "2026-11-08T15:00:00+0000", [])];
    const h = await cartao(tudo);
    expect(h).toContain("Cumprido");
    expect(h).not.toContain("Faltam");
    expect(h).toContain("1 post do perfil neste mês não cita a unidade na legenda e não entra na conta.");
    expect(h).toContain("Marcação só na imagem e post em colaboração o Atlas não enxerga.");
    const dois = await cartao([...tudo, post("feed", "2026-11-09T15:00:00+0000", [])]);
    expect(dois).toContain("2 posts do perfil neste mês não citam a unidade na legenda e não entram na conta.");
  });

  it("regra 'qualquer': não mostra o aviso de post sem citar", async () => {
    const h = await cartao([post("feed", "2026-11-08T15:00:00+0000", [])], { ...base, contagem: "qualquer" });
    expect(h).not.toContain("na legenda e não entra");
  });

  it("contrato desativado e post de um mês só de stories não quebram", async () => {
    expect(await cartao([], { ...base, ativo: false })).toContain("Contrato desativado");
    expect(await cartao([], { ...base, entregas: { stories: 5, feed: 0, reels: 0 } })).toContain("Só stories combinados");
  });
});
