import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { UnitLink } from "@/components/UnitLink";
import { BotaoCopiar } from "@/components/tabs/ShareButtons";
import { ItemVigente, NOTA_SEM_NIVEL, periodoVigente } from "@/components/AlertasVigentes";
import { type AlertaVigente, type ResultadoVigente } from "@/data/alertasVigentes";
import { continuaFeito, gruposVigentes, planoVigenteTexto, resumoVigenteTexto, usoDoPlano } from "@/data/planoVigente";
import { MIN_ITENS_NA_DISPUTA, rankingDoPlano, type PosicaoPlano } from "@/data/rankingPlano";
import { ehDono } from "@/lib/auth";
import { carregarFeitos, chaveFeito, marcarFeito, type Feito } from "@/data/planoFeitos";
import { formatMonthLong } from "@/data/periods";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Plano de ação do mês em andamento: por unidade, o que resolver agora (pendências) e o que fazer para o mês fechar bem (ritmo),
 * com o texto pronto para mandar ao gestor ou à equipe. `unit`: a unidade do filtro do topo (com ela, só o plano dela).
 */
export function PlanoAcaoTab({ res, unit = null, atualizadoEm, unidades = [], onAbrirTela, onOpenAlertas }: {
  res: ResultadoVigente; unit?: string | null; atualizadoEm: string | null; /** Todas as unidades do mês (o ranking mostra as sem item como "plano limpo"). */ unidades?: string[]; onAbrirTela?: (tela: string) => void; onOpenAlertas?: () => void;
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

      {!unit && ehDono() && (unidades.length > 1 || grupos.length > 1) && <UsoDoPlanoCard grupos={grupos} feitos={feitos} unidades={unidades.length ? unidades : grupos.map((g) => g.unit)} atualizadoEm={atualizadoEm} />}

      <p className="text-xs text-muted-foreground">
        “Feito” vale para {formatMonthLong(month)}: se o alerta continuar na leitura seguinte do EVO, o item volta como pendente. {NOTA_SEM_NIVEL}
        {onOpenAlertas && <> <button type="button" onClick={onOpenAlertas} className="font-medium text-primary-ink underline underline-offset-4 hover:text-primary-ink/80">Ver os alertas</button></>}
      </p>
    </div>
  );
}

/** Só o dono vê: o ranking de quem mais resolveu o plano no mês (em teste por um mês) e quais unidades estão usando o plano. */
function UsoDoPlanoCard({ grupos, feitos, unidades, atualizadoEm }: { grupos: ReturnType<typeof gruposVigentes>; feitos: Record<string, Feito>; unidades: string[]; atualizadoEm: string | null }) {
  const [visao, setVisao] = useState<"ranking" | "uso">("ranking");
  const uso = usoDoPlano(grupos, feitos);
  const rank = rankingDoPlano(unidades, grupos, feitos, atualizadoEm);
  const semUso = uso.filter((u) => !u.ultima).length;
  const quando = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const botao = (id: "ranking" | "uso", rotulo: string) => (
    <button type="button" onClick={() => setVisao(id)} aria-pressed={visao === id}
      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", visao === id ? "border-primary bg-primary/10 text-primary-ink" : "border-border bg-card text-muted-foreground hover:bg-secondary")}>
      {rotulo}
    </button>
  );
  return (
    <details className="group card-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl p-4 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold text-foreground">Quem está usando o plano</h3>
        <span className="text-xs text-muted-foreground">Só você vê · {semUso === 0 ? "todas as unidades marcaram algum item" : `${semUso} de ${uso.length} ${uso.length === 1 ? "unidade" : "unidades"} sem nenhum item marcado no mês`}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="space-y-4 border-t border-border p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Visão do quadro">{botao("ranking", "Ranking do mês")}{botao("uso", "Uso por unidade")}</div>
        {visao === "ranking" ? <RankingDoPlano rank={rank} /> : (
          <>
            <ul className="space-y-2" aria-label="Uso do plano por unidade">
              <li aria-hidden className="grid grid-cols-[minmax(0,1fr)_3.5rem_5.5rem] gap-3 text-[11px] uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,12rem)]">
                <span>Unidade</span><span className="text-right">Marcados</span><span className="text-right">Última marcação</span>
              </li>
              {uso.map((u) => (
                <li key={u.unit} className="grid grid-cols-[minmax(0,1fr)_3.5rem_5.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,12rem)]">
                  <span className="truncate"><UnitLink name={u.unit} /></span>
                  <span className={cn("text-right tabular-nums", u.marcados === 0 ? "text-muted-foreground" : "font-semibold text-foreground")}>{u.marcados} de {u.itens}</span>
                  <span className={cn("truncate text-right text-xs", u.ultima ? "text-muted-foreground" : "font-medium text-destructive")}>
                    {u.ultima ? `${quando(u.ultima.em)} · ${u.ultima.por.split(" ")[0]}` : "nunca marcou"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Conta os itens do mês marcados como feitos, mesmo os que voltaram a pendente porque o alerta continuou no EVO: aqui a pergunta é se a unidade usa o plano.</p>
          </>
        )}
      </div>
    </details>
  );
}

function RankingDoPlano({ rank }: { rank: ReturnType<typeof rankingDoPlano> }) {
  // Na disputa, mas sem nenhum item resolvido ainda: ficam num bloco compacto, em vez de uma fila de empatadas em 0%.
  const resolveram = rank.disputa.filter((p) => p.resolvidos > 0), nenhum = rank.disputa.filter((p) => p.resolvidos === 0);
  const linha = (p: PosicaoPlano) => (
    <li key={p.unit} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
      <span className="text-right font-semibold tabular-nums text-muted-foreground">{p.posicao ? `${p.posicao}º` : ""}</span>
      <span className="min-w-0 truncate"><UnitLink name={p.unit} /></span>
      <span className="text-right tabular-nums">
        <span className="font-semibold text-foreground">{p.pct == null ? "—" : `${Math.round(p.pct)}%`}</span>
        <span className="ml-2 text-xs text-muted-foreground">{p.resolvidos} de {p.total}{p.aguardando > 0 && ` · ${p.aguardando} aguardando o EVO`}</span>
      </span>
    </li>
  );
  return (
    <div className="space-y-5">
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quem mais resolveu o plano no mês</h4>
        {rank.disputa.length === 0
          ? <p className="text-sm text-muted-foreground">Nenhuma unidade com {MIN_ITENS_NA_DISPUTA} itens ou mais no mês ainda.</p>
          : resolveram.length === 0
            ? <p className="text-sm text-muted-foreground">Nenhuma unidade resolveu um item ainda.</p>
            : <ol className="space-y-2">{resolveram.map(linha)}</ol>}
      </section>
      {nenhum.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ainda sem nenhum item resolvido ({nenhum.length})</h4>
          <ul className="flex flex-wrap gap-1.5">{nenhum.map((p) => <li key={p.unit} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground"><UnitLink name={p.unit} /> · {p.resolvidos} de {p.total}{p.aguardando > 0 && ` · ${p.aguardando} aguardando`}</li>)}</ul>
        </section>
      )}
      {rank.poucos.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Poucos itens no mês (fora da disputa)</h4>
          <ul className="space-y-2">{rank.poucos.map(linha)}</ul>
        </section>
      )}
      {rank.limpas.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-success">Plano limpo: nenhuma pendência no mês</h4>
          <ul className="flex flex-wrap gap-1.5">{rank.limpas.map((p) => <li key={p.unit} className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"><UnitLink name={p.unit} /></li>)}</ul>
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        Mede quanto do plano a unidade resolveu: itens marcados como feitos cujo alerta saiu da leitura do EVO, sobre o total de itens (resolvidos mais pendentes). Marcado como feito mas com o alerta ainda no EVO aguarda a leitura seguinte e, se o alerta continuar, volta a pendente.
        Item que sumiu sem ninguém marcar não conta a favor nem contra. Só entra na disputa quem teve {MIN_ITENS_NA_DISPUTA} itens ou mais; o ranking recomeça todo mês.
      </p>
    </div>
  );
}
