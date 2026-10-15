import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
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
}

export function UnitsRanking({ units, monthLabel, partial, variationView }: Props) {
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
          <div role="group" aria-label="Indicador exibido" className="mt-4 space-y-2">
            {CATEGORIES.map((c) => (
              <div key={c} className="flex flex-wrap items-center gap-1.5">
                <span className="w-full sm:w-44 shrink-0 text-xs font-medium text-muted-foreground">{CATEGORY_LABEL[c]}</span>
                {INDICATORS.filter((i) => i.category === c).map((i) => (
                  <button
                    key={i.key}
                    type="button"
                    aria-pressed={key === i.key}
                    onClick={() => { setKey(i.key); setReversed(false); }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      key === i.key ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

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
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma unidade tem dado de {ind.label.toLowerCase()} neste mês.</p>
          ) : (
            <ol className="mt-3 space-y-1.5" aria-label={`Unidades por ${ind.label}`}>
              {rows.map((r) => {
                const tone = ind.tone?.(r.v);
                const left = r.v >= 0 ? zero : zero - (-r.v / span) * 100;
                const width = (Math.abs(r.v) / span) * 100;
                return (
                  <li key={r.name} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] sm:grid-cols-[1.5rem_12rem_minmax(0,1fr)_7.5rem] items-center gap-x-3 gap-y-1">
                    <span className="text-xs text-muted-foreground tabular-nums">{position.get(r.name)}</span>
                    <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                    <span className="sm:order-4 text-sm font-semibold tabular-nums text-right">{formatIndicator(ind, r.v)}</span>
                    <div className="col-span-3 sm:col-span-1 sm:order-3 relative h-2 rounded-full bg-secondary" aria-hidden>
                      <div className={cn("absolute inset-y-0 rounded-full", tone ? TONE_BAR[tone] : "bg-foreground/70")} style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%` }} />
                      {zero > 0 && <div className="absolute inset-y-[-3px] w-px bg-foreground/40" style={{ left: `${zero}%` }} />}
                    </div>
                  </li>
                );
              })}
            </ol>
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
