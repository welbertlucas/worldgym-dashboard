// Tema único dos gráficos Recharts: eixos, grade, tooltip e cores de referência.
export const AXIS_TICK = { fontSize: 11, fill: "hsl(220 9% 40%)" };
export const GRID = "hsl(222 16% 91%)";
export const TOOLTIP_STYLE = {
  background: "hsl(0 0% 100%)",
  border: "1px solid hsl(222 16% 91%)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
};
/** Faixa que marca o mês em andamento (parcial). */
export const PARTIAL_BAND = { fill: "hsl(32 92% 45%)", fillOpacity: 0.1 } as const;
/** Linhas de referência: tracejadas e mais finas que as séries, rótulo no canto superior direito. */
export const REF_LINE = { strokeDasharray: "4 4", strokeWidth: 1 } as const;
