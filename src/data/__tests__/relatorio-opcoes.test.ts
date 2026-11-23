import { describe, expect, it } from "vitest";
import { ID_BIG, ID_SATISF, montarRelatorio } from "@/data/relatorio";
import { montarRelatorioSemanal } from "@/data/relatorioSemana";
import { GRUPOS_DO_RELATORIO, TODOS_OS_IDS, previaDoItem, rotuloDaOpcao } from "@/data/relatorioOpcoes";
import { lerEscolhas, salvarEscolhas } from "@/lib/relatorioEscolhas";
import { month, unit } from "./helpers";

const dados = [month("2026-10", [unit("Asa Sul", { faturamento: 120000, nps: 80 }), unit("Gama", { faturamento: 40000 })])];

describe("opções do relatório", () => {
  it("cada item aparece uma vez só, agrupado por assunto, e diz onde existe", () => {
    const ids = GRUPOS_DO_RELATORIO.flatMap((g) => g.itens.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    const por = (id: string) => GRUPOS_DO_RELATORIO.flatMap((g) => g.itens).find((i) => i.id === id)!;
    expect(por("tk")).toMatchObject({ mes: true, semana: false }); // ticket é do mês: apagado na semana
    expect(por("rec")).toMatchObject({ mes: false, semana: true });
    expect(por("fat")).toMatchObject({ mes: true, semana: true });
    expect(GRUPOS_DO_RELATORIO.map((g) => g.titulo)).toEqual(["Visão geral", "Faturamento e vendas", "Retenção e cobrança", "Satisfação", "Alunos", "Plano de ação"]);
    expect(rotuloDaOpcao("fat", "mes")).toBe("Faturamento");
    expect(rotuloDaOpcao("canc", "semana")).toBe("Cancelamentos");
  });

  it("a prévia mostra os números do slide e fica vazia quando o item não gera slide", () => {
    const m = montarRelatorio(dados, "2026-10", [ID_BIG, "fat", ID_SATISF, "cresc"], null)!;
    expect(previaDoItem(m, "fat")).toBe("1º Asa Sul: R$ 120.000");
    expect(previaDoItem(m, ID_BIG)).toContain("Faturamento R$ 160.000");
    expect(previaDoItem(m, ID_SATISF)).toBe("NPS 80");
    expect(previaDoItem(m, "cresc")).toBeNull(); // sem o mês do ano anterior não há crescimento: o slide não sai
    expect(previaDoItem(m, "inad")).toBeNull(); // não foi marcado
    const um = montarRelatorio(dados, "2026-10", ["fat"], ["Asa Sul"])!;
    expect(previaDoItem(um, "fat")).toBe("R$ 120.000");
  });
});

describe("prévia do relatório semanal", () => {
  it("mostra o número da semana e, em seguida, o acumulado do mês até agora", () => {
    const base = [month("2026-11", [unit("Itapoã", { semanas: [{ contratos: 38, valorContratos: 3800 }, { contratos: 52, valorContratos: 5200 }, { contratos: 37, valorContratos: 3700 }] } as never)])];
    const m = montarRelatorioSemanal(base, "2026-11", 3, ["cv"], ["Itapoã"], 21)!;
    expect(previaDoItem(m, "cv")).toBe("na semana (15-21 nov/26): 37 · no mês até aqui (1-21 nov/26): 127, R$ 12.700 vendidos");
    expect(rotuloDaOpcao("cv", "semana")).toBe("Contratos vendidos"); // sem o "(total)" que confundia com o total do mês
  });
});

describe("última escolha lembrada", () => {
  const armazem = () => { const d: Record<string, string> = {}; return { getItem: (k: string) => d[k] ?? null, setItem: (k: string, v: string) => { d[k] = v; } }; };

  it("guarda por e-mail e descarta indicadores que não existem mais", () => {
    const a = armazem();
    expect(lerEscolhas("ana@exemplo.com", a)).toEqual({});
    salvarEscolhas("Ana@exemplo.com", { tipo: "mes", escopo: "algumas", marcadas: ["Gama"], indMes: ["fat", "nps", ID_SATISF], indSem: ["canc"] }, a);
    expect(lerEscolhas("ana@exemplo.com", a)).toEqual({ tipo: "mes", escopo: "algumas", marcadas: ["Gama"], indMes: ["fat", ID_SATISF], indSem: ["canc"] }); // "nps" saiu do menu
    expect(lerEscolhas("outra@exemplo.com", a)).toEqual({});
    expect(TODOS_OS_IDS.has("nps")).toBe(false);
  });

  it("sem armazenamento ou com texto quebrado, o menu abre como sempre", () => {
    expect(lerEscolhas("a@b.com", null)).toEqual({});
    expect(lerEscolhas("a@b.com", { getItem: () => "{quebrado" })).toEqual({});
    expect(() => salvarEscolhas("a@b.com", {}, { setItem: () => { throw new Error("cheio"); } })).not.toThrow();
  });
});
