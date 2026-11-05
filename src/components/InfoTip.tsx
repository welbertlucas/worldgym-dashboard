import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

/** Botão "i" que abre uma explicação curta. Abre ao clicar, tocar ou focar; fecha com Esc, clique fora ou ao sair do foco. */
export function InfoTip({ label, children }: { label: string; children: string }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent | TouchEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("touchstart", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  return (
    <span ref={raiz} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Como é calculado: ${label}`}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="rounded-full p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {aberto && (
        <span id={id} role="note" className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-white p-3 text-left text-xs font-normal leading-relaxed text-foreground shadow-md">
          {children}
        </span>
      )}
    </span>
  );
}
