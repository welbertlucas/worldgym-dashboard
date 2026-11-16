import { describe, expect, it } from "vitest";
import { ARTIGOS, artigosPara, buscarAjuda, secoesPara } from "@/data/ajuda";
import { NOVIDADES, naoVistas, novidadesPara } from "@/data/novidades";
import { itensDoMenu } from "@/components/nav";

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

  it("Ajuda fica por último no menu, depois de Usuários", () => {
    expect(itensDoMenu(true).slice(-2).map((i) => i.id)).toEqual(["acessos", "ajuda"]);
    expect(itensDoMenu(false).at(-1)!.id).toBe("ajuda");
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
});
