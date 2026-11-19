import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Delta, FaixaKpi, Sparkline } from "@/components/FaixaKpi";
import { CartaoDaConta, situacaoDoUltimoPost } from "@/components/instagram/CartaoDaConta";
import { FeedSecao } from "@/components/instagram/FeedSecao";
import { MelhorHorario, nomeDaCelula } from "@/components/instagram/MelhorHorario";
import { PostsEmDestaque } from "@/components/instagram/PostsEmDestaque";
import { StoriesSecao } from "@/components/instagram/StoriesSecao";
import type { PostInstagram, StoryInstagram } from "@/data/instagram";
import type { CartaoConta } from "@/data/instagramPainel";

const limpo = (h: string) => h.replace(/<!-- -->/g, "");
const post = (id: string, p: Partial<PostInstagram> = {}): PostInstagram => ({
  id, conta: "worldgym.gama", unidade: "Gama", tipo: "REELS", legenda: "", link: "https://instagram.com/p/x", data: "2026-11-18T13:00:00Z",
  curtidas: 80, comentarios: 10, visualizacoes: 1000, alcance: null, salvos: 5, compartilhamentos: 5, interacoes: null, ...p,
});
const cartao = (p: Partial<CartaoConta> = {}): CartaoConta => ({
  conta: { id: "1", usuario: "worldgym.gama", nome: "Gama", unidade: "Gama", seguidores: 2384, posts: 100, foto: null },
  postsNoPeriodo: 16, storiesNoPeriodo: 53, diasSemPost: 0, ganhoSeguidores: 28, mediaVisualizacoes: 1831, interacoesPorPost: 70, serie: [2300, 2340, 2384], ...p,
});

describe("Faixa de números, variação e gráfico pequeno", () => {
  it("mostra rótulo, número e detalhe de cada item", () => {
    const h = limpo(renderToString(<FaixaKpi rotulo="Números" itens={[{ id: "a", rotulo: "Seguidores", valor: "2.384", detalhe: "30 dias" }, { id: "b", rotulo: "Posts", valor: "16" }]} />));
    expect(h).toContain("Seguidores");
    expect(h).toContain("2.384");
    expect(h).toContain("30 dias");
    expect(h).toContain('aria-label="Números"');
  });
  it("variação: seta verde sobe, vermelha desce, sem histórico avisa", () => {
    expect(limpo(renderToString(<Delta valor={44} />))).toContain("+44");
    expect(renderToString(<Delta valor={44} />)).toContain("text-success");
    const baixo = limpo(renderToString(<Delta valor={-59} />));
    expect(baixo).toContain("−59");
    expect(renderToString(<Delta valor={-59} />)).toContain("text-destructive");
    expect(renderToString(<Delta valor={0} />)).not.toContain("svg");
    expect(renderToString(<Delta valor={null} />)).toContain("sem histórico ainda");
    expect(limpo(renderToString(<Delta valor={12} formatar={(n) => n.toFixed(1)} sufixo=" p.p." />))).toContain("12.0 p.p.");
  });
  it("gráfico pequeno: precisa de ao menos 2 pontos; série parada não quebra", () => {
    expect(renderToString(<Sparkline valores={[5]} rotulo="x" />)).toBe("");
    expect(renderToString(<Sparkline valores={[1, 2, 3]} rotulo="Evolução" />)).toContain('aria-label="Evolução"');
    expect(renderToString(<Sparkline valores={[7, 7, 7]} rotulo="parada" />)).toContain("path");
  });
});

describe("Cartão de cada conta", () => {
  it("situação do último post: hoje, ontem, dias e alerta depois de 7", () => {
    expect(situacaoDoUltimoPost(0)).toEqual({ texto: "Postou hoje", alerta: false });
    expect(situacaoDoUltimoPost(-1).texto).toBe("Postou hoje");
    expect(situacaoDoUltimoPost(1).texto).toBe("Postou ontem");
    expect(situacaoDoUltimoPost(5)).toEqual({ texto: "Postou há 5 dias", alerta: false });
    expect(situacaoDoUltimoPost(9)).toEqual({ texto: "Sem postar há 9 dias", alerta: true });
    expect(situacaoDoUltimoPost(null).texto).toBe("Sem posts guardados");
  });
  it("mostra @, unidade, seguidores, ganho e os números do período; conta sem unidade é a Institucional", () => {
    const h = limpo(renderToString(<ul><CartaoDaConta c={cartao()} maior={2384} mostrarBarra /></ul>));
    for (const t of ["@worldgym.gama", "Gama", "2.384", "+28", "Postou hoje", "Posts", "Stories", "Interações/post", "Views/post", "1.831"]) expect(h).toContain(t);
    const inst = limpo(renderToString(<ul><CartaoDaConta c={cartao({ conta: { ...cartao().conta, unidade: null, usuario: "worldgymbrasil" } })} maior={1} mostrarBarra={false} /></ul>));
    expect(inst).toContain("Institucional (conta da rede)");
  });
  it("conta com mais de 7 dias sem postar fica em vermelho; sem número mostra traço", () => {
    const h = renderToString(<ul><CartaoDaConta c={cartao({ diasSemPost: 9, ganhoSeguidores: null, mediaVisualizacoes: null, interacoesPorPost: null })} maior={1} mostrarBarra={false} /></ul>);
    expect(h).toContain("bg-destructive/10");
    expect(limpo(h)).toContain("—");
  });
});

describe("Melhor dia e horário", () => {
  it("nomeia a célula", () => { expect(nomeDaCelula(2, 0)).toBe("Quarta, de manhã"); expect(nomeDaCelula(6, 2)).toBe("Domingo, à noite"); });
  it("com posts, mostra o mapa e o melhor momento; sem posts, explica", () => {
    // 2026-11-18 (quarta) 13:00Z = 10h em Brasília: manhã; dois posts ali
    const h = limpo(renderToString(<MelhorHorario dias={90} quem="Rede" posts={[post("a", { curtidas: 100, comentarios: 0, salvos: 0, compartilhamentos: 0 }), post("b", { data: "2026-11-11T13:00:00Z", curtidas: 60, comentarios: 0, salvos: 0, compartilhamentos: 0 })]} />));
    expect(h).toContain("Melhor dia e horário para postar");
    expect(h).toContain("Quarta, de manhã");
    expect(h).toContain("80");
    expect(h).toContain("Manhã");
    expect(limpo(renderToString(<MelhorHorario dias={90} quem="Rede" posts={[]} />))).toContain("Nenhum post no período");
  });
});

describe("Posts em destaque, stories e feed", () => {
  it("posts em destaque: o primeiro marcado como 1º, com as interações; vazio explica", () => {
    const h = limpo(renderToString(<PostsEmDestaque posts={[post("a"), post("b", { tipo: "CAROUSEL_ALBUM", curtidas: 5 })]} quem="Rede" dias={30} mostrarConta />));
    expect(h).toContain("1º");
    expect(h).toContain("2º");
    expect(h).toContain("100"); // 80 + 10 + 5 + 5
    expect(h).toContain("Reels");
    expect(h).toContain("Carrossel");
    expect(limpo(renderToString(<PostsEmDestaque posts={[]} quem="Rede" dias={30} mostrarConta={false} />))).toContain("Nenhum post com interações no período");
  });
  it("stories: vazio explica; com stories mostra o seletor de período", () => {
    expect(limpo(renderToString(<StoriesSecao stories={[]} quem="Rede" mostrarConta />))).toContain("Nenhum story guardado ainda");
    const s: StoryInstagram = { id: "s1", conta: "worldgym.gama", unidade: "Gama", tipo: "IMAGE", link: null, data: new Date().toISOString(), visualizacoes: 200, alcance: null, respostas: null, compartilhamentos: null, interacoes: null };
    const h = limpo(renderToString(<StoriesSecao stories={[s]} quem="Rede" mostrarConta />));
    expect(h).toContain("Stories nas últimas 24 horas");
    expect(h).toContain("7 dias");
    expect(h).toContain("30 dias");
    expect(h).toContain("Visualizações por story");
  });
  it("feed: filtro por tipo com contagem e ordem; vazio explica", () => {
    const h = limpo(renderToString(<FeedSecao posts={[post("a"), post("b"), post("c", { tipo: "IMAGE" })]} quem="Rede" mostrarConta />));
    expect(h).toContain("Todos");
    expect(h).toContain("Reels");
    expect(h).toContain("Foto");
    expect(h).toContain("Mais recentes");
    expect(h).toContain("Mais interação");
    expect(limpo(renderToString(<FeedSecao posts={[]} quem="Rede" mostrarConta />))).toContain("Nenhum post guardado");
  });
});
