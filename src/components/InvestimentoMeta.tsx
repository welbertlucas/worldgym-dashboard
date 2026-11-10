import { useEffect, useState } from "react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { carregarCampanhas, INSTITUCIONAL, investimentoDoMes, investimentoInstitucional, type FotoCampanhas } from "@/data/campanhas";
import { isPartialMonth } from "@/data/periods";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (n: number) => n.toLocaleString("pt-BR");
const nomeDoMes = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };

/** Investimento do Meta no mês (todas as campanhas, inclusive as pausadas), contatos e custo por contato. */
export function InvestimentoMeta({ unit, month }: { unit: string | null; month: string }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  const mes = foto?.meses?.[month];
  const subtitle = <>{unit ?? "Rede"} • {month ? nomeDoMes(month) : ""}{month && isPartialMonth(month) && " (mês em andamento: valores parciais)"}</>;
  const titulo = "Investimento no Meta";

  if (foto === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  const inv = investimentoDoMes(mes, unit);
  if (!mes || !inv) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>{mes ? `Sem investimento do Meta lido para ${unit === INSTITUCIONAL ? "a conta Institucional" : unit ?? "a rede"} neste mês.` : "O investimento do Meta deste mês ainda não foi lido."}</ChartEmpty></ChartCard>;

  const contatos = inv.leads + inv.conversas;
  const porUnidade = unit ? [] : Object.entries(mes.unidades)
    .filter(([n, v]) => n !== "Rede" && v.investimento > 0)
    .map(([nome, v]) => ({ nome, investimento: v.investimento, contatos: v.leads + v.conversas }))
    .sort((a, b) => b.investimento - a.investimento);
  const institucional = investimentoInstitucional(mes);

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Investido no mês" value={reais(inv.investimento)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Contatos" value={int(contatos)} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
          <HeadlineStat label="Custo por contato" value={contatos > 0 ? reais2(inv.investimento / contatos) : "—"} swatch={<span className="h-2 w-2 rounded-full bg-[#3b82f6]" />} />
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Leads</dt><dd className="tabular-nums text-foreground">{int(inv.leads)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Conversas iniciadas</dt><dd className="tabular-nums text-foreground">{int(inv.conversas)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Impressões</dt><dd className="tabular-nums text-foreground">{int(inv.impressoes)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Cliques</dt><dd className="tabular-nums text-foreground">{int(inv.cliques)}</dd></div>
      </dl>

      {porUnidade.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm" aria-label="Investimento do Meta por unidade, da que mais investiu para a que menos investiu">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5 font-medium">Unidade</th><th className="py-1.5 text-right font-medium">Investido</th><th className="py-1.5 text-right font-medium">Contatos</th><th className="py-1.5 text-right font-medium">Custo por contato</th></tr></thead>
            <tbody>
              {porUnidade.map((u) => (
                <tr key={u.nome} className="border-t border-border">
                  <td className="py-1.5 text-foreground">{u.nome}</td>
                  <td className="py-1.5 text-right tabular-nums">{reais(u.investimento)}</td>
                  <td className="py-1.5 text-right tabular-nums">{int(u.contatos)}</td>
                  <td className="py-1.5 text-right tabular-nums">{u.contatos > 0 ? reais2(u.investimento / u.contatos) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mes.erros.length ? <p className="mt-3 text-xs text-warning">{mes.erros.length} {mes.erros.length === 1 ? "conta de anúncio não pôde ser lida" : "contas de anúncio não puderam ser lidas"} neste mês; o investimento delas não entra.</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Investimento = todas as campanhas do mês no Meta, inclusive as já pausadas. Contato = lead ou conversa iniciada.
        {unit === INSTITUCIONAL ? " A conta Institucional anuncia para a rede toda e fica separada das unidades." : !unit && institucional > 0 ? ` A rede soma só as unidades; a conta Institucional (${reais(institucional)} no mês) fica separada: escolha "Institucional" para vê-la.` : ""}
      </p>
    </ChartCard>
  );
}
