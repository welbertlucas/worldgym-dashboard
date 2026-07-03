import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonCardProps {
  title: string;
  value1: string | number;
  value2: string | number;
  diff: number;
  month1: string;
  month2: string;
  format: "currency" | "number" | "percentage";
  invertColors?: boolean;
}

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function formatValue(v: string | number, format: ComparisonCardProps["format"]) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (format === "currency")
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  if (format === "percentage") return `${v}%`;
  return Number.isInteger(n) ? n.toLocaleString("pt-BR") : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function ComparisonCard({ title, value1, value2, diff, month1, month2, format, invertColors }: ComparisonCardProps) {
  const isPositive = diff > 0;
  const isNeutral = Math.abs(diff) < 0.01;

  const goodColor = invertColors ? "text-destructive" : "text-success";
  const badColor = invertColors ? "text-success" : "text-destructive";

  const diffColor = isNeutral ? "text-muted-foreground" : isPositive ? goodColor : badColor;
  const DiffIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-4 flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">{formatMonthLabel(month1)}</p>
          <p className="text-base font-bold">{formatValue(value1, format)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">{formatMonthLabel(month2)}</p>
          <p className="text-base font-bold text-muted-foreground">{formatValue(value2, format)}</p>
        </div>
      </div>
      <div className={cn("flex items-center gap-1 text-xs font-semibold", diffColor)}>
        <DiffIcon className="w-3.5 h-3.5" />
        <span>
          {isNeutral ? "Sem variação" : `${isPositive ? "+" : ""}${diff.toFixed(1)}${format === "currency" || format === "number" ? "%" : "pp"}`}
        </span>
      </div>
    </div>
  );
}
