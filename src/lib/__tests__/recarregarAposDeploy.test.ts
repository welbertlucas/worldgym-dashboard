import { describe, expect, it } from "vitest";
import { CHAVE_RECARGA, INTERVALO_RECARGA_MS, deveRecarregar, recarregarAposDeploy } from "../recarregarAposDeploy";

const memoria = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("recarregar depois de um deploy", () => {
  it("recarrega na primeira falha e anota a hora", () => {
    const a = memoria();
    expect(deveRecarregar(a, 1_000_000)).toBe(true);
    expect(a.m.get(CHAVE_RECARGA)).toBe("1000000");
  });

  it("não recarrega de novo logo depois (evita recarregar sem parar); passado o intervalo, volta a recarregar", () => {
    const a = memoria();
    deveRecarregar(a, 1_000_000);
    expect(deveRecarregar(a, 1_000_000 + 5_000)).toBe(false);
    expect(deveRecarregar(a, 1_000_000 + INTERVALO_RECARGA_MS + 1)).toBe(true);
  });

  it("sem armazenamento (ou com erro ao gravar) recarrega mesmo assim", () => {
    expect(deveRecarregar(null)).toBe(true);
    expect(deveRecarregar({ getItem: () => null, setItem: () => { throw new Error("bloqueado"); } })).toBe(true);
  });

  it("no evento do Vite recarrega a página e esconde o erro; na segunda falha seguida deixa o erro aparecer", () => {
    const ouvintes: ((e: { preventDefault: () => void }) => void)[] = [];
    let recargas = 0;
    const sessao = memoria();
    const janela = {
      addEventListener: (_tipo: string, f: (e: { preventDefault: () => void }) => void) => ouvintes.push(f),
      sessionStorage: sessao,
      location: { reload: () => { recargas += 1; } },
    } as unknown as Window;
    recarregarAposDeploy(janela);
    let escondido = 0;
    const evento = { preventDefault: () => { escondido += 1; } };
    ouvintes[0](evento);
    ouvintes[0](evento);
    expect(recargas).toBe(1);
    expect(escondido).toBe(1);
  });
});
