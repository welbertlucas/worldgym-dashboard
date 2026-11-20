import { Notice } from "@/components/Notice";
import { KpiGaugeCard } from "@/components/executiva/KpiGaugeCard";
import { type MetricDetail } from "@/components/MetricCard";
import { type ContextoRoyalties, type FiltroRoyalties, brl, brl0, naoMapeadoNo, periodo, pct, resumoDoPeriodo, saldoDe } from "@/data/royalties";
import { COR_FIXA, COR_ROYALTIES } from "@/components/royalties/cores";

/** Abertura do menu: os cartões do Atlas com o recebido, as modalidades, o saldo devedor e as unidades inadimplentes. */
export function ResumoRoyalties({ c, f, onUnidade }: { c: ContextoRoyalties; f: FiltroRoyalties; onUnidade?: (u: string) => void }) {
  const ks = periodo(c, f);
  const r = resumoDoPeriodo(c, f);
  const parciais = ks.filter((k) => c.parcial.has(k));
  const nm = naoMapeadoNo(c, ks);
  const mostrarFixa = f.tipo !== "royalties" && r.unidades.some((u) => c.tipoDe[u] === "fixa");
  const mostrarRoy = f.tipo !== "fixa" && r.unidades.some((u) => c.tipoDe[u] === "royalties");
  const apuracao = c.m.pendencias.apuracao;
  const parteDoTotal = (v: number) => (r.total > 0 ? `${pct(v / r.total)} do total` : undefined);
  // O número dentro do arco é curto (cabe no cartão): sem centavos e, de 1 milhão para cima, "R$ 3,26 mi". O valor exato vai no chip abaixo.
  const curto = (v: number) => (Math.abs(v) >= 1e6 ? `R$ ${(v / 1e6).toFixed(2).replace(".", ",")} mi` : brl0(v));
  const exato = (v: number): MetricDetail[] => (Math.abs(v) >= 1e6 ? [{ text: brl(v), tone: "neutral" }] : []);
  const neutro = (text: string): MetricDetail => ({ text, tone: "neutral" });
  const fatia = (v: number) => (r.total > 0 ? Math.min(1, v / r.total) : 0);
  const cartoes: React.ReactNode[] = [
    <KpiGaugeCard key="total" title="Total recebido" value={curto(r.total)} fill={1} marker={null} tone="neutral" details={[...exato(r.total), neutro(`${c.rotulo[ks[0]]} a ${c.rotulo[ks[ks.length - 1]]}`)]} />,
  ];
  if (mostrarFixa) cartoes.push(<KpiGaugeCard key="fixa" title="Taxa fixa" value={curto(r.fixa)} fill={fatia(r.fixa)} marker={null} tone="neutral" color={COR_FIXA} details={[...exato(r.fixa), ...(parteDoTotal(r.fixa) ? [neutro(parteDoTotal(r.fixa)!)] : [])]} />);
  if (mostrarRoy) cartoes.push(<KpiGaugeCard key="roy" title="Royalties" value={curto(r.royalties)} fill={fatia(r.royalties)} marker={null} tone="neutral" color={COR_ROYALTIES} details={[...exato(r.royalties), ...(parteDoTotal(r.royalties) ? [neutro(parteDoTotal(r.royalties)!)] : [])]} />);
  if (r.cobradas.length > 0) {
    cartoes.push(
      <KpiGaugeCard key="saldo" title="Saldo devedor total" value={curto(r.saldoTotal)} fill={r.total + r.saldoTotal > 0 ? r.saldoTotal / (r.total + r.saldoTotal) : 0} marker={null} tone={r.saldoTotal > 0 ? "bad" : "good"}
        details={r.saldoTotal > 0 ? [neutro(`Taxa fixa ${brl0(r.saldoFixa)}`), neutro(`Royalties ${brl0(r.saldoRoyalties)}`), ...(apuracao ? [neutro(`Posição em ${c.rotulo[apuracao] ?? apuracao}`)] : [])] : [{ text: "Tudo em dia", tone: "good" }]} />,
      <KpiGaugeCard key="inad" title="Unidades inadimplentes" value={`${r.devedoras.length} de ${r.cobradas.length}`} fill={r.devedoras.length / r.cobradas.length} marker={null} tone={r.devedoras.length > 0 ? "bad" : "good"}
        details={[neutro("Com cobrança fixa ou royalties esperados")]}
        footer={
          <span className="flex flex-wrap justify-center gap-1" role="list" aria-label="Unidades com cobrança, as devedoras em vermelho">
            {[...r.cobradas].sort((a, b) => saldoDe(c, b) - saldoDe(c, a)).map((u) => (
              <button key={u} type="button" role="listitem" onClick={() => onUnidade?.(u)} title={`${u}${saldoDe(c, u) > 0.005 ? `: deve ${brl0(saldoDe(c, u))}` : ": em dia"}`} aria-label={`${u}: ${saldoDe(c, u) > 0.005 ? `deve ${brl0(saldoDe(c, u))}` : "em dia"}`}
                className={`h-2.5 w-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${saldoDe(c, u) > 0.005 ? "bg-destructive" : "bg-border"}`} />
            ))}
          </span>
        } />,
    );
  }
  const colunas = ["", "", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-2 xl:grid-cols-4", "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"][Math.min(cartoes.length, 5)];
  return (
    <div className="space-y-3">
      {(parciais.length > 0 || (nm > 0 && !f.unidades.length && f.tipo !== "royalties")) && (
        <div className="space-y-2">
          {parciais.length > 0 && <Notice>{parciais.map((k) => c.rotulo[k]).join(", ")} ainda é parcial: o extrato do mês veio incompleto.</Notice>}
          {nm > 0 && !f.unidades.length && f.tipo !== "royalties" && <Notice>Inclui {brl(nm)} sem unidade identificada, que não entra em nenhuma unidade.</Notice>}
        </div>
      )}
      <div className="card-surface overflow-hidden">
        <div className={`-mr-px -mb-px grid grid-cols-1 ${colunas}`}>{cartoes}</div>
      </div>
    </div>
  );
}
