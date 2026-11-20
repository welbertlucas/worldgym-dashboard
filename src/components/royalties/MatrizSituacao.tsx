import { useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { corDaModalidade } from "@/components/royalties/cores";
import { cn } from "@/lib/utils";
import { type ContextoRoyalties, type FiltroRoyalties, type Situacao, MODALIDADE, brl, brl0, matrizDeSituacao, periodo } from "@/data/royalties";

const SIT: Record<Situacao, { marca: string; texto: string; classe: string }> = {
  pago: { marca: "✓", texto: "Pago", classe: "bg-emerald-100 text-emerald-800" },
  pago2x: { marca: "2×", texto: "Pago 2x, compensa atraso", classe: "bg-emerald-200 text-emerald-900" },
  naopago: { marca: "✕", texto: "Não pago", classe: "bg-red-100 text-red-800" },
  na: { marca: "–", texto: "Ainda não devido", classe: "bg-secondary text-muted-foreground" },
};

/** Situação de pagamento mês a mês: uma linha por unidade com cobrança, em ordem de saldo devedor. Usa o mesmo período do filtro do topo. */
export function MatrizSituacao({ c, f, onUnidade }: { c: ContextoRoyalties; f: FiltroRoyalties; onUnidade?: (u: string) => void }) {
  const [todos, setTodos] = useState(false);
  const periodoTodo = periodo(c, f);
  const ks = todos ? periodoTodo : periodoTodo.slice(-12);
  const linhas = matrizDeSituacao(c, f, ks);
  return (
    <ChartCard
      title="Situação de pagamento mês a mês"
      subtitle={`${todos || periodoTodo.length <= 12 ? "Todos os meses do período" : "Últimos 12 meses do período"}. Mostra o que está nas células da planilha de controle, sem recalcular`}
      legend={
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(["pago", "naopago"] as const).map((s) => <span key={s} className="flex items-center gap-1.5"><span className={cn("inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-semibold", SIT[s].classe)} aria-hidden>{SIT[s].marca}</span>{SIT[s].texto}</span>)}
        </div>
      }
    >
      {linhas.length === 0 ? (
        <ChartEmpty>Nenhuma unidade com cobrança no período e nos filtros escolhidos.</ChartEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-xs" aria-label="Situação de pagamento por unidade e mês">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-medium text-muted-foreground">Unidade</th>
                {ks.map((k) => <th key={k} scope="col" className={cn("px-1 py-1 text-center font-medium whitespace-nowrap", c.parcial.has(k) ? "text-warning" : "text-muted-foreground")}>{c.rotulo[k]}{c.parcial.has(k) ? "*" : ""}</th>)}
                <th scope="col" className="px-2 py-1 text-right font-medium text-muted-foreground whitespace-nowrap">Não pagos</th>
                <th scope="col" className="px-2 py-1 text-right font-medium text-muted-foreground">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.unidade}>
                  <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-medium whitespace-nowrap text-foreground">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: corDaModalidade(l.tipo) }} title={MODALIDADE[l.tipo]} aria-hidden /><button type="button" onClick={() => onUnidade?.(l.unidade)} className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">{l.unidade}</button>
                  </th>
                  {l.celulas.map((x) => (
                    <td
                      key={x.key}
                      className={cn("h-6 min-w-6 rounded text-center font-semibold", x.situacao === "na" ? "bg-transparent" : SIT[x.situacao].classe, c.parcial.has(x.key) && "opacity-70")}
                      title={`${l.unidade}, ${c.rotulo[x.key]}: ${SIT[x.situacao].texto}${x.devido ? ` · devido ${brl(x.devido)}` : ""} · recebido ${brl(x.recebido)}${c.parcial.has(x.key) ? " · mês parcial" : ""}${x.ajuste ? " · ajuste manual" : ""}`}
                      aria-label={`${c.rotulo[x.key]}: ${SIT[x.situacao].texto}`}
                    >{x.situacao === "na" ? "" : SIT[x.situacao].marca}</td>
                  ))}
                  <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{l.naoPagos ?? ""}</td>
                  <td className={cn("px-2 py-1 text-right tabular-nums", l.saldo > 0.005 ? "font-semibold text-destructive" : "text-muted-foreground")}>{brl0(l.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {periodoTodo.length > 12 && (
        <button type="button" onClick={() => setTodos((v) => !v)} className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          {todos ? "Ver só os últimos 12 meses" : `Ver os ${periodoTodo.length} meses do período`}
        </button>
      )}
    </ChartCard>
  );
}
