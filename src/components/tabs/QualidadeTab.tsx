import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Abas, abaAtiva, type Aba } from "@/components/Abas";
import type { DadosQualidade } from "@/data/qualidade";
import { lerQualidade } from "@/lib/qualidade";
import { VisaoGeral } from "@/components/qualidade/VisaoGeral";
import { NovaVisita } from "@/components/qualidade/NovaVisita";
import { Visitas } from "@/components/qualidade/Visitas";
import { Agenda } from "@/components/qualidade/Agenda";
import { Modelos } from "@/components/qualidade/Modelos";
import { Rotina } from "@/components/qualidade/Rotina";
import { Pedidos } from "@/components/qualidade/Pedidos";
import { LocaisDasUnidades } from "@/components/qualidade/LocaisDasUnidades";
import { PlanosDaFranqueadora } from "@/components/qualidade/PlanosDeAcao";
import { agendaComSituacao, pedidosPendentes, podeValidarPlano } from "@/data/qualidade";
import { ehDono, getUsuario, podeEditarQualidade, podeVerQualidade } from "@/lib/auth";
import { ChecklistDaUnidade } from "@/components/qualidade/ChecklistDaUnidade";

export type EstadoQualidade = { fase: "carregando" } | { fase: "erro"; motivo: "permissao" | "falha" } | { fase: "pronto"; dados: DadosQualidade };

const ABAS: Aba[] = [
  { id: "geral", rotulo: "Visão geral" },
  { id: "visita", rotulo: "Nova visita" },
  { id: "agenda", rotulo: "Agenda" },
  { id: "visitas", rotulo: "Visitas" },
  { id: "planos", rotulo: "Planos de ação" },
  { id: "rotina", rotulo: "Rotina das unidades" },
  { id: "checklists", rotulo: "Checklists" },
];

export async function carregarQualidade(): Promise<EstadoQualidade> {
  const r = await lerQualidade();
  if (r.ok) return { fase: "pronto", dados: r.dados };
  return { fase: "erro", motivo: r.status === 403 ? "permissao" : "falha" };
}

const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

/** Visão de um estado (separada para os testes). */
export function QualidadeConteudo({ estado, hoje = hojeBR(), recarregar = () => {} }: { estado: EstadoQualidade; hoje?: string; recarregar?: () => void }) {
  const [aba, setAba] = useState("geral");
  const [unidade, setUnidade] = useState("");
  if (estado.fase === "carregando") return <ChartCard title="Qualidade"><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (estado.fase === "erro") return <ChartCard title="Qualidade"><ChartEmpty>{estado.motivo === "permissao" ? "Você não tem acesso a esta tela." : "Não consegui carregar a qualidade agora. Tente de novo em instantes."}</ChartEmpty></ChartCard>;
  const d = estado.dados;
  if (d.modo === "unidade") return <ChecklistDaUnidade dados={d} hoje={hoje} onMudou={recarregar} />;
  // A aba de pedidos de item novo é só do dono (é ele quem aprova); mostra quantos esperam resposta.
  const pendentes = pedidosPendentes(d.pedidos).length;
  // Aplicar o checklist (Nova visita, com check-in e selfie) é de todo o menu completo, Master inclusive; editar checklists, apagar e marcar local é de quem edita.
  const edita = podeEditarQualidade();
  const aplica = edita || podeVerQualidade();
  const aConfirmar = (d.planos ?? []).filter((p) => podeValidarPlano(p, getUsuario()?.email ?? "", ehDono())).length;
  // Agenda: mostra quantas visitas são para hoje ou estão atrasadas
  const naAgenda = agendaComSituacao(d.agenda, d.visitas, hoje).filter((l) => l.situacao === "atrasada" || l.situacao === "hoje").length;
  const base = (aplica ? ABAS : ABAS.filter((a) => a.id !== "visita")).map((a) => (a.id === "planos" && aConfirmar > 0 ? { ...a, rotulo: `Planos de ação (${aConfirmar})` } : a.id === "agenda" && naAgenda > 0 ? { ...a, rotulo: `Agenda (${naAgenda})` } : a));
  const abas: Aba[] = ehDono() ? [...base, { id: "pedidos", rotulo: pendentes > 0 ? `Pedidos (${pendentes})` : "Pedidos" }] : base;
  const ativa = abaAtiva(abas, aba);
  return (
    <div>
      <Abas tela="qualidade" titulo="Qualidade" abas={abas} ativa={ativa} onChange={setAba} />
      {ativa === "geral" && <VisaoGeral dados={d} hoje={hoje} onUnidade={(u) => { setUnidade(u); setAba("visitas"); }} onPedidos={ehDono() ? () => setAba("pedidos") : undefined} onPlanos={() => setAba("planos")} />}
      {ativa === "visita" && aplica && <NovaVisita dados={d} hoje={hoje} onSalvou={(u) => { setUnidade(u); setAba("visitas"); recarregar(); }} />}
      {ativa === "agenda" && <Agenda dados={d} hoje={hoje} podeEditar={edita} onMudou={recarregar} />}
      {ativa === "visitas" && <Visitas key={unidade} dados={d} unidadeInicial={unidade} podeApagar={edita} onMudou={recarregar} />}
      {ativa === "planos" && <PlanosDaFranqueadora dados={d} hoje={hoje} onMudou={recarregar} />}
      {ativa === "rotina" && <Rotina dados={d} hoje={hoje} podeApagar={edita} onMudou={recarregar} />}
      {ativa === "pedidos" && ehDono() && <Pedidos dados={d} onMudou={recarregar} />}
      {ativa === "checklists" && (
        <div className="space-y-4">
          <Modelos modelos={d.modelos} unidades={d.unidades} somenteLeitura={!edita} onMudou={recarregar} />
          {ehDono() && <LocaisDasUnidades unidades={d.unidades} locais={d.locais ?? {}} onMudou={recarregar} />}
        </div>
      )}
    </div>
  );
}

/** Menu Qualidade: só o dono e quem ele liberou (o servidor confere de novo). */
export function QualidadeTab() {
  const [estado, setEstado] = useState<EstadoQualidade>({ fase: "carregando" });
  const carregar = useCallback(() => { void carregarQualidade().then(setEstado); }, []);
  useEffect(() => { carregar(); }, [carregar]);
  return (
    <section className="space-y-4">
      <SectionTitle level="page"><span className="inline-flex items-center gap-2"><ClipboardCheck className="h-6 w-6" aria-hidden />Qualidade</span></SectionTitle>
      <QualidadeConteudo estado={estado} recarregar={carregar} />
    </section>
  );
}
