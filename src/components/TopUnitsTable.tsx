import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from "lucide-react";
import { getDataByMonth, getLatestData, UnitData } from "@/data/dashboardData";
import { INDICATOR_BY_KEY, type Tone } from "@/data/unitIndicators";
import { formatAbbreviatedNumber, cn } from "@/lib/utils";

interface TopUnitsTableProps {
  selectedMonth: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const toneClass: Record<Tone, string> = { good: "text-success", warn: "text-warning", bad: "text-destructive" };

type ColumnKey = keyof UnitData | "name";
type Group = "main" | "extra";
type Column = {
  key: ColumnKey;
  label: string;
  group: Group;
  renderValue?: (v: number) => { text: string; className?: string };
};

const num = (v: number) => ({ text: v.toLocaleString("pt-BR"), className: "tabular-nums" });
const money = (v: number) => ({ text: formatAbbreviatedNumber(v ?? 0), className: "tabular-nums" });
// Faixas de cor: as mesmas de antes, agora lidas da configuração única dos indicadores.
const toned = (key: string, fmtFn: (n: number) => string) => (v: number) => ({ text: fmtFn(v), className: toneClass[INDICATOR_BY_KEY[key].tone!(v)] });
const score = (v: number) => ({ text: v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "—", className: "tabular-nums" });

const columns: Column[] = [
  { key: "name", label: "Unidade", group: "main" },
  { key: "faturamento", label: "Faturamento", group: "main", renderValue: money },
  { key: "ticketMedio", label: "Ticket", group: "main", renderValue: (v) => ({ text: fmt(v), className: "tabular-nums" }) },
  { key: "adimplentes", label: "Adimpl.", group: "main", renderValue: num },
  { key: "novosContratos", label: "Novos", group: "main", renderValue: num },
  { key: "cancelados", label: "Cancel.", group: "main", renderValue: num },
  { key: "churn", label: "Churn", group: "main", renderValue: toned("churn", fmtPct) },
  { key: "renovacoes", label: "Renov.", group: "main", renderValue: toned("renovacoes", fmtPct) },
  { key: "inadimplenciaPerc", label: "Inadimpl.", group: "main", renderValue: toned("inadimplenciaPerc", fmtPct) },
  { key: "icv", label: "Convers.", group: "main", renderValue: toned("icv", fmtPct) },
  { key: "vendasOnline", label: "V. Online", group: "main", renderValue: money },
  { key: "diarias", label: "Diárias", group: "extra", renderValue: money },
  { key: "personal", label: "Personal", group: "extra", renderValue: money },
  { key: "camisetas", label: "Camisetas", group: "extra", renderValue: money },
  { key: "coqueteleiras", label: "Coquet.", group: "extra", renderValue: money },
  { key: "notaGoogle", label: "Nota G.", group: "extra", renderValue: score },
  { key: "nps", label: "NPS", group: "extra", renderValue: score },
];

const VIEWS = [
  { id: "main", label: "Principais" },
  { id: "all", label: "Todas as colunas" },
  { id: "extra", label: "Complementares e satisfação" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function TopUnitsTable({ selectedMonth }: TopUnitsTableProps) {
  const [sortKey, setSortKey] = useState<ColumnKey>("faturamento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("main");

  const monthData = getDataByMonth(selectedMonth) || getLatestData();
  const visible = columns.filter((c) => c.key === "name" || view === "all" || c.group === view);

  const units = monthData.units
    .filter((u) => !query.trim() || normalize(u.name).includes(normalize(query.trim())))
    .sort((a, b) => {
      const va = sortKey === "name" ? a.name : (a[sortKey] as number);
      const vb = sortKey === "name" ? b.name : (b[sortKey] as number);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const handleSort = (key: ColumnKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  if (!monthData.units.length) return null;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Desempenho detalhado</h3>
          <p className="text-sm text-muted-foreground">Todas as unidades e indicadores. Clique no título de uma coluna para ordenar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar unidade"
              aria-label="Buscar unidade"
              className="h-10 w-48 rounded-xl border border-input bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div role="group" aria-label="Colunas exibidas" className="inline-flex max-w-full flex-wrap gap-0.5 rounded-2xl sm:rounded-full bg-secondary p-1 border border-border/70">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
                className={cn("rounded-full px-3 py-1 text-xs sm:text-sm font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === v.id ? "bg-white text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white overflow-auto max-h-[34rem]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="border-b border-border text-xs font-medium text-muted-foreground">
              {visible.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    className={cn("px-3 py-2.5 whitespace-nowrap", col.key === "name" ? "text-left sticky left-0 z-30 bg-white" : "text-right")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={cn("inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", col.key !== "name" && "flex-row-reverse", active && "text-foreground")}
                    >
                      {col.label}
                      {active ? (sortDir === "desc" ? <ChevronDown className="w-3 h-3" aria-hidden /> : <ChevronUp className="w-3 h-3" aria-hidden />) : <ChevronsUpDown className="w-3 h-3 opacity-30" aria-hidden />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.name} className="group border-b border-border/50 last:border-0 hover:bg-secondary/60">
                {visible.map((col) => {
                  if (col.key === "name") {
                    return <th key={col.key} scope="row" className="px-3 py-2 text-left font-semibold whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-secondary">{unit.name}</th>;
                  }
                  const { text, className } = col.renderValue!(unit[col.key as keyof UnitData] as number);
                  return <td key={col.key} className={cn("px-3 py-2 text-right whitespace-nowrap font-medium tabular-nums", className)}>{text}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {units.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma unidade encontrada para “{query}”.</p>}
      </div>
      <p className="text-xs text-muted-foreground mt-2" aria-live="polite">{units.length} de {monthData.units.length} unidades</p>
    </section>
  );
}
