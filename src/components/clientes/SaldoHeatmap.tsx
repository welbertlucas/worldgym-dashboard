import { UnitLink } from "@/components/UnitLink";
import { getAvailableMonths, getDataByMonth, saldoAlunos, type UnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";
import { cn } from "@/lib/utils";

const MESES = 12;
/** Variação de ±4% da base de alunos no mês pinta a célula por inteiro. */
const ESCALA = 0.04;

const curto = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(" de ", "/").replace(".", "");

/** Cor da célula: verde quando a base cresce, vermelho quando encolhe; a intensidade é proporcional ao tamanho da unidade. */
export function corDaCelula(saldo: number | undefined, base: number | undefined): string | undefined {
  if (saldo === undefined || !base) return undefined;
  const i = Math.min(Math.abs(saldo) / base / ESCALA, 1);
  if (saldo === 0) return undefined;
  return saldo > 0 ? `hsl(142 60% 45% / ${0.12 + i * 0.5})` : `hsl(0 72% 51% / ${0.1 + i * 0.5})`;
}

export function SaldoHeatmap({ selectedMonth, selectedUnit }: { selectedMonth: string; selectedUnit: string | null }) {
  const meses = getAvailableMonths().filter((m) => m <= selectedMonth).slice(-MESES);
  const porMes = meses.map((m) => getDataByMonth(m));
  const nomes = [...new Set(porMes.flatMap((d) => d?.units.map((u) => u.name) ?? []))];
  const dado = (m: number, nome: string): UnitData | undefined => porMes[m]?.units.find((u) => u.name === nome);
  const linhas = nomes.map((nome) => {
    const celulas = meses.map((_, i) => dado(i, nome));
    const acumulado = celulas.reduce((s, u) => s + (u ? saldoAlunos(u) ?? 0 : 0), 0);
    return { nome, celulas, acumulado };
  }).sort((a, b) => a.acumulado - b.acumulado);
  const totais = porMes.map((d) => (d ? d.units.reduce((s, u) => s + (saldoAlunos(u) ?? 0), 0) : undefined));
  const haDado = linhas.some((l) => l.celulas.some((u) => u && saldoAlunos(u) !== undefined));

  return (
    <section className="card-surface p-5 sm:p-6" aria-labelledby="saldo-titulo">
      <h3 id="saldo-titulo" className="text-base font-semibold text-foreground">Saldo de alunos por unidade</h3>
      <p className="mb-4 text-sm text-muted-foreground">Alunos ativos no fim do mês menos no início, nos últimos {meses.length} meses. Verde cresce, vermelho encolhe; unidades ordenadas do pior para o melhor saldo acumulado.</p>
      {!haDado ? (
        <p className="text-sm text-muted-foreground">Sem dados de alunos ativos do EVO nestes meses.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm tabular-nums">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Unidade</th>
                {meses.map((m) => (
                  <th key={m} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">{curto(m)}{isPartialMonth(m) && <span title="Mês em andamento"> *</span>}</th>
                ))}
                <th className="py-2 pl-3 text-right text-xs font-medium text-muted-foreground">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nome} className={cn(selectedUnit === l.nome && "outline outline-2 -outline-offset-2 outline-foreground/40")}>
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-white py-1.5 pr-3 text-left text-sm font-medium text-foreground"><UnitLink name={l.nome} /></th>
                  {l.celulas.map((u, i) => {
                    const saldo = u ? saldoAlunos(u) : undefined;
                    return (
                      <td key={meses[i]} className="px-0.5 py-0.5">
                        <div className="rounded-md px-1 py-1.5 text-center text-xs font-medium text-foreground" style={{ background: corDaCelula(saldo, u?.ativosIni) }} title={u ? `${l.nome}: ${saldo === undefined ? "sem dado" : (saldo > 0 ? "+" : "") + saldo} alunos em ${curto(meses[i])}` : undefined}>
                          {saldo === undefined ? "—" : saldo > 0 ? `+${saldo}` : saldo}
                        </div>
                      </td>
                    );
                  })}
                  <td className={cn("py-1.5 pl-3 text-right text-sm font-semibold", l.acumulado > 0 ? "text-success" : l.acumulado < 0 ? "text-destructive" : "text-foreground")}>{l.acumulado > 0 ? "+" : ""}{l.acumulado.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="sticky left-0 z-10 border-t border-border bg-white py-2 pr-3 text-left text-sm font-semibold text-foreground">Rede</th>
                {totais.map((t, i) => <td key={meses[i]} className="border-t border-border px-1 py-2 text-center text-xs font-semibold text-foreground">{t === undefined ? "—" : t > 0 ? `+${t.toLocaleString("pt-BR")}` : t.toLocaleString("pt-BR")}</td>)}
                <td className="border-t border-border py-2 pl-3 text-right text-sm font-semibold text-foreground">{totais.reduce<number>((s, t) => s + (t ?? 0), 0).toLocaleString("pt-BR")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">* mês em andamento (valores parciais). A cor depende do tamanho da unidade: variação de 4% da base pinta a célula por inteiro.</p>
    </section>
  );
}
