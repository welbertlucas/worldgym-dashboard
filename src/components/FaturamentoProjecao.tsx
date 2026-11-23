import { ChartCard, HeadlineStat } from "@/components/ChartCard";
import { type UnitData } from "@/data/dashboardData";
import { formatMetaValue } from "@/data/metas";
import { formatMonthLong } from "@/data/periods";
import { DIA_MINIMO_PROJECAO, projecaoFaturamento } from "@/data/projecaoMes";

const brl = (n: number) => formatMetaValue("faturamento", n);
const pct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const mesCurto = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""); };

/**
 * Previsão de faturamento do mês em andamento em duas linhas (decisão do dono, 23/11/2026): "vendido até agora", o mesmo número do
 * cartão Faturamento, e "deve fechar o mês em". A estimativa segue a curva de vendas dos 3 meses anteriores até o mesmo dia.
 * O nível da meta fica só em Metas (cada informação numa tela só).
 */
export function FaturamentoProjecao({ total, month, partial, unit, atualizadoEm }: {
  total: UnitData; month: string; partial: boolean; unit: string | null; atualizadoEm: string | null;
}) {
  const p = projecaoFaturamento(total, month, partial, unit, atualizadoEm);
  if (!p) return null;
  const { vendido, estimativa, fracao, dia, meses } = p;
  const escala = Math.max(estimativa ?? vendido, 1) * 1.05;
  const w = (v: number) => `${(v / escala) * 100}%`;
  return (
    <ChartCard
      title="Previsão de faturamento do mês"
      subtitle={<>{unit ?? "Rede"} • {formatMonthLong(month)} (mês em andamento, dados até o dia {dia})</>}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Vendido até agora" value={brl(vendido)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
          {estimativa !== null && <HeadlineStat label="Deve fechar o mês em" value={`≈ ${brl(estimativa)}`} swatch={<span className="h-2 w-2 rounded-full bg-primary/30" />} />}
        </div>
      }
    >
      <div className="relative h-3 rounded-full bg-secondary" role="img" aria-label={`Vendido ${brl(vendido)}${estimativa !== null ? `, deve fechar em ${brl(estimativa)}` : ""}`}>
        {estimativa !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-primary/25" style={{ width: w(estimativa) }} />}
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: w(vendido) }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
        {estimativa !== null
          ? <>Escuro: vendido até agora. Claro: o que ainda deve entrar até o fim do mês. O nível da meta com essa previsão está em Metas.</>
          : dia < DIA_MINIMO_PROJECAO ? <>A previsão de fechamento aparece a partir do dia {DIA_MINIMO_PROJECAO}.</> : <>Ainda não há meses anteriores com as vendas por semana para estimar o fechamento.</>}
      </p>
      {estimativa !== null && fracao !== null && (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Como é calculado</summary>
          <div className="mt-2 space-y-2">
            <p>
              <b className="text-foreground">Vendido até agora ({brl(vendido)}):</b> o faturamento do mês até a véspera, o mesmo número do cartão Faturamento (o Total de vendas do EVO: recepção, cartão recorrente e online).
            </p>
            <p>
              <b className="text-foreground">Deve fechar o mês em (≈ {brl(estimativa)}):</b> em {meses.map(mesCurto).join(", ")}, até o dia {dia} {unit ? "a unidade" : "a rede"} já tinha vendido em média {pct(fracao * 100)}% do mês.
              {" "}Então {brl(vendido)} ÷ {pct(fracao * 100)}% ≈ {brl(estimativa)}.
            </p>
            <p>É uma estimativa, não uma promessa: o ritmo de vendas muda de um dia para o outro, e o cartão recorrente concentra parte do faturamento nos dias de vencimento.</p>
          </div>
        </details>
      )}
    </ChartCard>
  );
}
