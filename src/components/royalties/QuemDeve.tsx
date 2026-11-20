import { Download } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { corDaModalidade } from "@/components/royalties/cores";
import { type ContextoRoyalties, type FiltroRoyalties, MODALIDADE, brl, brl0, componentesDoSaldo, csvDeDevedoras, devedoras, pct, soma } from "@/data/royalties";

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
export function QuemDeve({ c, f }: { c: ContextoRoyalties; f: FiltroRoyalties }) {
  const lista = devedoras(c, f);
  const total = soma(lista.map((d) => d.saldo));
  const maior = Math.max(1, ...lista.map((d) => d.saldo));
  const apuracao = c.m.pendencias.apuracao;
  const modalidades = [...new Set(lista.map((d) => d.tipo))];
  return (
    <ChartCard
      title="Quem está devendo"
      subtitle={`Saldo devedor total por unidade, posição em ${apuracao ? c.rotulo[apuracao] ?? apuracao : "hoje"}`}
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
        <ol className="space-y-3" aria-label="Unidades com saldo devedor, da maior para a menor">
          {lista.map((d) => (
            <li key={d.unidade} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-foreground" title={d.linha.obs || undefined}>{d.unidade}</span>
                <span className="shrink-0 tabular-nums text-foreground">{brl0(d.saldo)} <span className="text-xs text-muted-foreground">({pct(d.saldo / total)})</span></span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden><div className="h-full rounded-full" style={{ width: `${(d.saldo / maior) * 100}%`, background: corDaModalidade(d.tipo) }} /></div>
              {(componentesDoSaldo(d.linha) || d.linha.obs) && (
                <p className="mt-1 text-xs text-muted-foreground">{componentesDoSaldo(d.linha)}{componentesDoSaldo(d.linha) && d.linha.obs ? " · " : ""}{d.linha.obs}</p>
              )}
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 border-t border-border pt-3 text-sm font-medium">
            <span className="text-foreground">Total em aberto</span>
            <span className="tabular-nums text-foreground">{brl(total)}</span>
          </li>
        </ol>
      )}
    </ChartCard>
  );
}
