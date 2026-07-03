import { useEffect, useState } from "react";
import { getDataByMonth, getLatestData } from "@/data/dashboardData";
import { Select } from "@/components/ui/select";

interface UnitComparisonProps {
  selectedMonth: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number, multiply = false) =>
  `${(multiply ? n * 100 : n).toFixed(1)}%`;

const rows: { label: string; key: string; format: "currency" | "percent_mul" | "percent" | "number" }[] = [
  { label: "Faturamento", key: "faturamento", format: "currency" },
  { label: "Ticket Médio", key: "ticketMedio", format: "currency" },
  { label: "Adimplentes", key: "adimplentes", format: "number" },
  { label: "Novos Contratos", key: "novosContratos", format: "number" },
  { label: "Cancelados", key: "cancelados", format: "number" },
  { label: "Churn", key: "churn", format: "percent_mul" },
  { label: "Renovação", key: "renovacoes", format: "percent_mul" },
  { label: "Inadimplência %", key: "inadimplenciaPerc", format: "percent" },
  { label: "ICV", key: "icv", format: "percent_mul" },
  { label: "Vendas Online", key: "vendasOnline", format: "currency" },
];

function formatVal(v: number, format: typeof rows[0]["format"]) {
  if (format === "currency") return fmt(v);
  if (format === "percent_mul") return fmtPct(v, true);
  if (format === "percent") return fmtPct(v);
  return v.toLocaleString("pt-BR");
}

export function UnitComparison({ selectedMonth }: UnitComparisonProps) {
  const monthData = getDataByMonth(selectedMonth) || getLatestData();
  const units = monthData.units.map((u) => u.name);
  const [unitA, setUnitA] = useState(units[0] ?? "");
  const [unitB, setUnitB] = useState(units[1] ?? units[0] ?? "");

  // Units differ month to month (units can open/close), so re-pick valid
  // defaults whenever the selected month no longer contains the current picks.
  useEffect(() => {
    if (!units.includes(unitA)) setUnitA(units[0] ?? "");
    if (!units.includes(unitB)) setUnitB(units[1] ?? units[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthData.month]);

  const dataA = monthData.units.find((u) => u.name === unitA);
  const dataB = monthData.units.find((u) => u.name === unitB);

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-4 flex-wrap">
        <h3 className="font-display font-bold uppercase tracking-tight text-sm text-muted-foreground flex-1">
          Comparativo de Unidades
        </h3>
        <Select value={unitA} onChange={(e) => setUnitA(e.target.value)} className="w-44">
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </Select>
        <span className="text-muted-foreground text-sm">vs</span>
        <Select value={unitB} onChange={(e) => setUnitB(e.target.value)} className="w-44">
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </Select>
      </div>

      {dataA && dataB ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-4 py-2">Métrica</th>
                <th className="text-right px-4 py-2">{unitA}</th>
                <th className="text-right px-4 py-2">{unitB}</th>
                <th className="text-right px-4 py-2">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const vA = (dataA as unknown as Record<string, number>)[row.key] ?? 0;
                const vB = (dataB as unknown as Record<string, number>)[row.key] ?? 0;
                const diff = vB !== 0 ? ((vA - vB) / Math.abs(vB)) * 100 : 0;
                const isGoodMetric = !["churn", "cancelados", "inadimplenciaPerc"].includes(row.key);
                const diffColor = Math.abs(diff) < 0.5
                  ? "text-muted-foreground"
                  : diff > 0 === isGoodMetric
                  ? "text-success"
                  : "text-destructive";
                return (
                  <tr key={row.key} className="border-b border-border/20 hover:bg-white/5">
                    <td className="px-4 py-2.5 text-muted-foreground">{row.label}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatVal(vA, row.format)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-muted-foreground">{formatVal(vB, row.format)}</td>
                    <td className={`px-4 py-2.5 text-right text-xs font-bold ${diffColor}`}>
                      {Math.abs(diff) < 0.5 ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-muted-foreground text-sm">Selecione duas unidades para comparar.</p>
      )}
    </div>
  );
}
