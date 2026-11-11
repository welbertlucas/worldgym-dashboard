import { useEffect, useState } from "react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { carregarCampanhas, cpm, ctr, INSTITUCIONAL, investimentoDoMes, investimentoInstitucional, pctDoFaturamento, type FotoCampanhas } from "@/data/campanhas";
import { getDataByMonth } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (n: number) => n.toLocaleString("pt-BR");
const pctBr = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
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
  if (!mes || !inv) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>{mes ? `Sem investimento do Meta lido para ${unit === INSTITUCIONAL ? "a conta Institucional" : unit ?? "a rede"} neste mês${unit && mes.erros.length ? " (a conta de anúncio pode estar sem permissão de leitura)" : ""}.` : "O investimento do Meta deste mês ainda não foi lido."}</ChartEmpty></ChartCard>;

  const contatos = inv.leads + inv.conversas;
  const evo = getDataByMonth(month);
  const faturamentoDe = (nome: string) => evo?.units.find((u) => u.name === nome)?.faturamento;
  const pctFat = pctDoFaturamento(mes, unit, faturamentoDe);
  const compras = inv.compras ?? 0, valorCompras = inv.valorCompras ?? 0;
  const porUnidade = unit ? [] : Object.entries(mes.unidades)
    .filter(([n, v]) => n !== "Rede" && v.investimento > 0)
    .map(([nome, v]) => ({ nome, investimento: v.investimento, contatos: v.leads + v.conversas, compras: v.compras ?? 0, pct: pctDoFaturamento(mes, nome, faturamentoDe) }))
    .sort((a, b) => b.investimento - a.investimento);
  const institucional = investimentoInstitucional(mes);
  const comCompras = porUnidade.some((u) => u.compras > 0);

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Investido no mês" value={reais(inv.investimento)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Contatos" value={int(contatos)} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
          <HeadlineStat label="Custo por contato" value={contatos > 0 ? reais2(inv.investimento / contatos) : "—"} swatch={<span className="h-2 w-2 rounded-full bg-[#3b82f6]" />} />
          {pctFat !== null && <HeadlineStat label="Do faturamento" value={pctBr(pctFat)} swatch={<span className="h-2 w-2 rounded-full bg-warning" />} />}
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Leads</dt><dd className="tabular-nums text-foreground">{int(inv.leads)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Conversas iniciadas</dt><dd className="tabular-nums text-foreground">{int(inv.conversas)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Impressões</dt><dd className="tabular-nums text-foreground">{int(inv.impressoes)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Alcance (pessoas diferentes)</dt><dd className="tabular-nums text-foreground">{inv.alcance ? int(inv.alcance) : "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Vezes que cada pessoa viu</dt><dd className="tabular-nums text-foreground">{inv.alcance ? (inv.impressoes / inv.alcance).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Cliques</dt><dd className="tabular-nums text-foreground">{int(inv.cliques)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">CTR (cliques a cada 100 exibições)</dt><dd className="tabular-nums text-foreground">{pct(ctr(inv.cliques, inv.impressoes))}</dd></div>
        <div><dt className="text-xs text-muted-foreground">CPM (custo de mil exibições)</dt><dd className="tabular-nums text-foreground">{cpm(inv.investimento, inv.impressoes) === null ? "—" : reais2(cpm(inv.investimento, inv.impressoes)!)}</dd></div>
      </dl>

      {compras > 0 && (
        <div className="mt-5 rounded-lg bg-secondary/50 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Vendas online marcadas pelo pixel do Meta</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Vendas online</dt><dd className="tabular-nums font-semibold text-foreground">{int(compras)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Valor das vendas</dt><dd className="tabular-nums text-foreground">{valorCompras > 0 ? reais(valorCompras) : "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Custo por venda online</dt><dd className="tabular-nums font-semibold text-foreground">{reais2(inv.investimento / compras)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Retorno por R$ 1 investido</dt><dd className="tabular-nums text-foreground">{valorCompras > 0 && inv.investimento > 0 ? reais2(valorCompras / inv.investimento) : "—"}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">Valor = o que o site informa ao Meta no momento da compra. Só conta quem comprou no site depois de ver ou clicar num anúncio (até 7 dias do clique ou 1 dia da visualização, regra do Meta). Matrícula fechada na recepção ou pelo WhatsApp não entra, e bloqueios de rastreamento do celular e do navegador fazem o número sair menor que o real.</p>
        </div>
      )}

      {porUnidade.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm" aria-label="Investimento do Meta por unidade, da que mais investiu para a que menos investiu">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5 font-medium">Unidade</th><th className="py-1.5 text-right font-medium">Investido</th><th className="py-1.5 text-right font-medium">Contatos</th><th className="py-1.5 text-right font-medium">Custo por contato</th><th className="py-1.5 text-right font-medium">Do faturamento</th>{comCompras && <th className="py-1.5 text-right font-medium">Vendas online</th>}</tr></thead>
            <tbody>
              {porUnidade.map((u) => (
                <tr key={u.nome} className="border-t border-border">
                  <td className="py-1.5 text-foreground">{u.nome}</td>
                  <td className="py-1.5 text-right tabular-nums">{reais(u.investimento)}</td>
                  <td className="py-1.5 text-right tabular-nums">{int(u.contatos)}</td>
                  <td className="py-1.5 text-right tabular-nums">{u.contatos > 0 ? reais2(u.investimento / u.contatos) : "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{u.pct === null ? "—" : pctBr(u.pct)}</td>
                  {comCompras && <td className="py-1.5 text-right tabular-nums">{u.compras > 0 ? int(u.compras) : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!unit && mes.erros.length ? <p className="mt-3 text-xs text-warning">{mes.erros.length} {mes.erros.length === 1 ? "conta de anúncio não pôde ser lida" : "contas de anúncio não puderam ser lidas"} neste mês; o investimento delas não entra.</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Investimento = todas as campanhas do mês no Meta, inclusive as já pausadas. Contato = lead ou conversa iniciada.{inv.alcance && !unit ? " Alcance da rede = soma das unidades (quem viu anúncio de duas unidades conta duas vezes)." : ""}{pctFat !== null && <> Do faturamento = investido no Meta ÷ faturamento do mês no EVO{unit ? "" : " (na rede, só das unidades com conta de anúncio lida)"}.</>}
        {unit === INSTITUCIONAL ? " A conta Institucional anuncia para a rede toda e fica separada das unidades." : !unit && institucional > 0 ? ` A rede soma só as unidades; a conta Institucional (${reais(institucional)} no mês) fica separada: escolha "Institucional" para vê-la.` : ""}
      </p>
    </ChartCard>
  );
}
