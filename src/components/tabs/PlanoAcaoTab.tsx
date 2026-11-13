import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { type Alert } from "@/data/alerts";
import { buildRecommendations, ALERT_LABELS } from "@/data/recommendations";
import { dashboardData } from "@/data/dashboardData";
import { formatMonthLong } from "@/data/periods";
import { type UnitDelta } from "@/data/unitMetrics";
import { destaquesDaUnidade, fraseDeDestaques, gruposDoPlano, passosDoItem, planoTexto, resumoDaRedeTexto } from "@/data/planoAcao";
import { SectionTitle } from "@/components/SectionTitle";
import { UnitLink } from "@/components/UnitLink";
import { BotaoCopiar } from "@/components/tabs/ShareButtons";
import { carregarFeitos, chaveFeito, marcarFeito, type Feito } from "@/data/planoFeitos";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SEV = { critical: ["Crítico", "bg-destructive/10 text-destructive"], attention: ["Atenção", "bg-warning/10 text-warning"], info: ["Informativo", "bg-secondary text-muted-foreground"] } as const;

/**
 * Plano de ação: por unidade, o que fazer a partir dos alertas críticos e de atenção do último mês fechado, com o texto
 * pronto para copiar e mandar ao gestor ou à equipe. O diagnóstico (evidências e hipóteses) fica na tela Alertas.
 * `unit`: a unidade do filtro do topo (com ela, só o plano dela).
 */
export function PlanoAcaoTab({ alerts: todos, evalMonth, deltas, unit = null, onOpenAlertas }: {
  alerts: Alert[]; evalMonth: string | null; deltas: UnitDelta[]; unit?: string | null; onOpenAlertas?: () => void;
}) {
  const alerts = unit ? todos.filter((a) => a.unit === unit) : todos;
  const grupos = gruposDoPlano(buildRecommendations(alerts, dashboardData));
  const informativos = alerts.filter((a) => a.severity === "info").length;
  const mes = evalMonth ? formatMonthLong(evalMonth) : null;
  // Itens marcados como feitos no mês avaliado (vistos por todos que acessam a unidade).
  const [feitos, setFeitos] = useState<Record<string, Feito>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  useEffect(() => { let vivo = true; if (evalMonth) carregarFeitos(evalMonth).then((f) => vivo && setFeitos(f)); return () => { vivo = false; }; }, [evalMonth]);
  const alternar = async (unidade: string, tipo: string) => {
    if (!evalMonth) return;
    const k = chaveFeito(unidade, tipo), feito = !feitos[k];
    setSalvando(k);
    const r = await marcarFeito(evalMonth, unidade, tipo, feito);
    setSalvando(null);
    if (!r.ok) { toast({ title: "Não consegui salvar", description: r.erro, variant: "destructive" }); return; }
    setFeitos((f) => { const n = { ...f }; if (r.item) n[k] = r.item; else delete n[k]; return n; });
  };
  const quando = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle hint={`${mes ? `Último mês fechado: ${mes}. ` : ""}O que fazer em cada unidade, a partir dos alertas críticos e de atenção. Copie o plano e mande para o gestor, a equipe ou os sócios. Para entender a causa (evidências e hipóteses), abra os Alertas.`}>Plano de ação</SectionTitle>
        {grupos.length > 1 && <BotaoCopiar rotulo="Copiar resumo da rede" texto={() => resumoDaRedeTexto(grupos, evalMonth)} />}
      </div>

      {grupos.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted-foreground">
          {evalMonth ? <>Nenhuma ação pendente{unit ? <> para <b className="text-foreground">{unit}</b></> : ""} em {mes}: nenhum alerta crítico ou de atenção.</> : "Ainda não há mês fechado para avaliar."}
        </p>
      ) : (
        <div className="space-y-3">
          {grupos.map((g, gi) => {
            const destaques = g.unit === "Rede" ? [] : destaquesDaUnidade(g.unit, deltas);
            const feitoDe = (kind: string) => feitos[chaveFeito(g.unit, kind)];
            const tiposFeitos = new Set<string>(g.itens.filter((r) => feitoDe(r.kind)).map((r) => r.kind));
            // Pendentes primeiro, feitos no fim (na ordem de prioridade dentro de cada parte).
            const itens = [...g.itens.filter((r) => !feitoDe(r.kind)), ...g.itens.filter((r) => feitoDe(r.kind))];
            return (
              <details key={g.unit} open={grupos.length === 1 || gi === 0} className="group card-surface">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl p-4 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <h3 className="text-sm font-semibold text-foreground">{g.unit === "Rede" ? "Rede" : <UnitLink name={g.unit} />}</h3>
                  <ul className="flex flex-wrap gap-1.5 text-xs font-medium">
                    {g.criticos > 0 && <li className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">{g.criticos} {g.criticos === 1 ? "crítico" : "críticos"}</li>}
                    {g.atencao > 0 && <li className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">{g.atencao} em atenção</li>}
                    {tiposFeitos.size > 0 && <li className="rounded-full bg-success/10 px-2.5 py-1 text-success">{tiposFeitos.size} de {g.itens.length} {tiposFeitos.size === 1 ? "feito" : "feitos"}</li>}
                  </ul>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="space-y-4 border-t border-border p-4 sm:p-5">
                  <div className="flex justify-end">
                    <BotaoCopiar rotulo={`Copiar plano ${g.unit === "Rede" ? "da rede" : `de ${g.unit}`}`} texto={() => planoTexto(g, destaques, evalMonth, tiposFeitos)} />
                  </div>
                  <ol className="space-y-4">
                    {itens.map((r, i) => {
                      const p = passosDoItem(r);
                      const [rot, cor] = SEV[r.severity];
                      const f = feitoDe(r.kind);
                      const k = chaveFeito(g.unit, r.kind);
                      return (
                        <li key={r.id} className={cn("grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2", f && "opacity-60")}>
                          <span className="pt-0.5 text-sm font-semibold tabular-nums text-muted-foreground">{f ? <Check className="h-4 w-4 text-success" aria-label="Feito" /> : `${i + 1}.`}</span>
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cor}`}>{rot}</span>
                              <span className={cn("text-sm font-semibold text-foreground", f && "line-through decoration-muted-foreground/60")}>{ALERT_LABELS[r.kind]}</span>
                              {evalMonth && (
                                <button
                                  type="button"
                                  disabled={salvando === k}
                                  onClick={() => void alternar(g.unit, r.kind)}
                                  className={cn("ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50", f ? "border-success/40 bg-success/10 text-success hover:bg-success/15" : "border-border bg-card text-foreground hover:bg-secondary")}
                                  title={f ? "Clique para voltar a pendente" : "Marcar este item como feito"}
                                >
                                  <Check className="h-3.5 w-3.5" aria-hidden />
                                  {f ? `Feito por ${f.por.split(" ")[0]} em ${quando(f.em)}` : "Marcar como feito"}
                                </button>
                              )}
                            </div>
                            {!f && <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                              <dt className="font-medium text-muted-foreground">Por quê</dt><dd className="text-foreground">{p.porque}</dd>
                              {p.conferir && <><dt className="font-medium text-muted-foreground">Conferir</dt><dd className="text-foreground">{p.conferir}</dd></>}
                              <dt className="font-medium text-muted-foreground">Fazer</dt><dd className="text-foreground">{p.fazer}</dd>
                              <dt className="font-medium text-muted-foreground">Acompanhar</dt><dd className="text-foreground">{p.acompanhar}</dd>
                            </dl>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {destaques.length > 0 && (
                    <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-foreground"><b className="text-success">O que melhorou:</b> {fraseDeDestaques(destaques)}</p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {informativos > 0 && <>Os {informativos} {informativos === 1 ? "item informativo fica" : "itens informativos ficam"} só nos Alertas. </>}
        O plano sai dos mesmos alertas: quando um alerta deixa de aparecer no mês seguinte, ele some daqui. "Feito" vale para o mês avaliado: se o alerta continuar no mês seguinte, o item volta como pendente.
        {onOpenAlertas && <> <button type="button" onClick={onOpenAlertas} className="font-medium text-primary-ink underline underline-offset-4 hover:text-primary-ink/80">Ver os alertas com evidências e hipóteses</button></>}
      </p>
    </div>
  );
}
