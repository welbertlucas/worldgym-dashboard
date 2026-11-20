import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { cn } from "@/lib/utils";
import type { UnitData } from "@/data/dashboardData";
import { COBERTURA_MINIMA, DIFERENCA_DESTAQUE_PP, taxasPorUnidade } from "@/data/taxasCartao";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct2 = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;
const pp = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2).replace(".", ",")} p.p.`;

/** Taxa de cartão de cada unidade, lado a lado (só dono e Master): a taxa que o EVO registrou sobre o valor recebido, por adquirente, da mais alta para a mais baixa. */
export function TaxaCartaoPorUnidade({ units, monthLabel }: { units: Pick<UnitData, "name" | "gatewaysCartao" | "gatewaysDet">[]; monthLabel: string }) {
  const { linhas, medias } = taxasPorUnidade(units);
  const maior = Math.max(0.01, ...linhas.map((l) => l.taxa));
  return (
    <ChartCard
      title="Taxa de cartão por unidade"
      subtitle={<>Rede • {monthLabel} • taxa que o EVO registrou sobre o valor recebido em cartão, por adquirente. Não é a do extrato da operadora; cobrança sem taxa registrada entra como zero, por isso a coluna de cobertura.</>}
      legend={medias.length > 0 ? <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{medias.map((m) => <span key={m.gateway}>Média {m.gateway}: <b className="font-semibold text-foreground">{pct2(m.taxa)}</b></span>)}</div> : undefined}
    >
      {linhas.length === 0 ? (
        <ChartEmpty>Sem taxas de cartão registradas neste mês.</ChartEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-2 pr-3 font-medium">Unidade</th><th className="px-3 py-2 font-medium">Adquirente</th><th className="px-3 py-2 text-right font-medium">Recebido em cartão</th><th className="px-3 py-2 text-right font-medium">Taxas</th><th className="px-3 py-2 font-medium">Taxa efetiva</th><th className="py-2 pl-3 text-right font-medium">Taxa registrada em</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.unidade}|${l.gateway}`} className="border-t border-border align-middle">
                  <td className="py-2 pr-3 font-medium text-foreground">{l.unidade}</td>
                  <td className="px-3 py-2 text-muted-foreground">{l.gateway}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{moeda(l.recebido)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{moeda(l.taxas)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="relative h-2 w-24 overflow-hidden rounded-full bg-secondary" aria-hidden><span className={cn("absolute inset-y-0 left-0 rounded-full", l.incompleta ? "bg-foreground/30" : "bg-foreground/75")} style={{ width: `${Math.max((l.taxa / maior) * 100, 2)}%` }} /></span>
                      <span className="w-14 font-semibold tabular-nums text-foreground">{pct2(l.taxa)}</span>
                      {l.difMedia !== null && Math.abs(l.difMedia) >= DIFERENCA_DESTAQUE_PP && <span className={cn("text-xs font-medium tabular-nums", l.difMedia > 0 ? "text-destructive" : "text-emerald-700")}>{pp(l.difMedia)} da média</span>}
                    </div>
                  </td>
                  <td className={cn("py-2 pl-3 text-right text-xs tabular-nums", l.incompleta ? "font-semibold text-warning" : "text-muted-foreground")}>{l.cobertura === null ? "—" : `${l.cobertura}% das cobranças${l.incompleta ? " (incompleta)" : ""}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Marcada como incompleta quando a taxa está registrada em menos de {COBERTURA_MINIMA}% das cobranças: o percentual real é maior. Só dono e Master veem esta tabela.</p>
    </ChartCard>
  );
}
