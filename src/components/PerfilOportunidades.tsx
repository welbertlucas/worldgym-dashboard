import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { GENEROS, GeneroBarra, IdadeColunas, ROTULOS_IDADE } from "@/components/perfil/blocos";
import type { UnitData } from "@/data/dashboardData";

/** Quem são as oportunidades cadastradas no mês (gênero e faixa etária) e quanto de cada grupo vira cliente. */
export function PerfilOportunidades({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const p = total.perfilOport;
  const cadastradas = p ? p.g.reduce((s, [c]) => s + c, 0) : 0;
  if (!p || cadastradas === 0) return <ChartCard title="Perfil das oportunidades" subtitle={subtitle}><ChartEmpty>Sem perfil das oportunidades neste mês.</ChartEmpty></ChartCard>;
  return (
    <ChartCard title="Perfil das oportunidades" subtitle={subtitle}>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Gênero</h4>
          <GeneroBarra itens={GENEROS.map((g, k) => ({ rotulo: g.rotulo, n: p.g[k][0], conv: p.g[k][1] }))} />
        </div>
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Faixa etária <span className="normal-case tracking-normal">(abaixo de cada coluna: quantos convertem)</span></h4>
          <IdadeColunas itens={ROTULOS_IDADE.map((rotulo, k) => ({ rotulo, n: p.i[k][0], conv: p.i[k][1] }))} />
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{cadastradas.toLocaleString("pt-BR")} oportunidades cadastradas no mês; "convertem" são as que viraram cliente no próprio mês (mesma regra da conversão). Só contagens: nenhum dado pessoal é guardado.</p>
    </ChartCard>
  );
}
