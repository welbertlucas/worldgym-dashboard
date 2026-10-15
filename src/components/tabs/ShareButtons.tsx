import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { type Recommendation } from "@/data/recommendations";
import { recommendationText, whatsappUrl } from "@/data/shareText";

const btn = "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Compartilhar no WhatsApp e copiar o texto de um risco/recomendação. */
export function ShareButtons({ rec, evalMonth, className }: { rec: Recommendation; evalMonth?: string | null; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);

  const label = `${rec.unit} — ${rec.fact}`;
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        <a
          href={whatsappUrl(recommendationText(rec, evalMonth))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 w-9 sm:w-auto items-center justify-center gap-1.5 rounded-full border border-[hsl(168_76%_26%/0.35)] bg-white text-[hsl(168_76%_24%)] hover:bg-[hsl(168_76%_26%/0.08)] sm:px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Compartilhar no WhatsApp: ${label}`}
          title="Compartilhar no WhatsApp"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline" aria-hidden>WhatsApp</span>
        </a>
        <button
          type="button"
          className={btn}
          aria-label={`Copiar texto: ${label}`}
          title="Copiar texto"
          onClick={async () => setState((await copyText(recommendationText(rec, evalMonth))) ? "copied" : "failed")}
        >
          {state === "copied" ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">{state === "copied" ? "Texto copiado" : state === "failed" ? "Não foi possível copiar" : ""}</span>
      {state !== "idle" && (
        <span aria-hidden className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-xs font-medium text-background shadow">
          {state === "copied" ? "Texto copiado" : "Não foi possível copiar"}
        </span>
      )}
    </div>
  );
}
