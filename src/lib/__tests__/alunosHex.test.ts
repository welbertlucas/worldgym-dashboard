import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error módulo JS do servidor
import { contarAlunosPorHexagono, hexagonoMaisPerto, indiceDeHexagonos, lerAlunosHex, normalizarCep, posicaoPorPrefixo, tabelaCepValida } from "../../../server/alunosHex.js";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";

// Números e CEPs INVENTADOS. Hexágonos: uma coluna de centros a cada 0,002° (~220 m); o do meio sem moradores.
const celulas: [number, number, number][] = Array.from({ length: 9 }, (_, i) => [-15.8 + (i - 4) * 0.002, -47.9, i === 4 ? 0 : 120]);
const tabelas = { DF: { uf: "DF", ceps: { "70000001": [-15.8, -47.9, 40, 0.1], "70000002": [-15.79, -47.9, 12, 0.2], "70000003": [-15.795, -47.9, 5, 3.2], "70000004": [-15.5, -47.5, 9, 0.1] } } };

describe("alunos por hexágono (CEP)", () => {
  it("normaliza o CEP e valida a tabela", () => {
    expect(normalizarCep("70.000-001")).toBe("70000001"); expect(normalizarCep("7000")).toBe(""); expect(normalizarCep(null)).toBe("");
    expect(tabelaCepValida(tabelas.DF)).toBe(true);
    expect(tabelaCepValida({ uf: "DF", ceps: { "7": [0, 0, 1, 0] } })).toBe(false); // CEP com menos de 8 dígitos
    expect(tabelaCepValida({ uf: "df", ceps: {} })).toBe(false); expect(tabelaCepValida(null)).toBe(false);
  });

  it("acha o hexágono mais perto, ignorando o sem moradores e o longe demais", () => {
    const idx = indiceDeHexagonos(celulas);
    expect(hexagonoMaisPerto(idx, -15.8041, -47.9)).toBe(2);
    const m = hexagonoMaisPerto(idx, -15.8, -47.9); expect(m).toBeGreaterThanOrEqual(0); expect(m).not.toBe(4); // o do meio não tem moradores
    expect(hexagonoMaisPerto(idx, -15.5, -47.5)).toBe(-1); // a quilômetros de qualquer hexágono
  });

  it("conta só aluno com CEP achado e de posição boa; o resto vira número de controle", () => {
    const idx = indiceDeHexagonos(celulas);
    const alunos = [
      ...Array(3).fill({ zipCode: "70000001" }),
      ...Array(4).fill({ zipCode: "70.000-002" }),
      { zipCode: "70000003" }, // espalhamento de 3,2 km: CEP rural, fora do mapa
      { zipCode: "99999999" }, // fora da tabela
      { zipCode: "" }, { zipCode: null }, // sem CEP
      { zipCode: "70000004" }, // CEP fora do alcance de qualquer hexágono
    ];
    const r = contarAlunosPorHexagono(alunos, tabelas, idx);
    expect(r).toMatchObject({ total: 12, semCep: 2, foraDaTabela: 1, baixaPrecisao: 1, semHexagono: 1, comPosicao: 7 });
    expect(r.celulas.reduce((a: number, c: number[]) => a + c[2], 0)).toBe(7);
    expect(r.celulas.every((c: number[]) => c.length === 3 && c[2] > 0)).toBe(true);
  });

  it("CEP fora da tabela vira a posição da região do CEP (prefixo), só se os CEPs vizinhos são próximos entre si", () => {
    // 7100000x: dois CEPs a ~220 m um do outro; 7200000x: dois CEPs a ~45 km um do outro (mesmo começo de 5 dígitos, mas não é a mesma região)
    const tab = { DF: { uf: "DF", ceps: { "71000001": [-15.8, -47.9, 40, 0.1], "71000002": [-15.802, -47.9, 30, 0.1], "72000001": [-15.8, -47.9, 10, 0.1], "72000002": [-15.5, -47.5, 10, 0.1] } } };
    const idx = indiceDeHexagonos(celulas);
    const p = posicaoPorPrefixo("71000009", tab); // mesmo começo (7 dígitos) de 71000001 e 71000002
    expect(p).not.toBeNull(); expect(Math.abs(p![0] - -15.8)).toBeLessThan(0.01);
    expect(posicaoPorPrefixo("72000009", tab)).toBeNull(); // os vizinhos estão a 45 km um do outro: não serve
    expect(posicaoPorPrefixo("99999999", tab)).toBeNull();
    const r = contarAlunosPorHexagono([{ zipCode: "71000009" }, { zipCode: "72000009" }], tab, idx);
    expect(r).toMatchObject({ comPosicao: 1, porPrefixo: 1, foraDaTabela: 1 });
  });

  it("a leitura respeita quem pode ver a unidade", async () => {
    const m = new Map<string, unknown>([["estudos/alunos-hex/5.json", { em: "2026-11-25", celulas: [[-15.8, -47.9, 3]] }]]);
    definirArmazem({ async ler(c: string) { return (m.get(c) as unknown) ?? null; }, async gravar() {} });
    expect((await lerAlunosHex("Asa Norte"))!.celulas).toHaveLength(1); // o dono vê qualquer unidade
    expect(await lerAlunosHex("Asa Norte", (n: string) => n === "Gama")).toBeNull(); // quem só tem o Gama não vê a Asa Norte
    expect(await lerAlunosHex("Unidade que não existe")).toBeNull();
    definirArmazem(null);
  });
});

describe("scripts/cep-posicoes.py", () => {
  it("monta a posição do CEP pela mediana dos endereços de boa qualidade e mede o espalhamento", () => {
    const dir = mkdtempSync(join(tmpdir(), "cep-"));
    const cab = "COD_UNICO_ENDERECO;COD_UF;CEP;LATITUDE;LONGITUDE;NV_GEO_COORD";
    const linhas = [
      "1;53;70000001;-15.8000;-47.9000;1", "2;53;70000001;-15.8002;-47.9002;1", "3;53;70000001;-15.8004;-47.9004;2",
      "4;53;70000001;-10.0000;-40.0000;5", // nível 5 (localidade): fora da conta
      "5;53;70000002;-15.7;-47.8;1", "6;53;70000002;-15.6;-47.7;1", // espalhado (~15 km)
      "7;53;00000000;-15.7;-47.8;1", "8;53;;-15.7;-47.8;1", // sem CEP válido
    ];
    const csv = join(dir, "53_DF.csv"), saida = join(dir, "cep_DF.json");
    writeFileSync(csv, [cab, ...linhas].join("\n"));
    execFileSync("python3", ["-I", "scripts/cep-posicoes.py", "--uf", "DF", "--fonte", csv, "--saida", saida], { stdio: "pipe" });
    const t = JSON.parse(readFileSync(saida, "utf8"));
    expect(t.uf).toBe("DF"); expect(Object.keys(t.ceps).sort()).toEqual(["70000001", "70000002"]);
    expect(t.ceps["70000001"][0]).toBeCloseTo(-15.8002, 4); expect(t.ceps["70000001"][2]).toBe(3); expect(t.ceps["70000001"][3]).toBeLessThan(0.05);
    expect(t.ceps["70000002"][3]).toBeGreaterThan(5); // espalhamento grande: o mapa descarta
    expect(t.resumo.semCep).toBe(2); expect(tabelaCepValida(t)).toBe(true);
  });
});
