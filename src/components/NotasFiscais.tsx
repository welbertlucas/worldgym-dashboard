import { UnitLink } from "@/components/UnitLink";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { dashboardData, getDataByMonth, getUnitData, type NotasMes, type UnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";
import { ALERT_CONFIG } from "@/data/alertConfig";

/** Mês seguinte a AAAA-MM. */
export const mesSeguinte = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct1 = (x: number) => `${x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** Abaixo disso, a cobertura do recebido por nota fica em destaque (o mesmo limite dos alertas). */
export const COBERTURA_MINIMA = ALERT_CONFIG.notas.minCobertura;

/** Parte do recebido no mês que ganhou nota (0 a 100), ou null sem recebimento. */
export const cobertura = (n: NotasMes) => (n.cobertura[1] > 0 ? (n.cobertura[0] / n.cobertura[1]) * 100 : null);

const curto = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
};

/**
 * Notas fiscais (EVO): quanto foi emitido no mês e, principalmente, quanto do que foi recebido ganhou nota
 * (no próprio mês ou no seguinte). Na rede, as unidades da menor para a maior cobertura.
 */
export function NotasFiscaisCard({ total, month, monthLabel, partial, unit }: { total: UnitData; month: string; monthLabel: string; partial: boolean; unit: string | null }) {
  const titulo = "Notas fiscais";
  // A cobertura de um mês só fecha no fim do mês seguinte (notas atrasadas ainda entram até lá).
  const aberta = partial || isPartialMonth(mesSeguinte(month));
  const subtitle = <>{unit ?? "Rede"} • {monthLabel}{aberta && ` (${partial ? "mês em andamento" : "o mês seguinte ainda não acabou"}: notas ainda podem sair)`}</>;
  const n = total.notas;
  if (!n) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>As notas fiscais ainda não foram carregadas para este mês.</ChartEmpty></ChartCard>;

  const cob = cobertura(n);
  const semNota = Math.max(0, n.cobertura[1] - n.cobertura[0]);
  const unidades = unit ? [] : (getDataByMonth(month)?.units ?? []).filter((u) => u.notas && u.notas.cobertura[1] > 0)
    .sort((a, b) => cobertura(a.notas!)! - cobertura(b.notas!)!);
  const serie = unit
    ? dashboardData.map((m) => m.month).filter((m) => m <= month).slice(-12)
      .map((m) => [m, getUnitData(m, unit)?.notas] as const).filter((x): x is readonly [string, NotasMes] => !!x[1] && cobertura(x[1]) !== null)
    : [];

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label={aberta ? "Recebido com nota até agora" : "Recebido com nota"} value={cob === null ? "—" : pct1(cob)} swatch={<span className={`h-2 w-2 rounded-full ${cob !== null && cob < COBERTURA_MINIMA ? "bg-destructive" : "bg-foreground"}`} />} />
          <HeadlineStat label="Recebido sem nota" value={brl(semNota)} swatch={<span className="h-2 w-2 rounded-full bg-destructive/70" />} />
          <HeadlineStat label={`Notas emitidas no mês · ${int(n.emitidas[0])}`} value={brl(n.emitidas[1])} swatch={<span className="h-2 w-2 rounded-full bg-foreground/50" />} />
          <HeadlineStat label="ISS das notas" value={brl(n.iss)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/30" />} />
        </div>
      }
    >
      <div className="space-y-1 text-sm text-muted-foreground">
        {n.outrosMeses[1] > 0 && (
          <p>
            <span className="font-semibold text-foreground">{brl(n.outrosMeses[1])}</span> ({int(n.outrosMeses[0])} notas) das notas emitidas no mês cobrem pagamentos de outros meses
            {unit ? "" : ", quase sempre notas atrasadas do mês anterior"}.
          </p>
        )}
        {(n.canceladas > 0 || n.negadas > 0) && <p>{int(n.canceladas)} notas canceladas e {int(n.negadas)} negadas pela prefeitura no mês.</p>}
      </div>

      {unidades.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Unidades: recebido com nota</h4>
          <ol className="grid grid-cols-1 gap-x-8 gap-y-2 xl:grid-cols-2" aria-label="Unidades pela parte do recebido com nota fiscal">
            {unidades.map((u) => {
              const c = cobertura(u.notas!)!;
              const falta = Math.max(0, u.notas!.cobertura[1] - u.notas!.cobertura[0]);
              return (
                <li key={u.name} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_9rem] items-center gap-3 text-sm">
                  <span className="truncate"><UnitLink name={u.name} /></span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <span className={`block h-full rounded-full ${c < COBERTURA_MINIMA ? "bg-destructive/75" : "bg-foreground/55"}`} style={{ width: `${Math.min(100, c)}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{pct1(c)}</span>{falta >= 1 ? ` · falta ${brl(falta)}` : ""}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {serie.length >= 2 && (
        <div className="mt-5">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recebido com nota, mês a mês</h4>
          <div className="flex h-24 items-end gap-1" role="img" aria-label="Parte do recebido com nota fiscal em cada mês">
            {serie.map(([m, x]) => {
              const c = cobertura(x)!;
              return (
                <div key={m} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${curto(m)}: ${pct1(c)}`}>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(c)}%</span>
                  <div className={`w-full rounded-t-sm ${c < COBERTURA_MINIMA ? "bg-destructive/75" : m === month ? "bg-foreground/70" : "bg-foreground/40"}`} style={{ height: `${Math.max(c * 0.6, 2)}px` }} />
                  <span className="truncate text-[10px] text-muted-foreground">{curto(m)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Notas fiscais emitidas pelo EVO. “Recebido com nota” = do que foi pago no mês, quanto tem nota autorizada emitida no próprio mês ou no seguinte (cada nota aponta para o pagamento que cobre),
        por isso não depende de a nota sair no mesmo mês do pagamento. Em vermelho, abaixo de {COBERTURA_MINIMA}%. Notas emitidas e ISS contam só as autorizadas.
        {unit === null && " Unidade que não emite nota pelo EVO aparece com 0%."}
      </p>
    </ChartCard>
  );
}
