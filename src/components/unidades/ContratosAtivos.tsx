import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { type UnitData } from "@/data/dashboardData";
import { type ContratosView, contratosView, pctTexto, somaContratos } from "@/data/contratosAtivos";
import { ContratosTiles, COR_LOCAL, COR_REDE } from "@/components/unidades/ContratosTiles";
import { UnitLink } from "@/components/UnitLink";
import { cn } from "@/lib/utils";

type Ordem = "especiais" | "personal" | "local" | "rede";
const ORDENS: { id: Ordem; label: string }[] = [
  { id: "especiais", label: "Especiais/VIP" },
  { id: "personal", label: "Personal" },
  { id: "local", label: "Local" },
  { id: "rede", label: "Rede" },
];
const n = (v: number) => v.toLocaleString("pt-BR");

/** Barra com a divisão dos contratos por alcance do plano (local e rede). */
function BarraAlcance({ v }: { v: ContratosView }) {
  const partes = [
    { label: "Local", f: v.local, cor: COR_LOCAL },
    { label: "Rede", f: v.rede, cor: COR_REDE },
  ];
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary" role="img" aria-label={partes.map((p) => `${p.label} ${pctTexto(p.f.pct)}`).join(", ")}>
        {partes.map((p) => <div key={p.label} style={{ width: `${p.f.pct}%`, background: p.cor }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
        {partes.map((p) => (
          <li key={p.label} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.cor }} aria-hidden />
            {p.label} <b className="font-semibold text-foreground">{n(p.f.n)}</b> ({pctTexto(p.f.pct)})
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Contratos ativos hoje: totais da rede e um cartão por unidade. Só aparece quando o EVO trouxe a foto do dia. */
export function ContratosAtivos({ units }: { units: UnitData[] }) {
  const [ordem, setOrdem] = useState<Ordem>("especiais");
  // Exporta só esta seção: durante a impressão, tudo fora dela vira display:none (visibility deixaria páginas em branco) e a página fica em retrato.
  useEffect(() => {
    const limpar = () => {
      document.querySelectorAll(".print-oculto").forEach((el) => el.classList.remove("print-oculto"));
      document.getElementById("contratos-page-style")?.remove();
    };
    window.addEventListener("afterprint", limpar);
    return () => { window.removeEventListener("afterprint", limpar); limpar(); };
  }, []);
  const exportar = () => {
    const alvo = document.getElementById("contratos-ativos");
    if (!alvo) return;
    for (let el: HTMLElement | null = alvo; el && el !== document.body; el = el.parentElement) {
      el.parentElement?.childNodes.forEach((irmao) => {
        if (irmao !== el && irmao instanceof HTMLElement) irmao.classList.add("print-oculto");
      });
    }
    const st = document.createElement("style");
    st.id = "contratos-page-style";
    st.textContent = "@page { size: A4 portrait; margin: 12mm; }";
    document.head.appendChild(st);
    window.print();
  };
  const rede = somaContratos(units);
  if (!rede) return null;

  const lista = units
    .map((u) => ({ u, v: contratosView(u) }))
    .filter((x): x is { u: UnitData; v: ContratosView } => x.v !== null)
    .sort((a, b) => b.v[ordem].n - a.v[ordem].n);

  return (
    <section id="contratos-ativos" aria-labelledby="contratos-titulo" className="space-y-4">
      <div className="relative">
        <button
          type="button"
          onClick={exportar}
          className="no-print absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden /> Exportar PDF
        </button>
        <h3 id="contratos-titulo" className="pr-32 text-base font-semibold text-foreground">Contratos ativos: especiais, personal e plano local ou rede</h3>
        <p className="hidden text-xs text-muted-foreground print:block">World Gym · emitido em {new Date().toLocaleDateString("pt-BR")}</p>
        <p className="text-sm text-muted-foreground">
          Foto de hoje, direto do EVO. Percentuais sobre o total de contratos ativos ({n(rede.total)}).
        </p>
      </div>

      <ContratosTiles v={rede} />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <h4 className="text-sm font-semibold text-foreground">Por unidade</h4>
        <div role="group" aria-label="Ordenar por" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          Ordenar por
          {ORDENS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={ordem === o.id}
              onClick={() => setOrdem(o.id)}
              className={cn("rounded-full border px-2.5 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", ordem === o.id ? "border-foreground bg-foreground text-background" : "border-border bg-white text-foreground hover:bg-secondary")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lista.map(({ u, v }) => (
          <li key={u.name} className="card-surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h5 className="truncate text-sm font-semibold text-foreground"><UnitLink name={u.name} /></h5>
              <span className="text-xs tabular-nums text-muted-foreground">{n(v.total)} contratos</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground tabular-nums">Especiais/VIP <b>{n(v.especiais.n)}</b> <span className="text-muted-foreground">({pctTexto(v.especiais.pct)})</span></span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground tabular-nums">Personal <b>{n(v.personal.n)}</b> <span className="text-muted-foreground">({pctTexto(v.personal.pct)})</span></span>
            </div>
            <div className="mt-3"><BarraAlcance v={v} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
