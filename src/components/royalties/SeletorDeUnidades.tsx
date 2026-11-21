import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rótulo do botão: nenhuma marcada = todas; uma = o nome dela; mais de uma = a quantidade. */
export const rotuloDasUnidades = (marcadas: string[]) => (marcadas.length === 0 ? "Todas as unidades" : marcadas.length === 1 ? marcadas[0] : `${marcadas.length} unidades`);

/** Escolha de uma ou mais unidades (caixas de marcar). Nenhuma marcada significa todas. Fecha com Esc ou clicando fora. */
export function SeletorDeUnidades({ opcoes, marcadas, onChange, extra }: {
  opcoes: string[]; marcadas: string[]; onChange: (u: string[]) => void; /** Texto à direita do nome (ex.: quanto a unidade deve). */ extra?: (u: string) => string;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  const alterna = (u: string) => onChange(marcadas.includes(u) ? marcadas.filter((x) => x !== u) : [...marcadas, u]);
  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label="Unidades"
        onClick={() => setAberto((a) => !a)}
        className="mt-1 flex h-9 w-56 items-center justify-between gap-2 rounded-lg border border-input bg-white px-3 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{rotuloDasUnidades(marcadas)}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <div className="absolute left-0 z-20 mt-1 w-72 rounded-xl border border-border bg-white p-1 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs">
            <button type="button" className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => onChange([...opcoes])}>Marcar todas</button>
            <button type="button" className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => onChange([])}>Limpar (todas)</button>
          </div>
          <ul role="listbox" aria-multiselectable="true" aria-label="Unidades" className="max-h-72 overflow-auto">
            {opcoes.map((u) => {
              const on = marcadas.includes(u);
              return (
                <li key={u} role="option" aria-selected={on}>
                  <button type="button" onClick={() => alterna(u)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-foreground bg-foreground text-background" : "border-border")}>{on && <Check className="h-3 w-3" aria-hidden />}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{u}</span>
                    {extra && <span className="shrink-0 text-xs text-muted-foreground">{extra(u)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
