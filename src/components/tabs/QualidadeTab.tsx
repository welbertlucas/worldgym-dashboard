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
import { Modelos } from "@/components/qualidade/Modelos";
import { Rotina } from "@/components/qualidade/Rotina";
import { ChecklistDaUnidade } from "@/components/qualidade/ChecklistDaUnidade";

export type EstadoQualidade = { fase: "carregando" } | { fase: "erro"; motivo: "permissao" | "falha" } | { fase: "pronto"; dados: DadosQualidade };

const ABAS: Aba[] = [
  { id: "geral", rotulo: "Visão geral" },
  { id: "visita", rotulo: "Nova visita" },
  { id: "visitas", rotulo: "Visitas" },
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
  const ativa = abaAtiva(ABAS, aba);
  return (
    <div>
      <Abas tela="qualidade" titulo="Qualidade" abas={ABAS} ativa={ativa} onChange={setAba} />
      {ativa === "geral" && <VisaoGeral dados={d} hoje={hoje} onUnidade={(u) => { setUnidade(u); setAba("visitas"); }} />}
      {ativa === "visita" && <NovaVisita dados={d} hoje={hoje} onSalvou={(u) => { setUnidade(u); setAba("visitas"); recarregar(); }} />}
      {ativa === "visitas" && <Visitas key={unidade} dados={d} unidadeInicial={unidade} onMudou={recarregar} />}
      {ativa === "rotina" && <Rotina dados={d} hoje={hoje} onMudou={recarregar} />}
      {ativa === "checklists" && <Modelos modelos={d.modelos} onMudou={recarregar} />}
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
