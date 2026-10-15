/**
 * Card padrão dos gráficos: título, subtítulo, legenda opcional (canto superior direito) e área do gráfico.
 * `headline` abre a composição analítica: valores de referência em destaque acima do gráfico.
 */
export function ChartCard({ title, subtitle, legend, headline, children }: {
  title: string; subtitle?: React.ReactNode; legend?: React.ReactNode; headline?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card-surface p-5 sm:p-6 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {legend}
      </div>
      {headline && <div className="mt-4">{headline}</div>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Valor de referência do cabeçalho: marcador da série + rótulo + número grande (Oswald, como nos KPIs). */
export function HeadlineStat({ label, value, swatch }: { label: string; value: string; swatch: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">{swatch}<span className="truncate">{label}</span></p>
      <p className="mt-1 font-display text-[2rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
    </div>
  );
}

/** Estado vazio do gráfico: orienta em vez de mostrar eixos sem dados. */
export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[240px] items-center justify-center rounded-xl bg-secondary/40 px-6 text-center text-sm text-muted-foreground">{children}</div>;
}
