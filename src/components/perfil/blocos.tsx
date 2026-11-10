import { cn } from "@/lib/utils";
import { MiniRosca } from "@/components/MiniRosca";

export const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");
const fmt = (n: number) => n.toLocaleString("pt-BR");

export const ROTULOS_IDADE = ["Até 17", "18–24", "25–34", "35–44", "45–54", "55–64", "65+", "Sem data"] as const;
export const GENEROS = [
  { rotulo: "Feminino", cor: "#8b5cf6" },
  { rotulo: "Masculino", cor: "#0ea5e9" },
  { rotulo: "Não informado", cor: "hsl(var(--foreground) / 0.22)" },
] as const;

export type Item = { rotulo: string; n: number; conv?: number };

/** Gênero: rosca com o percentual de cada fatia ao lado (e, nas oportunidades, quantas convertem). */
export function GeneroBarra({ itens, tamanho }: { itens: Item[]; /** classes de tamanho da rosca (padrão do MiniRosca: h-28 w-28) */ tamanho?: string }) {
  const total = itens.reduce((s, i) => s + i.n, 0);
  return (
    <MiniRosca
      rotulo="Gênero"
      tamanho={tamanho}
      centro={{ valor: fmt(total), legenda: "pessoas" }}
      fatias={itens.map((i, k) => ({ rotulo: i.rotulo, n: i.n, cor: GENEROS[k].cor, detalhe: i.conv !== undefined ? <>{pct(i.conv, i.n)} convertem</> : undefined }))}
    />
  );
}

/** Faixa etária: colunas com o percentual no topo; a faixa dominante ganha o destaque e "Sem data" fica discreta. */
export function IdadeColunas({ itens }: { itens: Item[] }) {
  const total = itens.reduce((s, i) => s + i.n, 0);
  const maior = Math.max(1, ...itens.slice(0, -1).map((i) => i.n));
  const topo = itens.slice(0, -1).reduce((m, i, k) => (i.n > itens[m].n ? k : m), 0);
  return (
    <ol className="flex h-48 items-end gap-1.5 sm:gap-3" aria-label="Distribuição por faixa etária">
      {itens.map((i, k) => {
        const semData = k === itens.length - 1;
        return (
          <li key={i.rotulo} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
            <span className="text-xs font-semibold tabular-nums text-foreground">{pct(i.n, total)}</span>
            <div className="mt-1 flex flex-1 items-end">
              <div className={cn("w-full rounded-t-lg", semData ? "bg-foreground/15" : k === topo ? "bg-primary" : "bg-primary/45")} style={{ height: `${Math.max(2, (i.n / maior) * 100)}%`, maxHeight: "100%" }} title={`${i.rotulo}: ${fmt(i.n)}`} />
            </div>
            <span className="mt-2 truncate text-[11px] text-muted-foreground">{i.rotulo}</span>
            {i.conv !== undefined && <span className="text-[11px] font-semibold tabular-nums text-foreground">{pct(i.conv, i.n)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
