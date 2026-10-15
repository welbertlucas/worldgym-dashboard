const INK = "hsl(222 25% 22%)";

interface DotProps { cx?: number; cy?: number; payload?: { parcial?: number | null } }

/** Marcador do mês em andamento: círculo vazado com o valor, sem ligação com a linha dos meses fechados. */
export const partialDot = (format: (v: number) => string) => (props: DotProps) => {
  const v = props.payload?.parcial;
  const { cx, cy } = props;
  if (v == null || cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) return <g />;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={INK} strokeWidth={2} />
      <text x={cx - 10} y={cy - 10} textAnchor="end" fontSize={11} fontWeight={600} fill={INK} stroke="#fff" strokeWidth={3} paintOrder="stroke">
        {`parcial: ${format(v)}`}
      </text>
    </g>
  );
};
