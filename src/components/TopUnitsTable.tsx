import { useState } from "react";
import { getDataByMonth, getAvailableMonths, getLatestData, UnitData } from "@/data/dashboardData";
import { Select } from "@/components/ui/select";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn, formatAbbreviatedNumber } from "@/lib/utils";

interface TopUnitsTableProps {
  selectedMonth: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// Metrics where a decrease is the desired direction (used to color the
// reference-month delta green/red correctly, matching the direction of
// the existing threshold coloring below).
const BAD_WHEN_UP = new Set(["cancelados", "churn", "inadimplenciaPerc"]);

type ColumnKey = keyof UnitData | "name";

type Column = {
  key: ColumnKey;
  label: string;
  align: "left" | "right";
  renderValue?: (v: number) => { text: string; className?: string };
};

const columns: Column[] = [
  { key: "name", label: "Unidade", align: "left" },
  { key: "faturamento", label: "Faturamento", align: "right", renderValue: (v) => ({ text: formatAbbreviatedNumber(v), className: "tabular-nums font-semibold" }) },
  { key: "ticketMedio", label: "Ticket", align: "right", renderValue: (v) => ({ text: fmt(v), className: "tabular-nums font-semibold" }) },
  { key: "adimplentes", label: "Adimpl.", align: "right", renderValue: (v) => ({ text: v.toLocaleString("pt-BR"), className: "tabular-nums" }) },
  { key: "novosContratos", label: "Novos", align: "right", renderValue: (v) => ({ text: v.toLocaleString("pt-BR"), className: "tabular-nums text-success" }) },
  { key: "cancelados", label: "Cancel.", align: "right", renderValue: (v) => ({ text: v.toLocaleString("pt-BR"), className: "tabular-nums text-destructive" }) },
  {
    key: "churn", label: "Churn", align: "right",
    renderValue: (v) => ({ text: fmtPct(v), className: v > 8 ? "text-destructive" : v > 5 ? "text-warning" : "text-success" }),
  },
  {
    key: "renovacoes", label: "Renov.", align: "right",
    renderValue: (v) => ({ text: fmtPct(v), className: v < 40 ? "text-destructive" : v < 60 ? "text-warning" : "text-success" }),
  },
  {
    key: "inadimplenciaPerc", label: "Inadimpl.", align: "right",
    renderValue: (v) => ({ text: `${v.toFixed(1)}%`, className: v > 8 ? "text-destructive" : v > 5 ? "text-warning" : "text-success" }),
  },
  {
    key: "icv", label: "Convers.", align: "right",
    renderValue: (v) => ({ text: fmtPct(v), className: v > 60 ? "text-success" : v > 40 ? "text-warning" : "text-destructive" }),
  },
  { key: "vendasOnline", label: "V. Online", align: "right", renderValue: (v) => ({ text: formatAbbreviatedNumber(v), className: "tabular-nums font-semibold" }) },
  { key: "diarias", label: "Diárias", align: "right", renderValue: (v) => ({ text: formatAbbreviatedNumber(v ?? 0), className: "tabular-nums" }) },
  { key: "personal", label: "Personal", align: "right", renderValue: (v) => ({ text: formatAbbreviatedNumber(v ?? 0), className: "tabular-nums" }) },
  { key: "camisetas", label: "Camisetas", align: "right", renderValue: (v) => ({ text: formatAbbreviatedNumber(v ?? 0), className: "tabular-nums" }) },
  { key: "coqueteleiras", label: "Coquet.", align: "right", renderValue: (v) => ({ text: formatAbbreviatedNumber(v ?? 0), className: "tabular-nums" }) },
  { key: "notaGoogle", label: "Nota G.", align: "right", renderValue: (v) => ({ text: v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "—", className: "tabular-nums" }) },
];

function diffPercent(current: number, ref: number): number | null {
  if (ref === 0) return null;
  return ((current - ref) / Math.abs(ref)) * 100;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, (mo || 1) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function TopUnitsTable({ selectedMonth }: TopUnitsTableProps) {
  const [sortKey, setSortKey] = useState<ColumnKey>("faturamento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [refMonth, setRefMonth] = useState<string | null>(null);

  const monthData = getDataByMonth(selectedMonth) || getLatestData();
  const refData = refMonth ? getDataByMonth(refMonth) : null;
  const months = getAvailableMonths();

  const units = [...monthData.units].sort((a, b) => {
    const va = sortKey === "name" ? a.name : (a[sortKey] as number);
    const vb = sortKey === "name" ? b.name : (b[sortKey] as number);
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleSort = (key: ColumnKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (!units.length) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-4 flex-wrap">
        <h3 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-tight text-foreground flex-1">Desempenho por Unidade</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-semibold tracking-widest text-muted-foreground">Mês de referência</span>
          <Select value={refMonth ?? ""} onChange={(e) => setRefMonth(e.target.value || null)} className="w-40">
            <option value="">— nenhum —</option>
            {months.filter((m) => m !== monthData.month).map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40 text-[9px] uppercase tracking-wide text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-1.5 py-1.5 select-none cursor-pointer hover:text-foreground transition-colors whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"}`}
                  onClick={() => handleSort(col.key)}
                >
                  <span className={`inline-flex items-center gap-0.5 ${col.align === "right" ? "flex-row-reverse" : ""}`}>
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === "desc" ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />
                    ) : (
                      <ChevronsUpDown className="w-2.5 h-2.5 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((unit, i) => {
              const ref = refData?.units.find((u) => u.name === unit.name);
              return (
                <tr key={unit.name} className={`border-b border-border/20 hover:bg-muted/50 transition-colors ${i === 0 && sortKey === "faturamento" && sortDir === "desc" ? "bg-primary/5" : ""}`}>
                  <td className="px-1.5 py-1.5 font-semibold max-w-[110px]">{unit.name}</td>
                  {columns.slice(1).map((col) => {
                    const value = unit[col.key as keyof UnitData] as number;
                    const refValue = ref ? (ref[col.key as keyof UnitData] as number) : null;
                    const diff = refValue != null ? diffPercent(value, refValue) : null;
                    const isGood = !BAD_WHEN_UP.has(col.key as string);
                    const diffColor = diff == null || Math.abs(diff) < 0.5
                      ? "text-muted-foreground"
                      : diff > 0 === isGood
                      ? "text-success"
                      : "text-destructive";
                    const { text, className } = col.renderValue!(value);
                    return (
                      <td key={col.key} className="px-1.5 py-1.5 text-right whitespace-nowrap">
                        <div className={cn("font-semibold", className)}>{text}</div>
                        {refMonth && (
                          <div className={`text-[9px] font-sans ${diffColor}`}>
                            {diff == null || Math.abs(diff) < 0.5 ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
