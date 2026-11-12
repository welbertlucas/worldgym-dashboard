import { UnitLink } from "@/components/UnitLink";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { dashboardData, getDataByMonth, getUnitData, type SaldoDevedor, type UnitData } from "@/data/dashboardData";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "—");

/** Faixas de atraso, na ordem gravada pelo servidor (server/saldo.js). */
export const FAIXAS = ["No prazo", "Até 30 dias", "31 a 90 dias", "91 dias a 1 ano", "Mais de 1 ano"];
/** Até 90 dias de atraso: a parte que a recepção ainda costuma conseguir cobrar. */
export const recente = (s: SaldoDevedor) => s.faixas.slice(0, 3).reduce((n, [v]) => n + v, 0);

const curto = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
};

/**
 * Saldo devedor em aberto (títulos "Balance due" do EVO): quanto, de quem (alunos ativos ou não), há quanto tempo
 * e como evoluiu no fim de cada mês. Na rede, as unidades pelo saldo de alunos ativos.
 */
export function SaldoDevedorCard({ total, month, monthLabel, partial, unit }: { total: UnitData; month: string; monthLabel: string; partial: boolean; unit: string | null }) {
  const titulo = "Saldo devedor em aberto";
  const subtitle = <>{unit ?? "Rede"} • {partial ? "hoje" : `fim de ${monthLabel}`}</>;
  const s = total.saldoDevedor;
  if (!s) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>O saldo devedor ainda não foi carregado para este mês.</ChartEmpty></ChartCard>;
  if (!s.valor) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Nenhum saldo devedor em aberto.</ChartEmpty></ChartCard>;

  const maiorFaixa = Math.max(...s.faixas.map(([v]) => v), 1);
  const serie = dashboardData.map((m) => m.month).filter((m) => m <= month).slice(-12)
    .map((m) => [m, (unit ? getUnitData(m, unit) : getDataByMonth(m)?.total)?.saldoDevedor?.valor] as const)
    .filter((x): x is readonly [string, number] => x[1] !== undefined);
  const maiorSerie = Math.max(...serie.map(([, v]) => v), 1);
  // Só compara fim de mês com fim de mês: a foto do mês em andamento (hoje) oscila com as cobranças recorrentes que falham e viram saldo.
  const anterior = serie.length >= 2 ? serie[serie.length - 2][1] : null;
  const unidades = unit ? [] : (getDataByMonth(month)?.units ?? []).filter((u) => u.saldoDevedor?.ativos?.[0]).sort((a, b) => b.saldoDevedor!.ativos![0] - a.saldoDevedor!.ativos![0]);
  const maiorUnid = Math.max(...unidades.map((u) => u.saldoDevedor!.ativos![0]), 1);

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label={`Em aberto · ${int(s.pessoas)} pessoas`} value={brl(s.valor)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          {s.ativos && <HeadlineStat label={`De alunos ativos · ${int(s.ativos[1])} pessoas`} value={brl(s.ativos[0])} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />}
          <HeadlineStat label="Vencido há até 90 dias (ou no prazo)" value={brl(recente(s))} swatch={<span className="h-2 w-2 rounded-full bg-foreground/50" />} />
          {!partial && anterior !== null && anterior > 0 && (
            <HeadlineStat label="Contra o mês anterior" value={`${s.valor >= anterior ? "+" : "−"}${brl(Math.abs(s.valor - anterior))}`} swatch={<span className={`h-2 w-2 rounded-full ${s.valor > anterior ? "bg-destructive" : "bg-foreground/30"}`} />} />
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Há quanto tempo venceu</h4>
          <ul className="space-y-2" aria-label="Saldo devedor por tempo de atraso">
            {FAIXAS.map((f, k) => {
              const [v, p] = s.faixas[k] ?? [0, 0];
              return (
                <li key={f} className="grid grid-cols-[7.5rem_minmax(0,1fr)_11.5rem] items-center gap-3 text-sm">
                  <span className="truncate text-foreground">{f}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <span className={`block h-full rounded-full ${k <= 2 ? "bg-primary" : "bg-foreground/40"}`} style={{ width: `${(v / maiorFaixa) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{brl(v)}</span> · {int(p)} pess.</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{pct(s.faixas[4]?.[0] ?? 0, s.valor)} do saldo venceu há mais de um ano.</p>
        </div>

        {unidades.length > 0 ? (
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Unidades: saldo de alunos ativos</h4>
            <ol className="space-y-2" aria-label="Unidades pelo saldo devedor de alunos ativos">
              {unidades.map((u) => {
                const [v, p] = u.saldoDevedor!.ativos!;
                return (
                  <li key={u.name} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_11.5rem] items-center gap-3 text-sm">
                    <span className="truncate"><UnitLink name={u.name} /></span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                      <span className="block h-full rounded-full bg-primary/80" style={{ width: `${(v / maiorUnid) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{brl(v)}</span> · {int(p)} pess.</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : serie.length >= 2 ? (
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Em aberto no fim de cada mês</h4>
            <div className="flex h-28 items-end gap-1" role="img" aria-label="Saldo devedor em aberto no fim de cada mês">
              {serie.map(([m, v]) => (
                <div key={m} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${curto(m)}: ${brl(v)}`}>
                  <div className={`w-full rounded-t-sm ${m === month ? "bg-primary" : "bg-foreground/45"}`} style={{ height: `${Math.max((v / maiorSerie) * 88, 2)}px` }} />
                  <span className="truncate text-[10px] text-muted-foreground">{m === month && partial ? "hoje" : curto(m)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Saldo devedor é a parte de uma venda que ficou para pagar depois (no EVO, forma de pagamento “Saldo devedor”); é por ele que a catraca barra com o motivo “Saldo devedor”.
        Conta o que segue em aberto {partial ? "hoje" : "no último dia do mês"}: quando a dívida é paga ou perdoada, o EVO cancela o título. “De alunos ativos” = de quem tinha contrato valendo naquele dia, o mais fácil de cobrar na recepção.
        Dívidas com mais de um ano raramente voltam.
      </p>
    </ChartCard>
  );
}
