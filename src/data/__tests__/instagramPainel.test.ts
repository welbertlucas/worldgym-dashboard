import { describe, expect, it } from "vitest";
import { contasDaEscolha, resumoDasContas, type DadosInstagram, type PostInstagram, type StoryInstagram } from "@/data/instagram";
import {
  calorDePostagem, cartoesDasContas, composicaoPorTipo, filtrarFeed, interacoesDe, kpisDoInstagram, MIN_POSTS_CELULA, ordenarContas,
  postsQueMaisEngajaram, serieDeSeguidores, storiesPorDiaContagem,
} from "@/data/instagramPainel";

const AGORA = new Date("2026-11-19T15:00:00Z");
const post = (id: string, conta: string, data: string, p: Partial<PostInstagram> = {}): PostInstagram => ({
  id, conta, unidade: conta === "worldgym.gama" ? "Gama" : "Itapoã", tipo: "IMAGE", legenda: "", link: null, data,
  curtidas: 10, comentarios: 0, visualizacoes: 100, alcance: null, salvos: 0, compartilhamentos: 0, interacoes: null, ...p,
});
const story = (id: string, conta: string, data: string, v: number | null = 100): StoryInstagram => ({ id, conta, unidade: "Gama", tipo: "IMAGE", link: null, data, visualizacoes: v, alcance: null, respostas: null, compartilhamentos: null, interacoes: null });

const dados: DadosInstagram = {
  geradoEm: "2026-11-19T12:00:00Z",
  contas: [
    { id: "1", usuario: "worldgym.gama", nome: "Gama", unidade: "Gama", seguidores: 2000, posts: 50, foto: null },
    { id: "2", usuario: "worldgym.itapoa", nome: "Itapoã", unidade: "Itapoã", seguidores: 1000, posts: 40, foto: null },
  ],
  seguidores: {
    "worldgym.gama": { "2026-11-10": 1900, "2026-11-14": 1950, "2026-11-19": 2000 },
    "worldgym.itapoa": { "2026-11-10": 1000, "2026-11-19": 1000 },
  },
  posts: [
    post("a", "worldgym.gama", "2026-11-18T13:00:00Z", { tipo: "REELS", curtidas: 80, comentarios: 10, salvos: 5, compartilhamentos: 5, visualizacoes: 1000 }), // 100 interações
    post("b", "worldgym.gama", "2026-11-17T13:00:00Z", { tipo: "REELS", interacoes: 40, curtidas: 30, visualizacoes: 400 }),
    post("c", "worldgym.itapoa", "2026-11-16T13:00:00Z", { tipo: "CAROUSEL_ALBUM", curtidas: 20, comentarios: 0, visualizacoes: null }),
    post("d", "worldgym.itapoa", "2026-09-01T13:00:00Z", { curtidas: 999 }), // fora dos 30 dias
  ],
  stories: [story("s1", "worldgym.gama", "2026-11-19T10:00:00Z", 200), story("s2", "worldgym.gama", "2026-11-19T11:00:00Z", 100), story("s3", "worldgym.itapoa", "2026-11-18T11:00:00Z", null)],
  erros: [],
};
const contas = contasDaEscolha(dados, null);
const resumo = resumoDasContas(dados, contas, AGORA);

describe("Instagram: números da faixa", () => {
  it("interações: usa o total do Meta; sem ele, soma as partes", () => {
    expect(interacoesDe(dados.posts[0])).toBe(100);
    expect(interacoesDe(dados.posts[1])).toBe(40);
  });

  it("soma da rede nos últimos 30 dias: seguidores, ganho, posts, interações, visualizações e stories", () => {
    const k = kpisDoInstagram(dados, contas, resumo, 30, AGORA);
    expect(k).toMatchObject({ seguidores: 3000, ganho: 100, posts: 3, interacoes: 160, visualizacoes: 1400, stories: 3, mediaViewsStory: 150 });
    expect(k.interacoesPorPost).toBeCloseTo(160 / 3);
    // taxa = média, por post, de interações ÷ seguidores da conta: (100/2000 + 40/2000 + 20/1000) / 3
    expect(k.taxaInteracao).toBeCloseTo((0.05 + 0.02 + 0.02) / 3);
  });

  it("uma unidade só: conta só os dela", () => {
    const so = contasDaEscolha(dados, "Itapoã");
    const k = kpisDoInstagram(dados, so, resumoDasContas(dados, so, AGORA), 30, AGORA);
    expect(k).toMatchObject({ seguidores: 1000, posts: 1, interacoes: 20, stories: 1, mediaViewsStory: null });
  });

  it("sem posts nem histórico: médias nulas, sem erro", () => {
    const vazio: DadosInstagram = { ...dados, posts: [], stories: [], seguidores: {} };
    const k = kpisDoInstagram(vazio, contas, resumoDasContas(vazio, contas, AGORA), 30, AGORA);
    expect(k).toMatchObject({ posts: 0, interacoes: 0, interacoesPorPost: null, taxaInteracao: null, ganho: null, serie: [], stories: 0, mediaViewsStory: null });
  });

  it("série de seguidores: soma por dia, repete o dia sem leitura e ignora conta que começou depois do primeiro dia", () => {
    const s = serieDeSeguidores(dados, contas, 30, AGORA);
    expect(s.map((p) => [p.dia, p.total])).toEqual([["2026-11-10", 2900], ["2026-11-14", 2950], ["2026-11-19", 3000]]);
    const tardia: DadosInstagram = { ...dados, seguidores: { ...dados.seguidores, "worldgym.itapoa": { "2026-11-19": 1000 } } };
    // Itapoã só tem leitura no último dia: sai da soma (senão o total pularia 1.000 sem ninguém ter ganho seguidor)
    expect(serieDeSeguidores(tardia, contas, 30, AGORA).map((p) => p.total)).toEqual([1900, 1950, 2000]);
    expect(serieDeSeguidores(dados, contas, 3, AGORA).map((p) => p.dia)).toEqual(["2026-11-19"]);
  });
});

describe("Instagram: cartões das contas", () => {
  it("interação por post e série de seguidores de cada conta; ordenação com conta sem número no fim", () => {
    const c = cartoesDasContas(dados, resumo, 30, AGORA);
    const gama = c.find((x) => x.conta.usuario === "worldgym.gama")!;
    expect(gama.interacoesPorPost).toBe(70);
    expect(gama.serie).toEqual([1900, 1950, 2000]);
    expect(ordenarContas(c, "seguidores").map((x) => x.conta.usuario)).toEqual(["worldgym.gama", "worldgym.itapoa"]);
    expect(ordenarContas(c, "ganho").map((x) => x.conta.usuario)).toEqual(["worldgym.gama", "worldgym.itapoa"]);
    expect(ordenarContas(c, "interacao").map((x) => x.conta.usuario)).toEqual(["worldgym.gama", "worldgym.itapoa"]);
    const semNumero = c.map((x) => (x.conta.usuario === "worldgym.gama" ? { ...x, conta: { ...x.conta, seguidores: null } } : x));
    expect(ordenarContas(semNumero, "seguidores").map((x) => x.conta.usuario)).toEqual(["worldgym.itapoa", "worldgym.gama"]);
  });
});

describe("Instagram: melhor dia e horário", () => {
  // 2026-11-18 é quarta; 13:00Z = 10h em Brasília (manhã). 2026-11-17 é terça.
  it("agrupa por dia da semana e parte do dia em horário de Brasília e acha a melhor célula (mínimo de posts)", () => {
    const ps = [
      post("1", "x", "2026-11-18T13:00:00Z", { curtidas: 100 }), // qua manhã
      post("2", "x", "2026-11-11T13:00:00Z", { curtidas: 60 }),  // qua manhã (semana anterior)
      post("3", "x", "2026-11-17T20:00:00Z", { curtidas: 500 }), // ter 17h = tarde, só 1 post: não vale como melhor
      post("4", "x", "2026-11-19T02:00:00Z", { curtidas: 7 }),   // 02:00Z = 23h de quarta em Brasília: noite
    ];
    const r = calorDePostagem(ps);
    const c = (dia: number, faixa: number) => r.celulas.find((x) => x.dia === dia && x.faixa === faixa)!;
    expect(c(2, 0)).toMatchObject({ n: 2, media: 80 });
    expect(c(1, 1)).toMatchObject({ n: 1, media: 500 });
    expect(c(2, 2)).toMatchObject({ n: 1, media: 7 });
    expect(c(0, 0)).toMatchObject({ n: 0, media: null });
    expect(MIN_POSTS_CELULA).toBe(2);
    expect(r.melhor).toMatchObject({ dia: 2, faixa: 0, media: 80 });
    expect(r.maior).toBe(80);
    expect(r.celulas).toHaveLength(21);
  });

  it("sem célula com posts suficientes: não escolhe melhor", () => {
    const r = calorDePostagem([post("1", "x", "2026-11-18T13:00:00Z")]);
    expect(r.melhor).toBeNull();
    expect(r.maior).toBe(1);
  });
});

describe("Instagram: o que gera mais interação, posts em destaque e feed", () => {
  it("composição por tipo: média e de que é feita", () => {
    const l = composicaoPorTipo(dados.posts.slice(0, 3));
    expect(l.map((x) => [x.rotulo, x.posts, Math.round(x.media)])).toEqual([["Reels", 2, 70], ["Carrossel", 1, 20]]);
    expect(l[0]).toMatchObject({ curtidas: 55, comentarios: 5, salvos: 2.5, compartilhamentos: 2.5 });
  });

  it("posts em destaque: só os dos últimos dias, do que mais engajou para o que menos, sem os zerados", () => {
    const ps = [...dados.posts, post("z", "worldgym.gama", "2026-11-18T10:00:00Z", { curtidas: 0 })];
    expect(postsQueMaisEngajaram(ps, 6, 30, AGORA).map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(postsQueMaisEngajaram(ps, 2, 30, AGORA).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("feed: filtra por tipo e ordena por data ou por interação", () => {
    expect(filtrarFeed(dados.posts, "REELS", "recentes").map((p) => p.id)).toEqual(["a", "b"]);
    expect(filtrarFeed(dados.posts, "todos", "interacao").map((p) => p.id)).toEqual(["d", "a", "b", "c"]);
    expect(filtrarFeed(dados.posts, "todos", "recentes").map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(filtrarFeed(dados.posts, "VIDEO", "recentes")).toEqual([]);
  });
});

describe("Instagram: stories por dia", () => {
  it("14 dias terminando hoje (Brasília), com zero nos dias sem story", () => {
    const l = storiesPorDiaContagem(dados.stories, 14, AGORA);
    expect(l).toHaveLength(14);
    expect(l[13]).toEqual({ dia: "2026-11-19", n: 2 });
    expect(l[12]).toEqual({ dia: "2026-11-18", n: 1 });
    expect(l[0].dia).toBe("2026-11-06");
    expect(l.slice(0, 12).every((x) => x.n === 0)).toBe(true);
  });
  it("01:00Z ainda é o dia anterior em Brasília", () => {
    const l = storiesPorDiaContagem([story("x", "worldgym.gama", "2026-11-19T01:00:00Z")], 3, AGORA);
    expect(l.map((x) => [x.dia, x.n])).toEqual([["2026-11-17", 0], ["2026-11-18", 1], ["2026-11-19", 0]]);
  });
});
