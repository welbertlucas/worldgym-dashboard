import { useEffect, useMemo, useState } from "react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { carregarCampanhas, investimentoDoMes, origemMeta, retornoDoMeta, type FotoCampanhas } from "@/data/campanhas";
import { getDataByMonth, ltv, type UnitData } from "@/data/dashboardData";
import { isPartialMonth } from "@/data/periods";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pctRoi = (r: number | null) => (r === null ? "—" : `${r >= 0 ? "+" : ""}${Math.round(r * 100).toLocaleString("pt-BR")}%`);
const nomeDoMes = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };

/** Uma linha do CAC/ROI: investimento do Meta no mês cruzado com os alunos vindos do Meta no EVO. */
function contas(investimento: number, u: UnitData | undefined) {
  const o = origemMeta(u?.origens);
  const vLtv = u ? ltv(u) : 0;
  return { investimento, alunos: o.convertidas, cadastros: o.cadastradas, nomes: o.nomes, ltv: vLtv, ...retornoDoMeta(investimento, o.convertidas, vLtv) };
}

/** CAC e ROI do Meta no mês: o que se investiu (todas as campanhas) contra os alunos que vieram do Instagram/Facebook. */
export function RetornoMeta({ unit, month }: { unit: string | null; month: string }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  const evo = useMemo(() => (month ? getDataByMonth(month) : undefined), [month]);
  const mes = foto?.meses?.[month];
  const subtitle = <>{unit ?? "Rede"} • {month ? nomeDoMes(month) : ""}{month && isPartialMonth(month) && " (mês em andamento: valores parciais)"}</>;
  const titulo = "Retorno do Meta: CAC e ROI";

  if (foto === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  const inv = investimentoDoMes(mes, unit);
  if (!mes || !inv) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>{mes ? `Sem investimento do Meta lido para ${unit ?? "a rede"} neste mês.` : "O investimento do Meta deste mês ainda não foi lido."}</ChartEmpty></ChartCard>;

  const alvo = unit ? evo?.units.find((u) => u.name === unit) : evo?.total;
  const r = contas(inv.investimento, alvo);
  const porUnidade = unit || !evo ? [] : Object.entries(mes.unidades)
    .filter(([n, v]) => n !== "Rede" && v.investimento > 0)
    .map(([n, v]) => ({ nome: n, ...contas(v.investimento, evo.units.find((u) => u.name === n)) }))
    .sort((a, b) => (a.cac ?? Infinity) - (b.cac ?? Infinity));
  const institucional = mes.unidades.Rede?.investimento ?? 0;

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Investido no Meta" value={reais(r.investimento)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Alunos vindos do Meta" value={r.alunos.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
          <HeadlineStat label="CAC" value={r.cac === null ? "—" : reais(r.cac)} swatch={<span className="h-2 w-2 rounded-full bg-[#3b82f6]" />} />
          <HeadlineStat label="ROI (pelo LTV)" value={pctRoi(r.roi)} swatch={<span className={`h-2 w-2 rounded-full ${r.roi !== null && r.roi < 0 ? "bg-destructive" : "bg-success"}`} />} />
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Contatos no Meta</dt><dd className="tabular-nums text-foreground">{(inv.leads + inv.conversas).toLocaleString("pt-BR")} <span className="text-muted-foreground">({inv.leads.toLocaleString("pt-BR")} leads, {inv.conversas.toLocaleString("pt-BR")} conversas)</span></dd></div>
        <div><dt className="text-xs text-muted-foreground">Cadastros com origem Meta no EVO</dt><dd className="tabular-nums text-foreground">{r.cadastros.toLocaleString("pt-BR")}</dd></div>
        <div><dt className="text-xs text-muted-foreground">LTV usado</dt><dd className="tabular-nums text-foreground">{r.ltv > 0 ? reais(r.ltv) : "sem LTV"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Retorno estimado</dt><dd className="tabular-nums text-foreground">{r.ltv > 0 ? reais(r.retorno) : "—"}</dd></div>
      </dl>

      {porUnidade.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm" aria-label="CAC e ROI do Meta por unidade, do menor para o maior CAC">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5 font-medium">Unidade</th><th className="py-1.5 text-right font-medium">Investido</th><th className="py-1.5 text-right font-medium">Alunos</th><th className="py-1.5 text-right font-medium">CAC</th><th className="py-1.5 text-right font-medium">ROI</th></tr></thead>
            <tbody>
              {porUnidade.map((u) => (
                <tr key={u.nome} className="border-t border-border">
                  <td className="py-1.5 text-foreground">{u.nome}</td>
                  <td className="py-1.5 text-right tabular-nums">{reais(u.investimento)}</td>
                  <td className="py-1.5 text-right tabular-nums">{u.alunos.toLocaleString("pt-BR")}</td>
                  <td className="py-1.5 text-right tabular-nums">{u.cac === null ? "—" : reais(u.cac)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${u.roi !== null && u.roi < 0 ? "text-destructive" : ""}`}>{pctRoi(u.roi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {foto?.meses?.[month]?.erros.length ? <p className="mt-3 text-xs text-warning">{mes.erros.length} {mes.erros.length === 1 ? "conta de anúncio não pôde ser lida" : "contas de anúncio não puderam ser lidas"} neste mês; o investimento delas não entra.</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Investimento = todas as campanhas do mês no Meta, inclusive as já pausadas{!unit && institucional > 0 ? `; inclui ${reais(institucional)} da conta Institucional, que não entra no CAC de nenhuma unidade` : ""}.
        {" "}Alunos vindos do Meta = oportunidades do EVO com origem {r.nomes.length ? r.nomes.map((n) => `"${n}"`).join(", ") : "Instagram ou Facebook"} convertidas no mês.
        {" "}CAC = investimento ÷ alunos. ROI = (alunos × LTV − investimento) ÷ investimento, com LTV = ticket médio × permanência média.
        {r.nomes.length === 0 && " Nenhuma oportunidade com origem Instagram ou Facebook neste mês: confira se a recepção está marcando a origem no cadastro."}
      </p>
    </ChartCard>
  );
}
