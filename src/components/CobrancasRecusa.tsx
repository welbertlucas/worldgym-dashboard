import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { type UnitData } from "@/data/dashboardData";

const MAX_LINHAS = 8;
const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");

/** Motivos de recusa ainda em aberto, do maior para o menor número de cobranças. */
export function recusaOrdenada(m: Record<string, { n: number; abertas: number; valorAberto: number }>) {
  const lista = Object.entries(m).filter(([, x]) => x.abertas > 0).sort((a, b) => b[1].abertas - a[1].abertas);
  const topo = lista.slice(0, MAX_LINHAS);
  const resto = lista.slice(MAX_LINHAS);
  return resto.length
    ? [...topo, ["Demais motivos", { n: 0, abertas: resto.reduce((s, [, x]) => s + x.abertas, 0), valorAberto: resto.reduce((s, [, x]) => s + x.valorAberto, 0) }] as [string, { n: number; abertas: number; valorAberto: number }]]
    : topo;
}

/** Cobranças que falharam no vencimento: quanto foi recuperado, quanto segue em aberto e por que o cartão foi recusado. */
export function CobrancasRecusa({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • vencimentos de {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const c = total.cobrancas;
  if (!c || c.falhas === 0) return <ChartCard title="Cobranças com falha e motivos de recusa" subtitle={subtitle}><ChartEmpty>Sem cobranças com falha do EVO neste mês.</ChartEmpty></ChartCard>;
  const linhas = recusaOrdenada(total.recusaMotivos ?? {});
  const abertasComMotivo = linhas.reduce((s, [, x]) => s + x.abertas, 0);
  const maior = linhas[0]?.[1].abertas ?? 1;
  return (
    <ChartCard
      title="Cobranças com falha e motivos de recusa"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Falharam no vencimento" value={c.falhas.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Recuperadas" value={pct(c.recuperadas, c.falhas)} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
          <HeadlineStat label="Ainda em aberto" value={formatCurrency(c.valorAberto)} swatch={<span className="h-2 w-2 rounded-full bg-destructive" />} />
        </div>
      }
    >
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma cobrança em aberto tem motivo de recusa registrado.</p>
      ) : (
        <>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Cobranças em aberto por motivo da última recusa do cartão</p>
          <ol className="space-y-2" aria-label="Motivos de recusa das cobranças em aberto">
            {linhas.map(([nome, x]) => (
              <li key={nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="truncate text-sm text-foreground" title={nome}>{nome}</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{x.abertas.toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">· {pct(x.abertas, abertasComMotivo)} · {formatCurrency(x.valorAberto)}</span></span>
                <div className="col-span-2 h-2 rounded-full bg-secondary" aria-hidden>
                  <div className="h-full rounded-full bg-destructive/70" style={{ width: `${Math.max((x.abertas / maior) * 100, 1.5)}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Título que não foi pago no vencimento. "Recuperada" já foi paga depois; "em aberto" ainda não. Cobranças canceladas ficam de fora. Só cartão tem motivo de recusa.</p>
    </ChartCard>
  );
}
