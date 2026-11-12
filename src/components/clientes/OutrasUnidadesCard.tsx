import { UnitLink } from "@/components/UnitLink";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { getDataByMonth, type FluxoUnidades, type UnitData } from "@/data/dashboardData";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—");

/** Maiores fluxos da rede (origem → destino), a partir do "vieram" de cada unidade. */
export function fluxosDaRede(units: Pick<UnitData, "name" | "outrasUnidades">[], n = 10): [string, string, number, number][] {
  return units
    .flatMap((u) => (u.outrasUnidades?.vieram.unidades ?? []).map(([de, p, e]) => [de, u.name, p, e] as [string, string, number, number]))
    .sort((a, b) => b[2] - a[2] || b[3] - a[3])
    .slice(0, n);
}

function Lista({ titulo, fluxo, rotulo }: { titulo: string; fluxo: FluxoUnidades; rotulo: string }) {
  const maior = Math.max(...fluxo.unidades.map(([, p]) => p), 1);
  return (
    <div>
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h4>
      {fluxo.unidades.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém neste mês.</p> : (
        <ol className="space-y-2" aria-label={titulo}>
          {fluxo.unidades.slice(0, 8).map(([nome, p, e]) => (
            <li key={nome} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_9rem] items-center gap-3 text-sm">
              <span className="truncate"><UnitLink name={nome} /></span>
              <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                <span className="block h-full rounded-full bg-foreground/60" style={{ width: `${(p / maior) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{int(p)}</span> {rotulo} · {int(e)} entradas</span>
            </li>
          ))}
          {fluxo.unidades.length > 8 && <li className="text-xs text-muted-foreground">e mais {fluxo.unidades.length - 8} unidades</li>}
        </ol>
      )}
    </div>
  );
}

/**
 * Quem treina em outra unidade (entradas na catraca × unidade do cadastro do aluno). Na unidade: alunos dela que foram
 * a outras e alunos de outras que vieram a ela. Na rede: quantos treinaram fora da própria unidade e os maiores fluxos.
 */
export function OutrasUnidadesCard({ total, month, monthLabel, partial, unit }: { total: UnitData; month: string; monthLabel: string; partial: boolean; unit: string | null }) {
  const titulo = "Alunos que treinam em outra unidade";
  const subtitle = <>{unit ?? "Rede"} • {monthLabel}{partial && " (mês em andamento: até hoje)"}</>;
  const units = getDataByMonth(month)?.units ?? [];

  if (!unit) {
    const com = units.filter((u) => u.outrasUnidades);
    if (!com.length) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Ainda não carregado para este mês.</ChartEmpty></ChartCard>;
    const fora = com.reduce((s, u) => s + u.outrasUnidades!.foram.pessoas, 0);
    const entradas = com.reduce((s, u) => s + u.outrasUnidades!.vieram.entradas, 0);
    const frequentadores = com.reduce((s, u) => s + (u.frequentadores ?? 0), 0);
    const fluxos = fluxosDaRede(com);
    const maior = Math.max(...fluxos.map((f) => f[2]), 1);
    const ranking = [...com].sort((a, b) => b.outrasUnidades!.vieram.pessoas - a.outrasUnidades!.vieram.pessoas).slice(0, 8);
    return (
      <ChartCard
        title={titulo}
        subtitle={subtitle}
        headline={
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <HeadlineStat label="Alunos que treinaram fora da própria unidade" value={int(fora)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
            <HeadlineStat label="Entradas em outra unidade" value={int(entradas)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/50" />} />
            {frequentadores > 0 && <HeadlineStat label="Das pessoas que treinaram no mês" value={pct(fora, frequentadores)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Maiores fluxos (de onde → para onde)</h4>
            <ol className="space-y-2" aria-label="Maiores fluxos de alunos entre unidades">
              {fluxos.map(([de, para, p]) => (
                <li key={`${de}>${para}`} className="grid grid-cols-[minmax(0,1fr)_6rem_5rem] items-center gap-3 text-sm">
                  <span className="truncate"><UnitLink name={de} /> <span className="text-muted-foreground">→</span> <UnitLink name={para} /></span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <span className="block h-full rounded-full bg-primary/80" style={{ width: `${(p / maior) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums"><span className="font-semibold">{int(p)}</span> <span className="text-muted-foreground">alunos</span></span>
                </li>
              ))}
            </ol>
          </div>
          <Lista titulo="Unidades que mais recebem alunos de outras" fluxo={{ pessoas: 0, entradas: 0, unidades: ranking.map((u) => [u.name, u.outrasUnidades!.vieram.pessoas, u.outrasUnidades!.vieram.entradas]) }} rotulo="alunos" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Cruza as entradas na catraca com a unidade do cadastro de cada aluno no EVO (a de hoje). Só contagens: ninguém é identificado. Visitantes sem cadastro de aluno ficam de fora.
        </p>
      </ChartCard>
    );
  }

  const o = total.outrasUnidades;
  if (!o) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Ainda não carregado para este mês.</ChartEmpty></ChartCard>;
  const ativos = total.ativosFim ?? total.alunosAtivos ?? 0;
  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label={`Alunos daqui que treinaram em outra${ativos ? ` · ${pct(o.foram.pessoas, ativos)} dos ativos` : ""}`} value={int(o.foram.pessoas)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label={`Alunos de outras que treinaram aqui${total.frequentadores ? ` · ${pct(o.vieram.pessoas, total.frequentadores)} de quem veio` : ""}`} value={int(o.vieram.pessoas)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Lista titulo={`Para onde foram os alunos de ${unit}`} fluxo={o.foram} rotulo="alunos" />
        <Lista titulo={`De onde vieram os alunos de outras unidades`} fluxo={o.vieram} rotulo="alunos" />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Cruza as entradas na catraca com a unidade do cadastro de cada aluno no EVO (a de hoje). Só contagens: ninguém é identificado. Visitantes sem cadastro de aluno ficam de fora.
      </p>
    </ChartCard>
  );
}
