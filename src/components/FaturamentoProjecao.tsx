import { ChartCard, HeadlineStat } from "@/components/ChartCard";
import { mesesDeReferencia } from "@/components/VendasPorDia";
import { getDataByMonth, type UnitData } from "@/data/dashboardData";
import { formatMetaValue, nextTier, resolveGoal, TIERS, TIER_LABEL, tierReached, type Meta } from "@/data/metas";
import { formatMonthLong } from "@/data/periods";
import { diasFechados, projetarMes } from "@/data/vendasDia";

const brl = (n: number) => formatMetaValue("faturamento", n);
const pct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

/**
 * Quanto vai faturar até o fim do mês, em duas partes:
 *  1. o que já está lançado no EVO (já venceu + vai vencer nos dias que faltam): é a soma dos títulos do mês, não estimativa;
 *  2. a estimativa das vendas que ainda vão entrar: contratos novos que faltam (a mesma projeção de Comercial → Vendas)
 *     vezes o valor médio de um contrato novo no mês.
 * Só aparece no mês em andamento, quando o EVO trouxe a previsão.
 */
export function FaturamentoProjecao({ total, month, partial, unit, atualizadoEm, metas }: {
  total: UnitData; month: string; partial: boolean; unit: string | null; atualizadoEm: string | null; metas: Meta[];
}) {
  const lancado = total.previsaoFaturamento;
  if (!partial || lancado === undefined || !(lancado > 0)) return null;
  const jaVenceu = total.faturamento;
  const aVencer = Math.max(0, lancado - jaVenceu);

  // Vendas que ainda vão entrar: contratos novos que faltam × valor médio de um contrato novo (matrícula e rematrícula).
  const dias = diasFechados(month, partial, atualizadoEm);
  const proj = total.vendasDia?.length ? projetarMes(total.vendasDia, month, dias, mesesDeReferencia(month, unit)) : null;
  const tv = total.tipoVenda;
  const nVendas = tv ? tv.novo[0] + tv.remat[0] : 0;
  const ticket = tv && nVendas > 0 ? (tv.novo[1] + tv.remat[1]) / nVendas : 0;
  const faltam = proj ? Math.max(0, proj.valor - (total.novosContratos ?? proj.realizado)) : 0;
  const vendasFuturas = proj && ticket ? faltam * ticket : null;
  const estimativa = lancado + (vendasFuturas ?? 0);

  const md = getDataByMonth(month);
  // Meta da rede somada só de algumas unidades não compara com o realizado de todas: aí fica sem o nível.
  const bruto = md ? resolveGoal(metas, md, month, unit, "faturamento") : null;
  const goal = bruto && (!bruto.units || bruto.units === md!.units.length) ? bruto : null;
  const nivel = goal ? tierReached("faturamento", estimativa, goal.meta) : null;
  const prox = goal ? nextTier("faturamento", estimativa, goal.meta) : null;
  const marcas = goal ? TIERS.filter((t) => goal.meta[t] !== undefined).map((t) => ({ t, v: goal.meta[t]! })) : [];
  const escala = Math.max(estimativa, ...marcas.map((x) => x.v), 1) * 1.05;
  const w = (v: number) => `${(v / escala) * 100}%`;

  return (
    <ChartCard
      title="Quanto vamos faturar até o fim do mês"
      subtitle={<>{unit ?? "Rede"} • {formatMonthLong(month)} (mês em andamento)</>}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Já lançado no EVO" value={brl(lancado)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
          {vendasFuturas !== null && <HeadlineStat label="Vendas que ainda devem entrar" value={`≈ ${brl(vendasFuturas)}`} swatch={<span className="h-2 w-2 rounded-full bg-primary/40" />} />}
          {vendasFuturas !== null && <HeadlineStat label="Estimativa de fechamento" value={`≈ ${brl(estimativa)}`} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />}
          {nivel && <HeadlineStat label="Com isso, a meta fecha em" value={TIER_LABEL[nivel]} swatch={<span className={`h-2 w-2 rounded-full ${nivel === "abaixo" ? "bg-destructive" : "bg-primary/60"}`} />} />}
        </div>
      }
    >
      <div className="relative h-3 rounded-full bg-secondary" role="img" aria-label={`Já venceu ${brl(jaVenceu)}, lançado ${brl(lancado)}, estimativa ${brl(estimativa)}`}>
        {vendasFuturas !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-primary/15" style={{ width: w(estimativa) }} />}
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary/40" style={{ width: w(lancado) }} />
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: w(jaVenceu) }} />
        {marcas.map((x) => (
          <span key={x.t} className="absolute -top-1 h-5 w-0.5 bg-foreground/70" style={{ left: w(x.v) }} title={`${TIER_LABEL[x.t]}: ${brl(x.v)}`} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
        Escuro: já venceu ({brl(jaVenceu)}). Médio: ainda vai vencer, já lançado ({brl(aVencer)}).{vendasFuturas !== null && " Claro: vendas que ainda devem entrar."}
        {marcas.length > 0 && <> Traços: meta {marcas.map((x) => `${TIER_LABEL[x.t]} ${brl(x.v)}`).join(" · ")}.</>}
        {prox && prox.value > estimativa && <> Para o {TIER_LABEL[prox.tier]} faltariam {brl(prox.value - estimativa)}.</>}
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
              <b className="text-foreground">Vendas que ainda devem entrar (≈ {brl(vendasFuturas)}):</b> pela projeção de Comercial → Vendas, o mês deve fechar com ≈ {int(proj.valor)} novos contratos e já saíram {int(total.novosContratos ?? proj.realizado)};
              faltam ≈ {int(faltam)}. Cada contrato novo vendido neste mês rendeu em média {brl(ticket)}, então {int(faltam)} × {brl(ticket)} ≈ {brl(vendasFuturas)}.
            </p>
          )}
          <p>É uma estimativa, não uma promessa: o ritmo de vendas e o valor médio dos contratos mudam de um dia para o outro, e cancelamentos ou ajustes de cobrança tiram do lançado.</p>
        </div>
      </details>
    </ChartCard>
  );
}
