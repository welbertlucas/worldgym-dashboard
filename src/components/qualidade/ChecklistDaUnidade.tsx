import { useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FREQUENCIA_ROTULO, PRAZO_DIAS, type DadosQualidade, dataBR, rotinaDasUnidades } from "@/data/qualidade";
import { Detalhe } from "@/components/qualidade/Visitas";
import { NovaVisita } from "@/components/qualidade/NovaVisita";
import { PedidosDaUnidade } from "@/components/qualidade/PedidosDaUnidade";

/** O que a unidade vê no menu Qualidade: os checklists dela, se estão em dia, o formulário e os próprios envios dos últimos 30 dias (nada de nota, visitas ou outras unidades). */
export function ChecklistDaUnidade({ dados, hoje, onMudou }: { dados: DadosQualidade; hoje: string; onMudou: () => void }) {
  const [preenchendo, setPreenchendo] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const envios = [...(dados.envios ?? [])].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const rotina = rotinaDasUnidades(envios, dados.modelos, dados.unidades, hoje);
  const nomeDaUnidade = dados.unidades.length === 1 ? dados.unidades[0] : "";
  return (
    <div className="space-y-4">
      {preenchendo ? (
        <>
          <NovaVisita dados={dados} hoje={hoje} modo="unidade" onSalvou={() => { setPreenchendo(false); onMudou(); }} />
          <Button variant="ghost" onClick={() => setPreenchendo(false)}>Voltar</Button>
        </>
      ) : (
        <ChartCard title={nomeDaUnidade ? `Checklists de ${nomeDaUnidade}` : "Checklists da sua unidade"} subtitle="Os checklists que a unidade preenche e a situação de cada um." legend={rotina.length > 0 ? <Button size="sm" onClick={() => setPreenchendo(true)}>Preencher agora</Button> : undefined}>
          {rotina.length === 0 ? (
            <ChartEmpty>Ainda não há checklist disponível para a sua unidade.</ChartEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {rotina.map((l) => (
                <li key={`${l.unidade}|${l.modeloId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0 text-sm"><span className="font-medium text-foreground">{l.modeloNome}</span>{dados.unidades.length > 1 && <span className="text-muted-foreground"> · {l.unidade}</span>}<span className="block text-xs text-muted-foreground">{FREQUENCIA_ROTULO[l.frequencia].replace(" (a unidade preenche)", "")}</span></span>
                  <span className={cn("text-right text-sm", l.situacao === "em-dia" ? "text-emerald-700" : "font-semibold text-destructive")}>
                    {l.situacao === "nunca" ? "Ainda não enviado" : l.situacao === "em-dia" ? (l.dias === 0 ? "Enviado hoje" : `Enviado há ${l.dias} dia${l.dias === 1 ? "" : "s"}`) : `Atrasado: último envio ${dataBR(l.ultimo!.data)}`}
                    <span className="block text-xs font-normal text-muted-foreground">{l.frequencia === "diaria" ? "todo dia" : `a cada ${PRAZO_DIAS[l.frequencia]} dias`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      )}
      {!preenchendo && <PedidosDaUnidade dados={dados} onMudou={onMudou} />}
      {!preenchendo && (
        <ChartCard title="Seus envios" subtitle="Os últimos 30 dias. Clique para ver as respostas e as fotos.">
          {envios.length === 0 ? (
            <ChartEmpty>Nenhum envio nos últimos 30 dias.</ChartEmpty>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border">
              {envios.map((v) => (
                <li key={v.id} className="border-b border-border last:border-b-0">
                  <button type="button" aria-expanded={aberta === v.id} onClick={() => setAberta(aberta === v.id ? null : v.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">{dataBR(v.data)}</span>
                    <span className="min-w-0 flex-1 text-sm"><span className="font-medium text-foreground">{v.modeloNome}</span><span className="block text-xs text-muted-foreground">{v.avaliador.nome}</span></span>
                    <span className={cn("shrink-0 text-xs", v.respostas.some((r) => r.conforme === false) ? "font-semibold text-warning" : "text-muted-foreground")}>{v.respostas.filter((r) => r.conforme === false).length > 0 ? `${v.respostas.filter((r) => r.conforme === false).length} não conformes` : "Tudo conforme"}</span>
                  </button>
                  {aberta === v.id && <Detalhe v={v} />}
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      )}
    </div>
  );
}
