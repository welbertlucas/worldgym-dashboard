import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { chaveDaEmpresa, dataDoProcesso, montarJuridico, nomeDaEmpresa, parseAba, resumoDoMes, valorDaCausa } from "../../../server/juridico.js";
import { agrupar, diasSemMovimento, empresasDe, filtrar, filtroInicial, ordenar, parado, resumo, type Processo } from "@/data/juridico";

const CAB = ["Ano", "Número do Processo", "Unidade", "Polo da Ação", "Parte Contrária", "Judicial / Extrajudicial", "Tribunal", "Juízo", "Tipo de Ação", "Objeto da Ação", "Valor da Causa", "Status do Processo", "Data da Última Movimentação", "Último Andamento"];
// Dados inventados (nada da planilha real). Serial 46310 = 2026-10-15.
const ATIVOS = [
  CAB,
  [2026, "0000001-00.2026.8.07.0001", "Empresa Alfa Academias Ltda", "Réu", "FULANO DE TAL", "Judicial", "TJDF", "2º Juizado", "Ação de Indenização", "texto livre com nome", 10000, "Ativo", 46310, "andamento livre"],
  [2026, "0000002-00.2026.8.07.0002", "EMPRESA ALFA ACADEMIAS LTDA", "RÉU", "Beltrano", "Judicial", "TJDF", "3º Juizado", "Ação de Cobrança", "x", "Sigiloso", "Ativo", "Sigiloso", "y"],
  [2025, "PA 1", "Empresa Beta Ldta", "Réu", "PROCON", "Extrajudicial", "PROCON-GO", "—", "Notificação Extrajudicial", "x", 0, "Ativo", "05/11/2026", "z"],
  [2025, "", "Sem número", "Réu", "x", "Judicial", "TJDF", "", "", "", 1, "Ativo", "", ""],
];
const ARQ = [CAB, [2026, "0000009-00.2026.8.05.0001", "Empresa Beta Ldta", "Autor", "Cicrano", "Judicial", "TJBA", "10ª Vara", "Ação de Cobrança", "x", "R$ 7.217,58", "Arquivado", "2026-08-27", "w"]];

describe("leitura da planilha do jurídico", () => {
  it("descarta a parte contrária e os textos livres e normaliza empresa, polo, valor e data", () => {
    const m = montarJuridico({ ativos: ATIVOS, arquivados: ARQ }, new Date("2026-11-20T12:00:00Z"));
    expect(m.processos).toHaveLength(4); // a linha sem número saiu
    const json = JSON.stringify(m);
    for (const proibido of ["FULANO", "Beltrano", "Cicrano", "texto livre", "andamento livre"]) expect(json).not.toContain(proibido);
    expect(Object.keys(m.processos[0]).sort()).toEqual(["ano", "arquivado", "empresa", "juizo", "natureza", "numero", "orgao", "polo", "sigiloso", "status", "tipo", "ultimaMov", "valor"]);
    const [a, b, c, d] = m.processos;
    expect(a).toMatchObject({ empresa: "Empresa Alfa Academias Ltda", polo: "Réu", valor: 10000, ultimaMov: "2026-10-15", natureza: "judicial", arquivado: false });
    expect(b).toMatchObject({ empresa: "Empresa Alfa Academias Ltda", polo: "Réu", valor: null, sigiloso: true, ultimaMov: null });
    expect(c).toMatchObject({ empresa: "Empresa Beta Ltda", natureza: "extrajudicial", orgao: "PROCON-GO", juizo: "", valor: 0, ultimaMov: "2026-11-05" });
    expect(d).toMatchObject({ arquivado: true, valor: 7217.58, status: "Arquivado", polo: "Autor", ultimaMov: "2026-08-27" });
  });

  it("número repetido vale uma vez (a aba de ativos ganha) e aba sem o cabeçalho esperado não devolve nada", () => {
    const igual = [CAB, [2026, "0000001-00.2026.8.07.0001", "Outra", "Réu", "", "Judicial", "TJDF", "", "", "", 1, "Arquivado", "", ""]];
    expect(montarJuridico({ ativos: ATIVOS, arquivados: igual }).processos.filter((p: any) => p.numero === "0000001-00.2026.8.07.0001")).toHaveLength(1);
    expect(parseAba([["a", "b"], [1, 2]])).toEqual([]);
    expect(parseAba([])).toEqual([]);
  });

  it("funções de apoio", () => {
    expect(nomeDaEmpresa("FLAG ACADEMIAS DO BRASIL LTDA")).toBe(nomeDaEmpresa("Flag Academias do Brasil Ldta"));
    expect(chaveDaEmpresa("Aliança Academia LTDA - EPP.")).toBe(chaveDaEmpresa("aliança academia ltda"));
    expect(valorDaCausa("R$ 1.234,56")).toBe(1234.56);
    expect(valorDaCausa("Sigiloso")).toBeNull();
    expect(dataDoProcesso(46310)).toBe("2026-10-15");
    expect(dataDoProcesso("05/11/2026")).toBe("2026-11-05");
    expect(dataDoProcesso("Sigiloso")).toBeNull();
  });

  it("o resumo do mês leva só totais", () => {
    const r = resumoDoMes(montarJuridico({ ativos: ATIVOS, arquivados: ARQ }, new Date("2026-11-20T12:00:00Z")));
    expect(r).toEqual({ mes: "2026-11", atualizadoEm: "2026-11-20T12:00:00.000Z", ativos: 3, arquivados: 1, valorEmRisco: 10000, sigilosos: 1, judiciais: 2, extrajudiciais: 1 });
  });
});

const P = (o: Partial<Processo>): Processo => ({ ano: 2026, numero: "1", empresa: "A", polo: "Réu", natureza: "judicial", orgao: "TJDF", juizo: "", tipo: "T", valor: 0, sigiloso: false, status: "Ativo", ultimaMov: "2026-11-10", arquivado: false, ...o });
const HOJE = "2026-11-20";

describe("cálculos da tela de jurídico", () => {
  const ps = [P({ numero: "1", valor: 10000, empresa: "Alfa", ultimaMov: "2026-11-15" }), P({ numero: "2", valor: null, sigiloso: true, empresa: "Alfa", ultimaMov: null }), P({ numero: "3", natureza: "extrajudicial", orgao: "PROCON", empresa: "Beta", polo: "Autor", ultimaMov: "2026-08-01" }), P({ numero: "4", arquivado: true, empresa: "Beta", valor: 500 })];

  it("filtra por situação, natureza e empresa", () => {
    expect(filtrar(ps, filtroInicial).map((p) => p.numero)).toEqual(["1", "2", "3"]);
    expect(filtrar(ps, { ...filtroInicial, situacao: "arquivados" }).map((p) => p.numero)).toEqual(["4"]);
    expect(filtrar(ps, { ...filtroInicial, situacao: "todos", natureza: "extrajudicial" }).map((p) => p.numero)).toEqual(["3"]);
    expect(filtrar(ps, { ...filtroInicial, empresa: "Beta" }).map((p) => p.numero)).toEqual(["3"]);
    expect(empresasDe(ps)).toEqual(["Alfa", "Beta"]);
  });

  it("parado = ativo sem movimentação há mais de 60 dias ou sem data; arquivado nunca", () => {
    expect(diasSemMovimento(ps[0], HOJE)).toBe(5);
    expect(parado(ps[0], HOJE)).toBe(false);
    expect(parado(ps[1], HOJE)).toBe(true);
    expect(parado(ps[2], HOJE)).toBe(true);
    expect(parado(ps[3], HOJE)).toBe(false);
  });

  it("resumo, grupos e ordenação", () => {
    const ativos = filtrar(ps, filtroInicial);
    expect(resumo(ativos, HOJE)).toEqual({ total: 3, valor: 10000, semValor: 1, sigilosos: 1, reu: 2, judiciais: 2, extrajudiciais: 1, parados: 2 });
    expect(agrupar(ativos, "empresa")).toEqual([{ nome: "Alfa", qtd: 2, valor: 10000 }, { nome: "Beta", qtd: 1, valor: 0 }]);
    expect(ordenar(ativos, "valor").map((p) => p.numero)).toEqual(["1", "3", "2"]);
    expect(ordenar(ativos, "parados").map((p) => p.numero)).toEqual(["2", "3", "1"]);
    expect(ordenar(ativos, "recentes").map((p) => p.numero)).toEqual(["1", "3", "2"]);
  });
});
