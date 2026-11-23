import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMonthLong } from "@/data/periods";
/** O que o painel precisa de um alerta (vale para os do mês em andamento e para os do fechamento). */
export interface AlertaDoTopo { id: string; unit: string; severity: "critical" | "attention" | "info"; fact: string; month: string; weight: number; title?: string }

const MAX_NO_PAINEL = 5;

/** Os críticos primeiro e, dentro de cada grupo, os de unidades que pesam mais no faturamento da rede. */
export function maisCriticos<T extends AlertaDoTopo>(alertas: T[], limite = MAX_NO_PAINEL): T[] {
  const criticos = alertas.filter((a) => a.severity === "critical");
  return [...criticos].sort((a, b) => b.weight - a.weight).slice(0, limite);
}

/**
 * Ícone de alerta no canto do cabeçalho, com o número de alertas críticos. Ao clicar, abre um painel com os mais críticos
 * e o caminho para a tela completa de alertas.
 */
export function AlertasNoTopo({ alertas, onVerTodos, mes = null }: { alertas: AlertaDoTopo[]; onVerTodos: () => void; /** Mês em andamento, que os alertas avaliam. */ mes?: string | null }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const criticos = alertas.filter((a) => a.severity === "critical").length;
  const lista = maisCriticos(alertas);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);

  const deQuando = mes ? ` de ${formatMonthLong(mes)}` : "";
  const rotulo = criticos > 0 ? `Alertas${deQuando}: ${criticos} ${criticos === 1 ? "crítico" : "críticos"}` : `Alertas${deQuando}: nenhum crítico`;
  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={rotulo}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title={rotulo}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // Com críticos o botão chama a atenção (vermelho claro); sem nenhum, volta ao estilo neutro dos outros botões.
          criticos > 0
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:bg-secondary",
          aberto && "ring-2 ring-primary/30",
        )}
      >
        <TriangleAlert className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Alertas</span>
        {criticos > 0 && (
          <span className="min-w-[1.25rem] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-primary-foreground" aria-hidden>
            {criticos}
          </span>
        )}
      </button>
      {aberto && (
        <div
          role="dialog"
          aria-label="Alertas mais críticos"
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-white p-3 shadow-lg"
        >
          <p className="px-1 pb-2 text-sm font-semibold text-foreground">
            {criticos > 0 ? `${criticos} ${criticos === 1 ? "alerta crítico" : "alertas críticos"}` : "Nenhum alerta crítico"}{mes && ` em ${formatMonthLong(mes)}`}
          </p>
          {mes && <p className="px-1 pb-2 -mt-1 text-xs text-muted-foreground">Do mês em andamento: o que fazer agora. O que aconteceu no mês anterior fica em Alertas, aba Fechamento.</p>}
          {lista.length > 0 ? (
            <ul className="max-h-[22rem] space-y-1 overflow-y-auto">
              {lista.map((a) => (
                <li key={a.id} className="rounded-lg px-2 py-2 hover:bg-secondary/60">
                  <p className="text-sm font-medium text-foreground">{a.unit}<span className="font-normal text-muted-foreground"> · {a.title ?? formatMonthLong(a.month)}</span></p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.fact}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 pb-1 text-sm text-muted-foreground">Nada crítico neste mês.</p>
          )}
          <button
            type="button"
            onClick={() => { setAberto(false); onVerTodos(); }}
            className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-primary-ink hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver todos os alertas e o que fazer ({alertas.length})
          </button>
        </div>
      )}
    </div>
  );
}
