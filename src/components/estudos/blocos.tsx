// Blocos visuais dos estudos de ponto, no padrão do estudo de geomarketing da World Gym (Canva): título com ícone vermelho e letra
// condensada, número grande em vermelho com o rótulo embaixo, nota em caixa rosada e faixa vermelha com o veredito.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Icone = LucideIcon;

export function Secao({ icone: I, titulo, children, className = "" }: { icone: Icone; titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border bg-white p-5 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 font-display text-[22px] font-semibold leading-none tracking-tight text-foreground">
        <I className="h-5 w-5 flex-none text-primary" aria-hidden />{titulo}
      </h3>
      {children}
    </section>
  );
}

/** Número de destaque: grande, vermelho, com o rótulo em cinza embaixo. */
export function Destaque({ valor, rotulo, tom = "marca" }: { valor: string; rotulo: string; tom?: "marca" | "bom" | "ruim" | "atencao" }) {
  const cor = tom === "bom" ? "text-success" : tom === "ruim" ? "text-destructive" : tom === "atencao" ? "text-warning" : "text-primary";
  return (
    <div className="text-center">
      <div className={`font-display text-[44px] font-semibold leading-none tracking-tight tabular-nums ${cor}`}>{valor}</div>
      <div className="mt-1 text-sm text-muted-foreground">{rotulo}</div>
    </div>
  );
}

/** Nota explicativa em caixa rosada (o "porquê" do número). */
export function Nota({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2 text-[13px] leading-relaxed text-foreground/85">{children}</div>;
}

/** Faixa com o veredito (cor do veredito, texto branco). */
export function Faixa({ tom, children }: { tom: "bom" | "atencao" | "ruim"; children: ReactNode }) {
  const fundo = tom === "bom" ? "bg-success" : tom === "atencao" ? "bg-warning" : "bg-primary";
  return <div className={`rounded-md px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white ${fundo}`}>{children}</div>;
}

/** Linha "rótulo ........ valor". */
export function Linha({ rotulo, valor }: { rotulo: ReactNode; valor: ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 text-[13px] last:border-0"><span className="min-w-0 truncate">{rotulo}</span><span className="whitespace-nowrap tabular-nums text-muted-foreground">{valor}</span></div>;
}
