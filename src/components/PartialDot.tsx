const INK = "hsl(222 25% 22%)";

interface DotProps { cx?: number; cy?: number; payload?: Record<string, number | string | boolean | null | undefined> }
interface DotOptions {
  /** Campo do dado que guarda o valor parcial (padrão "parcial"). */
  field?: string;
  color?: string;
  /** Mostra o rótulo "parcial: valor" ao lado do marcador. */
  label?: boolean;
  /** Marcador menor e preenchido: para a série secundária quando dois marcadores ficam próximos. */
  secondary?: boolean;
}

/** Marcador do mês em andamento: círculo vazado com o valor, sem ligação com a linha dos meses fechados. */
export const partialDot = (format: (v: number) => string, { field = "parcial", color = INK, label = true, secondary = false }: DotOptions = {}) => (props: DotProps) => {
  const v = props.payload?.[field];
  const { cx, cy } = props;
  if (typeof v !== "number" || cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) return <g />;
  return (
    <g>
      <circle cx={cx} cy={cy} r={secondary ? 3 : 5} fill={secondary ? color : "#fff"} stroke={secondary ? "#fff" : color} strokeWidth={secondary ? 1.5 : 2} />
      {label && (
        <text x={cx - 10} y={cy - 10} textAnchor="end" fontSize={11} fontWeight={600} fill={color} stroke="#fff" strokeWidth={3} paintOrder="stroke">
          {`parcial: ${format(v)}`}
        </text>
      )}
    </g>
  );
};
