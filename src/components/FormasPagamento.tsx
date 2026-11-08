import { DonutList } from "@/components/DonutList";
import type { UnitData } from "@/data/dashboardData";
import { formatAbbreviatedNumber } from "@/lib/utils";

const moeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const CORES = ["hsl(222 25% 22%)", "hsl(4 90% 50%)", "hsl(222 14% 52%)", "hsl(142 50% 38%)", "hsl(220 14% 78%)", "hsl(35 90% 50%)"];

/** Formas de pagamento ordenadas pelo valor; da 6ª em diante viram "Outras". */
export function formasOrdenadas(f: Record<string, number>): [string, number][] {
  const l = Object.entries(f).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return l.length > 6 ? [...l.slice(0, 5), ["Outras", l.slice(5).reduce((s, [, v]) => s + v, 0)]] : l;
}

/** Quanto do recebido no mês entrou por cartão de crédito, débito, Pix, dinheiro... */
export function FormasPagamento({ total, monthLabel, unitLabel }: { total: UnitData; monthLabel: string; unitLabel: string }) {
  const l = formasOrdenadas(total.formasPagamento ?? {});
  const soma = l.reduce((s, [, v]) => s + v, 0);
  return (
    <DonutList
      title="Recebimento por forma de pagamento"
      subtitle={`${unitLabel} • ${monthLabel} • valor pago no mês, pela data do pagamento`}
      center={{ value: formatAbbreviatedNumber(soma), caption: "recebido" }}
      empty="Sem formas de pagamento do EVO neste mês."
      items={l.map(([label, value], k) => ({ label, value, color: CORES[k % CORES.length], valueText: moeda(value) }))}
    />
  );
}
