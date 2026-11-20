import { ChartCard } from "@/components/ChartCard";
import type { ContextoRoyalties } from "@/data/royalties";

/** Notas e premissas: o que a planilha e a diretoria definiram e que muda a leitura dos números. */
export function NotasRoyalties({ c }: { c: ContextoRoyalties }) {
  const notas = c.m.notasExtra ?? [];
  const premissas = c.m.premissas ?? [];
  const ajustes = c.m.situacaoAjustes ?? [];
  if (!notas.length && !premissas.length && !ajustes.length) return null;
  return (
    <ChartCard title="Notas e premissas" subtitle="O que a planilha e a diretoria definiram e muda a leitura dos números">
      <div className="space-y-4 text-sm text-foreground">
        {notas.length > 0 && <ul className="list-disc space-y-1.5 pl-5">{notas.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        {ajustes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ajustes manuais na matriz</h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
              {ajustes.map((a, i) => <li key={i}>{a.unidade}, {c.rotulo[a.mes] ?? a.mes}: a planilha diz “{a.planilha}” e o painel mostra “{a.exibido}”.</li>)}
            </ul>
          </div>
        )}
        {premissas.length > 0 && (
          <details className="rounded-xl border border-border px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Premissas da planilha ({premissas.length})</summary>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">{premissas.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </details>
        )}
      </div>
    </ChartCard>
  );
}
