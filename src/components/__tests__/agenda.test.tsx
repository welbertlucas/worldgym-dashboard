import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Agenda } from "@/components/qualidade/Agenda";
import type { AgendaVisita, DadosQualidade, ModeloChecklist, Visita } from "@/data/qualidade";

const limpo = (h: string) => h.replace(/<!-- -->/g, "").replace(/ /g, " ");
const MODELO: ModeloChecklist = { id: "m1", nome: "Roteiro de visitação", descricao: "", frequencia: "visita", ativo: true, atualizadoEm: "", itens: [] };
const ag = (id: string, unidade: string, data: string, extra: Partial<AgendaVisita> = {}): AgendaVisita => ({ id, unidade, data, modeloId: "m1", modeloNome: "Roteiro de visitação", responsavel: "", observacao: "", criadoPor: { nome: "Ana", email: "a@x.com" }, atualizadoEm: "", ...extra });
const visita = (unidade: string, data: string) => ({ id: `v-${unidade}`, modeloId: "m1", modeloNome: "R", unidade, data, mes: data.slice(0, 7), avaliador: { nome: "A", email: "a@x.com" }, respostas: [], observacao: "", nota: 90, criadoEm: "" }) as Visita;
const dados = (agenda: AgendaVisita[], visitas: Visita[] = []): DadosQualidade => ({ modo: "completo", unidades: ["Asa Norte", "Gama", "Ceilândia", "Taguatinga"], modelos: [MODELO], visitas, envios: [], agenda });

describe("agenda de visitas (tela)", () => {
  const agenda = [ag("a", "Gama", "2026-11-10"), ag("b", "Asa Norte", "2026-11-20", { responsavel: "João", observacao: "levar o termo" }), ag("c", "Ceilândia", "2026-12-02"), ag("d", "Gama", "2026-11-05")];

  it("quem edita vê o formulário, as sugestões e as visitas por situação", () => {
    const h = limpo(renderToString(<Agenda dados={dados(agenda, [visita("Gama", "2026-11-06")])} hoje="2026-11-20" podeEditar onMudou={() => {}} />));
    for (const t of ["Agendar uma visita", "Agenda de visitas", "3 visitas à frente, 1 atrasada", "É hoje", "Atrasada", "Agendada", "João · levar o termo", "Visitas já feitas", "Feita", "Roteiro de visitação"]) expect(h).toContain(t);
    expect(h).toContain("Sem visita há mais de 60 dias");
    expect(h).toContain("Taguatinga · nunca visitada"); // as outras três têm visita recente ou agenda à frente
    expect(h).toContain("Tirar da agenda: Asa Norte, 20/11/2026");
    expect(h).not.toContain("Tirar da agenda: Gama, 06/11/2026");
  });

  it("quem só consulta (Master sem liberação) vê a agenda, mas sem formulário nem botão de tirar", () => {
    const h = limpo(renderToString(<Agenda dados={dados(agenda)} hoje="2026-11-20" podeEditar={false} onMudou={() => {}} />));
    expect(h).toContain("Agenda de visitas");
    expect(h).toContain("Asa Norte");
    for (const t of ["Agendar uma visita", "Tirar da agenda", "Sem visita há mais de"]) expect(h).not.toContain(t);
  });

  it("agenda vazia: orienta quem edita e avisa quem só consulta", () => {
    expect(limpo(renderToString(<Agenda dados={dados([])} hoje="2026-11-20" podeEditar onMudou={() => {}} />))).toContain("Use o formulário acima");
    expect(limpo(renderToString(<Agenda dados={dados([])} hoje="2026-11-20" podeEditar={false} onMudou={() => {}} />))).toContain("Nenhuma visita agendada por enquanto");
  });
});
