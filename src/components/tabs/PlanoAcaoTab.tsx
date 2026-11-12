import { ChevronDown } from "lucide-react";
import { type Alert } from "@/data/alerts";
import { buildRecommendations, ALERT_LABELS } from "@/data/recommendations";
import { dashboardData } from "@/data/dashboardData";
import { formatMonthLong } from "@/data/periods";
import { type UnitDelta } from "@/data/unitMetrics";
import { destaquesDaUnidade, fraseDeDestaques, gruposDoPlano, passosDoItem, planoTexto, resumoDaRedeTexto } from "@/data/planoAcao";
import { SectionTitle } from "@/components/SectionTitle";
import { UnitLink } from "@/components/UnitLink";
import { BotaoCopiar } from "@/components/tabs/ShareButtons";

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
            return (
              <details key={g.unit} open={grupos.length === 1 || gi === 0} className="group card-surface">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl p-4 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <h3 className="text-sm font-semibold text-foreground">{g.unit === "Rede" ? "Rede" : <UnitLink name={g.unit} />}</h3>
                  <ul className="flex flex-wrap gap-1.5 text-xs font-medium">
                    {g.criticos > 0 && <li className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">{g.criticos} {g.criticos === 1 ? "crítico" : "críticos"}</li>}
                    {g.atencao > 0 && <li className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">{g.atencao} em atenção</li>}
                  </ul>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="space-y-4 border-t border-border p-4 sm:p-5">
                  <div className="flex justify-end">
                    <BotaoCopiar rotulo={`Copiar plano ${g.unit === "Rede" ? "da rede" : `de ${g.unit}`}`} texto={() => planoTexto(g, destaques, evalMonth)} />
                  </div>
                  <ol className="space-y-4">
                    {g.itens.map((r, i) => {
                      const p = passosDoItem(r);
                      const [rot, cor] = SEV[r.severity];
                      return (
                        <li key={r.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2">
                          <span className="pt-0.5 text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}.</span>
                          <div className="space-y-1.5">
                            <p className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cor}`}>{rot}</span>
                              <span className="text-sm font-semibold text-foreground">{ALERT_LABELS[r.kind]}</span>
                            </p>
                            <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                              <dt className="font-medium text-muted-foreground">Por quê</dt><dd className="text-foreground">{p.porque}</dd>
                              {p.conferir && <><dt className="font-medium text-muted-foreground">Conferir</dt><dd className="text-foreground">{p.conferir}</dd></>}
                              <dt className="font-medium text-muted-foreground">Fazer</dt><dd className="text-foreground">{p.fazer}</dd>
                              <dt className="font-medium text-muted-foreground">Acompanhar</dt><dd className="text-foreground">{p.acompanhar}</dd>
                            </dl>
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
        O plano sai dos mesmos alertas: quando um alerta deixa de aparecer no mês seguinte, ele some daqui.
        {onOpenAlertas && <> <button type="button" onClick={onOpenAlertas} className="font-medium text-primary-ink underline underline-offset-4 hover:text-primary-ink/80">Ver os alertas com evidências e hipóteses</button></>}
      </p>
    </div>
  );
}
