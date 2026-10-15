import { GaugeMeter, type GaugeZone } from "@/components/GaugeMeter";
import { INDICATOR_BY_KEY, formatIndicator, gaugeMax, toneZones, type Tone } from "@/data/unitIndicators";
import { type UnitData } from "@/data/dashboardData";

// Mesmas cores semânticas do restante do dashboard (verde / âmbar / vermelho).
const TONE_COLOR: Record<Tone, string> = { good: "hsl(142 55% 40%)", warn: "hsl(38 92% 50%)", bad: "hsl(0 72% 51%)" };
const KEYS = ["churn", "inadimplenciaPerc", "renovacoes", "icv"] as const;

/** Saúde da carteira: velocímetros dos indicadores que já têm faixas de interpretação (as mesmas da tabela e dos gráficos). */
export function HealthGauges({ total, partial }: { total: UnitData; partial: boolean }) {
  return (
    <section aria-labelledby="saude-titulo" className="card-surface overflow-hidden">
      <div className="p-5 sm:p-6 pb-3">
        <h3 id="saude-titulo" className="text-base font-semibold text-foreground">Saúde da carteira</h3>
        <p className="text-sm text-muted-foreground">
          Onde cada indicador da rede está em relação às faixas de leitura.{partial && " Valores parciais do mês em andamento."}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-border border-t border-border">
        {KEYS.map((key) => {
          const ind = INDICATOR_BY_KEY[key];
          const value = ind.value(total);
          const max = gaugeMax(ind, value);
          const zones = toneZones(ind, max);
          if (!zones) return null;
          const gz: GaugeZone[] = zones.map((z) => ({ from: z.from, to: z.to, color: TONE_COLOR[z.tone], opacity: 0.9 }));
          const stops = ind.toneStops!;
          const ticks = [0, stops[0], stops[1], max].map((v) => ({ value: v, text: `${Math.round(v)}%` }));
          return (
            <div key={key} className="bg-white p-5 flex flex-col items-center text-center">
              <h4 className="text-sm font-medium text-muted-foreground">{ind.label}</h4>
              <div className="mt-2 w-full max-w-[15rem]">
                <GaugeMeter zones={gz} max={max} value={value} ticks={ticks} label={`${ind.label}: ${formatIndicator(ind, value)}`} />
              </div>
              <p className="-mt-1 font-display text-[2rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">{formatIndicator(ind, value)}</p>
              <p className="mt-2 text-xs text-muted-foreground">{ind.toneHint}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
