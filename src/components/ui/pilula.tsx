import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pílula de escolha (filtros e opções liga/desliga), padrão único do Atlas: redonda como o Button, contorno cinza e, quando
 * escolhida, fundo escuro com texto claro. Para ações use o Button (components/ui/button).
 */
export const Pilula = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo: boolean; tamanho?: "sm" | "md" }>(
  ({ ativo, tamanho = "sm", className, ...props }, ref) => (
    <button ref={ref} type="button" aria-pressed={ativo}
      className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-full border font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background",
        tamanho === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm", className)}
      {...props} />
  ),
);
Pilula.displayName = "Pilula";
