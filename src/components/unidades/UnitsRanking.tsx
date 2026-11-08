import { UnitLink } from "@/components/UnitLink";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDownUp, Check, ChevronDown } from "lucide-react";
import { type UnitData } from "@/data/dashboardData";
import { CATEGORY_LABEL, INDICATORS, formatIndicator, hasData, type Category, type Indicator } from "@/data/unitIndicators";
import { cn } from "@/lib/utils";

const TONE_BAR = { good: "bg-success", warn: "bg-warning", bad: "bg-destructive" } as const;
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

interface Props {
  units: UnitData[];
  monthLabel: string;
  /** Mês em andamento: os valores são parciais. */
  partial: boolean;
  /** Visão alternativa (variação vs. mês anterior); renderizada quando o usuário escolhe "Variação". */
  variationView?: React.ReactNode;
  /** Unidade em foco: a linha dela fica destacada e aparece a posição dela em cada indicador (clicar troca o indicador). */
  destaque?: string;
}

/** Indicadores do resumo de posição da unidade em foco. */
export const RESUMO_POSICAO = ["faturamento", "recebimento", "ticketMedio", "novosContratos", "renovacoes", "churn", "inadimplenciaPerc"] as const;

/** Posição de `nome` entre as unidades com dado (1 = melhor, conforme a direção do indicador). null sem regra ou sem dado. */
export function posicaoEntre(units: UnitData[], nome: string, ind: Indicator): { posicao: number; de: number } | null {
  if (!ind.direction) return null;
  const vals = units.map((u) => ({ name: u.name, v: ind.value(u) })).filter((r) => hasData(ind, r.v));
  const eu = vals.find((r) => r.name === nome);
  if (!eu) return null;
  return { posicao: vals.filter((r) => (ind.direction === "higher" ? r.v > eu.v : r.v < eu.v)).length + 1, de: vals.length };
}

/** Botão que abre a lista de indicadores, agrupada por categoria (no lugar de uma fileira de botões por indicador). */
function IndicadorMenu({ value, onChange, semDado }: { value: string; onChange: (key: string) => void; semDado: Set<string> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const topoAntes = useRef<number | null>(null);
  // Trocar de indicador pode encolher ou crescer a lista; mantém o botão no mesmo lugar da tela em vez de a página pular.
  useLayoutEffect(() => {
    if (topoAntes.current === null || !ref.current) return;
    const dif = ref.current.getBoundingClientRect().top - topoAntes.current;
    topoAntes.current = null;
    if (Math.abs(dif) > 1) window.scrollBy(0, dif);
  }, [value]);
  const atual = INDICATORS.find((i) => i.key === value) ?? INDICATORS[0];
  useEffect(() => {
    if (!open) return;
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative mt-4 inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-muted-foreground">Indicador</span>
        <span className="font-semibold text-foreground">{atual.label}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div role="listbox" aria-label="Indicador exibido" className="absolute left-0 z-20 mt-2 max-h-[70vh] w-[min(92vw,22rem)] overflow-auto rounded-xl border border-border bg-white p-2 shadow-lg">
          {CATEGORIES.map((c) => (
            <div key={c} className="py-1">
              <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{CATEGORY_LABEL[c]}</p>
              {INDICATORS.filter((i) => i.category === c).map((i) => (
                <button
                  key={i.key}
                  type="button"
                  role="option"
                  aria-selected={value === i.key}
                  onClick={() => { topoAntes.current = ref.current?.getBoundingClientRect().top ?? null; onChange(i.key); setOpen(false); }}
                  className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value === i.key && "bg-secondary font-medium")}
                >
                  <span>{i.label}{semDado.has(i.key) && <span className="ml-2 text-xs font-normal text-muted-foreground">sem dado neste mês</span>}</span>
                  {value === i.key && <Check className="h-4 w-4" aria-hidden />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function UnitsRanking({ units, monthLabel, partial, variationView, destaque }: Props) {
  const [key, setKey] = useState("faturamento");
  const [mode, setMode] = useState<"values" | "variation">("values");
  const [reversed, setReversed] = useState(false);
  const ind: Indicator = INDICATORS.find((i) => i.key === key) ?? INDICATORS[0];

  const withData = units.map((u) => ({ name: u.name, v: ind.value(u) })).filter((r) => hasData(ind, r.v));
  const noData = units.filter((u) => !hasData(ind, ind.value(u))).map((u) => u.name);
  // Melhor primeiro quando há regra (menor primeiro para "menor é melhor"); sem regra, do maior para o menor valor.
  const lowerFirst = ind.direction === "lower";
  const bestFirst = [...withData].sort((a, b) => (lowerFirst ? a.v - b.v : b.v - a.v));
  const position = new Map(bestFirst.map((r, i) => [r.name, i + 1])); // posição real, mesmo com a ordem invertida
  const rows = reversed ? [...bestFirst].reverse() : bestFirst;

  const min = Math.min(0, ...rows.map((r) => r.v));
  const max = Math.max(0, ...rows.map((r) => r.v));
  const span = max - min || 1;
  const zero = (-min / span) * 100; // posição do zero na escala (0 quando não há negativos)

  const semDado = new Set(INDICATORS.filter((i) => !units.some((u) => hasData(i, i.value(u)))).map((i) => i.key));
  const nomeIndicador = ind.label === ind.label.toUpperCase() ? ind.label : ind.label.toLowerCase(); // siglas (NPS) ficam em maiúsculas

  const orderText = !ind.direction
    ? "Sem regra de interpretação para este indicador: ordenado do maior para o menor valor, sem classificação."
    : lowerFirst ? "Menor é melhor: ordenado do menor para o maior valor." : "Maior é melhor: ordenado do maior para o menor valor.";

  return (
    <section className="card-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Desempenho por unidade</h3>
          <p className="text-sm text-muted-foreground">
            {mode === "values" ? <>Valores de <span className="first-letter:uppercase">{monthLabel}</span>{partial && " (mês em andamento, valores parciais)"}</> : "Variação do último mês fechado em relação ao anterior"}
          </p>
        </div>
        {variationView && (
          <div role="group" aria-label="Tipo de visualização" className="inline-flex rounded-full bg-secondary p-1 border border-border/70">
            {([["values", "Valores"], ["variation", "Variação"]] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn("rounded-full px-3.5 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  mode === m ? "bg-white text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === "variation" && variationView ? (
        <div className="mt-4">{variationView}</div>
      ) : (
        <>
          {destaque && (
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" aria-label={`Posição de ${destaque} na rede`}>
              {RESUMO_POSICAO.map((k) => {
                const i = INDICATORS.find((x) => x.key === k)!;
                const p = posicaoEntre(units, destaque, i);
                return (
                  <li key={k}>
                    <button type="button" aria-pressed={key === k} onClick={() => { setKey(k); setReversed(false); }} className={cn("w-full rounded-xl border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", key === k ? "border-foreground bg-secondary" : "border-border bg-white hover:bg-secondary")}>
                      <span className="block truncate text-xs text-muted-foreground">{i.label}</span>
                      <span className="font-display text-lg font-semibold tabular-nums text-foreground">{p ? `${p.posicao}º` : "—"}</span> <span className="text-xs text-muted-foreground">{p ? `de ${p.de}` : "sem dado"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <IndicadorMenu semDado={semDado} value={key} onChange={(k) => { setKey(k); setReversed(false); }} />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{orderText}</p>
            <button
              type="button"
              onClick={() => setReversed((r) => !r)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowDownUp className="w-3.5 h-3.5" aria-hidden /> Inverter ordem
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma unidade tem dado de {nomeIndicador} neste mês. Escolha outro indicador ou outro mês.</p>
          ) : (
            <>
            {!reversed && rows.length >= 3 && (
              <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={`Três primeiras unidades por ${ind.label}`}>
                {rows.slice(0, 3).map((r, i) => (
                  <li key={r.name} className="rounded-xl border border-border bg-white px-4 py-3">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">{i + 1}</span>
                      <span className="truncate font-medium text-foreground"><UnitLink name={r.name} /></span>
                    </p>
                    <p className="mt-2 font-display text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums text-foreground">{formatIndicator(ind, r.v)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{ind.label}</p>
                  </li>
                ))}
              </ol>
            )}
            <ol className="mt-4 space-y-1.5" aria-label={`Unidades por ${ind.label}`}>
              {rows.map((r) => {
                const tone = ind.tone?.(r.v);
                const left = r.v >= 0 ? zero : zero - (-r.v / span) * 100;
                const width = (Math.abs(r.v) / span) * 100;
                return (
                  <li key={r.name} aria-current={r.name === destaque ? "true" : undefined} className={cn("grid grid-cols-[1.5rem_minmax(0,1fr)_auto] sm:grid-cols-[1.5rem_12rem_minmax(0,1fr)_7.5rem] items-center gap-x-3 gap-y-1", r.name === destaque && "-mx-2 rounded-lg bg-primary/10 px-2 py-1 ring-1 ring-primary/40")}>
                    <span className="text-xs text-muted-foreground tabular-nums">{position.get(r.name)}</span>
                    <span className="text-sm font-medium text-foreground truncate"><UnitLink name={r.name} /></span>
                    <span className="sm:order-4 text-sm font-semibold tabular-nums text-right">{formatIndicator(ind, r.v)}</span>
                    <div className="col-span-3 sm:col-span-1 sm:order-3 relative h-2 rounded-full bg-secondary" aria-hidden>
                      <div className={cn("absolute inset-y-0 rounded-full", tone ? TONE_BAR[tone] : "bg-foreground/70")} style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%` }} />
                      {zero > 0 && <div className="absolute inset-y-[-3px] w-px bg-foreground/40" style={{ left: `${zero}%` }} />}
                    </div>
                  </li>
                );
              })}
            </ol>
            </>
          )}

          {noData.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Sem dado neste mês: {noData.join(", ")}.</p>
          )}
          {ind.tone && <p className="mt-2 text-xs text-muted-foreground">Cores seguem as faixas já usadas na tabela: {ind.toneHint}.</p>}
        </>
      )}
    </section>
  );
}
