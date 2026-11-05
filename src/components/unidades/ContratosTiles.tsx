import { type ContratosView, pctTexto } from "@/data/contratosAtivos";

export const COR_LOCAL = "hsl(222 25% 22%)";
export const COR_REDE = "hsl(4 90% 50%)";

const n = (v: number) => v.toLocaleString("pt-BR");

/** As quatro categorias lado a lado: quantidade e percentual dos contratos ativos. */
export function ContratosTiles({ v }: { v: ContratosView }) {
  const itens = [
    { label: "Especiais/VIP", f: v.especiais, cor: null as string | null },
    { label: "Personal", f: v.personal, cor: null },
    { label: "Plano local", f: v.local, cor: COR_LOCAL },
    { label: "Plano rede (10+)", f: v.rede, cor: COR_REDE },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4">
      {itens.map(({ label, f, cor }) => (
        <div key={label} className="rounded-xl border border-border bg-white px-4 py-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {cor && <span className="h-2 w-2 rounded-full" style={{ background: cor }} aria-hidden />}
            {label}
          </dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums text-foreground">{n(f.n)}</span>
            <span className="text-sm font-medium tabular-nums text-muted-foreground">{pctTexto(f.pct)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
