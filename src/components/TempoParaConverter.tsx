import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";
// Mesmas faixas que o servidor grava em `tempoConversao.f` (server/prospects.js).
export const FAIXAS_TEMPO = ["No mesmo dia", "1 a 3 dias", "4 a 7 dias", "8 a 30 dias", "Mais de 30 dias"];

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");
const dias = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${v === 1 ? "dia" : "dias"}`;

/** Quanto tempo leva do cadastro da oportunidade até ela virar cliente (das que converteram no próprio mês do cadastro). */
export function TempoParaConverter({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const t = total.tempoConversao;
  if (!t || t.n === 0) return <ChartCard title="Tempo até converter" subtitle={subtitle}><ChartEmpty>Sem conversões com o tempo calculado neste mês.</ChartEmpty></ChartCard>;
  const media = t.soma / t.n;
  const mesmoDia = t.f[0];
  const maior = Math.max(...t.f, 1);
  return (
    <ChartCard
      title="Tempo até converter"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Tempo médio até virar cliente" value={dias(media)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Convertem no mesmo dia" value={pct(mesmoDia, t.n)} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
        </div>
      }
    >
      <ol className="space-y-2" aria-label="Oportunidades convertidas por tempo até a conversão">
        {FAIXAS_TEMPO.map((rotulo, i) => (
          <li key={rotulo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="text-sm text-foreground">{rotulo}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{t.f[i].toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">· {pct(t.f[i], t.n)}</span></span>
            <div className="col-span-2 h-2 rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max((t.f[i] / maior) * 100, t.f[i] > 0 ? 1.5 : 0)}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">Conta as {t.n.toLocaleString("pt-BR")} oportunidades cadastradas no mês que viraram cliente no próprio mês, do dia do cadastro ao dia da conversão. Quem converte em outro mês não entra.</p>
    </ChartCard>
  );
}
