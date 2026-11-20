import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { type Grupo, brl0 } from "@/data/juridico";

/** Lista no estilo do "Desempenho por unidade": posição, nome, barra de quantidade e, à direita, processos e valor em causa. */
export function Ranking({ titulo, subtitulo, grupos, limite = 8 }: { titulo: string; subtitulo?: string; grupos: Grupo[]; limite?: number }) {
  const mostrados = grupos.slice(0, limite);
  const maior = Math.max(1, ...grupos.map((g) => g.qtd));
  return (
    <ChartCard title={titulo} subtitle={subtitulo}>
      {grupos.length === 0 ? (
        <ChartEmpty>Nenhum processo no filtro atual.</ChartEmpty>
      ) : (
        <ol className="space-y-1" aria-label={titulo}>
          {mostrados.map((g, i) => (
            <li key={g.nome} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:grid-cols-[1.75rem_minmax(0,14rem)_minmax(0,1fr)_9.5rem] items-center gap-x-3 gap-y-1 px-1 py-1">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${i < 3 ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
              <span className="truncate text-sm font-medium text-foreground" title={g.nome}>{g.nome}</span>
              <span className="sm:order-4 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-foreground">{g.qtd} <span className="text-xs font-normal text-muted-foreground">{g.valor > 0 ? brl0(g.valor) : "sem valor"}</span></span>
              <span className="relative col-span-3 h-5 rounded-md bg-secondary/70 sm:order-3 sm:col-span-1" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-md bg-foreground/75" style={{ width: `${Math.max((g.qtd / maior) * 100, 4)}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {grupos.length > limite && <p className="mt-2 text-xs text-muted-foreground">Mais {grupos.length - limite} fora desta lista.</p>}
    </ChartCard>
  );
}
