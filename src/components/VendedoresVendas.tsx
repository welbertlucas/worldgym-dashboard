import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";

const rotuloContratos = (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? "contrato" : "contratos"}`;
const moeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

/** Quem mais vendeu planos no mês: contratos novos e rematrículas por vendedor (campo "vendido por" do EVO; sem comissão). */
export function VendedoresVendas({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const lista = total.vendedores ?? [];
  if (lista.length === 0) return <ChartCard title="Vendedores que mais vendem" subtitle={subtitle}><ChartEmpty>Sem vendas de plano por vendedor neste mês.</ChartEmpty></ChartCard>;
  const [contratos, , nVend, semVend] = total.vendedoresTotal ?? [0, 0, 0, 0];
  const noRanking = lista.reduce((s, l) => s + l[1], 0);
  const outros = Math.max(contratos - semVend - noRanking, 0);
  const unidades = new Set(lista.map((l) => l[3]).filter(Boolean));
  const comUnidade = unidades.size > 1;
  const maior = lista[0][1];
  return (
    <ChartCard
      title="Vendedores que mais vendem"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Maior número de contratos" value={maior.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          {nVend > 0 && <HeadlineStat label="Vendedores no mês" value={nVend.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-muted-foreground" />} />}
        </div>
      }
    >
      <ol className="space-y-2" aria-label="Vendedores, de quem mais vendeu para quem menos vendeu">
        {lista.map(([nome, n, valor, unidade], k) => (
          <li key={`${nome}|${unidade ?? ""}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">{k + 1}º</span>
            <span className="truncate text-sm text-foreground" title={nome}>{nome}{comUnidade && unidade && <span className="text-muted-foreground"> · {unidade}</span>}</span>
            <span className="text-sm tabular-nums text-foreground"><span className="font-semibold">{n.toLocaleString("pt-BR")}</span><span className="text-muted-foreground"> · {moeda(valor)}</span></span>
            <div className="col-span-2 col-start-2 h-2 rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max((n / maior) * 100, 1.5)}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">
        Contratos de plano novos e rematrículas, com o valor deles, por quem fez a venda (campo "vendido por" do EVO). Renovações e a recorrência mensal automática não entram.
        {outros > 0 && ` Outros vendedores: ${rotuloContratos(outros)}.`}
        {semVend > 0 && ` Sem vendedor no EVO (online e recorrência): ${rotuloContratos(semVend)}, fora do ranking.`}
      </p>
    </ChartCard>
  );
}
