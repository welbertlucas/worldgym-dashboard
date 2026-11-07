import { UnitLink } from "@/components/UnitLink";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { getAvailableUnits, getDataByMonth, type UnitData } from "@/data/dashboardData";
import { treinosMaisRecente } from "@/data/mapaAlunos";
import { formatMonthLong } from "@/data/periods";

const COR = { ativo: "bg-success", vencido: "bg-warning", futuro: "bg-foreground/40", sem: "bg-destructive/70" } as const;
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");

export interface SituacaoTreino { ativo: number; vencido: number; futuro: number; sem: number; alunos: number }

/** Situação dos treinos dos alunos ativos; "sem treino" é a diferença para os alunos ativos. null se o EVO não trouxe treinos. */
export function situacaoDosTreinos(u: UnitData): SituacaoTreino | null {
  if (u.treinoAtivo === undefined) return null;
  const ativo = u.treinoAtivo, vencido = u.treinoVencido ?? 0, futuro = u.treinoFuturo ?? 0;
  const alunos = Math.max(u.ativosFim ?? 0, ativo + vencido + futuro);
  return { ativo, vencido, futuro, sem: Math.max(0, alunos - ativo - vencido - futuro), alunos };
}

function Barra({ s }: { s: SituacaoTreino }) {
  const parte = (n: number) => (s.alunos ? (n / s.alunos) * 100 : 0);
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
      <div className={COR.ativo} style={{ width: `${parte(s.ativo)}%` }} />
      <div className={COR.vencido} style={{ width: `${parte(s.vencido)}%` }} />
      <div className={COR.futuro} style={{ width: `${parte(s.futuro)}%` }} />
      <div className={COR.sem} style={{ width: `${parte(s.sem)}%` }} />
    </div>
  );
}

/** Quantos alunos ativos têm treino ativo, vencido ou nenhum. A rotina do EVO só mostra o estado de hoje, então o histórico se forma dia a dia. */
export function TreinosCard({ total, month, monthLabel, unit }: { total: UnitData; month: string; monthLabel: string; unit: string | null }) {
  // A situação dos treinos é uma foto de hoje: em meses fechados mostra a foto mais recente, dizendo de qual mês é.
  const reserva = situacaoDosTreinos(total) ? null : treinosMaisRecente(unit, getAvailableUnits());
  const s = situacaoDosTreinos(reserva?.total ?? total);
  const subtitle = <>{unit ?? "Rede"} • {reserva ? `foto mais recente (${formatMonthLong(reserva.mes)})` : monthLabel}</>;
  if (!s) return <ChartCard title="Treinos dos alunos" subtitle={subtitle}><ChartEmpty>A situação dos treinos é uma foto de hoje e só existe para o mês em andamento; ela passa a aparecer nos meses seguintes conforme os dias são registrados.</ChartEmpty></ChartCard>;
  const unidades = unit ? [] : (reserva ? reserva.unidades : (getDataByMonth(month)?.units ?? [])).map((u) => ({ u, s: situacaoDosTreinos(u) })).filter((x): x is { u: UnitData; s: SituacaoTreino } => !!x.s && x.s.alunos > 0).sort((a, b) => b.s.ativo / b.s.alunos - a.s.ativo / a.s.alunos);
  return (
    <ChartCard
      title="Treinos dos alunos"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Com treino ativo" value={pct(s.ativo, s.alunos)} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
          <HeadlineStat label="Treino vencido" value={pct(s.vencido, s.alunos)} swatch={<span className="h-2 w-2 rounded-full bg-warning" />} />
          <HeadlineStat label="Sem treino" value={pct(s.sem, s.alunos)} swatch={<span className="h-2 w-2 rounded-full bg-destructive/70" />} />
        </div>
      }
    >
      <Barra s={s} />
      <p className="mt-2 text-xs text-muted-foreground">{s.ativo.toLocaleString("pt-BR")} ativos · {s.vencido.toLocaleString("pt-BR")} vencidos · {s.futuro.toLocaleString("pt-BR")} começam no futuro · {s.sem.toLocaleString("pt-BR")} sem treino, de {s.alunos.toLocaleString("pt-BR")} alunos ativos.</p>
      {unidades.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Treinos por unidade, da maior para a menor parcela com treino ativo">
          {unidades.map(({ u, s: x }) => (
            <li key={u.name} className="grid grid-cols-[8rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_4rem]">
              <span className="truncate font-medium text-foreground"><UnitLink name={u.name} /></span>
              <Barra s={x} />
              <span className="text-right font-semibold tabular-nums text-foreground">{pct(x.ativo, x.alunos)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Verde = treino ativo, âmbar = vencido, cinza = começa no futuro, vermelho = sem treino. Alunos ativos de hoje; nas unidades que não usam o módulo de treino, quase todos aparecem sem treino.</p>
    </ChartCard>
  );
}
