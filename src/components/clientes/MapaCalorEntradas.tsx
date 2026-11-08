import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";

/** Linhas de segunda a domingo (no dado, 0 = domingo). */
const DIAS = [
  { sem: 1, nome: "Seg" }, { sem: 2, nome: "Ter" }, { sem: 3, nome: "Qua" }, { sem: 4, nome: "Qui" },
  { sem: 5, nome: "Sex" }, { sem: 6, nome: "Sáb" }, { sem: 0, nome: "Dom" },
];
const NOME_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dec = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Quantas vezes cada dia da semana aparece entre o dia 1 e o dia `dias` do mês (para tirar a média por dia). */
export function ocorrenciasDaSemana(month: string, dias: number): number[] {
  const [y, m] = month.split("-").map(Number);
  const out = Array(7).fill(0);
  for (let d = 1; d <= dias; d++) out[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] += 1;
  return out;
}

/** Média de entradas por dia da semana × hora (7 × 24, domingo primeiro). */
export function mediaPorHora(calor: number[], ocorrencias: number[]): number[] {
  return calor.map((n, k) => (ocorrencias[Math.floor(k / 24)] ? n / ocorrencias[Math.floor(k / 24)] : 0));
}

/** Horário de pico: o dia da semana e a hora com a maior média. */
export function horarioDePico(media: number[]): { sem: number; hora: number; media: number } | null {
  let k = -1;
  media.forEach((v, i) => { if (v > 0 && (k < 0 || v > media[k])) k = i; });
  return k < 0 ? null : { sem: Math.floor(k / 24), hora: k % 24, media: media[k] };
}

/** Entradas na catraca por dia da semana e hora (média por dia), como no Insights; mais as entradas de cada dia do mês. */
export function MapaCalorEntradas({ total, month, monthLabel, partial, unitLabel }: { total: UnitData; month: string; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: até hoje)"}</>;
  const calor = total.calor;
  const porDia = total.entradasDia ?? [];
  if (!calor || !total.entradas) return <ChartCard title="Quando os alunos treinam" subtitle={subtitle}><ChartEmpty>Sem entradas da catraca do EVO neste mês.</ChartEmpty></ChartCard>;

  const ocorr = ocorrenciasDaSemana(month, porDia.length);
  const media = mediaPorHora(calor, ocorr);
  const maior = Math.max(...media, 1);
  const pico = horarioDePico(media);
  // Só as horas em que a rede/unidade abre (alguma entrada no mês).
  const comEntrada = Array.from({ length: 24 }, (_, h) => h).filter((h) => DIAS.some((d) => calor[d.sem * 24 + h] > 0));
  const horas = comEntrada.length ? Array.from({ length: comEntrada[comEntrada.length - 1] - comEntrada[0] + 1 }, (_, i) => comEntrada[0] + i) : [];
  const diasComEntrada = porDia.filter((n) => n > 0).length || 1;
  const maiorDia = Math.max(...porDia, 1);
  const [y, m] = month.split("-").map(Number);

  return (
    <ChartCard
      title="Quando os alunos treinam"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Entradas no mês" value={int(total.entradas)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Média por dia" value={int(total.entradas / diasComEntrada)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/50" />} />
          {total.frequentadores ? <HeadlineStat label="Idas por aluno no mês" value={dec(total.entradas / total.frequentadores)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/30" />} /> : null}
          {pico && <HeadlineStat label="Horário de pico" value={`${DIAS.find((d) => d.sem === pico.sem)?.nome} ${pico.hora}h`} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-[11px]" aria-label="Média de entradas por dia da semana e hora">
          <thead>
            <tr>
              <th className="w-10" />
              {horas.map((h) => <th key={h} scope="col" className="font-normal text-muted-foreground tabular-nums">{h}h</th>)}
            </tr>
          </thead>
          <tbody>
            {DIAS.map((d) => (
              <tr key={d.sem}>
                <th scope="row" className="pr-1 text-left font-medium text-muted-foreground">{d.nome}</th>
                {horas.map((h) => {
                  const v = media[d.sem * 24 + h];
                  const i = v / maior;
                  const topo = pico && pico.sem === d.sem && pico.hora === h;
                  return (
                    <td
                      key={h}
                      title={`${NOME_LONGO[d.sem]}, ${h}h às ${h + 1}h: ${dec(v)} entradas em média`}
                      className={topo ? "h-7 rounded-[4px] ring-2 ring-primary ring-inset" : "h-7 rounded-[4px]"}
                      style={{ background: v > 0 ? `hsl(4 90% 50% / ${0.06 + i * 0.84})` : "hsl(var(--secondary))" }}
                    >
                      <span className="sr-only">{dec(v)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
        <span>menos</span>
        <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(to right, hsl(4 90% 50% / 0.06), hsl(4 90% 50% / 0.9))" }} />
        <span>mais movimento</span>
      </div>

      {porDia.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Entradas por dia do mês</h4>
          <div className="flex h-20 items-end gap-[2px]" role="img" aria-label={`Entradas por dia; o maior dia teve ${int(maiorDia)}`}>
            {porDia.map((n, k) => {
              const sem = new Date(Date.UTC(y, m - 1, k + 1)).getUTCDay();
              return <div key={k} title={`${k + 1}/${String(m).padStart(2, "0")} (${NOME_LONGO[sem]}): ${int(n)} entradas`} className={sem === 0 || sem === 6 ? "flex-1 rounded-t-sm bg-foreground/25" : "flex-1 rounded-t-sm bg-foreground/70"} style={{ height: `${Math.max((n / maiorDia) * 100, n ? 2 : 0)}%` }} />;
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums"><span>1</span><span>{porDia.length}</span></div>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Entradas liberadas na catraca (reconhecimento facial, teclado, app ou liberação manual); saídas e acessos bloqueados ficam de fora.
        Cada célula é a média de entradas naquela hora em um dia daquele tipo no mês. Fim de semana em cinza no gráfico por dia.
        Idas por aluno = entradas ÷ pessoas diferentes que vieram{unitLabel === "Rede" ? " (na rede, quem treina em duas unidades conta nas duas)" : ""}. Só contagens: ninguém é identificado.
      </p>
    </ChartCard>
  );
}
