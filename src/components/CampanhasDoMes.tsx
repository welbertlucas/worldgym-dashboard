import { useEffect, useMemo, useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { campanhasDoMesDaEscolha, carregarCampanhas, INSTITUCIONAL, nomeDoObjetivo, type FotoCampanhas } from "@/data/campanhas";
import { isPartialMonth } from "@/data/periods";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (n: number) => n.toLocaleString("pt-BR");
const nomeDoMes = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };

/**
 * Campanhas do mês: cada campanha que gastou no mês escolhido (inclusive as já pausadas), com investimento, contatos e
 * custo por contato. Completa o "Investimento no Meta" (o total) mostrando de onde veio cada real.
 */
export function CampanhasDoMes({ unit, month }: { unit: string | null; month: string }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  const [todas, setTodas] = useState(false);
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  const lista = useMemo(() => campanhasDoMesDaEscolha(foto?.meses?.[month], unit), [foto, month, unit]);
  const titulo = "Campanhas do mês";
  const subtitle = <>{unit ?? "Rede"} • {nomeDoMes(month)}{isPartialMonth(month) && " (até ontem)"}</>;

  if (foto === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (lista === null) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>A lista por campanha ainda não foi lida para este mês.</ChartEmpty></ChartCard>;
  if (!lista.length) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>{`Nenhuma campanha com gasto ${unit === INSTITUCIONAL ? "na conta Institucional" : unit ? `em ${unit}` : "na rede"} neste mês.`}</ChartEmpty></ChartCard>;

  const total = lista.reduce((s, c) => s + c.investimento, 0);
  const visiveis = todas ? lista : lista.slice(0, 10);
  return (
    <ChartCard title={titulo} subtitle={subtitle}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">Campanha</th>
              <th scope="col" className="py-2 px-3 text-right font-medium">Investido</th>
              <th scope="col" className="py-2 px-3 text-right font-medium">Contatos</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Custo por contato</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => {
              const contatos = c.leads + c.conversas;
              return (
                <tr key={`${c.conta}-${c.id}`} className="border-b border-border/60 last:border-0 align-top">
                  <td className="py-2.5 pr-3">
                    <span className="block font-medium text-foreground">{c.nome}</span>
                    <span className="block text-xs text-muted-foreground">{!unit && <>{c.unidade ?? INSTITUCIONAL} · </>}{nomeDoObjetivo(c.objetivo)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <span className="font-semibold text-foreground">{reais(c.investimento)}</span>
                    <span className="block text-xs text-muted-foreground">{total > 0 ? `${Math.round((c.investimento / total) * 100)}% do total` : ""}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{contatos > 0 ? int(contatos) : "—"}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{contatos > 0 ? reais2(c.investimento / contatos) : "sem contatos"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lista.length > 10 && <button type="button" onClick={() => setTodas(!todas)} className="mt-3 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">{todas ? "Ver só as 10 que mais gastaram" : `Ver todas as ${lista.length} campanhas`}</button>}
      <p className="mt-3 text-xs text-muted-foreground">Todas as campanhas que gastaram no mês, inclusive as que já foram pausadas. Contatos = leads e conversas iniciadas.</p>
    </ChartCard>
  );
}
