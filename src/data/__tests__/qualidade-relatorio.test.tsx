import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { montarRelatorioDaVisita, nomeDoPdf } from "@/data/qualidadeRelatorio";
import { Detalhe } from "@/components/qualidade/Visitas";
import type { PlanoAcao, Visita } from "@/data/qualidade";

const r = (itemId: string, grupo: string, texto: string, conforme: boolean | null, extra: object = {}) => ({ itemId, grupo, texto, conforme, comentario: "", fotos: [], ...extra });
const visita = {
  id: "v1", modeloId: "m", modeloNome: "Roteiro", unidade: "Asa Norte", data: "2026-11-20", mes: "2026-11", avaliador: { nome: "Ana", email: "a@b.com" }, nota: 86.5, notasPorGrupo: { Recepção: 100, Estrutura: 72.5 }, observacao: "Reforçar a limpeza.", criadoEm: "x",
  checkin: { em: "2026-11-20T17:05:00Z", loc: { lat: 1, lng: 1, precisao: 5 }, ip: "1.1.1.1", distanciaM: 40, selfie: "2026-11_abc" }, duracaoMin: 75, assinatura: { nome: "Carlos", cargo: "Gerente", foto: "f1" },
  respostas: [
    r("1", "Recepção", "Uniforme", true), r("2", "Estrutura", "Vestiários", false, { comentario: "Sem água quente", fotos: ["f2"] }),
    r("3", "Estrutura", "Extintores", true, { vencimento: "2027-03-10" }), r("4", "Estrutura", "Piscina", null), r("5", "", "Item sem grupo", true),
  ],
} as unknown as Visita;
const plano = (visitaId: string) => ({ id: "p", unidade: "Asa Norte", visitaId, itemTexto: "Vestiários", oQue: "Consertar", prazo: "2026-11-30", responsavel: "", status: "validacao" }) as unknown as PlanoAcao;

describe("relatório em PDF da visita da Qualidade", () => {
  it("agrupa as respostas, conta, traz o vencimento, as fotos, a assinatura e só os planos da visita; a selfie não entra", () => {
    const rel = montarRelatorioDaVisita(visita, [plano("v1"), plano("outra")]);
    expect(rel).toMatchObject({ titulo: "Visita de qualidade", unidade: "Asa Norte", data: "20/11/2026", nota: "86,5%", origem: "franqueadora", contagem: { conformes: 3, naoConformes: 1, naoSeAplica: 1 } });
    expect(rel.grupos.map((g) => [g.nome, g.nota, g.itens.length])).toEqual([["Recepção", "100%", 1], ["Estrutura", "72,5%", 3], ["Itens", null, 1]]); // item sem grupo vai em "Itens"
    const ve = rel.grupos[1].itens;
    expect(ve[0]).toMatchObject({ situacao: "nao-conforme", comentario: "Sem água quente", fotos: ["f2"] });
    expect(ve[1].vencimento).toBe("10/03/2027");
    expect(ve[2].situacao).toBe("nao-se-aplica");
    expect(rel.marcas).toEqual(["Check-in 14:05 · a 40 m da unidade", "Duração: 75 min"]);
    expect(rel.planos).toEqual([{ item: "Vestiários", oQue: "Consertar", prazo: "30/11/2026", responsavel: "—", status: "aguardando confirmação" }]);
    expect(rel.assinatura).toMatchObject({ nome: "Carlos", foto: "f1" });
    expect(JSON.stringify(rel)).not.toContain("2026-11_abc"); // o código da selfie nunca vai para o PDF
  });

  it("envio do checklist da unidade tem outro título e o arquivo leva a unidade e a data", () => {
    const envio = { ...visita, origem: "unidade" } as Visita;
    expect(montarRelatorioDaVisita(envio).titulo).toBe("Checklist da unidade");
    expect(nomeDoPdf(visita)).toBe("Qualidade-Asa-Norte-2026-11-20.pdf");
    expect(nomeDoPdf({ unidade: "São Sebastião", data: "2026-11-02", origem: "unidade" })).toBe("Checklist-Sao-Sebastiao-2026-11-02.pdf");
  });

  it("o detalhe da visita ganha o botão Baixar PDF", () => {
    expect(renderToString(<Detalhe v={visita} planos={[]} />)).toContain("Baixar PDF");
  });
});
