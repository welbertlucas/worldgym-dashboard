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

/** Barras horizontais (no lugar de texto): rótulo, barra proporcional ao maior valor e o número. `destaque` pinta de vermelho. */
export function Barras({ itens }: { itens: { rotulo: ReactNode; valor: number; texto: string; destaque?: boolean }[] }) {
  const mx = Math.max(1e-9, ...itens.map((i) => i.valor));
  return (
    <div className="space-y-1.5">
      {itens.map((i, k) => (
        <div key={k} className="grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-2 text-[13px]">
          <span className="truncate">{i.rotulo}</span>
          <span className="h-2.5 rounded-full bg-muted"><span className={`block h-full rounded-full ${i.destaque ? "bg-primary" : "bg-foreground/35"}`} style={{ width: `${Math.max(2, (i.valor / mx) * 100)}%` }} /></span>
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">{i.texto}</span>
        </div>
      ))}
    </div>
  );
}

/** Barra única dividida em partes (soma 1), com a legenda embaixo. */
export function Partes({ partes }: { partes: { rotulo: string; parte: number; cor: string }[] }) {
  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {partes.map((p) => <span key={p.rotulo} style={{ width: `${Math.max(0, p.parte) * 100}%`, background: p.cor }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {partes.map((p) => <span key={p.rotulo} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.cor }} />{p.rotulo} <b className="tabular-nums">{Math.round(p.parte * 100)}%</b></span>)}
      </div>
    </div>
  );
}

/** Régua: faixa de A a B, com marca no valor real (ex.: vendas contra a faixa do modelo). */
export function ReguaSimples({ min, max, valor, rotuloMin, rotuloMax, rotuloValor, bom }: { min: number; max: number; valor: number; rotuloMin: string; rotuloMax: string; rotuloValor: string; bom: boolean }) {
  const lo = Math.min(min, valor) * 0.92, hi = Math.max(max, valor) * 1.05, pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="mt-3" aria-hidden>
      <div className="relative h-4 text-[11px] font-semibold"><span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `clamp(40px, ${pos(valor)}, calc(100% - 40px))` }}>{rotuloValor}</span></div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-[10px] h-1 rounded bg-foreground/10" />
        <div className="absolute top-[7px] h-2.5 rounded bg-foreground/20" style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})` }} />
        <div className={`absolute top-[3px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[3px] border-white shadow ${bom ? "bg-success" : "bg-primary"}`} style={{ left: pos(valor) }} />
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground"><span>{rotuloMin}</span><span>{rotuloMax}</span></div>
    </div>
  );
}
