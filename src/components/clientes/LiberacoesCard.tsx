import { UnitLink } from "@/components/UnitLink";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { dashboardData, getDataByMonth, type UnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";
import { MOTIVOS_DE_RECEITA as MOTIVOS, alertasLiberacoes, liberacoesDeReceita } from "../../../server/alertasLiberacoes.js";

/** Os 4 grupos das liberações (server/entradas.js); 1 e 3 são as sem pagamento registrado. */
export const GRUPOS = ["Aluno com pendência de cadastro", "Aluno que não estava em dia", "Visitante com venda no dia", "Visitante sem venda no dia"];
const SEM_PAGAMENTO = new Set([1, 3]);

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dec = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

/** Motivos em que a liberação deixa entrar quem não está em dia com a academia (receita em jogo); a lista mora no módulo do alerta. */
export const MOTIVOS_DE_RECEITA = new Set(MOTIVOS);

/** Por que a unidade está no alerta de liberações (mesma regra da tela Alertas e do e-mail), em poucas palavras. */
const porque = (a: { nivel: boolean; alta: boolean; quantidade: number; media: number | null }) =>
  [a.nivel && "120 ou mais sem pagamento no mês", a.alta && a.media !== null && `${dec(a.quantidade / Math.max(a.media, 1))}× a média dos 3 meses anteriores`].filter(Boolean).join(" e ");

/**
 * Liberações manuais na catraca: a catraca barrou e a recepção liberou. O motivo é o do bloqueio que a mesma pessoa
 * levou até 30 min antes. Quem liberou não sai pela API do EVO. Num mês fechado, marca as unidades no alerta
 * "Liberações sem pagamento registrado" (server/alertasLiberacoes.js).
 */
export function LiberacoesCard({ total, month, monthLabel, partial, unit }: { total: UnitData; month: string; monthLabel: string; partial: boolean; unit: string | null }) {
  const subtitle = <>{unit ?? "Rede"} • {monthLabel}{partial && " (mês em andamento: até hoje)"}</>;
  const titulo = "Liberações manuais na catraca";
  if (total.liberacoes === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>As liberações manuais ainda não foram carregadas para este mês.</ChartEmpty></ChartCard>;
  if (total.liberacoes === 0) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Nenhuma liberação manual na catraca neste mês.</ChartEmpty></ChartCard>;

  const n = total.liberacoes;
  const motivos = total.liberacoesMotivos ?? [];
  const maior = Math.max(...motivos.map(([, q]) => q), 1);
  const lider = motivos.filter(([m]) => m !== "Sem bloqueio antes")[0];
  const deReceita = liberacoesDeReceita(total) ?? 0;
  const grupos = total.liberacoesGrupos;
  const maiorGrupo = Math.max(...(grupos ?? [1]), 1);
  // Alerta só vale para mês fechado (é o que a tela Alertas e o e-mail avaliam).
  const emAlerta = new Map(isPartialMonth(month) ? [] : alertasLiberacoes(dashboardData, month).map((a) => [a.quem, a] as const));
  const unidades = unit ? [] : (getDataByMonth(month)?.units ?? []).filter((u) => (u.liberacoes ?? 0) > 0).sort((a, b) => (b.liberacoes ?? 0) - (a.liberacoes ?? 0));
  const maiorUnid = Math.max(...unidades.map((u) => u.liberacoes ?? 0), 1);
  const alertaDaUnidade = unit ? emAlerta.get(unit) : undefined;

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Liberações no mês" value={int(n)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label={`Sem pagamento registrado · ${pct(deReceita, n)}`} value={int(deReceita)} swatch={<span className="h-2 w-2 rounded-full bg-destructive" />} />
          {lider && <HeadlineStat label="Bloqueio mais liberado" value={lider[0]} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />}
        </div>
      }
    >
      {alertaDaUnidade && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-foreground">
          <span className="font-semibold">Em alerta:</span> {int(alertaDaUnidade.quantidade)} liberações sem pagamento registrado ({porque(alertaDaUnidade)}).
        </p>
      )}
      {grupos && (
        <div className="mb-6">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quem foi liberado</h4>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-2 xl:grid-cols-2" aria-label="Liberações manuais por grupo">
            {GRUPOS.map((g, k) => (
              <li key={g} className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_6.5rem] items-center gap-3 text-sm">
                <span className="truncate text-foreground" title={g}>{g}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                  <span className={`block h-full rounded-full ${SEM_PAGAMENTO.has(k) ? "bg-destructive/75" : "bg-foreground/55"}`} style={{ width: `${(grupos[k] / maiorGrupo) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{int(grupos[k])}</span> · {pct(grupos[k], n)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={unidades.length ? "grid grid-cols-1 gap-8 xl:grid-cols-2" : ""}>
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Por que a catraca tinha barrado</h4>
          <ul className="space-y-2" aria-label="Liberações manuais por motivo do bloqueio">
            {motivos.map(([m, q]) => (
              <li key={m} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_6.5rem] items-center gap-3 text-sm">
                <span className="truncate text-foreground" title={m}>{m}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                  <span className={`block h-full rounded-full ${MOTIVOS_DE_RECEITA.has(m) ? "bg-destructive/75" : m === "Sem bloqueio antes" ? "bg-foreground/30" : "bg-foreground/65"}`} style={{ width: `${(q / maior) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{int(q)}</span> · {pct(q, n)}</span>
              </li>
            ))}
          </ul>
        </div>
        {unidades.length > 0 && (
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Unidades: liberações no mês</h4>
            <ol className="space-y-2" aria-label="Unidades pelo total de liberações manuais">
              {unidades.map((u) => {
                const tot = u.liberacoes ?? 0, rec = liberacoesDeReceita(u) ?? 0, a = emAlerta.get(u.name);
                return (
                  <li key={u.name} className="text-sm">
                    <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_9rem] items-center gap-3">
                      <span className="truncate"><UnitLink name={u.name} /></span>
                      <span className="flex h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                        <span className={`block h-full ${a ? "bg-destructive" : "bg-destructive/60"}`} style={{ width: `${(rec / maiorUnid) * 100}%` }} />
                        <span className="block h-full bg-foreground/40" style={{ width: `${((tot - rec) / maiorUnid) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{int(tot)}</span> · {int(rec)} sem pagamento</span>
                    </div>
                    {a && <p className="mt-0.5 text-xs font-medium text-destructive">Em alerta: {porque(a)}</p>}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Liberação manual: a recepção liberou a entrada no sistema. O motivo é o do bloqueio que a mesma pessoa levou na catraca da unidade até 30 minutos antes;
        “Sem bloqueio antes” é quando foi liberada sem a catraca ter barrado (por exemplo, sem tentar o reconhecimento facial).
        Sem pagamento registrado (em vermelho) = aluno que não estava em dia (saldo devedor, inativo ou plano que não dá acesso àquela catraca) mais visitante (sem cadastro de aluno) liberado sem nenhuma venda no mesmo dia, que pode ser aula experimental ou acesso sem pagar.
        Num mês fechado, entra no alerta “Liberações sem pagamento registrado” a unidade com 120 ou mais dessas liberações, ou com o dobro da média dos 3 meses anteriores (mínimo de 30).
        {!grupos && " Este mês ainda não separa os visitantes: conta só os alunos que não estavam em dia. "}
        Quem liberou não sai pela API do EVO; para ver o colaborador, use no EVO Gerencial → Controle de entradas → Entradas e saídas, com a ação “Entrada manual”.
      </p>
    </ChartCard>
  );
}
