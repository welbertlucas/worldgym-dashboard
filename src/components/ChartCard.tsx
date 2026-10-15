/** Card padrão dos gráficos: título, subtítulo secundário e área do gráfico. */
export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-surface p-5 min-w-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
