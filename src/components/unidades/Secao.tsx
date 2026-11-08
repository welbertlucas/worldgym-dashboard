import type { ReactNode } from "react";

/** Bloco da página de Unidades: título, uma frase dizendo o que mostra (e com o que compara) e o conteúdo. */
export function Secao({ id, titulo, descricao, acoes, children }: { id: string; titulo: string; descricao?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h3 id={`${id}-titulo`} className="text-lg font-semibold text-foreground">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
        </div>
        {acoes && <div className="no-print flex flex-wrap items-end gap-3">{acoes}</div>}
      </div>
      {children}
    </section>
  );
}

/** Atalhos para as seções da página. */
export function AtalhosSecoes({ itens }: { itens: { id: string; rotulo: string }[] }) {
  return (
    <nav aria-label="Seções desta página" className="no-print flex flex-wrap gap-2">
      {itens.map((i) => (
        <a key={i.id} href={`#${i.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">
          {i.rotulo}
        </a>
      ))}
    </nav>
  );
}
