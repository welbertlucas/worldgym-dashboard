import type { ReactNode } from "react";

export interface FatiaRosca {
  rotulo: string;
  n: number;
  /** Cor CSS da fatia (ex.: "hsl(var(--success))" ou "#8b5cf6"). */
  cor: string;
  /** Texto extra abaixo do número (ex.: "12,3% convertem"). */
  detalhe?: ReactNode;
}

const R = 38;
const C = 2 * Math.PI * R;
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");

/**
 * Rosca compacta com a legenda ao lado (percentual em destaque e a contagem embaixo), no mesmo estilo das roscas do painel.
 * Feita para blocos que dividem o cartão com outro gráfico (gênero, estado civil, tipo de venda, treinos).
 */
export function MiniRosca({ fatias, rotulo, centro, tamanho = "h-28 w-28" }: { fatias: FatiaRosca[]; rotulo: string; centro?: { valor: string; legenda: string }; tamanho?: string }) {
  const total = fatias.reduce((s, f) => s + Math.max(0, f.n), 0);
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className={`relative shrink-0 ${tamanho}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${rotulo}: ${fatias.map((f) => `${f.rotulo} ${pct(f.n, total)}`).join(", ")}`}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="13" />
          {total > 0 && fatias.map((f) => {
            const len = (Math.max(0, f.n) / total) * C;
            if (len <= 0) return null;
            const gap = Math.min(1.6, len * 0.3);
            const seg = <circle key={f.rotulo} cx="50" cy="50" r={R} fill="none" stroke={f.cor} strokeWidth="13" strokeDasharray={`${Math.max(len - gap, 0.5)} ${C}`} strokeDashoffset={-offset} />;
            offset += len;
            return seg;
          })}
        </svg>
        {centro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-lg font-semibold leading-none tabular-nums text-foreground">{centro.valor}</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">{centro.legenda}</span>
          </div>
        )}
      </div>
      <ul className="min-w-[10rem] max-w-[18rem] flex-1 space-y-2.5">
        {fatias.map((f) => (
          <li key={f.rotulo} className="grid grid-cols-[0.625rem_minmax(0,1fr)_auto] items-baseline gap-x-2">
            <span className="h-2.5 w-2.5 translate-y-px rounded-full" style={{ background: f.cor }} aria-hidden />
            <span className="truncate text-sm text-foreground">{f.rotulo}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{pct(f.n, total)}</span>
            <span className="col-span-2 col-start-2 text-xs tabular-nums text-muted-foreground">
              {f.n.toLocaleString("pt-BR")}{f.detalhe && <> · {f.detalhe}</>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
