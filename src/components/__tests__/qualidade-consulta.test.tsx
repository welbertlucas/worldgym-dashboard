import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

// Master sem liberação: vê a Qualidade só para consulta e não é o dono (nem os pesos, nem os pedidos).
vi.mock("@/lib/auth", async (original) => ({ ...(await original<typeof import("@/lib/auth")>()), ehDono: () => false, podeEditarQualidade: () => false }));

import { QualidadeConteudo } from "@/components/tabs/QualidadeTab";
import { Modelos } from "@/components/qualidade/Modelos";
import { PlanosDaFranqueadora } from "@/components/qualidade/PlanosDeAcao";
import type { DadosQualidade, PedidoItem, PlanoAcao, Visita } from "@/data/qualidade";

const limpo = (h: string) => h.replace(/<!-- -->/g, "").replace(/ /g, " ");
const MODELO = { id: "m1", nome: "Roteiro de visitação", descricao: "", frequencia: "visita" as const, ativo: true, atualizadoEm: "", itens: [{ id: "i1", grupo: "Banheiros", texto: "Banheiro limpo", peso: 2, foto: "nenhuma" as const }] };
const VISITA: Visita = { id: "v1", modeloId: "m1", modeloNome: "Roteiro de visitação", unidade: "Asa Norte", data: "2026-11-18", mes: "2026-11", avaliador: { nome: "Ana", email: "a@x.com" }, respostas: [], observacao: "", nota: 80, criadoEm: "2026-11-18T12:00:00Z" };
const PEDIDO: PedidoItem = { id: "p1", unidade: "Asa Norte", modeloId: "m1", modeloNome: "Roteiro de visitação", texto: "Piscina", motivo: "", solicitante: { nome: "G", email: "g@x.com" }, status: "pendente", criadoEm: "2026-11-19T12:00:00Z" };
const DADOS: DadosQualidade = { modo: "completo", unidades: ["Asa Norte", "Gama"], modelos: [MODELO], visitas: [VISITA], envios: [], pedidos: [PEDIDO] };

describe("Qualidade para quem só consulta (Master sem liberação)", () => {
  it("vê a visão geral, as visitas, a rotina e os checklists, mas não tem Nova visita nem Pedidos", () => {
    const html = limpo(renderToString(<QualidadeConteudo hoje="2026-11-20" estado={{ fase: "pronto", dados: DADOS }} />));
    for (const t of ["Visão geral", "Visitas", "Rotina das unidades", "Checklists", "Nota média da rede"]) expect(html).toContain(t);
    for (const t of ["Nova visita", "Pedidos", "pedido de item novo"]) expect(html).not.toContain(t);
  });

  it("os checklists aparecem só para ler: sem criar, editar nem apagar, e sem o roteiro sugerido", () => {
    const html = limpo(renderToString(<Modelos modelos={[MODELO]} unidades={["Asa Norte"]} somenteLeitura onMudou={() => {}} />));
    expect(html).toContain("Roteiro de visitação");
    for (const t of ["Novo checklist", "Editar", "Usar o roteiro sugerido", "Usar o checklist de abertura sugerido", "Apagar"]) expect(html).not.toContain(t);
    expect(limpo(renderToString(<Modelos modelos={[]} unidades={[]} somenteLeitura onMudou={() => {}} />))).toContain("Nenhum checklist criado ainda");
  });

  it("quem não criou o plano nem é o dono vê o plano aguardando confirmação, mas sem os botões de confirmar", () => {
    const plano: PlanoAcao = { id: "p", unidade: "Asa Norte", visitaId: "v", visitaMes: "2026-11", itemId: "i", itemTexto: "Recepção", modeloNome: "Roteiro", oQue: "Arrumar o balcão", prazo: "2026-12-01", responsavel: "", como: "", criadoPor: { nome: "Vera Visitante", email: "vera@x.com" }, criadoEm: "2026-11-10T12:00:00Z", status: "validacao", historico: [] };
    const html = limpo(renderToString(<PlanosDaFranqueadora dados={{ ...DADOS, planos: [plano] }} hoje="2026-11-20" onMudou={() => {}} />)).replace(/<[^>]+>/g, "");
    expect(html).toContain("Para eu confirmar (0)");
    expect(html).not.toContain("Confirmar a correção");
  });
});
