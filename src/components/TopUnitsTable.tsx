import { getDataByMonth, getLatestData } from "@/data/dashboardData";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TopUnitsTableProps {
  selectedMonth: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number, multiply = false) =>
  `${(multiply ? n * 100 : n).toFixed(1)}%`;

export function TopUnitsTable({ selectedMonth }: TopUnitsTableProps) {
  const monthData = getDataByMonth(selectedMonth) || getLatestData();
  const units = [...monthData.units].sort((a, b) => b.faturamento - a.faturamento);

  if (!units.length) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40">
        <h3 className="font-display font-bold uppercase tracking-tight text-sm text-muted-foreground">Desempenho por Unidade</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-2">Unidade</th>
              <th className="text-right px-4 py-2">Faturamento</th>
              <th className="text-right px-4 py-2">Ticket Médio</th>
              <th className="text-right px-4 py-2">Adimplentes</th>
              <th className="text-right px-4 py-2">Novos</th>
              <th className="text-right px-4 py-2">Cancelados</th>
              <th className="text-right px-4 py-2">Churn</th>
              <th className="text-right px-4 py-2">Renovação</th>
              <th className="text-right px-4 py-2">Inadimplência</th>
              <th className="text-right px-4 py-2">Vendas Online</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit, i) => (
              <tr key={unit.name} className={`border-b border-border/20 hover:bg-white/5 transition-colors ${i === 0 ? "bg-primary/5" : ""}`}>
                <td className="px-4 py-2.5 font-semibold">{unit.name}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmt(unit.faturamento)}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmt(unit.ticketMedio)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{unit.adimplentes.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-success">{unit.novosContratos.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-destructive">{unit.cancelados.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={unit.churn > 0.08 ? "text-destructive" : unit.churn > 0.05 ? "text-warning" : "text-success"}>
                    {fmtPct(unit.churn, true)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={unit.renovacoes < 0.4 ? "text-destructive" : unit.renovacoes < 0.6 ? "text-warning" : "text-success"}>
                    {fmtPct(unit.renovacoes, true)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={unit.inadimplenciaPerc > 8 ? "text-destructive" : unit.inadimplenciaPerc > 5 ? "text-warning" : "text-success"}>
                    {unit.inadimplenciaPerc.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmt(unit.vendasOnline)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
