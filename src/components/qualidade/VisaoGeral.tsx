import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { KpiGaugeCard } from "@/components/executiva/KpiGaugeCard";
import { type MetricDetail } from "@/components/MetricCard";
import { cn } from "@/lib/utils";
import { pedidosPendentes, DIAS_DA_MEDIA, DIAS_SEM_VISITA, NOTA_ATENCAO, NOTA_BOA, DIAS_AVISO_VENCIMENTO, type DadosQualidade, certificadosPorUnidade, dataBR, equipamentosParados, itensQueMaisFalham, pctTexto, resumoDaRede, resumoPorUnidade, tomDaNota } from "@/data/qualidade";
import { FotoGuardada } from "@/components/qualidade/Fotos";

const COR_TOM = { good: "bg-emerald-600", warn: "bg-amber-500", bad: "bg-destructive", neutral: "bg-foreground/30" } as const;
const neutro = (text: string): MetricDetail => ({ text, tone: "neutral" });

/** Visão da rede: cartões do Atlas, ranking de unidades pela nota média dos últimos 90 dias e os itens que mais falham. */
export function VisaoGeral({ dados, hoje, onUnidade, onPedidos }: { dados: DadosQualidade; hoje: string; onUnidade: (u: string) => void; onPedidos?: () => void }) {
  const r = resumoDaRede(dados.visitas, dados.unidades, hoje);
  const linhas = resumoPorUnidade(dados.visitas, dados.unidades, hoje);
  const falhos = itensQueMaisFalham(dados.visitas, hoje);
  const parados = equipamentosParados([...dados.visitas, ...(dados.envios ?? [])], hoje);
  const certificados = certificadosPorUnidade(dados.visitas, dados.unidades, hoje);
  const temCertificado = certificados.some((c) => c.vencimento);
  const totalUn = dados.unidades.length;
  const pendentes = pedidosPendentes(dados.pedidos).length;
  return (
    <div className="space-y-4">
      {onPedidos && pendentes > 0 && (
        <button type="button" onClick={onPedidos} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-left text-sm text-foreground hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span><b>{pendentes} {pendentes === 1 ? "pedido de item novo espera" : "pedidos de item novo esperam"}</b> a sua resposta.</span>
          <span className="shrink-0 font-semibold underline underline-offset-4">Ver pedidos</span>
        </button>
      )}
      <div className="card-surface overflow-hidden">
        <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
          <KpiGaugeCard title="Nota média da rede" value={pctTexto(r.notaMedia)} fill={(r.notaMedia ?? 0) / 100} marker={null} tone={tomDaNota(r.notaMedia)} details={[neutro(`Itens conformes, últimos ${DIAS_DA_MEDIA} dias`)]} />
          <KpiGaugeCard title="Visitas no mês" value={String(r.visitasNoMes)} fill={totalUn ? Math.min(1, r.visitasNoMes / totalUn) : 0} marker={null} tone="neutral" details={[neutro(`${totalUn} unidades na rede`)]} />
          <KpiGaugeCard title="Sem visita" value={`${r.semVisita} de ${totalUn}`} fill={totalUn ? r.semVisita / totalUn : 0} marker={null} tone={r.semVisita > 0 ? "bad" : "good"} details={[neutro(`Há mais de ${DIAS_SEM_VISITA} dias ou nunca visitadas`)]} />
          <KpiGaugeCard title="Equipamentos parados" value={String(parados.length)} fill={0} marker={null} tone={parados.length > 0 ? "warn" : "good"} details={[neutro(parados.length ? `${new Set(parados.map((p) => p.unidade)).size} unidade${new Set(parados.map((p) => p.unidade)).size === 1 ? "" : "s"}` : "Nenhum na última visita")]} />
          <KpiGaugeCard title="Itens não conformes" value={String(r.naoConformes)} fill={0} marker={null} tone={r.naoConformes > 0 ? "warn" : "good"} details={[neutro(`Nos últimos ${DIAS_DA_MEDIA} dias`)]} />
        </div>
      </div>

      <ChartCard title="Nota por unidade" subtitle={`Média das visitas dos últimos ${DIAS_DA_MEDIA} dias. Verde a partir de ${NOTA_BOA}%, amarelo a partir de ${NOTA_ATENCAO}%, vermelho abaixo.`}>
        <ol className="space-y-1" aria-label="Nota por unidade">
          {linhas.map((l, i) => (
            <li key={l.unidade}>
              <button type="button" onClick={() => onUnidade(l.unidade)} className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:grid-cols-[1.75rem_12rem_minmax(0,1fr)_11rem] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-1 text-left hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums", l.media !== null && i < 3 ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}>{i + 1}</span>
                <span className="truncate text-sm font-medium text-foreground">{l.unidade}</span>
                <span className="sm:order-4 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-foreground">
                  {l.media !== null ? pctTexto(l.media) : <span className="font-normal text-muted-foreground">{l.ultima ? "sem nota recente" : "sem visita"}</span>}
                  {l.ultima && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{dataBR(l.ultima.data)}</span>}
                </span>
                <span className="relative col-span-3 h-5 rounded-md bg-secondary/70 sm:order-3 sm:col-span-1" aria-hidden>
                  {l.media !== null && <span className={cn("absolute inset-y-0 left-0 rounded-md", COR_TOM[tomDaNota(l.media)])} style={{ width: `${Math.max(l.media, 1)}%` }} />}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </ChartCard>

      {parados.length > 0 && (
        <ChartCard title="Equipamentos parados" subtitle={`${parados.length} ${parados.length === 1 ? "equipamento parado" : "equipamentos parados"} no último registro de cada unidade (visita ou checklist da unidade). O prazo conta os registros seguidos em que o mesmo código apareceu.`}>
          <ul className="divide-y divide-border">
            {parados.map((p) => (
              <li key={`${p.unidade}|${p.codigo}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 text-sm"><span className="font-medium text-foreground">{p.unidade}</span> · <span className="text-foreground">{p.codigo}</span>{p.descricao && <span className="block text-xs text-muted-foreground">{p.descricao}</span>}</span>
                <span className="flex items-center gap-3">
                  {p.fotos[0] && <FotoGuardada id={p.fotos[0]} />}
                  <span className={cn("whitespace-nowrap text-right text-sm tabular-nums", p.dias > 30 ? "font-semibold text-destructive" : "text-foreground")}>{p.dias === 0 ? "visto hoje" : `${p.dias} dias`}<span className="block text-xs font-normal text-muted-foreground">desde {dataBR(p.desde)}{p.visitas > 1 ? ` · ${p.visitas} visitas` : ""}</span></span>
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      {temCertificado && (
        <ChartCard title="Certificado PJ do CREF" subtitle={`Vencimento informado na última visita de cada unidade. Atenção quando faltam ${DIAS_AVISO_VENCIMENTO} dias ou menos.`}>
          <ul className="divide-y divide-border">
            {certificados.map((c) => (
              <li key={c.unidade} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-medium text-foreground">{c.unidade}</span>
                {c.vencimento ? (
                  <span className={cn("whitespace-nowrap text-right tabular-nums", c.situacao === "vencido" ? "font-semibold text-destructive" : c.situacao === "a-vencer" ? "font-semibold text-warning" : "text-foreground")}>
                    {dataBR(c.vencimento)}<span className="ml-2 text-xs font-normal">{c.situacao === "vencido" ? `vencido há ${Math.abs(c.dias as number)} dias` : c.dias === 0 ? "vence hoje" : `faltam ${c.dias} dias`}</span>
                  </span>
                ) : <span className="text-muted-foreground">sem data registrada</span>}
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      <ChartCard title="Itens que mais falham" subtitle={`Entre as respostas dos últimos ${DIAS_DA_MEDIA} dias, os itens com mais "não conforme" em proporção.`}>
        {falhos.length === 0 ? (
          <ChartEmpty>Nenhum item não conforme nos últimos {DIAS_DA_MEDIA} dias.</ChartEmpty>
        ) : (
          <ul className="divide-y divide-border">
            {falhos.map((g) => (
              <li key={`${g.modelo}|${g.texto}`} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                <span className="min-w-0"><span className="text-foreground">{g.texto}</span><span className="block text-xs text-muted-foreground">{g.modelo}</span></span>
                <span className="shrink-0 whitespace-nowrap text-right tabular-nums text-foreground">{g.falhas} de {g.respondidas}<span className="block text-xs text-muted-foreground">{g.unidades} {g.unidades === 1 ? "unidade" : "unidades"}</span></span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
