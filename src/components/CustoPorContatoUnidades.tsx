import { useEffect, useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { carregarCampanhas, type FotoCampanhas, type MesMeta } from "@/data/campanhas";
import { isPartialMonth } from "@/data/periods";
import { cn } from "@/lib/utils";

const reais2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomeDoMes = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };
/** Abaixo disto o custo por contato oscila demais para comparar (poucos contatos): a barra fica em cinza claro. */
export const MIN_CONTATOS = 10;

export interface LinhaCusto { nome: string; custo: number; contatos: number; investimento: number }

/** Custo por contato (lead ou conversa) de cada unidade, do mais barato ao mais caro, e a média da rede (investimento ÷ contatos de todas). */
export function custosPorUnidade(mes: MesMeta | undefined): { linhas: LinhaCusto[]; semContato: string[]; media: number | null } {
  const todas = Object.entries(mes?.unidades ?? {}).filter(([n, v]) => n !== "Rede" && v.investimento > 0);
  const linhas = todas.map(([nome, v]) => ({ nome, investimento: v.investimento, contatos: v.leads + v.conversas }))
    .filter((u) => u.contatos > 0).map((u) => ({ ...u, custo: u.investimento / u.contatos })).sort((a, b) => a.custo - b.custo);
  const semContato = todas.filter(([, v]) => v.leads + v.conversas === 0).map(([n]) => n).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const inv = linhas.reduce((s, l) => s + l.investimento, 0), cont = linhas.reduce((s, l) => s + l.contatos, 0);
  return { linhas, semContato, media: cont > 0 ? inv / cont : null };
}

/** Quanto cada unidade paga por contato no Meta no mês, com a média da rede como referência. Só faz sentido para a rede (sem unidade escolhida). */
export function CustoPorContatoUnidades({ unit, month }: { unit: string | null; month: string }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  if (unit) return null;
  const titulo = "Custo por contato por unidade";
  const subtitle = <>Rede • {month ? nomeDoMes(month) : ""}{month && isPartialMonth(month) && " (mês em andamento: valores parciais)"}</>;
  if (foto === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  const { linhas, semContato, media } = custosPorUnidade(foto?.meses?.[month]);
  if (linhas.length === 0 || media === null) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Sem contatos do Meta por unidade neste mês.</ChartEmpty></ChartCard>;
  const maior = Math.max(...linhas.map((l) => l.custo), media);
  const posMedia = `${(media / maior) * 100}%`;
  return (
    <ChartCard title={titulo} subtitle={subtitle}>
      <div className="relative">
        <ol className="space-y-2" aria-label="Custo por contato de cada unidade, do mais barato para o mais caro">
          {linhas.map((l) => {
            const pouco = l.contatos < MIN_CONTATOS;
            const caro = l.custo > media * 1.25;
            return (
              <li key={l.nome} className="grid grid-cols-[8.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_5rem]">
                <span className={cn("truncate text-foreground", pouco && "text-muted-foreground")} title={`${l.nome} · ${l.contatos.toLocaleString("pt-BR")} contatos`}>{l.nome}</span>
                <div className="h-2.5 rounded-full bg-secondary" aria-hidden>
                  <div className={cn("h-full rounded-full", pouco ? "bg-foreground/20" : caro ? "bg-primary" : "bg-foreground/70")} style={{ width: `${Math.max((l.custo / maior) * 100, 1.5)}%` }} />
                </div>
                <span className={cn("text-right font-semibold tabular-nums", pouco ? "text-muted-foreground" : "text-foreground")}>{reais2(l.custo)}</span>
              </li>
            );
          })}
        </ol>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[8.5rem] right-[4.5rem] sm:left-[11rem] sm:right-[5rem]">
          <div className="absolute inset-y-0 border-l border-dashed border-foreground/50" style={{ left: posMedia, marginLeft: "0.75rem" }} />
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground">Média da rede: <span className="font-semibold tabular-nums">{reais2(media)}</span> por contato <span className="text-muted-foreground">(linha tracejada)</span></p>
      <p className="mt-1 text-xs text-muted-foreground">
        Do mais barato ao mais caro. Em carmim, as unidades mais de 25% acima da média; em cinza claro, as com menos de {MIN_CONTATOS} contatos no mês, em que o custo oscila muito. Contato = lead ou conversa iniciada.
        {semContato.length > 0 && <> Investiram sem registrar contato: {semContato.join(", ")}.</>}
      </p>
    </ChartCard>
  );
}
