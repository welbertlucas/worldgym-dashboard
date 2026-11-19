import { describe, expect, it } from "vitest";
import { contasQueContam, diaDeBrasilia, entregasDoMes, mesAnteriorDe, metaDoMes, postConta, resumoDeEntregas, type ContasDaRede, type PostInfluenciador, type PostsDoPerfil } from "@/data/entregas";
import type { Influenciador } from "@/data/influenciadores";

const CONTAS: ContasDaRede = { marca: "worldgymbrasil", porUnidade: { Gama: "worldgym.gama", "Asa Norte": "worldgym.asanorte" } };
const HOJE = "2026-11-19";

const contrato = (p: Partial<Influenciador> = {}): Influenciador => ({
  id: "1", usuario: "fulano", unidade: "Gama", inicio: null, fim: null, entregas: { stories: 6, feed: 4, reels: 2 }, contagem: "marcando", ativo: true, criadoEm: "2026-11-01T00:00:00Z", ...p,
});
let n = 0;
const post = (tipo: "feed" | "reels", data: string, citou: string[] = ["worldgym.gama"]): PostInfluenciador => ({ id: `p${++n}`, tipo, data, link: `https://instagram.com/p/${n}/`, legenda: "", curtidas: 1, comentarios: 0, citou });
const perfil = (posts: PostInfluenciador[]): PostsDoPerfil => ({ lidoEm: "2026-11-19T12:00:00Z", posts });

describe("Regra do que conta como entrega", () => {
  it("contrato de uma unidade: vale citar ou marcar a unidade ou a marca; rede toda: qualquer conta da rede; 'qualquer': sem exigência", () => {
    expect(contasQueContam(contrato(), CONTAS)).toEqual(["worldgym.gama", "worldgymbrasil"]);
    expect(contasQueContam(contrato({ unidade: null }), CONTAS)?.sort()).toEqual(["worldgym.asanorte", "worldgym.gama", "worldgymbrasil"]);
    expect(contasQueContam(contrato({ contagem: "qualquer" }), CONTAS)).toBeNull();
    expect(contasQueContam({ unidade: "Gama" } as Influenciador, CONTAS)).toEqual(["worldgym.gama", "worldgymbrasil"]); // contrato antigo, sem a regra
  });
  it("post de outra unidade não conta para o contrato da Gama; a marca conta; sem citar não conta, salvo na regra 'qualquer'", () => {
    const c = contrato();
    expect(postConta(post("feed", "2026-11-10T12:00:00+0000", ["worldgym.gama"]), c, CONTAS)).toBe(true);
    expect(postConta(post("feed", "2026-11-10T12:00:00+0000", ["worldgymbrasil"]), c, CONTAS)).toBe(true);
    expect(postConta(post("feed", "2026-11-10T12:00:00+0000", ["worldgym.asanorte"]), c, CONTAS)).toBe(false);
    expect(postConta(post("feed", "2026-11-10T12:00:00+0000", []), c, CONTAS)).toBe(false);
    expect(postConta(post("feed", "2026-11-10T12:00:00+0000", []), contrato({ contagem: "qualquer" }), CONTAS)).toBe(true);
  });
});

describe("Meta do mês", () => {
  it("contrato que cobre o mês inteiro: a meta cheia; começa no meio: proporcional, arredondando para cima; terminou antes: fora", () => {
    expect(metaDoMes(contrato(), "2026-11").metas).toEqual({ stories: 6, feed: 4, reels: 2 });
    // 16 a 30/11 = 15 de 30 dias = 50%
    expect(metaDoMes(contrato({ inicio: "2026-11-16" }), "2026-11").metas).toEqual({ stories: 3, feed: 2, reels: 1 });
    expect(metaDoMes(contrato({ inicio: "2026-11-16", entregas: { stories: 1, feed: 1, reels: 1 } }), "2026-11").metas).toEqual({ stories: 1, feed: 1, reels: 1 }); // 0,5 sobe para 1
    expect(metaDoMes(contrato({ fim: "2026-11-10" }), "2026-11").metas).toEqual({ stories: 2, feed: 2, reels: 1 }); // 10 de 30 dias
    expect(metaDoMes(contrato({ inicio: "2026-12-01" }), "2026-11").dias).toBeNull();
    expect(metaDoMes(contrato({ fim: "2026-10-31" }), "2026-11").dias).toBeNull();
  });
  it("mês anterior e dia de Brasília", () => {
    expect(mesAnteriorDe("2026-11")).toBe("2026-10");
    expect(mesAnteriorDe("2026-01")).toBe("2025-12");
    expect(diaDeBrasilia("2026-11-01T01:00:00+0000")).toBe("2026-10-31"); // 22h do dia 31 em Brasília
    expect(diaDeBrasilia("2026-11-01T12:00:00+0000")).toBe("2026-11-01");
  });
});

describe("Entregue contra combinado", () => {
  // Novembro em andamento: 19 de 30 dias; metas 4 feeds e 2 reels => esperado até hoje: 2 feeds e 1 reels
  it("mês em andamento: atrasado quando saiu menos que o ritmo pede", () => {
    const e = entregasDoMes(contrato(), perfil([post("reels", "2026-11-05T15:00:00+0000"), post("reels", "2026-11-12T15:00:00+0000"), post("feed", "2026-11-10T15:00:00+0000")]), CONTAS, "2026-11", HOJE);
    expect(e).toMatchObject({ parcial: true, situacao: "atrasado", feitas: { feed: 1, reels: 2 }, faltam: { feed: 3, reels: 0 }, esperado: { feed: 2, reels: 1 } });
    expect(e.contam).toHaveLength(3);
  });
  it("mês em andamento: no ritmo quando já saiu o que o prazo pede; cumprido quando fechou a meta", () => {
    const base = [post("reels", "2026-11-05T15:00:00+0000"), post("feed", "2026-11-06T15:00:00+0000"), post("feed", "2026-11-10T15:00:00+0000")];
    expect(entregasDoMes(contrato(), perfil(base), CONTAS, "2026-11", HOJE).situacao).toBe("no_ritmo");
    const tudo = [...base, post("reels", "2026-11-11T15:00:00+0000"), post("feed", "2026-11-12T15:00:00+0000"), post("feed", "2026-11-13T15:00:00+0000")];
    expect(entregasDoMes(contrato(), perfil(tudo), CONTAS, "2026-11", HOJE)).toMatchObject({ situacao: "cumprido", faltam: { feed: 0, reels: 0 } });
  });
  it("mês fechado: cumprido ou não cumprido, sem ritmo", () => {
    const out = [post("feed", "2026-10-02T15:00:00+0000"), post("feed", "2026-10-09T15:00:00+0000"), post("feed", "2026-10-16T15:00:00+0000"), post("feed", "2026-10-23T15:00:00+0000"), post("reels", "2026-10-05T15:00:00+0000"), post("reels", "2026-10-25T15:00:00+0000")];
    expect(entregasDoMes(contrato(), perfil(out), CONTAS, "2026-10", HOJE)).toMatchObject({ parcial: false, situacao: "cumprido" });
    const e = entregasDoMes(contrato(), perfil(out.slice(0, 5)), CONTAS, "2026-10", HOJE);
    expect(e).toMatchObject({ situacao: "nao_cumprido", faltam: { feed: 0, reels: 1 } });
    expect(e.esperado).toEqual({ feed: 4, reels: 2 });
  });
  it("só conta o post do mês (em horário de Brasília) e dentro do contrato; o que não cita a unidade vai para 'sem citar'", () => {
    const ps = [
      post("feed", "2026-11-01T01:00:00+0000"),         // 31/10 em Brasília: fora de novembro
      post("feed", "2026-11-02T15:00:00+0000"),         // conta
      post("feed", "2026-11-03T15:00:00+0000", []),     // não cita
      post("reels", "2026-12-01T15:00:00+0000"),        // dezembro
    ];
    const e = entregasDoMes(contrato(), perfil(ps), CONTAS, "2026-11", HOJE);
    expect(e.feitas).toEqual({ feed: 1, reels: 0 });
    expect(e.semCitar).toBe(1);
    // contrato que começou em 10/11: o post do dia 2 é anterior ao contrato e não conta
    expect(entregasDoMes(contrato({ inicio: "2026-11-10" }), perfil(ps), CONTAS, "2026-11", HOJE).feitas).toEqual({ feed: 0, reels: 0 });
    // regra 'qualquer': o que não cita também conta
    expect(entregasDoMes(contrato({ contagem: "qualquer" }), perfil(ps), CONTAS, "2026-11", HOJE).feitas).toEqual({ feed: 2, reels: 0 });
  });
  it("situações sem conferência: sem leitura, desativado, fora do contrato, só stories", () => {
    expect(entregasDoMes(contrato(), undefined, CONTAS, "2026-11", HOJE).situacao).toBe("sem_leitura");
    expect(entregasDoMes(contrato({ ativo: false }), perfil([]), CONTAS, "2026-11", HOJE).situacao).toBe("desativado");
    expect(entregasDoMes(contrato({ inicio: "2026-12-01" }), perfil([]), CONTAS, "2026-11", HOJE).situacao).toBe("fora");
    expect(entregasDoMes(contrato({ entregas: { stories: 5, feed: 0, reels: 0 } }), perfil([]), CONTAS, "2026-11", HOJE).situacao).toBe("sem_meta");
  });
  it("começo do mês: ritmo esperado ainda é zero, então não está atrasado", () => {
    expect(entregasDoMes(contrato(), perfil([]), CONTAS, "2026-11", "2026-11-03")).toMatchObject({ situacao: "no_ritmo", esperado: { feed: 0, reels: 0 } });
  });
});

describe("Resumo de entregas", () => {
  it("soma feed e reels dos contratos com leitura, sem deixar o excesso de um tipo cobrir a falta de outro", () => {
    const a = contrato({ usuario: "a" });
    const b = contrato({ usuario: "b", entregas: { stories: 0, feed: 2, reels: 0 } });
    const c = contrato({ usuario: "c" }); // sem leitura: fica de fora
    const posts = {
      a: perfil([post("feed", "2026-11-02T15:00:00+0000"), post("feed", "2026-11-03T15:00:00+0000")]),
      b: perfil([post("feed", "2026-11-02T15:00:00+0000"), post("feed", "2026-11-03T15:00:00+0000"), post("feed", "2026-11-04T15:00:00+0000")]), // 1 a mais
    };
    expect(resumoDeEntregas([a, b, c], posts, CONTAS, "2026-11", HOJE)).toEqual({ feitas: 4, combinadas: 8, comLeitura: 2 });
  });
});
