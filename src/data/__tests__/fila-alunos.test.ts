import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { criarTrava, executarComLimite, ordenarPorAntiguidade } from "../../../server/filaAlunos.js";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("ordem da fila de alunos", () => {
  it("as nunca lidas vão primeiro e depois a mais antiga, sem mexer na ordem de empate", () => {
    const carimbos: Record<string, string | undefined> = { A: "2026-11-18T03:00:00Z", B: undefined, C: "2026-11-17T03:00:00Z", D: undefined };
    const fila = ordenarPorAntiguidade([["1", "A"], ["2", "B"], ["3", "C"], ["4", "D"]], ([, n]: string[]) => carimbos[n]);
    expect(fila.map(([, n]: string[]) => n)).toEqual(["B", "D", "C", "A"]);
  });
  it("carimbo inválido conta como nunca lida", () => {
    const fila = ordenarPorAntiguidade([["1", "A"], ["2", "B"]], ([, n]: string[]) => (n === "A" ? "2026-11-18T03:00:00Z" : "lixo"));
    expect(fila.map(([, n]: string[]) => n)).toEqual(["B", "A"]);
  });
});

describe("executarComLimite", () => {
  it("nunca passa do limite ao mesmo tempo e faz todas", async () => {
    let ativas = 0, pico = 0;
    const r = await executarComLimite([1, 2, 3, 4, 5, 6, 7], 3, async () => { ativas++; pico = Math.max(pico, ativas); await espera(5); ativas--; });
    expect(pico).toBe(3);
    expect(r.feitas.length).toBe(7);
    expect(r.puladas).toEqual([]);
    expect(r.falhas).toEqual([]);
  });
  it("começa na ordem dada", async () => {
    const ordem: number[] = [];
    await executarComLimite([1, 2, 3, 4], 2, async (n: number) => { ordem.push(n); await espera(2); });
    expect(ordem).toEqual([1, 2, 3, 4]);
  });
  it("depois do corte não começa item novo; o que estava em andamento termina e o resto fica como pulado", async () => {
    let corte = false;
    const feitos: number[] = [];
    const r = await executarComLimite([1, 2, 3, 4, 5, 6], 2, async (n: number) => { if (n === 2) corte = true; await espera(5); feitos.push(n); }, { podeIniciar: () => !corte });
    expect(feitos.sort()).toEqual([1, 2]);
    expect(r.puladas).toEqual([3, 4, 5, 6]);
  });
  it("uma falha não derruba as outras", async () => {
    const r = await executarComLimite([1, 2, 3], 2, async (n: number) => { if (n === 2) throw new Error("EVO fora"); });
    expect(r.feitas).toEqual([1, 3]);
    expect(r.falhas.length).toBe(1);
    expect(r.falhas[0].item).toBe(2);
  });
  it("lista vazia e limite maior que a lista funcionam", async () => {
    expect((await executarComLimite([], 3, async () => {})).feitas).toEqual([]);
    expect((await executarComLimite([1], 5, async () => {})).feitas).toEqual([1]);
  });
});

describe("trava de gravação", () => {
  it("as gravações rodam uma de cada vez, na ordem, mesmo se uma falhar", async () => {
    const trava = criarTrava();
    const log: string[] = [];
    const a = trava(async () => { log.push("a1"); await espera(10); log.push("a2"); });
    const b = trava(async () => { log.push("b1"); throw new Error("x"); });
    const c = trava(async () => { log.push("c1"); });
    await a; await b.catch(() => {}); await c;
    expect(log).toEqual(["a1", "a2", "b1", "c1"]);
  });
});
