import { describe, expect, it } from "vitest";
import { limitarSemCenso, parecerDoPonto } from "@/lib/estudoPonto";
// @ts-expect-error módulo JS do servidor
import { blocosUrbanos, censoDoPonto, dentroDaCaixa, pertoDosBlocos } from "../../../server/censoMunicipio.js";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";

// Números inventados (as premissas reais não entram em teste nem no repositório).
const cidade = (lat0: number, lng0: number) => Array.from({ length: 6 }, (_, i) => [lat0 + i * 0.003, lng0 + i * 0.003, 200, 3000, 70]); // 6 hexágonos povoados no mesmo bloco
const rural = (lat: number, lng: number) => [[lat, lng, 90, 1500, 30]]; // um hexágono isolado (setor rural inteiro)

describe("Censo por município", () => {
  it("só conta como cidade o bloco com vários hexágonos povoados; a zona rural não entra", () => {
    const blocos = blocosUrbanos([...cidade(-17.88, -51.72), ...rural(-18.4, -52.1), ...rural(-17.45, -51.3)]);
    expect(blocos).toHaveLength(1);
    expect(pertoDosBlocos([-17.88, -51.72], blocos)).toBe(true);
    expect(pertoDosBlocos([-17.91, -51.76], blocos)).toBe(true); // bloco vizinho (a área de 10 min passa do bloco)
    expect(pertoDosBlocos([-17.4, -52.1], blocos)).toBe(false); // zona rural do mesmo município
    expect(pertoDosBlocos([-17.79, -50.93], blocos)).toBe(false); // cidade vizinha, a 90 km
  });

  it("a API devolve só o município que cobre o ponto, e nada quando nenhum foi gerado", async () => {
    const memoria = new Map<string, unknown>();
    const A = { cod: "5200001", nome: "Cidade A", uf: "GO", celulas: cidade(-17.88, -51.72) }, B = { cod: "5200002", nome: "Cidade B", uf: "GO", celulas: cidade(-17.79, -50.93) };
    for (const m of [A, B]) memoria.set(`estudos/censo-mun/${m.cod}.json`, { rk: 0.2, municipio: { cod: m.cod }, celulas: m.celulas });
    memoria.set("estudos/censo-mun/indice.json", { municipios: [A, B].map((m) => ({ cod: m.cod, nome: m.nome, uf: m.uf, blocos: blocosUrbanos(m.celulas) })) });
    definirArmazem({ ler: async (c: string) => memoria.get(c) ?? null, gravar: async () => {} });
    try {
      const a = await censoDoPonto({ c: [-17.882, -51.718] });
      expect(a.municipios.map((m: { nome: string }) => m.nome)).toEqual(["Cidade A"]);
      expect(a.municipios[0].celulas).toHaveLength(6);
      expect((await censoDoPonto({ c: [-18.92, -48.28] })).municipios).toEqual([]);
      await expect(censoDoPonto({ c: ["x", 1] })).rejects.toThrow(/inválida/);
    } finally { definirArmazem(null); }
  });

  it("índice antigo, só com caixa, continua funcionando", () => {
    expect(dentroDaCaixa([-17.88, -51.72], [-17.9, -17.8, -51.8, -51.7])).toBe(true);
    expect(dentroDaCaixa([-18.9, -48.3], [-17.9, -17.8, -51.8, -51.7])).toBe(false);
  });
});

describe("sem Censo, o parecer nunca passa de com condicionantes", () => {
  it("aprova vira com condicionantes, e o que não aprova continua não aprovando", () => {
    expect(limitarSemCenso("aprovado", true)).toBe("atencao");
    expect(limitarSemCenso("aprovado", false)).toBe("aprovado");
    expect(limitarSemCenso("aprovado", undefined)).toBe("aprovado");
    expect(limitarSemCenso("atencao", true)).toBe("atencao");
    expect(limitarSemCenso("reprovado", true)).toBe("reprovado");
    expect(limitarSemCenso(null, true)).toBeNull();
  });

  it("o parecer explica o limite e não diz que as vendas ficam abaixo da meta quando passam dela", () => {
    const base = { provavel: 330_000, meta: 327_000, payback: 35, mesesAprovado: 36, mesesAtencao: 48 };
    const sem = parecerDoPonto({ ...base, veredito: "aprovado", semCenso: true });
    expect(sem.rotulo).toMatch(/condicionantes/i);
    expect(sem.porque).toMatch(/acima dos/);
    expect(sem.porque).toMatch(/sem o Censo desta região/);
    const com = parecerDoPonto({ ...base, veredito: "aprovado" });
    expect(com.rotulo).toMatch(/^Aprova$/i);
    // veredito "com condicionantes" vindo de outra regra, com as vendas acima da meta: não pode dizer "abaixo dos"
    expect(parecerDoPonto({ ...base, veredito: "atencao" }).porque).not.toMatch(/abaixo dos/);
    expect(parecerDoPonto({ ...base, provavel: 300_000, veredito: "atencao" }).porque).toMatch(/abaixo dos/);
  });
});
