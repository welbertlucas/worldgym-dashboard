import { UnitLink } from "@/components/UnitLink";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { getDataByMonth, type UnitData } from "@/data/dashboardData";

export const FAIXAS = [
  { rotulo: "Até 7 dias", cor: "bg-success" },
  { rotulo: "8 a 14 dias", cor: "bg-success/50" },
  { rotulo: "15 a 30 dias", cor: "bg-warning" },
  { rotulo: "31 a 60 dias", cor: "bg-destructive/50" },
  { rotulo: "Mais de 60 dias", cor: "bg-destructive/80" },
  { rotulo: "Nunca acessou", cor: "bg-foreground/40" },
] as const;

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");
const soma = (a: number[]) => a.reduce((n, v) => n + v, 0);

/** Alunos ativos "sumidos": sem acesso há mais de 30 dias (faixas 31–60, mais de 60 e nunca). */
export const semAcessoHa30 = (a: number[]) => soma(a.slice(3));

function Barra({ a }: { a: number[] }) {
  const t = soma(a);
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
      {FAIXAS.map((f, i) => <div key={f.rotulo} className={f.cor} style={{ width: `${t ? (a[i] / t) * 100 : 0}%` }} />)}
    </div>
  );
}

/** Quando os alunos ativos vieram pela última vez (catraca). Foto de hoje: só existe para o mês em andamento. */
export function AcessosCard({ total, month, monthLabel, unit }: { total: UnitData; month: string; monthLabel: string; unit: string | null }) {
  const subtitle = <>{unit ?? "Rede"} • {monthLabel}</>;
  const a = total.acessos;
  if (!a || soma(a) === 0) return <ChartCard title="Último check-in dos alunos" subtitle={subtitle}><ChartEmpty>O último acesso é uma foto de hoje e só existe para o mês em andamento; ela passa a aparecer conforme os dias são registrados.</ChartEmpty></ChartCard>;
  const t = soma(a);
  const unidades = unit ? [] : (getDataByMonth(month)?.units ?? []).filter((u) => u.acessos && soma(u.acessos) > 0).sort((x, y) => semAcessoHa30(y.acessos!) / soma(y.acessos!) - semAcessoHa30(x.acessos!) / soma(x.acessos!));
  return (
    <ChartCard
      title="Último check-in dos alunos"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Vieram nos últimos 7 dias" value={pct(a[0], t)} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
          <HeadlineStat label="Sem vir há mais de 30 dias" value={pct(semAcessoHa30(a), t)} swatch={<span className="h-2 w-2 rounded-full bg-destructive/70" />} />
        </div>
      }
    >
      <Barra a={a} />
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-3">
        {FAIXAS.map((f, i) => <li key={f.rotulo} className="flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${f.cor}`} />{f.rotulo}: <span className="font-semibold tabular-nums text-foreground">{a[i].toLocaleString("pt-BR")}</span></li>)}
      </ul>
      {unidades.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Alunos sem vir há mais de 30 dias por unidade, da maior para a menor parcela">
          {unidades.map((u) => (
            <li key={u.name} className="grid grid-cols-[8rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_4rem]">
              <span className="truncate font-medium text-foreground"><UnitLink name={u.name} /></span>
              <Barra a={u.acessos!} />
              <span className="text-right font-semibold tabular-nums text-foreground">{pct(semAcessoHa30(u.acessos!), soma(u.acessos!))}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Alunos ativos de hoje, pelo último acesso registrado na catraca. A coluna da direita é a parcela sem vir há mais de 30 dias (quanto maior, mais alunos em risco de cancelar).</p>
    </ChartCard>
  );
}
