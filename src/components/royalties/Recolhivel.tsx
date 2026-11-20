import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bloco recolhido por padrão: o conteúdo só é montado quando a pessoa abre (gráficos escondidos não pagam o custo de desenhar). */
export function Recolhivel({ titulo, apoio, children }: { titulo: string; apoio?: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 text-left hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{titulo}</span>
          {apoio && <span className="mt-0.5 block text-xs text-muted-foreground">{apoio}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && <div className="space-y-4">{children}</div>}
    </section>
  );
}
