import { Download } from "lucide-react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { corDaModalidade } from "@/components/royalties/cores";
import { cn } from "@/lib/utils";
import { type ContextoRoyalties, type FiltroRoyalties, MODALIDADE, brl, brl0, concentracao, csvDeDevedoras, devedoras, fraseDeConcentracao, pct, soma } from "@/data/royalties";

/** Baixa o CSV das devedoras do filtro atual (o mesmo arquivo que o painel original gera). */
function baixarCsv(c: ContextoRoyalties, f: FiltroRoyalties) {
  const blob = new Blob([csvDeDevedoras(c, f)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `devedoras-${c.m.pendencias.apuracao ?? "atual"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Quem está devendo: o saldo devedor total de cada unidade, em barras, com a composição e a observação da planilha. */
export function QuemDeve({ c, f, onUnidade }: { c: ContextoRoyalties; f: FiltroRoyalties; onUnidade?: (u: string) => void }) {
  const lista = devedoras(c, f);
  const k = concentracao(c, f);
  const frase = fraseDeConcentracao(k);
  const maiores = new Set(k.maiores);
  const total = soma(lista.map((d) => d.saldo));
  const maior = Math.max(1, ...lista.map((d) => d.saldo));
  const media = lista.length ? total / lista.length : 0;
  const apuracao = c.m.pendencias.apuracao;
  const modalidades = [...new Set(lista.map((d) => d.tipo))];
  return (
    <ChartCard
      title="Quem está devendo"
      subtitle={<>{`Saldo devedor por unidade, posição em ${apuracao ? c.rotulo[apuracao] ?? apuracao : "hoje"}. `}{lista.length > 0 && <>{frase.antes}{frase.destaque && <b className="font-semibold text-foreground">{frase.destaque}</b>}{frase.depois} Clique numa unidade para ver o detalhe.</>}</>}
      legend={
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {modalidades.map((m) => <span key={m} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: corDaModalidade(m) }} aria-hidden />{MODALIDADE[m]}</span>)}
          {lista.length > 0 && (
            <button type="button" onClick={() => baixarCsv(c, f)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Download className="h-3.5 w-3.5" aria-hidden />Exportar CSV
            </button>
          )}
        </div>
      }
    >
      {lista.length === 0 ? (
        <ChartEmpty>Nenhuma unidade com saldo devedor no filtro atual.</ChartEmpty>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <HeadlineStat label="Total em aberto" value={brl(total)} swatch={<span className="h-2 w-2 rounded-full bg-destructive" />} />
            <HeadlineStat label={`Maior: ${lista[0].unidade}`} value={brl0(lista[0].saldo)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/75" />} />
            <HeadlineStat label="Média por unidade devedora" value={brl0(media)} swatch={<span className="h-3 w-0 border-l-2 border-dashed border-foreground/60" />} />
          </div>
          <ol className="mt-5 space-y-1" aria-label="Unidades com saldo devedor, da maior para a menor">
            {lista.map((d, i) => (
              <li key={d.unidade}>
                <button
                  type="button"
                  onClick={() => onUnidade?.(d.unidade)}
                  className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:grid-cols-[1.75rem_12rem_minmax(0,1fr)_9.5rem] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-1 text-left hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${d.unidade}: deve ${brl0(d.saldo)}. Abrir o detalhe`}
                >
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums", i < 3 ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}>{i + 1}</span>
                  <span className="truncate text-sm font-medium text-foreground">{d.unidade}</span>
                  <span className="sm:order-4 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-foreground">{brl0(d.saldo)} <span className="text-xs font-normal text-muted-foreground">{pct(d.saldo / total)}</span></span>
                  <span className="relative col-span-3 h-5 rounded-md bg-secondary/70 sm:order-3 sm:col-span-1" aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${Math.max((d.saldo / maior) * 100, 0.8)}%`, background: corDaModalidade(d.tipo) }} />
                    <span className="absolute inset-y-[-4px] border-l-2 border-dashed border-foreground/50" style={{ left: `${(media / maior) * 100}%` }} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-3 border-l-2 border-dashed border-foreground/50" aria-hidden />média por unidade devedora ({brl0(media)})</p>
        </>
      )}
    </ChartCard>
  );
}
