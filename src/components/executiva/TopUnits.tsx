import { type UnitData } from "@/data/dashboardData";
import { formatIndicator, INDICATOR_BY_KEY } from "@/data/unitIndicators";

/** Maiores faturamentos do mês exibido, em barras na mesma escala (a partir do zero). */
export function TopUnits({ units, monthLabel, partial, onOpen, limit = 6 }: { units: UnitData[]; monthLabel: string; partial: boolean; onOpen: () => void; limit?: number }) {
  const ind = INDICATOR_BY_KEY.faturamento;
  const rows = [...units].sort((a, b) => b.faturamento - a.faturamento).slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => r.faturamento));
  return (
    <section className="card-surface p-5 sm:p-6 flex flex-col min-w-0" aria-labelledby="top-titulo">
      <h3 id="top-titulo" className="text-base font-semibold text-foreground">Maiores faturamentos</h3>
      <p className="text-sm text-muted-foreground"><span className="first-letter:uppercase">{monthLabel}</span>{partial && " (em andamento)"}</p>
      <ol className="mt-5 space-y-4 flex-1" aria-label="Unidades por faturamento">
        {rows.map((u, i) => (
          <li key={u.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate"><span className="text-muted-foreground tabular-nums mr-2">{i + 1}</span><span className="font-medium text-foreground">{u.name}</span></span>
              <span className="font-semibold tabular-nums shrink-0">{formatIndicator(ind, u.faturamento)}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden" aria-hidden>
              <div className="h-full rounded-full bg-foreground/80" style={{ width: `${(u.faturamento / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onOpen}
        className="mt-5 self-start rounded-lg text-sm font-semibold text-primary hover:text-primary/80 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ver todas as unidades
      </button>
    </section>
  );
}
