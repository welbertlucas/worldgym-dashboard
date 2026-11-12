import { UnitLink } from "@/components/UnitLink";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { getDataByMonth, type UnitData } from "@/data/dashboardData";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dec = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n: number, d: number) => (d > 0 ? `${dec((n / d) * 100)}%` : "—");

/** Motivos em que a liberação deixa entrar quem não está em dia com a academia (receita em jogo). */
export const MOTIVOS_DE_RECEITA = new Set(["Saldo devedor", "Aluno inativo", "Catraca fora do plano"]);

/** Liberações a cada 100 entradas. */
export const porCemEntradas = (u: Pick<UnitData, "liberacoes" | "entradas">) => (u.entradas ? ((u.liberacoes ?? 0) / u.entradas) * 100 : 0);

/**
 * Liberações manuais na catraca: a catraca barrou e a recepção liberou. O motivo é o do bloqueio que a mesma pessoa
 * levou até 30 min antes. Quem liberou não sai pela API do EVO.
 */
export function LiberacoesCard({ total, month, monthLabel, partial, unit }: { total: UnitData; month: string; monthLabel: string; partial: boolean; unit: string | null }) {
  const subtitle = <>{unit ?? "Rede"} • {monthLabel}{partial && " (mês em andamento: até hoje)"}</>;
  const titulo = "Liberações manuais na catraca";
  if (total.liberacoes === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>As liberações manuais ainda não foram carregadas para este mês.</ChartEmpty></ChartCard>;
  if (total.liberacoes === 0) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Nenhuma liberação manual na catraca neste mês.</ChartEmpty></ChartCard>;

  const n = total.liberacoes;
  const motivos = total.liberacoesMotivos ?? [];
  const maior = Math.max(...motivos.map(([, q]) => q), 1);
  const comBloqueio = motivos.filter(([m]) => m !== "Sem bloqueio antes");
  const lider = comBloqueio[0];
  const deReceita = motivos.filter(([m]) => MOTIVOS_DE_RECEITA.has(m)).reduce((s, [, q]) => s + q, 0);
  const unidades = unit ? [] : (getDataByMonth(month)?.units ?? []).filter((u) => (u.liberacoes ?? 0) > 0).sort((a, b) => porCemEntradas(b) - porCemEntradas(a));
  const maiorTaxa = Math.max(...unidades.map(porCemEntradas), 0.01);

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Liberações no mês" value={int(n)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          {total.entradas ? <HeadlineStat label="A cada 100 entradas" value={dec(porCemEntradas(total))} swatch={<span className="h-2 w-2 rounded-full bg-foreground/50" />} /> : null}
          <HeadlineStat label="Saldo devedor, inativo ou catraca fora do plano" value={pct(deReceita, n)} swatch={<span className="h-2 w-2 rounded-full bg-destructive" />} />
          {lider && <HeadlineStat label="Bloqueio mais liberado" value={lider[0]} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />}
        </div>
      }
    >
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
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Unidades: liberações a cada 100 entradas</h4>
            <ol className="space-y-2" aria-label="Unidades por liberações a cada 100 entradas">
              {unidades.map((u) => (
                <li key={u.name} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_6.5rem] items-center gap-3 text-sm">
                  <span className="truncate"><UnitLink name={u.name} /></span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <span className="block h-full rounded-full bg-foreground/65" style={{ width: `${(porCemEntradas(u) / maiorTaxa) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{dec(porCemEntradas(u))}</span> · {int(u.liberacoes ?? 0)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Liberação manual: a recepção liberou a entrada no sistema. O motivo é o do bloqueio que a mesma pessoa levou na catraca da unidade até 30 minutos antes;
        “Sem bloqueio antes” é quando foi liberada sem a catraca ter barrado (por exemplo, sem tentar o reconhecimento facial).
        Em vermelho, os casos em que entrou quem não estava em dia (saldo devedor, aluno inativo ou plano que não dá acesso àquela catraca).
        Quem liberou não sai pela API do EVO; para ver o colaborador, use no EVO Gerencial → Controle de entradas → Entradas e saídas, com a ação “Entrada manual”.
      </p>
    </ChartCard>
  );
}
