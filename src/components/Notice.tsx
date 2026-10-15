import { Clock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Aviso discreto em âmbar: mês em andamento (clock) ou inconsistência de cadastro (alert). */
export function Notice({ children, icon = "clock", className }: { children: React.ReactNode; icon?: "clock" | "alert"; className?: string }) {
  const Icon = icon === "clock" ? Clock : TriangleAlert;
  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground", className)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
