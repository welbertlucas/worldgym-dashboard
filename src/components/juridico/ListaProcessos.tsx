import { useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { cn } from "@/lib/utils";
import { type Ordem, type Processo, DIAS_PARADO, brl, dataBR, diasSemMovimento, ordenar, parado } from "@/data/juridico";

const POR_VEZ = 10;

/** A lista dos processos do filtro: número, empresa, órgão, tipo, polo, valor e última movimentação (os parados em destaque). */
export function ListaProcessos({ processos, hoje }: { processos: Processo[]; hoje: string }) {
  const [ordem, setOrdem] = useState<Ordem>("valor");
  const [quantos, setQuantos] = useState(POR_VEZ);
  const lista = ordenar(processos, ordem);
  const mostrados = lista.slice(0, quantos);
  return (
    <ChartCard
      title="Processos"
      subtitle={`${processos.length} no filtro atual. Sem andamento = última movimentação há mais de ${DIAS_PARADO} dias.`}
      legend={
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Ordenar por
          <select value={ordem} onChange={(e) => { setOrdem(e.target.value as Ordem); setQuantos(POR_VEZ); }} aria-label="Ordenar processos" className="h-9 rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="valor">Maior valor</option>
            <option value="parados">Mais tempo sem andamento</option>
            <option value="recentes">Movimentados há pouco</option>
          </select>
        </label>
      }
    >
      {processos.length === 0 ? (
        <ChartEmpty>Nenhum processo no filtro atual.</ChartEmpty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2 pr-3 font-medium">Processo</th><th className="px-3 py-2 font-medium">Empresa</th><th className="px-3 py-2 font-medium">Órgão e tipo</th><th className="px-3 py-2 font-medium">Polo</th><th className="px-3 py-2 text-right font-medium">Valor</th><th className="py-2 pl-3 font-medium">Última movimentação</th></tr>
              </thead>
              <tbody>
                {mostrados.map((p) => {
                  const dias = diasSemMovimento(p, hoje);
                  return (
                    <tr key={p.numero} className="border-t border-border align-top">
                      <td className="py-2.5 pr-3 tabular-nums text-foreground">{p.numero}<span className="block text-xs text-muted-foreground">{p.ano ?? ""}{p.arquivado ? " · arquivado" : p.status && p.status !== "Ativo" ? ` · ${p.status}` : ""}</span></td>
                      <td className="px-3 py-2.5 text-foreground">{p.empresa}</td>
                      <td className="px-3 py-2.5 text-foreground">{p.orgao || "—"}<span className="block text-xs text-muted-foreground">{p.tipo}</span></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.polo}<span className="block text-xs">{p.natureza === "judicial" ? "Judicial" : "Extrajudicial"}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{p.valor === null ? <span className="text-muted-foreground">{p.sigiloso ? "Sigiloso" : "—"}</span> : p.valor === 0 ? <span className="text-muted-foreground">Sem valor</span> : brl(p.valor)}</td>
                      <td className={cn("py-2.5 pl-3 tabular-nums", parado(p, hoje) ? "text-destructive" : "text-muted-foreground")}>{dataBR(p.ultimaMov)}{dias !== null && <span className="block text-xs">{dias === 0 ? "hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`}</span>}{dias === null && !p.arquivado && <span className="block text-xs">sem data</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {lista.length > quantos && (
            <button type="button" onClick={() => setQuantos((q) => q + POR_VEZ)} className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Ver mais ({lista.length - quantos})</button>
          )}
        </>
      )}
    </ChartCard>
  );
}
