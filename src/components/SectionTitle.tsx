import { cn } from "@/lib/utils";

/** level="page" é o título principal da seção (maior); o padrão é título de bloco. */
export function SectionTitle({ children, hint, level = "block" }: { children: React.ReactNode; hint?: string; level?: "page" | "block" }) {
  return (
    <div className="mb-4 sm:mb-5">
      <h2 className={cn("font-semibold tracking-tight text-foreground", level === "page" ? "text-2xl sm:text-[1.75rem] leading-tight" : "text-lg sm:text-xl")}>{children}</h2>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
