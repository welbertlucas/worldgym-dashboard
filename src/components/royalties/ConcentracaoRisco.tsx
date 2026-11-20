import { useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { corDaModalidade } from "@/components/royalties/cores";
import { cn } from "@/lib/utils";
import { type ContextoRoyalties, type FiltroRoyalties, type LinhaConcentracao, brl, brl0, concentracao, fraseDeConcentracao, pct, soma } from "@/data/royalties";

/** Faixa proporcional: um pedaço por unidade, na cor da modalidade; no saldo, as três maiores ganham contorno escuro. */
function Faixa({ linhas, valor, total, destaques }: { linhas: LinhaConcentracao[]; valor: (x: LinhaConcentracao) => number; total: number; destaques?: Set<string> }) {
  const partes = linhas.filter((x) => valor(x) > 0).sort((a, b) => valor(b) - valor(a));
  return (
    <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Participação de cada unidade: ${partes.map((x) => `${x.unidade} ${pct(valor(x) / total)}`).join(", ")}`}>
      {partes.map((x) => (
        <span
          key={x.unidade}
          className={cn("h-full", destaques?.has(x.unidade) && "ring-1 ring-inset ring-foreground")}
          style={{ flex: valor(x), background: corDaModalidade(x.tipo) }}
          title={`${x.unidade}: ${brl(valor(x))} (${pct(valor(x) / total)})`}
        />
      ))}
    </div>
  );
}

/** Concentração e risco: quanto cada unidade pesa no recebido e no saldo devedor, e quanto as três maiores devedoras concentram. */
export function ConcentracaoRisco({ c, f }: { c: ContextoRoyalties; f: FiltroRoyalties }) {
  const [todas, setTodas] = useState(false);
  const k = concentracao(c, f);
  const frase = fraseDeConcentracao(k);
  const destaques = new Set(k.maiores);
  const linhas = [...k.comSaldo, ...(todas || !k.comSaldo.length ? k.semSaldo : [])];
  let acumulado = 0;
  return (
    <ChartCard title="Concentração e risco" subtitle="Participação de cada unidade no que entrou e no que falta entrar">
      {k.comSaldo.length === 0 && k.totalRecebido === 0 ? (
        <ChartEmpty>Sem recebimentos nem saldo devedor no filtro atual.</ChartEmpty>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-snug text-foreground">{frase.antes}{frase.destaque && <b className="font-semibold">{frase.destaque}</b>}{frase.depois}</p>
          <div className="space-y-3">
            {k.totalRecebido > 0 && (
              <div>
                <p className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Recebido no período</span><span className="tabular-nums">{brl0(k.totalRecebido)}</span></p>
                <Faixa linhas={[...k.comSaldo, ...k.semSaldo]} valor={(x) => x.recebido} total={k.totalRecebido} />
              </div>
            )}
            {k.totalSaldo > 0 && (
              <div>
                <p className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Saldo devedor (contorno escuro = 3 maiores)</span><span className="tabular-nums">{brl0(k.totalSaldo)}</span></p>
                <Faixa linhas={k.comSaldo} valor={(x) => x.saldo} total={k.totalSaldo} destaques={destaques} />
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Peso de cada unidade no recebido e no saldo devedor">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-2 text-left font-medium">Unidade</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">% do recebido</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">% do saldo</th>
                  <th scope="col" className="py-1.5 pl-2 text-right font-medium">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((x) => {
                  const devedora = x.saldo > 0.005;
                  const parte = k.totalSaldo ? x.saldo / k.totalSaldo : 0;
                  if (devedora) acumulado += parte;
                  return (
                    <tr key={x.unidade} className={cn("border-t border-border", destaques.has(x.unidade) && "bg-destructive/5")}>
                      <th scope="row" className="py-1.5 pr-2 text-left font-medium text-foreground">{x.unidade}</th>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{k.totalRecebido ? pct(x.recebido / k.totalRecebido) : "—"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{devedora ? pct(parte) : "—"}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums text-muted-foreground">{devedora ? pct(acumulado) : ""}</td>
                    </tr>
                  );
                })}
                {k.comSaldo.length > 0 && k.semSaldo.length > 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={4} className="py-1.5">
                      <button type="button" onClick={() => setTodas((v) => !v)} aria-expanded={todas} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                        {todas ? `Ocultar as ${k.semSaldo.length} sem saldo` : `+${k.semSaldo.length} ${k.semSaldo.length === 1 ? "unidade" : "unidades"} sem saldo (${k.totalRecebido ? pct(soma(k.semSaldo.map((x) => x.recebido)) / k.totalRecebido) : "0%"} do recebido)`}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
