import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { GENEROS, GeneroBarra, IdadeColunas, pct, ROTULOS_IDADE } from "@/components/perfil/blocos";
import type { UnitData } from "@/data/dashboardData";

/** Quem são os alunos ativos: gênero, faixa etária e estado civil (quando o cadastro tem). Foto de hoje, só no mês em andamento. */
export function PerfilAlunosCard({ total, monthLabel, unit }: { total: UnitData; monthLabel: string; unit: string | null }) {
  const subtitle = <>{unit ?? "Rede"} • {monthLabel}</>;
  const p = total.perfil;
  const alunos = p ? p.g.reduce((s, v) => s + v, 0) : 0;
  if (!p || alunos === 0) return <ChartCard title="Perfil dos alunos" subtitle={subtitle}><ChartEmpty>O perfil é uma foto de hoje do EVO e só existe para o mês em andamento; ele aparece depois da próxima sincronização.</ChartEmpty></ChartCard>;
  const civil = Object.entries(p.c).sort((a, b) => b[1] - a[1]);
  const informados = civil.reduce((s, [, n]) => s + n, 0);
  const comIdade = alunos - p.i[7];
  return (
    <ChartCard title="Perfil dos alunos" subtitle={subtitle}>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Gênero</h4>
          <GeneroBarra itens={GENEROS.map((g, k) => ({ rotulo: g.rotulo, n: p.g[k] }))} />
          {informados > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado civil <span className="normal-case tracking-normal">({pct(informados, alunos)} dos alunos informaram)</span></h4>
              <ul className="space-y-2">
                {civil.slice(0, 6).map(([nome, n]) => (
                  <li key={nome} className="grid grid-cols-[7rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                    <span className="truncate text-foreground">{nome}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden><div className="h-full rounded-full bg-primary/60" style={{ width: `${(n / civil[0][1]) * 100}%` }} /></div>
                    <span className="text-right font-semibold tabular-nums text-foreground">{pct(n, informados)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Faixa etária</h4>
          <IdadeColunas itens={ROTULOS_IDADE.map((rotulo, k) => ({ rotulo, n: p.i[k] }))} />
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{alunos.toLocaleString("pt-BR")} alunos ativos hoje ({pct(comIdade, alunos)} com data de nascimento). Só contagens: nenhuma data de nascimento ou nome é guardada.</p>
    </ChartCard>
  );
}
