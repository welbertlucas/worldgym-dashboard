import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { type UnitData } from "@/data/dashboardData";
// Mesma regra dos alertas do Meta.
import { origemMetaDe } from "../../server/alertasMeta.js";

const MAX_LINHAS = 8;
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");

/** Origens ordenadas por oportunidades cadastradas; a cauda vira "Demais origens". */
export function origensOrdenadas(o: Record<string, [number, number]>): [string, number, number][] {
  const lista = Object.entries(o).filter(([, [c]]) => c > 0).sort((a, b) => b[1][0] - a[1][0]).map(([k, [c, v]]) => [k, c, v] as [string, number, number]);
  const topo = lista.slice(0, MAX_LINHAS);
  const resto = lista.slice(MAX_LINHAS);
  return resto.length ? [...topo, ["Demais origens", resto.reduce((s, r) => s + r[1], 0), resto.reduce((s, r) => s + r[2], 0)]] : topo;
}

/** De onde vêm as oportunidades (cadastros de prospects) e quanto de cada origem vira cliente no mês. */
export function OrigemOportunidades({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const origens = total.origens;
  const cadastradas = origens ? Object.values(origens).reduce((s, [c]) => s + c, 0) : 0;
  if (!origens || cadastradas === 0) return <ChartCard title="Origem das oportunidades" subtitle={subtitle}><ChartEmpty>Sem oportunidades do EVO neste mês.</ChartEmpty></ChartCard>;
  const convertidas = Object.values(origens).reduce((s, [, v]) => s + v, 0);
  const linhas = origensOrdenadas(origens);
  const maior = linhas[0][1];
  const meta = origemMetaDe(origens);
  return (
    <ChartCard
      title="Origem das oportunidades"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Oportunidades cadastradas" value={cadastradas.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Convertidas no mês" value={pct(convertidas, cadastradas)} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
        </div>
      }
    >
      <ol className="space-y-2" aria-label="Origem das oportunidades, da mais para a menos frequente">
        {linhas.map(([nome, c, v]) => (
          <li key={nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="truncate text-sm text-foreground" title={nome}>{nome}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{c.toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">· {pct(c, cadastradas)} do total · {pct(v, c)} convertem</span></span>
            <div className="col-span-2 h-2 rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max((c / maior) * 100, 1.5)}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-xl bg-secondary/60 px-4 py-3">
        <p className="text-sm font-medium text-foreground">Vindas do Meta (Instagram, Facebook e anúncios)</p>
        <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
          {meta.cadastradas > 0
            ? <><span className="font-semibold text-foreground">{meta.cadastradas.toLocaleString("pt-BR")}</span> cadastradas · {pct(meta.cadastradas, cadastradas)} do total · <span className="font-semibold text-foreground">{meta.convertidas.toLocaleString("pt-BR")}</span> convertidas ({pct(meta.convertidas, meta.cadastradas)})</>
            : "Nenhuma oportunidade com origem Instagram, Facebook ou anúncio neste mês."}
        </p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Origem informada no cadastro do prospect. "Convertem" = viraram cliente dentro do mesmo mês do cadastro. "Vindas do Meta" soma as origens com Instagram, Facebook, anúncio ou tráfego pago no nome (a mesma regra dos alertas do Marketing).</p>
    </ChartCard>
  );
}
