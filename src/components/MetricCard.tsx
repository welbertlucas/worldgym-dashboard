import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive";
  className?: string;
}

const variantStyles = {
  default: {
    border: "border-l-primary",
    icon: "bg-primary/10 text-primary",
    value: "text-foreground",
  },
  success: {
    border: "border-l-success",
    icon: "bg-success/10 text-success",
    value: "text-success",
  },
  warning: {
    border: "border-l-warning",
    icon: "bg-warning/10 text-warning",
    value: "text-warning",
  },
  destructive: {
    border: "border-l-destructive",
    icon: "bg-destructive/10 text-destructive",
    value: "text-destructive",
  },
};

export function MetricCard({ title, value, subtitle, icon: Icon, variant = "default", className }: MetricCardProps) {
  const styles = variantStyles[variant];
  return (
    <div className={cn("rounded-lg border border-border/60 border-l-4 bg-white p-4 flex flex-col gap-3 shadow-sm", styles.border, className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</span>
        <div className={cn("p-2 rounded-md", styles.icon)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div>
        <p className={cn("font-display text-4xl font-bold tracking-tight", styles.value)}>{value}</p>
        {subtitle && <p className="text-xs font-semibold text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
