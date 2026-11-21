import { HeadlineStat } from "@/components/ChartCard";
import { GoalRing } from "@/components/metas/GoalRing";
import { META_INDICATORS, formatMetaValue, type AcumuladoDoAno, type MetaKey } from "@/data/metas";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesNome = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1];
const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

/**
 * Quanto a rede já fez no ano: o acumulado de janeiro até o mês exibido, a variação sobre o mesmo período do ano anterior (só meses fechados) e,
 * ao lado, a rosca de progresso para a meta do ano (a soma das metas mensais cadastradas).
 */
export function AnoAcumulado({ a, metaKey }: { a: AcumuladoDoAno; metaKey: MetaKey }) {
  const rotulo = META_INDICATORS[metaKey].label;
  const ate = a.meses.filter((m) => m.realizado !== null).at(-1)!.month;
  const periodo = `janeiro a ${mesNome(ate)} de ${a.ano}`;
  const f = a.fechados;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-label={`${rotulo} no ano`}>
      <section className="card-surface p-5 sm:p-6">
        <h3 className="text-base font-semibold text-foreground">{rotulo} no ano — {a.ano}</h3>
        <p className="text-sm text-muted-foreground">Rede • {periodo}{a.parcial && ` (${mesNome(ate)} até agora)`}</p>
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
          <HeadlineStat label={`${rotulo} no ano`} value={formatMetaValue(metaKey, a.realizado)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
          {f.variacao !== null && f.ultimo && (
            <HeadlineStat
              label={`Meses fechados (jan a ${mesNome(f.ultimo).slice(0, 3)}) vs. ${Number(a.ano) - 1}`}
              value={`${f.variacao > 0 ? "+" : ""}${pct(f.variacao)}`}
              swatch={<span className={`h-2 w-2 rounded-full ${f.variacao >= 0 ? "bg-success" : "bg-destructive"}`} />}
            />
          )}
        </div>
        {f.variacao !== null && f.anoAnterior !== null && f.ultimo && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nos {f.n} {f.n === 1 ? "mês fechado" : "meses fechados"} (janeiro a {mesNome(f.ultimo)}) a rede fez <b className="text-foreground">{formatMetaValue(metaKey, f.realizado)}</b>, contra{" "}
            <b className="text-foreground">{formatMetaValue(metaKey, f.anoAnterior)}</b> no mesmo período de {Number(a.ano) - 1}.
          </p>
        )}
        {a.metaDoAno && a.mesesComMeta < 12 && (
          <p className="mt-2 text-xs text-muted-foreground">A meta do ano soma as metas cadastradas de {a.mesesComMeta} {a.mesesComMeta === 1 ? "mês" : "meses"}; ela cresce conforme os outros meses forem cadastrados.</p>
        )}
      </section>
      {a.metaDoAno ? (
        <GoalRing metaKey={metaKey} actual={a.realizado} meta={a.metaDoAno} partial={a.parcial} title={`Meta do ano — ${rotulo}`} subtitle={`Rede • ${periodo}, contra a soma das metas mensais de ${a.ano}`} />
      ) : (
        <section className="card-surface flex items-center p-5 text-sm text-muted-foreground sm:p-6">Ainda não há metas mensais cadastradas para a rede em {a.ano}.</section>
      )}
    </div>
  );
}
