import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";

/** Consultores que mais converteram oportunidades em clientes no mês (o EVO informa quem converteu, não quem cadastrou). */
export function ConsultoresConversao({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const lista = total.consultores ?? [];
  if (lista.length === 0) return <ChartCard title="Consultores que mais convertem" subtitle={subtitle}><ChartEmpty>Sem conversões por consultor neste mês.</ChartEmpty></ChartCard>;
  const unidades = new Set(lista.map((l) => l[2]).filter(Boolean));
  const comUnidade = unidades.size > 1;
  const maior = lista[0][1];
  const somaTop = lista.reduce((s, l) => s + l[1], 0);
  const convertidas = total.conversoes;
  return (
    <ChartCard
      title="Consultores que mais convertem"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Maior número de conversões" value={maior.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          {convertidas ? <HeadlineStat label={`Os ${lista.length} primeiros somam`} value={`${Math.round((somaTop / convertidas) * 100)}%`} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} /> : null}
        </div>
      }
    >
      <ol className="space-y-2" aria-label="Consultores, de quem mais converteu para quem menos converteu">
        {lista.map(([nome, n, unidade], k) => (
          <li key={`${nome}|${unidade ?? ""}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">{k + 1}º</span>
            <span className="truncate text-sm text-foreground" title={nome}>{nome}{comUnidade && unidade && <span className="text-muted-foreground"> · {unidade}</span>}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{n.toLocaleString("pt-BR")}</span>
            <div className="col-span-2 col-start-2 h-2 rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max((n / maior) * 100, 1.5)}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">Quem fechou a conversão da oportunidade em cliente (campo "convertido por" do EVO). O EVO não informa quem cadastrou. Aparecem os 10 que mais converteram{comUnidade ? " na rede" : ""}.</p>
    </ChartCard>
  );
}
