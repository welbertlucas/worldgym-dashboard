import { ChartCard } from "@/components/ChartCard";
import { COR_ROYALTIES } from "@/components/royalties/cores";
import { cn } from "@/lib/utils";
import { type ContextoRoyalties, type FiltroRoyalties, brl, brl0 } from "@/data/royalties";
import { mostraRoyalties, quadrosDeEsperado } from "@/data/royaltiesUnidades";

/** Esperado e recebido: para as unidades com valor esperado informado, mês a mês, quanto devia entrar e quanto entrou. */
export function EsperadoRecebido({ c, f, onUnidade }: { c: ContextoRoyalties; f: FiltroRoyalties; onUnidade?: (u: string) => void }) {
  if (!mostraRoyalties(c, f)) return null;
  const { quadros, maximo } = quadrosDeEsperado(c, f);
  if (quadros.length === 0) return null;
  return (
    <ChartCard title="Esperado e recebido" subtitle="Unidades com valor esperado informado. O saldo devedor de royalties vem só daqui. Valor recebido acima do esperado é rateio e já fica fora dos royalties.">
      <div className="space-y-6">
        {quadros.map((q) => (
          <section key={q.unidade} aria-label={`Esperado e recebido de ${q.unidade}`}>
            <div className="flex items-baseline justify-between gap-3">
              <button type="button" onClick={() => onUnidade?.(q.unidade)} className="text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">{q.unidade}</button>
              {q.saldo > 0 && <span className="text-sm font-medium text-destructive">Deve {brl(q.saldo)}</span>}
            </div>
            {q.meses.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Sem meses no período selecionado.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {q.meses.map((m) => (
                  <li key={m.key} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 text-xs">
                    <span className={cn("tabular-nums", m.parcial ? "text-warning" : "text-muted-foreground")}>{m.label}{m.parcial ? "*" : ""}</span>
                    <span
                      className="relative block h-3 rounded-full bg-secondary"
                      title={`${q.unidade}, ${m.label}: ${m.esperado ? `esperado ${brl(m.esperado)}` : "sem valor esperado informado"}, recebido ${brl(m.recebido)}`}
                    >
                      {m.esperado > 0 && <span className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/25" style={{ width: `${(m.esperado / maximo) * 100}%` }} />}
                      {m.recebido > 0 && <span className="absolute inset-y-[3px] left-0 rounded-full" style={{ width: `${(m.recebido / maximo) * 100}%`, background: COR_ROYALTIES }} />}
                    </span>
                    <span className={cn("whitespace-nowrap text-right tabular-nums", m.esperado && !m.recebido ? "font-semibold text-destructive" : "text-foreground")}>
                      {m.esperado ? `${brl0(m.recebido)} de ${brl0(m.esperado)}` : brl0(m.recebido)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Recebido no período <b className="font-semibold text-foreground">{brl(q.recebidoNoPeriodo)}</b></span>
              <span>Esperado informado <b className="font-semibold text-foreground">{brl(q.esperadoInformado)}</b></span>
              <span>Recebido nesses meses <b className="font-semibold text-foreground">{brl(q.recebidoNosMeses)}</b></span>
            </p>
          </section>
        ))}
      </div>
    </ChartCard>
  );
}
