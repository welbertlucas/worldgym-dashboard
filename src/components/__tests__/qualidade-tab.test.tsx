import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QualidadeConteudo } from "@/components/tabs/QualidadeTab";
import { Modelos } from "@/components/qualidade/Modelos";
import { VisaoGeral } from "@/components/qualidade/VisaoGeral";
import { NovaVisita } from "@/components/qualidade/NovaVisita";
import { Rotina } from "@/components/qualidade/Rotina";
import { ChecklistDaUnidade } from "@/components/qualidade/ChecklistDaUnidade";
import { Pedidos } from "@/components/qualidade/Pedidos";
import { PedidosDaUnidade } from "@/components/qualidade/PedidosDaUnidade";
import { itensDoMenu, TODOS_OS_MENUS, nomeDaTela } from "@/components/nav";
import { itensDaUnidade, type DadosQualidade, type Visita } from "@/data/qualidade";

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
    for (const t of ["Visão geral", "Nova visita", "Visitas", "Rotina das unidades", "Checklists", "Nota média da rede", "Visitas no mês", "Sem visita", "Equipamentos parados", "Itens não conformes", "Nota por unidade", "Itens que mais falham", "Banheiro feminino limpo"]) expect(html).toContain(t);
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

  it("mostra o painel do certificado PJ do CREF com vencimento e situação", () => {
    const comCert: Visita = { ...VISITA, respostas: [{ itemId: "c", grupo: "", texto: "Certificado", tipo: "vencimento", conforme: true, comentario: "", fotos: [], vencimento: "2026-12-10" }] };
    const html = limpo(renderToString(<VisaoGeral dados={{ ...DADOS, visitas: [comCert] }} hoje="2026-11-20" onUnidade={() => {}} />));
    expect(html).toContain("Certificado PJ do CREF");
    expect(html).toContain("10/12/2026");
    expect(html).toContain("faltam 20 dias");
    expect(html).toContain("sem data registrada");
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
    const comFora = { ...MODELO, itens: [{ ...MODELO.itens[0], foraDe: ["Gama"] }, MODELO.itens[1]] };
    expect(limpo(renderToString(<Modelos modelos={[comFora]} unidades={["Asa Norte", "Gama"]} onMudou={() => {}} />))).toContain("1 com unidades de fora");
    expect(limpo(renderToString(<Modelos modelos={[]} onMudou={() => {}} />))).toContain("Crie o primeiro");
  });

  it("nova visita: o item que não vale para a unidade escolhida não aparece", () => {
    const m = { ...MODELO, itens: [MODELO.itens[0], { ...MODELO.itens[1], foraDe: ["Gama"] }] };
    // sem unidade escolhida o formulário nem abre; o filtro vale pelo helper usado na tela
    expect(itensDaUnidade(m.itens, "Gama").map((i: any) => i.texto)).toEqual(["Banheiro feminino limpo"]);
    expect(itensDaUnidade(m.itens, "Asa Norte")).toHaveLength(2);
  });

  it("nova visita: sem checklist avisa; com checklist pede unidade e checklist", () => {
    expect(renderToString(<NovaVisita dados={{ ...DADOS, modelos: [] }} hoje="2026-11-20" onSalvou={() => {}} />)).toContain("Crie um checklist");
    const html = limpo(renderToString(<NovaVisita dados={DADOS} hoje="2026-11-20" onSalvou={() => {}} />));
    expect(html).toContain("Escolha a unidade e o checklist para começar");
    expect(html).toContain("Roteiro de visitação");
  });

  const ABERTURA = { ...MODELO, id: "ab", nome: "Checklist de abertura", frequencia: "diaria" as const };
  const ENVIO: Visita = { ...VISITA, id: "e1", modeloId: "ab", modeloNome: "Checklist de abertura", unidade: "Asa Norte", data: "2026-11-18", origem: "unidade", avaliador: { nome: "Gerente Asa", email: "g@x.com" } };

  it("rotina das unidades: mostra atrasadas, quem enviou e os não conformes (e orienta quando não há checklist de unidade)", () => {
    const html = limpo(renderToString(<Rotina dados={{ ...DADOS, modelos: [ABERTURA, MODELO], envios: [ENVIO] }} hoje="2026-11-20" onMudou={() => {}} />));
    for (const t of ["Rotina das unidades", "Checklist de abertura", "Asa Norte", "Gerente Asa", "Atrasada 1 dia", "Sem envio", "1 não conforme", "Não entra na nota"]) expect(html).toContain(t);
    expect(html).not.toContain("Roteiro de visitação"); // o da visita não é rotina de unidade
    expect(limpo(renderToString(<Rotina dados={DADOS} hoje="2026-11-20" onMudou={() => {}} />))).toContain("Nenhum checklist de unidade ainda");
  });

  it("a unidade vê só os checklists dela e os próprios envios, sem notas nem visitas", () => {
    const dados: DadosQualidade = { modo: "unidade", unidades: ["Asa Norte"], modelos: [ABERTURA], visitas: [], envios: [ENVIO] };
    const html = limpo(renderToString(<QualidadeConteudo hoje="2026-11-20" estado={{ fase: "pronto", dados }} />));
    for (const t of ["Checklists de Asa Norte", "Checklist de abertura", "Preencher agora", "Seus envios", "Atrasado: último envio 18/11/2026"]) expect(html).toContain(t);
    for (const t of ["Nota média", "Visão geral", "Itens que mais falham", "Gama"]) expect(html).not.toContain(t);
    expect(limpo(renderToString(<ChecklistDaUnidade dados={{ ...dados, modelos: [], envios: [] }} hoje="2026-11-20" onMudou={() => {}} />))).toContain("Ainda não há checklist");
  });

  it("formulário da unidade: sem escolha de unidade (uma só), sem data nem nota; mostra o checklist da rotina", () => {
    const dados: DadosQualidade = { modo: "unidade", unidades: ["Asa Norte"], modelos: [ABERTURA, MODELO], visitas: [], envios: [] };
    const html = limpo(renderToString(<NovaVisita dados={dados} hoje="2026-11-20" modo="unidade" onSalvou={() => {}} />));
    expect(html).toContain("Preencher o checklist");
    expect(html).toContain("Checklist de abertura");
    expect(html).not.toContain("Roteiro de visitação"); // o da visita fica de fora
    expect(html).not.toContain("Escolha a unidade");
    expect(html).not.toContain('aria-label="Data da visita"');
  });

  const PEDIDO = { id: "p1", unidade: "Asa Norte", modeloId: "ab", modeloNome: "Checklist de abertura", texto: "Piscina: cloro e pH medidos", motivo: "A unidade tem piscina", solicitante: { nome: "Gerente Asa", email: "g@x.com" }, status: "pendente" as const, criadoEm: "2026-11-19T12:00:00Z" };

  it("dono: a aba Pedidos lista o que espera resposta (com aprovar e recusar) e o que já foi respondido; a visão geral avisa", () => {
    const respondido = { ...PEDIDO, id: "p2", texto: "Sauna limpa", status: "recusado" as const, decisao: { por: "Dono", em: "2026-11-20T12:00:00Z", resposta: "Já coberto" } };
    const dados: DadosQualidade = { ...DADOS, modelos: [ABERTURA], pedidos: [PEDIDO, respondido] };
    const html = limpo(renderToString(<Pedidos dados={dados} onMudou={() => {}} />));
    for (const t of ["Pedidos de item novo", "Piscina: cloro e pH medidos", "A unidade tem piscina", "Pedido por Gerente Asa", "Aprovar", "Recusar", "Já respondidos", "Sauna limpa", "Recusado", "Já coberto"]) expect(html).toContain(t);
    expect(limpo(renderToString(<Pedidos dados={{ ...DADOS, pedidos: [] }} onMudou={() => {}} />))).toContain("Nenhum pedido esperando resposta");
    const abas = limpo(renderToString(<QualidadeConteudo hoje="2026-11-20" estado={{ fase: "pronto", dados }} />));
    expect(abas).toContain("Pedidos (1)");
    expect(abas).toContain("1 pedido de item novo espera");
    expect(abas).not.toContain("Pedidos (2)");
  });

  it("unidade: pode pedir um item novo e vê a resposta do dono nos próprios pedidos", () => {
    const aprovado = { ...PEDIDO, id: "p3", texto: "Sauna limpa", status: "aprovado" as const, decisao: { por: "Dono", em: "2026-11-20T12:00:00Z", resposta: "Incluído", escopo: "unidade" as const } };
    const dados: DadosQualidade = { modo: "unidade", unidades: ["Asa Norte"], modelos: [ABERTURA], visitas: [], envios: [], pedidos: [PEDIDO, aprovado] };
    const html = limpo(renderToString(<PedidosDaUnidade dados={dados} onMudou={() => {}} />));
    for (const t of ["Pedir um item novo", "Fazer um pedido", "Aguardando resposta", "Aprovado: já está no seu checklist", "Resposta:", "Incluído"]) expect(html).toContain(t);
    const tela = limpo(renderToString(<ChecklistDaUnidade dados={dados} hoje="2026-11-20" onMudou={() => {}} />));
    expect(tela).toContain("Pedir um item novo");
    expect(tela).not.toContain("Pedidos (");
    expect(limpo(renderToString(<PedidosDaUnidade dados={{ ...dados, modelos: [] }} onMudou={() => {}} />))).toBe(""); // sem checklist da unidade, sem pedido
  });

  it("checklists: o item pedido por uma unidade aparece marcado como só dela", () => {
    const m = { ...MODELO, itens: [{ ...MODELO.itens[0], soEm: ["Gama"] }, MODELO.itens[1]] };
    expect(limpo(renderToString(<Modelos modelos={[m]} unidades={["Asa Norte", "Gama"]} onMudou={() => {}} />))).toContain("Roteiro de visitação");
  });
});

import { Item } from "@/components/qualidade/NovaVisita";
import { Detalhe } from "@/components/qualidade/Visitas";
import { LocaisDasUnidades } from "@/components/qualidade/LocaisDasUnidades";

describe("Qualidade: check-in, check-out, selfie e data", () => {
  const ABRE = { ...MODELO, id: "ab", nome: "Checklist de abertura", frequencia: "diaria" as const };

  it("a unidade começa pelo check-in: o checklist só abre depois dele, sem escolher data nem horário", () => {
    const dados: DadosQualidade = { modo: "unidade", unidades: ["Asa Norte"], modelos: [ABRE], visitas: [], envios: [] };
    const html = limpo(renderToString(<NovaVisita dados={dados} hoje="2026-11-20" modo="unidade" onSalvou={() => {}} />));
    expect(html).toContain("Iniciar o checklist (check-in)");
    expect(html).toContain("registra o horário e a localização do seu aparelho");
    expect(html).toContain("endereço IP");
    expect(html).not.toContain("Equipe uniformizada"); // os itens só aparecem depois do check-in
    for (const t of ['aria-label="Data da visita"', "Chegada", "Saída", 'type="date"', 'type="time"']) expect(html).not.toContain(t);
  });

  it("checklist que pede selfie: o check-in mostra o aviso e só libera depois da selfie; o que não pede, não mostra", () => {
    const dados = (selfie?: boolean): DadosQualidade => ({ modo: "unidade", unidades: ["Asa Norte"], modelos: [{ ...ABRE, ...(selfie === undefined ? {} : { selfie }) }], visitas: [], envios: [] });
    const com = limpo(renderToString(<NovaVisita dados={dados(true)} hoje="2026-11-20" modo="unidade" onSalvou={() => {}} />));
    for (const t of ["Selfie na unidade", "Tirar a selfie", "só o dono e quem edita a qualidade a veem"]) expect(com).toContain(t);
    const tagDoBotao = (h: string) => /<button([^>]*)>(?:(?!<\/button>).)*Iniciar o checklist/.exec(h)?.[1] ?? "";
    expect(tagDoBotao(com)).toMatch(/\sdisabled=""/); // sem a selfie o botão fica desligado
    const sem = limpo(renderToString(<NovaVisita dados={dados()} hoje="2026-11-20" modo="unidade" onSalvou={() => {}} />));
    expect(sem).not.toContain("Selfie na unidade"); // a abertura da unidade não pede por padrão
    expect(tagDoBotao(sem)).not.toMatch(/\sdisabled=""/);
  });

  it("a visita da franqueadora também: sem campo de data (nem retroativa nem futura) e sem horário digitado", () => {
    const html = limpo(renderToString(<NovaVisita dados={{ ...DADOS, modelos: [{ ...MODELO, frequencia: "visita" }] }} hoje="2026-11-20" onSalvou={() => {}} />));
    expect(html).toContain("Nova visita");
    for (const t of ['aria-label="Data da visita"', "Chegada (opcional)", "Saída (opcional)", 'type="date"', 'type="time"']) expect(html).not.toContain(t);
  });

  it("o peso do item aparece só quando a tela manda mostrar (dono em visita); gestor e quem não é dono não veem", () => {
    const item = { id: "i", grupo: "Banheiros", texto: "Banheiros limpos", peso: 2, foto: "nenhuma" as const };
    const r = { conforme: null, na: false, comentario: "", fotos: [], equipamentos: [], vencimento: "" };
    expect(limpo(renderToString(<Item item={item} r={r} dataVisita="2026-11-20" mostraPeso onChange={() => {}} />))).toContain("peso 2");
    expect(limpo(renderToString(<Item item={item} r={r} dataVisita="2026-11-20" mostraPeso={false} onChange={() => {}} />))).not.toContain("peso");
  });

  it("o detalhe mostra check-in, check-out, duração, a distância da unidade (e o aviso de fora do local) e a selfie do check-in", () => {
    const v: Visita = {
      ...VISITA, chegada: "11:30", saida: "12:00", duracaoMin: 30,
      checkin: { em: "2026-11-20T14:30:00Z", loc: { lat: -15.78, lng: -47.9, precisao: 10 }, ip: "200.1.1.1", distanciaM: 35, foraDoLocal: false, selfie: "2026-11_11111111-1111-1111-1111-111111111111" },
      checkout: { em: "2026-11-20T15:00:00Z", loc: { lat: -15.9, lng: -47.95, precisao: 10 }, ip: "200.1.1.2", distanciaM: 13500, foraDoLocal: true },
    };
    const html = limpo(renderToString(<Detalhe v={v} />)).replace(/<[^>]+>/g, "");
    for (const t of ["Check-in 11:30", "a 35 m da unidade", "Check-out 12:00", "fora do local: a 13,5 km da unidade", "Duração: 30 min", "Selfie no check-in", "ver no mapa"]) expect(html).toContain(t);
    const sem = limpo(renderToString(<Detalhe v={{ ...VISITA, checkin: { em: "2026-11-20T14:30:00Z", loc: null, ip: "187.2.2.2" } }} />));
    expect(sem).toContain("sem localização (só horário e IP 187.2.2.2)");
  });

  it("dono: marca o local das unidades (quantas já estão marcadas)", () => {
    const html = limpo(renderToString(<LocaisDasUnidades unidades={["Asa Norte", "Gama"]} locais={{ Gama: { lat: -16.02, lng: -48.06, raio: 300 } }} onMudou={() => {}} />));
    for (const t of ["Local das unidades", "1 de 2 unidades com o local marcado", "Usar onde estou", "Gama"]) expect(html).toContain(t);
  });
});
