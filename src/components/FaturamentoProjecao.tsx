import { ChartCard, HeadlineStat } from "@/components/ChartCard";
import { type UnitData } from "@/data/dashboardData";
import { formatMetaValue } from "@/data/metas";
import { formatMonthLong } from "@/data/periods";
import { projecaoFaturamento } from "@/data/projecaoMes";

const brl = (n: number) => formatMetaValue("faturamento", n);
const pct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

/**
 * Quanto vai faturar até o fim do mês, em duas partes:
 *  1. o que já está lançado no EVO (já venceu + vai vencer nos dias que faltam): é a soma dos títulos do mês, não estimativa;
 *  2. a estimativa das vendas que ainda vão entrar: contratos novos que faltam (a mesma projeção da aba Vendas)
 *     vezes o valor médio de um contrato novo no mês.
 * Só aparece no mês em andamento, quando o EVO trouxe a previsão. O nível da meta fica só em Metas (cada informação numa tela só).
 */
export function FaturamentoProjecao({ total, month, partial, unit, atualizadoEm }: {
  total: UnitData; month: string; partial: boolean; unit: string | null; atualizadoEm: string | null;
}) {
  const p = projecaoFaturamento(total, month, partial, unit, atualizadoEm);
  if (!p) return null;
  const { jaVenceu, lancado, vendasFuturas, estimativa, faltam, ticket, contratos: proj } = p;
  const aVencer = Math.max(0, lancado - jaVenceu);

  const escala = Math.max(estimativa, 1) * 1.05;
  const w = (v: number) => `${(v / escala) * 100}%`;

  return (
    <ChartCard
      title="Projeção de faturamento até o final do mês"
      subtitle={<>{unit ?? "Rede"} • {formatMonthLong(month)} (mês em andamento). Conta pelas cobranças (títulos) lançadas no EVO, por isso pode diferir do cartão Faturamento, que mostra as vendas do mês.</>}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Já lançado no EVO" value={brl(lancado)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
          {vendasFuturas !== null && <HeadlineStat label="Vendas que ainda devem entrar" value={`≈ ${brl(vendasFuturas)}`} swatch={<span className="h-2 w-2 rounded-full bg-primary/40" />} />}
          {vendasFuturas !== null && <HeadlineStat label="Estimativa de fechamento" value={`≈ ${brl(estimativa)}`} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />}
        </div>
      }
    >
      <div className="relative h-3 rounded-full bg-secondary" role="img" aria-label={`Já venceu ${brl(jaVenceu)}, lançado ${brl(lancado)}, estimativa ${brl(estimativa)}`}>
        {vendasFuturas !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-primary/15" style={{ width: w(estimativa) }} />}
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary/40" style={{ width: w(lancado) }} />
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: w(jaVenceu) }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
        Escuro: já venceu ({brl(jaVenceu)}). Médio: ainda vai vencer, já lançado ({brl(aVencer)}).{vendasFuturas !== null && " Claro: vendas que ainda devem entrar."}
        {" "}O nível da meta com essa estimativa está em Metas.
        {vendasFuturas === null && " A estimativa das vendas que ainda devem entrar aparece a partir do dia 10."}
      </p>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Como é calculado</summary>
        <div className="mt-2 space-y-2">
          <p>
            <b className="text-foreground">Já lançado no EVO ({brl(lancado)}):</b> faturamento é a soma das mensalidades e cobranças que vencem no mês. Já venceram {brl(jaVenceu)} ({pct((jaVenceu / lancado) * 100)}% do total)
            e o EVO tem mais {brl(aVencer)} com vencimento nos dias que faltam. Não é palpite: é o que já está lançado.
          </p>
          {vendasFuturas !== null && proj && (
            <p>
              <b className="text-foreground">Vendas que ainda devem entrar (≈ {brl(vendasFuturas)}):</b> pela projeção da aba Vendas, o mês deve fechar com ≈ {int(proj.valor)} novos contratos e já saíram {int(total.novosContratos ?? proj.realizado)};
              faltam ≈ {int(faltam)}. Cada contrato novo vendido neste mês rendeu em média {brl(ticket)}, então {int(faltam)} × {brl(ticket)} ≈ {brl(vendasFuturas)}.
            </p>
          )}
          <p>É uma estimativa, não uma promessa: o ritmo de vendas e o valor médio dos contratos mudam de um dia para o outro, e cancelamentos ou ajustes de cobrança tiram do lançado.</p>
        </div>
      </details>
    </ChartCard>
  );
}
