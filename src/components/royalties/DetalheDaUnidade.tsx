import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { corDaModalidade } from "@/components/royalties/cores";
import { cn } from "@/lib/utils";
import { type ContextoRoyalties, MODALIDADE, type Situacao, brl } from "@/data/royalties";
import { detalheDaUnidade } from "@/data/royaltiesUnidades";

const COR_SITUACAO: Record<Situacao, string> = { pago: "bg-emerald-500", pago2x: "bg-emerald-700", naopago: "bg-red-500", na: "bg-border" };
const TEXTO_SITUACAO: Record<Situacao, string> = { pago: "Pago", pago2x: "Pago 2x, compensa atraso", naopago: "Não pago", na: "Ainda não devido" };

/** O painel de uma unidade, aberto ao clicar nela em qualquer painel: saldo, progresso, dados da cobrança, meses sem recebimento, mês a mês e observação. */
export function DetalheDaUnidade({ c, unidade, onFechar }: { c: ContextoRoyalties; unidade: string; onFechar: () => void }) {
  const d = detalheDaUnidade(c, unidade);
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    fechar.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [onFechar]);

  if (!d) return null;
  const cor = corDaModalidade(d.tipo);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fechar o detalhe da unidade" tabIndex={-1} onClick={onFechar} className="absolute inset-0 cursor-default bg-black/40" />
      <aside role="dialog" aria-modal="true" aria-labelledby="detalhe-royalties-titulo" className="relative flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-white p-5 shadow-xl sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="detalhe-royalties-titulo" className="text-xl font-semibold tracking-tight text-foreground">{d.unidade}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: cor }} aria-hidden />{MODALIDADE[d.tipo]}</p>
          </div>
          <button ref={fechar} type="button" onClick={onFechar} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-3.5 w-3.5" aria-hidden />Fechar
          </button>
        </header>

        <p className="text-sm text-muted-foreground">
          Saldo devedor total
          <strong className={cn("mt-1 block font-display text-[2rem] leading-none font-semibold tabular-nums", d.saldo > 0.005 ? "text-destructive" : "text-foreground")}>{d.saldoTexto}</strong>
        </p>

        {d.progresso && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${Math.round(d.progresso.percentual)}% do devido já recebido`}><div className="h-full rounded-full" style={{ width: `${d.progresso.percentual}%`, background: cor }} /></div>
            <p className="mt-2 text-xs text-muted-foreground">{d.progresso.texto}</p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {d.fatos.map(([rotulo, valor]) => (
            <div key={rotulo} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{rotulo}</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{valor}</dd>
            </div>
          ))}
        </dl>

        {!d.semCobranca && (
          <section>
            <h3 className="text-sm font-semibold text-foreground">Meses sem recebimento{d.mesesSemRecebimento.length > 0 ? ` (${d.naoPagos ?? d.mesesSemRecebimento.length})` : ""}</h3>
            {d.mesesSemRecebimento.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">{d.mesesSemRecebimento.map((m) => <li key={m} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-foreground">{m}</li>)}</ul>
            ) : <p className="mt-1 text-sm text-muted-foreground">Nenhum.</p>}
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold text-foreground">Recebido mês a mês{d.meses.some((m) => m.situacao) ? " e situação" : ""}</h3>
          <div className="mt-3 grid items-end gap-px" style={{ gridTemplateColumns: `repeat(${d.meses.length}, minmax(0, 1fr))` }} role="img" aria-label={`Recebido por mês de ${d.meses[0].label} a ${d.meses[d.meses.length - 1].label}`}>
            {d.meses.map((m) => (
              <div key={m.key} className="flex flex-col items-stretch gap-0.5" title={`${m.label}: recebido ${brl(m.recebido)}${m.situacao ? ` · ${TEXTO_SITUACAO[m.situacao]}` : ""}${c.parcial.has(m.key) ? " · mês parcial" : ""}`}>
                <span className="block rounded-sm" style={{ height: `${Math.max(1, (m.recebido / d.maiorRecebido) * 56)}px`, background: cor, opacity: c.parcial.has(m.key) ? 0.6 : 1 }} />
                {m.situacao && <span className={cn("block h-1.5 rounded-sm", COR_SITUACAO[m.situacao])} />}
              </div>
            ))}
          </div>
          <p className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{d.meses[0].label}</span><span>{d.meses[d.meses.length - 1].label}</span></p>
        </section>

        {d.obs && (
          <section>
            <h3 className="text-sm font-semibold text-foreground">Observação</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.obs}</p>
          </section>
        )}
      </aside>
    </div>
  );
}
