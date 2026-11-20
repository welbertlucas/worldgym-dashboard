import { Notice } from "@/components/Notice";
import { ChartCard } from "@/components/ChartCard";
import { type ContextoRoyalties, type FiltroRoyalties, brl, brl0, fraseDeAbertura, naoMapeadoNo, periodo, pct, resumoDoPeriodo } from "@/data/royalties";
import { COR_FIXA, COR_ROYALTIES } from "@/components/royalties/cores";

function Numero({ rotulo, valor, apoio, cor, destaque }: { rotulo: string; valor: string; apoio?: React.ReactNode; cor?: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">{cor && <span className="h-2 w-2 rounded-full" style={{ background: cor }} aria-hidden />}<span className="truncate">{rotulo}</span></p>
      <p className={`mt-1 font-display text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums ${destaque ? "text-destructive" : "text-foreground"}`}>{valor}</p>
      {apoio && <p className="mt-1.5 text-xs text-muted-foreground">{apoio}</p>}
    </div>
  );
}

/** Abertura do menu: a frase do período e os números que ela resume (recebido, modalidades, saldo devedor e inadimplentes). */
export function ResumoRoyalties({ c, f }: { c: ContextoRoyalties; f: FiltroRoyalties }) {
  const ks = periodo(c, f);
  const r = resumoDoPeriodo(c, f);
  const parciais = ks.filter((k) => c.parcial.has(k));
  const nm = naoMapeadoNo(c, ks);
  const mostrarFixa = f.tipo !== "royalties" && r.unidades.some((u) => c.tipoDe[u] === "fixa");
  const mostrarRoy = f.tipo !== "fixa" && r.unidades.some((u) => c.tipoDe[u] === "royalties");
  const apuracao = c.m.pendencias.apuracao;
  const parteDoTotal = (v: number) => (r.total > 0 ? `${pct(v / r.total)} do total` : undefined);
  return (
    <ChartCard title="Resumo" subtitle="Recebimentos da marca (taxa fixa e royalties) e saldo devedor por unidade">
      <p className="text-lg font-semibold leading-snug text-foreground sm:text-xl">{fraseDeAbertura(c, f, r)}</p>
      {(parciais.length > 0 || (nm > 0 && !f.unidades.length && f.tipo !== "royalties")) && (
        <div className="mt-3 space-y-2">
          {parciais.length > 0 && <Notice>{parciais.map((k) => c.rotulo[k]).join(", ")} ainda é parcial: o extrato do mês veio incompleto. Esses meses aparecem com asterisco e hachurados nos gráficos.</Notice>}
          {nm > 0 && !f.unidades.length && f.tipo !== "royalties" && <Notice>Inclui {brl(nm)} sem unidade identificada, que não entra em nenhuma unidade.</Notice>}
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Numero rotulo="Total recebido" valor={brl(r.total)} apoio={`${c.rotulo[ks[0]]} a ${c.rotulo[ks[ks.length - 1]]}`} />
        {mostrarFixa && <Numero rotulo="Taxa fixa" valor={brl(r.fixa)} cor={COR_FIXA} apoio={parteDoTotal(r.fixa)} />}
        {mostrarRoy && <Numero rotulo="Royalties" valor={brl(r.royalties)} cor={COR_ROYALTIES} apoio={parteDoTotal(r.royalties)} />}
        {r.cobradas.length > 0 && (
          <Numero rotulo="Saldo devedor total" valor={brl(r.saldoTotal)} destaque={r.saldoTotal > 0}
            apoio={r.saldoTotal > 0 ? `Taxa fixa ${brl0(r.saldoFixa)} · royalties ${brl0(r.saldoRoyalties)}${apuracao ? `, posição em ${c.rotulo[apuracao] ?? apuracao}` : ""}` : "Tudo em dia"} />
        )}
        {r.cobradas.length > 0 && <Numero rotulo="Unidades inadimplentes" valor={`${r.devedoras.length} de ${r.cobradas.length}`} apoio="Unidades com cobrança fixa ou royalties esperados" />}
      </div>
    </ChartCard>
  );
}
