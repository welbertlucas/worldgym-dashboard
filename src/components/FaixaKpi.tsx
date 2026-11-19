import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ItemKpi {
  id: string;
  rotulo: string;
  /** O número em destaque, já formatado. */
  valor: string;
  icone?: ReactNode;
  /** Logo abaixo do número: variação, gráfico pequeno... */
  extra?: ReactNode;
  detalhe?: ReactNode;
}

/**
 * Faixa de números do topo de uma tela: um cartão só, com linhas finas entre os itens e o número em Oswald
 * (o mesmo estilo dos KPIs do Overview e do Comercial). Quebra em quantas colunas couberem.
 */
export function FaixaKpi({ itens, rotulo }: { itens: ItemKpi[]; rotulo: string }) {
  return (
    <section aria-label={rotulo} className="card-surface overflow-hidden p-0">
      {/* As margens negativas escondem a linha do último item de cada fila, qualquer que seja o número de colunas. */}
      <ul className="-mb-px -mr-px grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(10.5rem, 1fr))" }}>
        {itens.map((i) => (
          <li key={i.id} className="min-w-0 border-b border-r border-border px-5 py-4">
            <p className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">{i.icone && <span className="mt-px shrink-0">{i.icone}</span>}<span>{i.rotulo}</span></p>
            <p className="mt-1.5 font-display text-[2rem] font-semibold leading-none tracking-tight text-foreground tabular-nums">{i.valor}</p>
            {i.extra && <div className="mt-2">{i.extra}</div>}
            {i.detalhe && <p className="mt-1.5 text-xs text-muted-foreground">{i.detalhe}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

const numero = (n: number) => n.toLocaleString("pt-BR");

/** Variação com seta: verde quando sobe, vermelho quando desce. `valor` null = ainda sem histórico para comparar. */
export function Delta({ valor, formatar = numero, sufixo = "", titulo, semHistorico = "sem histórico ainda" }: {
  valor: number | null; formatar?: (n: number) => string; sufixo?: string; titulo?: string; semHistorico?: string;
}) {
  if (valor == null) return <span className="text-xs text-muted-foreground">{semHistorico}</span>;
  const sobe = valor > 0;
  const igual = valor === 0;
  const Seta = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <span title={titulo} className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", igual ? "text-muted-foreground" : sobe ? "text-success" : "text-destructive")}>
      {!igual && <Seta className="h-3.5 w-3.5" aria-hidden />}
      {sobe ? "+" : valor < 0 ? "−" : ""}{formatar(Math.abs(valor))}{sufixo}
    </span>
  );
}

/** Linha pequena de evolução (sem eixos), no vermelho da marca. Menos de 2 pontos não desenha nada. */
export function Sparkline({ valores, rotulo, className }: { valores: number[]; rotulo: string; className?: string }) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min;
  const W = 100, H = 28, pad = 2;
  const pontos = valores.map((v, i) => [(i / (valores.length - 1)) * W, faixa === 0 ? H / 2 : H - pad - ((v - min) / faixa) * (H - 2 * pad)]);
  const linha = pontos.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg role="img" aria-label={rotulo} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("h-7 w-full", className)}>
      <path d={`${linha} L${W} ${H} L0 ${H} Z`} fill="hsl(4 90% 50% / 0.10)" />
      <path d={linha} fill="none" stroke="hsl(4 90% 50%)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
