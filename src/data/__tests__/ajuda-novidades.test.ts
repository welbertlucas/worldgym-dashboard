import { describe, expect, it } from "vitest";
import { ARTIGOS, artigosPara, buscarAjuda, SECOES, secoesPara } from "@/data/ajuda";
import { buscarNovidades, NOVIDADES, naoVistas, novidadesPara } from "@/data/novidades";
import { itensDoMenu, NAV_RODAPE, ondeFica } from "@/components/nav";

describe("central de ajuda", () => {
  it("quem não é dono não vê artigos nem a seção do dono", () => {
    const todos = artigosPara(false);
    expect(todos.some((a) => a.publico === "dono")).toBe(false);
    expect(secoesPara(false).some((s) => s.id === "dono")).toBe(false);
    expect(artigosPara(true).some((a) => a.publico === "dono")).toBe(true);
  });

  it("texto para todos não fala do que o dono acompanha", () => {
    const proibido = /registro de atividade|atividade de cada|telas que (ela|ele) abriu|quem está usando o plano|marca d.água|só para você|ver como/i;
    for (const a of artigosPara(false)) expect(`${a.titulo} ${a.resumo} ${a.paragrafos.join(" ")}`).not.toMatch(proibido);
    for (const n of novidadesPara(false)) expect(`${n.titulo} ${n.texto}`).not.toMatch(proibido);
  });

  it("ids únicos, autora e glossário vindo dos indicadores", () => {
    expect(new Set(ARTIGOS.map((a) => a.id)).size).toBe(ARTIGOS.length);
    expect(ARTIGOS.every((a) => a.autora === "Ana Júlia")).toBe(true);
    expect(ARTIGOS.some((a) => a.id === "indicador-churn")).toBe(true);
  });

  it("busca sem acento e com o título primeiro", () => {
    const r = buscarAjuda(artigosPara(false), "senha");
    expect(r[0].titulo).toMatch(/senha/i);
    expect(buscarAjuda(artigosPara(false), "inadimplencia").length).toBeGreaterThan(0);
    expect(buscarAjuda(artigosPara(false), "   ")).toEqual([]);
  });

  it("Novidades e Central de ajuda ficam no rodapé do menu, fora da lista das telas", () => {
    expect(NAV_RODAPE.map((i) => i.id)).toEqual(["novidades", "ajuda"]);
    expect(itensDoMenu(true).some((i) => i.id === "ajuda" || i.id === "novidades")).toBe(false);
    expect(itensDoMenu(true).at(-1)!.id).toBe("acessos");
  });

  it("seção e artigo não dividem o mesmo endereço; onde fica cada tela", () => {
    const ids = new Set(ARTIGOS.map((a) => a.id));
    expect(SECOES.some((s) => ids.has(s.id))).toBe(false);
    expect(ondeFica("gerencial/oportunidades")).toBe("Menu › Gerencial › Oportunidades");
    expect(ondeFica("riscos/mes")).toBe("Menu › Alertas › Mês em andamento");
    expect(ondeFica("novidades")).toBe("Novidades, no rodapé do menu");
  });
});

describe("novidades", () => {
  it("filtra as do dono, mais nova primeiro, e conta as não vistas", () => {
    const todos = novidadesPara(false);
    expect(todos.every((n) => n.publico === "todos")).toBe(true);
    expect(todos.map((n) => n.data)).toEqual([...todos.map((n) => n.data)].sort().reverse());
    expect(novidadesPara(true).length).toBe(NOVIDADES.length);
    expect(naoVistas(todos, [todos[0].id])).toBe(todos.length - 1);
    expect(new Set(NOVIDADES.map((n) => n.id)).size).toBe(NOVIDADES.length);
  });

  it("\"Saiba mais\" leva a um artigo que a mesma pessoa pode abrir", () => {
    for (const dono of [false, true]) {
      const ids = new Set(artigosPara(dono).map((a) => a.id));
      for (const n of novidadesPara(dono)) if (n.artigo) expect(ids.has(n.artigo), n.id).toBe(true);
    }
  });

  it("busca nas novidades sem acento; vazia mostra todas", () => {
    const todos = novidadesPara(false);
    expect(buscarNovidades(todos, "")).toEqual(todos);
    expect(buscarNovidades(todos, "conversao").some((n) => n.id === "2026-11-16-alerta-conversao")).toBe(true);
    expect(buscarNovidades(todos, "melhoria").every((n) => n.tipo === "melhoria" || /melhoria/i.test(n.texto))).toBe(true);
    expect(buscarNovidades(todos, "xyzabc")).toEqual([]);
  });

  it("Relatórios: Master e Unidades veem a novidade e o artigo de uso; o que é controle do dono fica só com ele", () => {
    const para = novidadesPara(false).filter((n) => n.id.includes("relatorios")).map((n) => n.id);
    expect(para).toEqual(["2026-11-17-relatorios-para-todos"]);
    expect(artigosPara(false).some((a) => a.id === "tela-relatorios")).toBe(true);
    expect(artigosPara(false).some((a) => a.id === "dono-relatorios")).toBe(false);
    expect(novidadesPara(true).filter((n) => n.id.includes("relatorios")).length).toBeGreaterThan(1);
    const texto = [...novidadesPara(false).filter((n) => n.id.includes("relatorios")), ...artigosPara(false).filter((a) => a.id === "tela-relatorios")].map((x) => JSON.stringify(x)).join(" ");
    expect(texto).not.toMatch(/Pode gerar relatórios|em Usuários|libera|registro/i);
  });
});

describe("royalties: ajuda e novidade restritas", () => {
  const texto = (a: { titulo: string; resumo: string; paragrafos: string[] }) => `${a.titulo} ${a.resumo} ${a.paragrafos.join(" ")}`;

  it("quem não vê o menu não encontra seção, artigo nem novidade sobre royalties", () => {
    expect(secoesPara(false, false).some((s) => s.id === "royalties")).toBe(false);
    expect(artigosPara(false, undefined, false).some((a) => a.secao === "royalties")).toBe(false);
    expect(novidadesPara(false, undefined, false).some((n) => n.publico === "royalties")).toBe(false);
    // nenhum texto aberto a todos cita royalties
    for (const a of artigosPara(false, undefined, false)) expect(texto(a)).not.toMatch(/royalties/i);
    for (const n of novidadesPara(false, undefined, false)) expect(`${n.titulo} ${n.texto}`).not.toMatch(/royalties/i);
  });

  it("quem vê o menu (Master ou liberado, sem ser dono) lê a ajuda e a novidade, mas não a seção do dono", () => {
    expect(secoesPara(false, true).some((s) => s.id === "royalties")).toBe(true);
    expect(artigosPara(false, undefined, true).filter((a) => a.secao === "royalties").length).toBeGreaterThanOrEqual(3);
    expect(novidadesPara(false, undefined, true).some((n) => n.publico === "royalties")).toBe(true);
    // como liberar e como o dado é atualizado fica só para o dono
    expect(artigosPara(false, undefined, true).some((a) => a.id === "dono-royalties")).toBe(false);
    expect(secoesPara(false, true).some((s) => s.id === "dono")).toBe(false);
  });

  it("o dono vê tudo, inclusive o artigo de como liberar o menu", () => {
    expect(artigosPara(true).some((a) => a.id === "dono-royalties")).toBe(true);
    expect(artigosPara(true).filter((a) => a.secao === "royalties").length).toBeGreaterThanOrEqual(3);
    expect(novidadesPara(true).some((n) => n.publico === "royalties")).toBe(true);
  });

  it("os artigos de royalties abrem a tela de Royalties", () => {
    for (const a of ARTIGOS.filter((x) => x.secao === "royalties")) expect(a.tela).toBe("royalties");
    expect(NOVIDADES.find((n) => n.publico === "royalties")?.tela).toBe("royalties");
  });
});

describe("gerador de escalas: ajuda e novidade restritas", () => {
  const texto = (a: { titulo: string; resumo: string; paragrafos: string[] }) => `${a.titulo} ${a.resumo} ${a.paragrafos.join(" ")}`;

  it("quem não vê o menu não encontra seção, artigo nem novidade do gerador", () => {
    expect(secoesPara(false, false, false, false, false).some((s) => s.id === "escalas")).toBe(false);
    expect(artigosPara(false, undefined, false, false, false, false).some((a) => a.secao === "escalas")).toBe(false);
    expect(novidadesPara(false, undefined, false, false, false, false).some((n) => n.publico === "escalas")).toBe(false);
    for (const a of artigosPara(false, undefined, false, false, false, false)) expect(texto(a)).not.toMatch(/gerador de escalas/i);
  });

  it("quem vê o menu lê os artigos do gerador, e todo \"Saiba mais\" abre um artigo dessa pessoa", () => {
    const artigos = artigosPara(false, undefined, false, false, false, true);
    expect(artigos.filter((a) => a.secao === "escalas").length).toBeGreaterThanOrEqual(4);
    for (const n of novidadesPara(false, undefined, false, false, false, true)) if (n.artigo) expect(artigos.some((a) => a.id === n.artigo)).toBe(true);
    for (const a of ARTIGOS.filter((x) => x.secao === "escalas")) expect(a.tela).toBe("escalas");
  });

  it("o estudo da unidade explica as camadas e o PDF sem citar premissas do dono", () => {
    const a = ARTIGOS.find((x) => x.id === "estudos-de-ponto-unidade");
    expect(a).toBeTruthy();
    expect(texto(a!)).toMatch(/PDF/);
    expect(texto(a!)).not.toMatch(/payback|investimento|premissa|veredito/i);
  });
});

describe("franqueadora: ajuda e novidade", () => {
  it("só quem vê Royalties ou Jurídico lê; quem vê um dos dois já lê", () => {
    const nada = [artigosPara(false, undefined, false, false, false, false).some((a) => a.id === "franqueadora-o-que-e"), novidadesPara(false, undefined, false, false, false, false).some((n) => n.id === "2026-11-25-franqueadora")];
    expect(nada).toEqual([false, false]);
    for (const [r, j] of [[true, false], [false, true]] as const) {
      expect(artigosPara(false, undefined, r, j, false, false).some((a) => a.id === "franqueadora-o-que-e")).toBe(true);
      expect(novidadesPara(false, undefined, r, j, false, false).some((n) => n.id === "2026-11-25-franqueadora")).toBe(true);
    }
  });
});
