import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { UnitLink } from "@/components/UnitLink";
import { BotaoCopiar } from "@/components/tabs/ShareButtons";
import { ItemVigente, NOTA_SEM_NIVEL, periodoVigente } from "@/components/AlertasVigentes";
import { type AlertaVigente, type ResultadoVigente } from "@/data/alertasVigentes";
import { continuaFeito, gruposVigentes, planoVigenteTexto, resumoVigenteTexto } from "@/data/planoVigente";
import { carregarFeitos, chaveFeito, marcarFeito, type Feito } from "@/data/planoFeitos";
import { formatMonthLong } from "@/data/periods";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Plano de ação do mês em andamento: por unidade, o que resolver agora (pendências) e o que fazer para o mês fechar bem (ritmo),
 * com o texto pronto para mandar ao gestor ou à equipe. `unit`: a unidade do filtro do topo (com ela, só o plano dela).
 */
export function PlanoAcaoTab({ res, unit = null, atualizadoEm, onAbrirTela, onOpenAlertas }: {
  res: ResultadoVigente; unit?: string | null; atualizadoEm: string | null; onAbrirTela?: (tela: string) => void; onOpenAlertas?: () => void;
}) {
  const month = res.month;
  const alertas = unit ? res.alertas.filter((a) => a.unit === unit) : res.alertas;
  const grupos = gruposVigentes(alertas);
  const [feitos, setFeitos] = useState<Record<string, Feito>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  useEffect(() => { let vivo = true; if (month) carregarFeitos(month).then((f) => vivo && setFeitos(f)); return () => { vivo = false; }; }, [month]);
  /** Feito que ainda vale (marcado depois da última leitura do EVO). */
  const feitoDe = (u: string, kind: string) => { const f = feitos[chaveFeito(u, kind)]; return f && continuaFeito(f.em, atualizadoEm) ? f : undefined; };
  /** Marcado antes da última leitura e o alerta continua: volta a pendente, com o aviso. */
  const voltou = (u: string, kind: string) => { const f = feitos[chaveFeito(u, kind)]; return f && !continuaFeito(f.em, atualizadoEm) ? f : undefined; };
  const alternar = async (unidade: string, kind: string) => {
    if (!month) return;
    const k = chaveFeito(unidade, kind), feito = !feitoDe(unidade, kind);
    setSalvando(k);
    const r = await marcarFeito(month, unidade, kind, feito);
    setSalvando(null);
    if (!r.ok) { toast({ title: "Não consegui salvar", description: r.erro, variant: "destructive" }); return; }
    setFeitos((f) => { const n = { ...f }; if (r.item) n[k] = r.item; else delete n[k]; return n; });
  };
  const quando = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  if (!month) return (
    <div className="space-y-4">
      <SectionTitle>Plano de ação</SectionTitle>
      <p className="card-surface p-6 text-sm text-muted-foreground">O mês atual ainda não foi lido do EVO. O plano aparece depois da primeira leitura (de madrugada).</p>
    </div>
  );

  const item = (g: string, a: AlertaVigente, i: number) => {
    const f = feitoDe(g, a.kind), v = voltou(g, a.kind), k = chaveFeito(g, a.kind);
    return (
      <li key={a.id} className={cn("grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2", f && "opacity-60")}>
        <span className="pt-0.5 text-sm font-semibold tabular-nums text-muted-foreground">{f ? <Check className="h-4 w-4 text-success" aria-label="Feito" /> : `${i + 1}.`}</span>
        <div className="space-y-2">
          {f ? <p className="text-sm font-semibold text-foreground line-through decoration-muted-foreground/60">{a.title}</p> : <ItemVigente a={a} comUnidade={false} onAbrirTela={onAbrirTela} />}
          {v && !f && <p className="text-xs text-warning">Marcado como feito por {v.por.split(" ")[0]} em {quando(v.em)}, mas continua na leitura mais nova do EVO.</p>}
          <button
            type="button"
            disabled={salvando === k}
            onClick={() => void alternar(g, a.kind)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50", f ? "border-success/40 bg-success/10 text-success hover:bg-success/15" : "border-border bg-card text-foreground hover:bg-secondary")}
            title={f ? "Clique para voltar a pendente" : "Marcar este item como feito"}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            {f ? `Feito por ${f.por.split(" ")[0]} em ${quando(f.em)}` : "Marcar como feito"}
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle hint="O que fazer em cada unidade neste mês: o que resolver agora e o que fazer para o mês fechar bem. Copie o plano e mande para o gestor, a equipe ou os sócios.">
          {`Plano de ação de ${formatMonthLong(month)}`}
        </SectionTitle>
        {grupos.length > 1 && <BotaoCopiar rotulo="Copiar resumo da rede" texto={() => resumoVigenteTexto(grupos, month, res.dias)} />}
      </div>
      <p className="text-sm text-muted-foreground">Com os dados do EVO de {periodoVigente(res)}. O EVO é lido de madrugada: o que for feito hoje aparece amanhã.</p>

      {grupos.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted-foreground">Nenhuma ação pendente{unit ? <> para <b className="text-foreground">{unit}</b></> : ""} em {formatMonthLong(month)} até agora.</p>
      ) : (
        <div className="space-y-3">
          {grupos.map((g, gi) => {
            const feitosAqui = new Set(g.itens.filter((a) => feitoDe(g.unit, a.kind)).map((a) => a.kind));
            const ordenar = (xs: AlertaVigente[]) => [...xs.filter((a) => !feitosAqui.has(a.kind)), ...xs.filter((a) => feitosAqui.has(a.kind))];
            const pend = ordenar(g.itens.filter((a) => a.tipo === "pendencia")), ritmo = ordenar(g.itens.filter((a) => a.tipo === "ritmo"));
            return (
              <details key={g.unit} open={grupos.length === 1 || gi === 0} className="group card-surface">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl p-4 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <h3 className="text-sm font-semibold text-foreground">{g.unit === "Rede" ? "Rede" : <UnitLink name={g.unit} />}</h3>
                  <ul className="flex flex-wrap gap-1.5 text-xs font-medium">
                    {g.criticos > 0 && <li className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">{g.criticos} {g.criticos === 1 ? "crítico" : "críticos"}</li>}
                    {g.atencao > 0 && <li className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">{g.atencao} em atenção</li>}
                    <li className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">{g.itens.length} {g.itens.length === 1 ? "item" : "itens"}</li>
                    {feitosAqui.size > 0 && <li className="rounded-full bg-success/10 px-2.5 py-1 text-success">{feitosAqui.size} {feitosAqui.size === 1 ? "feito" : "feitos"}</li>}
                  </ul>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="space-y-5 border-t border-border p-4 sm:p-5">
                  <div className="flex justify-end">
                    <BotaoCopiar rotulo={`Copiar plano ${g.unit === "Rede" ? "da rede" : `de ${g.unit}`}`} texto={() => planoVigenteTexto(g, month, res.dias, feitosAqui)} />
                  </div>
                  {pend.length > 0 && (
                    <section>
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resolver agora</h4>
                      <ol className="space-y-5">{pend.map((a, i) => item(g.unit, a, i))}</ol>
                    </section>
                  )}
                  {ritmo.length > 0 && (
                    <section>
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acelerar o mês</h4>
                      <ol className="space-y-5">{ritmo.map((a, i) => item(g.unit, a, i))}</ol>
                    </section>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        “Feito” vale para {formatMonthLong(month)}: se o alerta continuar na leitura seguinte do EVO, o item volta como pendente. {NOTA_SEM_NIVEL}
        {onOpenAlertas && <> <button type="button" onClick={onOpenAlertas} className="font-medium text-primary-ink underline underline-offset-4 hover:text-primary-ink/80">Ver os alertas</button></>}
      </p>
    </div>
  );
}
