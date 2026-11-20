import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QualidadeConteudo } from "@/components/tabs/QualidadeTab";
import { Modelos } from "@/components/qualidade/Modelos";
import { VisaoGeral } from "@/components/qualidade/VisaoGeral";
import { NovaVisita } from "@/components/qualidade/NovaVisita";
import { itensDoMenu, TODOS_OS_MENUS, nomeDaTela } from "@/components/nav";
import type { DadosQualidade, Visita } from "@/data/qualidade";

const limpo = (h: string) => h.replace(/<!-- -->/g, "").replace(/ /g, " ");
const MODELO = { id: "m1", nome: "Roteiro de visitação", descricao: "", frequencia: "visita" as const, ativo: true, atualizadoEm: "2026-11-20T00:00:00Z", itens: [{ id: "i1", grupo: "Banheiros", texto: "Banheiro feminino limpo", peso: 2, foto: "nao_conforme" as const }, { id: "i2", grupo: "Equipe", texto: "Equipe uniformizada", peso: 1, foto: "nenhuma" as const }] };
const VISITA: Visita = { id: "v1", modeloId: "m1", modeloNome: "Roteiro de visitação", unidade: "Asa Norte", data: "2026-11-18", mes: "2026-11", avaliador: { nome: "Ana", email: "a@x.com" }, respostas: [{ itemId: "i1", grupo: "Banheiros", texto: "Banheiro feminino limpo", peso: 2, conforme: false, comentario: "sem papel", fotos: [] }, { itemId: "i2", grupo: "Equipe", texto: "Equipe uniformizada", peso: 1, conforme: true, comentario: "", fotos: [] }], observacao: "", nota: 33.3, criadoEm: "2026-11-18T12:00:00Z" };
const DADOS: DadosQualidade = { unidades: ["Asa Norte", "Gama", "Itapoã"], modelos: [MODELO], visitas: [VISITA] };

describe("Qualidade (menu e telas)", () => {
  it("o item só entra no menu para quem foi liberado", () => {
    expect(itensDoMenu(false, false, false, false, false, false).some((i) => i.id === "qualidade")).toBe(false);
    expect(itensDoMenu(false, false, false, false, false, true).some((i) => i.id === "qualidade")).toBe(true);
    expect(TODOS_OS_MENUS.some((i) => i.id === "qualidade")).toBe(true);
    expect(nomeDaTela("qualidade")).toBe("Qualidade");
  });

  it("mostra carregando, sem acesso e falha", () => {
    expect(renderToString(<QualidadeConteudo estado={{ fase: "carregando" }} />)).toContain("Carregando");
    expect(renderToString(<QualidadeConteudo estado={{ fase: "erro", motivo: "permissao" }} />)).toContain("não tem acesso");
    expect(renderToString(<QualidadeConteudo estado={{ fase: "erro", motivo: "falha" }} />)).toContain("Não consegui carregar");
  });

  it("com dados, abre na visão geral com as abas, os cartões e o ranking", () => {
    const html = limpo(renderToString(<QualidadeConteudo hoje="2026-11-20" estado={{ fase: "pronto", dados: DADOS }} />));
    for (const t of ["Visão geral", "Nova visita", "Visitas", "Checklists", "Nota média da rede", "Visitas no mês", "Sem visita", "Equipamentos parados", "Itens não conformes", "Nota por unidade", "Itens que mais falham", "Banheiro feminino limpo"]) expect(html).toContain(t);
    expect(html).toContain("2 de 3"); // Gama e Itapoã sem visita
  });

  it("mostra o painel de equipamentos parados com código, descrição e há quanto tempo", () => {
    const comEq: Visita = { ...VISITA, respostas: [{ itemId: "e", grupo: "", texto: "Equipamentos", tipo: "equipamentos", conforme: false, comentario: "", fotos: [], equipamentos: [{ codigo: "EQ-77", descricao: "esteira 3 travada", fotos: [] }] }] };
    const html = limpo(renderToString(<VisaoGeral dados={{ ...DADOS, visitas: [comEq] }} hoje="2026-11-20" onUnidade={() => {}} />));
    expect(html).toContain("1 equipamento parado");
    expect(html).toContain("EQ-77");
    expect(html).toContain("esteira 3 travada");
    expect(html).toContain("desde 18/11/2026");
  });

  it("visão geral sem visita nenhuma não quebra", () => {
    const html = limpo(renderToString(<VisaoGeral dados={{ ...DADOS, visitas: [] }} hoje="2026-11-20" onUnidade={() => {}} />));
    expect(html).toContain("3 de 3");
    expect(html).toContain("Nenhum item não conforme");
  });

  it("checklists: lista com o botão do roteiro sugerido; sem checklist, convida a criar", () => {
    const html = limpo(renderToString(<Modelos modelos={[MODELO]} onMudou={() => {}} />));
    expect(html).toContain("Roteiro de visitação");
    expect(html).toContain("2 itens");
    expect(html).toContain("Usar o roteiro sugerido");
    expect(limpo(renderToString(<Modelos modelos={[]} onMudou={() => {}} />))).toContain("Crie o primeiro");
  });

  it("nova visita: sem checklist avisa; com checklist pede unidade e checklist", () => {
    expect(renderToString(<NovaVisita dados={{ ...DADOS, modelos: [] }} hoje="2026-11-20" onSalvou={() => {}} />)).toContain("Crie um checklist");
    const html = limpo(renderToString(<NovaVisita dados={DADOS} hoje="2026-11-20" onSalvou={() => {}} />));
    expect(html).toContain("Escolha a unidade e o checklist para começar");
    expect(html).toContain("Roteiro de visitação");
  });
});
