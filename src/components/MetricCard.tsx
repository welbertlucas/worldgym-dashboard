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
    card: "border-border/60 bg-secondary/20",
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
  success: {
    card: "border-success/20 bg-success/5",
    icon: "bg-success/15 text-success",
    value: "text-foreground",
  },
  warning: {
    card: "border-warning/20 bg-warning/5",
    icon: "bg-warning/15 text-warning",
    value: "text-foreground",
  },
  destructive: {
    card: "border-destructive/20 bg-destructive/5",
    icon: "bg-destructive/15 text-destructive",
    value: "text-foreground",
  },
};

export function MetricCard({ title, value, subtitle, icon: Icon, variant = "default", className }: MetricCardProps) {
  const styles = variantStyles[variant];
  return (
    <div className={cn("rounded-lg border p-4 flex flex-col gap-3", styles.card, className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <div className={cn("p-2 rounded-md", styles.icon)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className={cn("text-2xl font-bold tracking-tight", styles.value)}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
