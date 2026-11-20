import { KpiGaugeCard } from "@/components/executiva/KpiGaugeCard";
import { type MetricDetail } from "@/components/MetricCard";
import { type ResumoJuridico as Resumo, DIAS_PARADO, brl, curto } from "@/data/juridico";

const neutro = (text: string): MetricDetail => ({ text, tone: "neutral" });

/** Cartões do topo (os mesmos em meia-lua do Atlas): quantos processos, quanto está em causa, como réu, judicial x extrajudicial e parados. */
export function ResumoJuridico({ r, arquivados }: { r: Resumo; arquivados: number }) {
  const frac = (a: number, b: number) => (b > 0 ? a / b : 0);
  const cartoes = [
    <KpiGaugeCard key="total" title="Processos" value={String(r.total)} fill={frac(r.total, r.total + arquivados)} marker={null} tone="neutral" details={[neutro(`${arquivados} arquivado${arquivados === 1 ? "" : "s"} na planilha`)]} />,
    <KpiGaugeCard key="valor" title="Valor em causa" value={curto(r.valor)} fill={r.total ? 1 : 0} marker={null} tone="neutral"
      details={[...(r.valor >= 1e6 ? [neutro(brl(r.valor))] : []), ...(r.semValor ? [neutro(`${r.semValor} sem valor${r.sigilosos ? ` (${r.sigilosos} sigiloso${r.sigilosos === 1 ? "" : "s"})` : ""}`)] : [])]} />,
    <KpiGaugeCard key="reu" title="Como réu" value={`${r.reu} de ${r.total}`} fill={frac(r.reu, r.total)} marker={null} tone="neutral" details={[neutro(`${Math.round(frac(r.reu, r.total) * 100)}% dos processos`)]} />,
    <KpiGaugeCard key="nat" title="Judiciais" value={`${r.judiciais} de ${r.total}`} fill={frac(r.judiciais, r.total)} marker={null} tone="neutral" details={[neutro(`${r.extrajudiciais} extrajudiciais (Procon, MP...)`)]} />,
    <KpiGaugeCard key="parados" title="Sem andamento" value={String(r.parados)} fill={frac(r.parados, r.total)} marker={null} tone={r.parados > 0 ? "bad" : "good"} details={[neutro(`Há mais de ${DIAS_PARADO} dias ou sem data`)]} />,
  ];
  return (
    <div className="card-surface overflow-hidden">
      <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{cartoes}</div>
    </div>
  );
}
