import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { GENEROS, GeneroBarra, IdadeColunas, pct, ROTULOS_IDADE } from "@/components/perfil/blocos";
import { getAvailableUnits, type UnitData } from "@/data/dashboardData";
import { perfilMaisRecente } from "@/data/mapaAlunos";
import { MiniRosca } from "@/components/MiniRosca";
import { formatMonthLong } from "@/data/periods";

const CORES_CIVIL = ["hsl(var(--primary))", "hsl(222 25% 30%)", "hsl(222 14% 55%)", "hsl(35 90% 50%)", "hsl(220 14% 80%)"];

/** Quem são os alunos ativos: gênero, faixa etária e estado civil (quando o cadastro tem). Foto de hoje, só no mês em andamento. */
export function PerfilAlunosCard({ total, monthLabel, unit }: { total: UnitData; monthLabel: string; unit: string | null }) {
  // O perfil é uma foto de hoje: em meses fechados mostra a foto mais recente, dizendo de qual mês é.
  const reserva = total.perfil ? null : perfilMaisRecente(unit, getAvailableUnits());
  const p = total.perfil ?? reserva?.perfil;
  const subtitle = <>{unit ?? "Rede"} • {reserva ? `foto mais recente (${formatMonthLong(reserva.mes)})` : monthLabel}</>;
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
          <GeneroBarra tamanho="h-40 w-40" itens={GENEROS.map((g, k) => ({ rotulo: g.rotulo, n: p.g[k] }))} />
          {informados / alunos >= 0.1 && (
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado civil <span className="normal-case tracking-normal">({pct(informados, alunos)} dos alunos informaram)</span></h4>
              <MiniRosca
                rotulo="Estado civil"
                tamanho="h-40 w-40"
                fatias={(civil.length > 5 ? [...civil.slice(0, 4), ["Outros", civil.slice(4).reduce((t, [, n]) => t + n, 0)] as [string, number]] : civil).map(([nome, n], k) => ({ rotulo: nome, n, cor: CORES_CIVIL[k % CORES_CIVIL.length] }))}
              />
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
