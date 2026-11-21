import { useState } from "react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";
import { cartaoAReceberPorUnidade, resumoCartaoAReceber } from "@/data/cartaoAReceber";
import { diaDaSemana, diasNoMes } from "@/data/vendasDia";
import { formatAbbreviatedNumber } from "@/lib/utils";

const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const NOME_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const moeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Cartão de crédito que as unidades já cobraram e que ainda vai cair na conta neste mês: calendário por dia (quando o dinheiro cai) e, na rede,
 * quanto cada unidade ainda tem a receber. Valor bruto, sem a taxa da operadora; a data é a prevista pelo EVO (antecipação com a operadora não aparece).
 */
export function CartaoAReceber({ total, units, month, hoje, unitLabel, porUnidade }: {
  total: UnitData; units: Pick<UnitData, "name" | "cartaoAReceber">[]; month: string; hoje: string; unitLabel: string; porUnidade: boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const titulo = "Cartão de crédito a receber no mês";
  const subtitle = <>{unitLabel} • crédito já cobrado, pela data em que o dinheiro cai • valor bruto, sem a taxa da operadora</>;
  if (!total.cartaoAReceber) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>O cartão a receber ainda não foi carregado. Ele entra na próxima atualização da noite.</ChartEmpty></ChartCard>;
  const r = resumoCartaoAReceber(total.cartaoAReceber, hoje);
  const porDia = new Map(r.dias.map((d) => [d.dia, d]));
  const maior = Math.max(...r.dias.map((d) => d.valor), 1);
  const n = diasNoMes(month);
  const offset = (diaDaSemana(month, 1) + 6) % 7;
  const celulas: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);
  const semanas = Array.from({ length: celulas.length / 7 }, (_, k) => celulas.slice(k * 7, k * 7 + 7));
  const iso = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const foco = sel ?? r.maior?.dia ?? null;
  const dFoco = foco ? porDia.get(foco) : undefined;
  const linhas = porUnidade ? cartaoAReceberPorUnidade(units, hoje) : [];
  const maiorUn = Math.max(...linhas.map((l) => l.aReceber), 1);

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Ainda vai cair até o fim do mês" value={moeda(r.aReceber)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
          <HeadlineStat label="Já caiu neste mês" value={moeda(r.jaCaiu)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/40" />} />
          {r.proximo && <HeadlineStat label="Próximo dia com recebimento" value={dm(r.proximo.dia)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <table className="w-full table-fixed border-separate border-spacing-1 text-xs" aria-label={`Cartão de crédito a receber por dia em ${month}`}>
            <thead><tr>{SEMANA.map((d) => <th key={d} scope="col" className="pb-1 font-medium text-muted-foreground">{d}</th>)}</tr></thead>
            <tbody>
              {semanas.map((s, k) => (
                <tr key={k}>
                  {s.map((d, j) => {
                    if (d === null) return <td key={j} />;
                    const x = porDia.get(iso(d));
                    const i = x ? x.valor / maior : 0;
                    const passado = iso(d) < hoje;
                    return (
                      <td
                        key={j}
                        onMouseEnter={() => setSel(iso(d))}
                        onClick={() => setSel(iso(d))}
                        className={`h-12 cursor-default rounded-md p-1 align-top ${foco === iso(d) ? "ring-2 ring-primary ring-inset" : ""} ${iso(d) === hoje ? "outline outline-1 outline-foreground/60" : ""}`}
                        style={{ background: !x ? "hsl(var(--secondary))" : passado ? `hsl(222 14% 52% / ${0.12 + i * 0.3})` : `hsl(4 90% 50% / ${0.1 + i * 0.8})` }}
                      >
                        <span className={`block text-[10px] ${i > 0.6 && !passado ? "text-white/85" : "text-muted-foreground"}`}>{d}</span>
                        {x && <span className={`block text-center text-[11px] font-semibold tabular-nums ${i > 0.6 && !passado ? "text-white" : "text-foreground"}`}>{formatAbbreviatedNumber(x.valor)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-primary" />Ainda vai cair (hoje em diante)</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: "hsl(222 14% 52% / 0.35)" }} />Já caiu</span>
          </div>
          <p className="mt-2 min-h-[1.25rem] text-sm text-foreground" aria-live="polite" onMouseLeave={() => setSel(null)}>
            {foco && (dFoco
              ? <><span className="font-semibold">{dm(foco)}</span> ({NOME_LONGO[diaDaSemana(month, Number(foco.slice(8)))]}): <span className="font-semibold tabular-nums">{moeda(dFoco.valor)}</span> em {dFoco.n.toLocaleString("pt-BR")} {dFoco.n === 1 ? "cobrança" : "cobranças"} · {dFoco.aReceber ? "ainda vai cair" : "já caiu"}</>
              : <><span className="font-semibold">{dm(foco)}</span>: nenhum recebimento de cartão de crédito.</>)}
          </p>
        </div>

        {porUnidade && (
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">A receber por unidade</h4>
            {linhas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma unidade tem cartão a receber até o fim do mês.</p> : (
              <ul className="space-y-2" aria-label="Cartão de crédito a receber por unidade">
                {linhas.map((l) => (
                  <li key={l.unidade} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-foreground">{l.unidade}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground">{moeda(l.aReceber)}</span>
                    </div>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${(l.aReceber / maiorUn) * 100}%` }} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </ChartCard>
  );
}
