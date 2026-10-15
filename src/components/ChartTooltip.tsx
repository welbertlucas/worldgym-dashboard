export interface TipRow { label: string; value: string; color: string }

/** Tooltip no padrão do gráfico principal da Visão Executiva: título, uma linha por série e nota opcional. */
export function TooltipCard({ title, rows, note }: { title: string; rows: TipRow[]; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground first-letter:uppercase">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="mt-1 flex items-center gap-1.5 text-foreground">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} aria-hidden />
          {r.label}
          <b className="ml-auto pl-4 tabular-nums">{r.value}</b>
        </p>
      ))}
      {note && <p className="mt-1.5 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
