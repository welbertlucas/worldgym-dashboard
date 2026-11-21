import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { KpiGaugeCard } from "@/components/executiva/KpiGaugeCard";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FREQUENCIA_ROTULO, PRAZO_DIAS, type DadosQualidade, dataBR, rotinaDasUnidades } from "@/data/qualidade";
import { apagarEnvio } from "@/lib/qualidade";
import { Detalhe } from "@/components/qualidade/Visitas";

/** Acompanhamento dos checklists que as unidades preenchem (abertura etc.): quem enviou, quem está atrasado e o que veio não conforme. Não entra na nota. */
export function Rotina({ dados, hoje, podeApagar = true, onMudou }: { dados: DadosQualidade; hoje: string; podeApagar?: boolean; onMudou: () => void }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const linhas = rotinaDasUnidades(dados.envios ?? [], dados.modelos, dados.unidades, hoje);
  if (linhas.length === 0) return <ChartCard title="Rotina das unidades"><ChartEmpty>Nenhum checklist de unidade ainda. Na aba Checklists, use o "checklist de abertura sugerido" (ou crie um com frequência diária, semanal ou mensal) e libere o preenchimento para a unidade na tela Usuários.</ChartEmpty></ChartCard>;
  const atrasadas = linhas.filter((l) => l.situacao !== "em-dia").length;
  const comProblema = linhas.filter((l) => l.naoConformes > 0 && l.situacao !== "nunca").length;
  const apagar = async (id: string, mes: string) => {
    if (!window.confirm("Apagar este envio? As fotos também serão apagadas e isso não dá para desfazer.")) return;
    const r = await apagarEnvio(id, mes);
    if (!r.ok) return toast({ title: "Não consegui apagar", description: r.erro, variant: "destructive" });
    setAberta(null);
    onMudou();
  };
  return (
    <div className="space-y-4">
      <div className="card-surface overflow-hidden">
        <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-3">
          <KpiGaugeCard title="Em dia" value={`${linhas.length - atrasadas} de ${linhas.length}`} fill={(linhas.length - atrasadas) / linhas.length} marker={null} tone={atrasadas === 0 ? "good" : "neutral"} details={[{ text: "Unidades que enviaram dentro do prazo", tone: "neutral" }]} />
          <KpiGaugeCard title="Atrasadas ou sem envio" value={String(atrasadas)} fill={atrasadas / linhas.length} marker={null} tone={atrasadas > 0 ? "bad" : "good"} details={[{ text: "Prazo: diária 1 dia, semanal 7, mensal 31", tone: "neutral" }]} />
          <KpiGaugeCard title="Último envio com não conformes" value={String(comProblema)} fill={comProblema / linhas.length} marker={null} tone={comProblema > 0 ? "warn" : "good"} details={[{ text: "Itens marcados como não conformes", tone: "neutral" }]} />
        </div>
      </div>
      <ChartCard title="Rotina das unidades" subtitle="Último envio de cada checklist que a unidade preenche. Não entra na nota nem no ranking. Clique numa linha para ver as respostas e as fotos.">
        <ul className="overflow-hidden rounded-xl border border-border">
          {linhas.map((l) => {
            const id = `${l.unidade}|${l.modeloId}`;
            return (
              <li key={id} className="border-b border-border last:border-b-0">
                <button type="button" disabled={!l.ultimo} aria-expanded={aberta === id} onClick={() => setAberta(aberta === id ? null : id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left enabled:hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0 flex-1 text-sm"><span className="font-medium text-foreground">{l.unidade}</span><span className="block truncate text-xs text-muted-foreground">{l.modeloNome} · {FREQUENCIA_ROTULO[l.frequencia]}</span></span>
                  <span className="w-44 text-sm tabular-nums text-muted-foreground">{l.ultimo ? `${dataBR(l.ultimo.data)} · ${l.ultimo.avaliador.nome || "—"}` : "Nunca enviou"}</span>
                  <span className={cn("w-28 text-right text-xs font-semibold", l.situacao === "em-dia" ? "text-emerald-700" : "text-destructive")}>
                    {l.situacao === "em-dia" ? "Em dia" : l.situacao === "nunca" ? "Sem envio" : `Atrasada ${(l.dias ?? 0) - PRAZO_DIAS[l.frequencia]} ${(l.dias ?? 0) - PRAZO_DIAS[l.frequencia] === 1 ? "dia" : "dias"}`}
                  </span>
                  <span className={cn("w-28 text-right text-xs", l.naoConformes > 0 ? "font-semibold text-warning" : "text-muted-foreground")}>{l.ultimo ? (l.naoConformes > 0 ? `${l.naoConformes} não ${l.naoConformes === 1 ? "conforme" : "conformes"}` : "Tudo conforme") : ""}</span>
                </button>
                {aberta === id && l.ultimo && <Detalhe v={l.ultimo} onApagar={podeApagar ? () => void apagar(l.ultimo!.id, l.ultimo!.mes) : undefined} />}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Se a unidade enviou mais de uma vez no dia, vale o último envio.</p>
      </ChartCard>
    </div>
  );
}
