import { describe, expect, it } from "vitest";
import { ARTIGOS, artigosPara, buscarAjuda, SECOES, secoesPara } from "@/data/ajuda";
import { NOVIDADES, naoVistas, novidadesPara } from "@/data/novidades";
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
    expect(ondeFica("comercial/oportunidades")).toBe("Menu › Comercial › Oportunidades");
    expect(ondeFica("riscos/mes")).toBe("Botão Alertas, no cabeçalho › Mês em andamento");
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
});
