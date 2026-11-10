import { useEffect, useMemo, useState } from "react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { carregarCampanhas, INSTITUCIONAL, investimentoDoMes, investimentoInstitucional, origemMeta, retornoDoMeta, type FotoCampanhas } from "@/data/campanhas";
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

  // Conta Institucional: anuncia para a rede toda, então não dá para ligar alunos a ela; mostra só investimento e contatos.
  if (unit === INSTITUCIONAL) {
    const contatos = inv.leads + inv.conversas;
    return (
      <ChartCard title={titulo} subtitle={subtitle} headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Investido no Meta" value={reais(inv.investimento)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Contatos" value={contatos.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
          <HeadlineStat label="Custo por contato" value={contatos > 0 ? reais(inv.investimento / contatos) : "—"} swatch={<span className="h-2 w-2 rounded-full bg-[#3b82f6]" />} />
        </div>
      }>
        <p className="text-xs text-muted-foreground">A conta Institucional anuncia para a rede toda e fica separada das unidades: o investimento dela não entra no CAC nem no ROI de nenhuma unidade, nem na soma da rede. Contato = lead ou conversa iniciada.</p>
      </ChartCard>
    );
  }

  // Por unidade com conta de anúncio lida no mês (a rede soma só estas: unidade sem conta lida não entra no CAC).
  const linhas = !evo ? [] : Object.entries(mes.unidades)
    .filter(([n]) => n !== "Rede")
    .map(([n, v]) => ({ nome: n, ...contas(v.investimento, evo.units.find((u) => u.name === n)) }));
  const somaRede = () => {
    const investimento = linhas.reduce((s, l) => s + l.investimento, 0);
    const alunos = linhas.reduce((s, l) => s + l.alunos, 0);
    const retorno = linhas.reduce((s, l) => s + l.retorno, 0);
    const nomes = [...new Set(linhas.flatMap((l) => l.nomes))].sort();
    return { investimento, alunos, retorno, nomes, cadastros: linhas.reduce((s, l) => s + l.cadastros, 0), ltv: alunos > 0 ? retorno / alunos : 0,
      cac: alunos > 0 && investimento > 0 ? investimento / alunos : null, roi: investimento > 0 && alunos > 0 && retorno > 0 ? (retorno - investimento) / investimento : null };
  };
  const r = unit ? contas(inv.investimento, evo?.units.find((u) => u.name === unit)) : somaRede();
  const porUnidade = unit ? [] : linhas.filter((l) => l.investimento > 0).sort((a, b) => (a.cac ?? Infinity) - (b.cac ?? Infinity));
  const institucional = investimentoInstitucional(mes);

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
        <div><dt className="text-xs text-muted-foreground">{unit ? "LTV usado" : "LTV médio"}</dt><dd className="tabular-nums text-foreground">{r.ltv > 0 ? reais(r.ltv) : "sem LTV"}</dd></div>
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
        Investimento = todas as campanhas do mês no Meta, inclusive as já pausadas{!unit ? ". A rede soma só as unidades com conta de anúncio lida" : ""}{!unit && institucional > 0 ? `; a conta Institucional (${reais(institucional)} no mês) fica separada: escolha "Institucional" para vê-la` : ""}.
        {" "}Alunos vindos do Meta = oportunidades do EVO com origem {r.nomes.length ? r.nomes.map((n) => `"${n}"`).join(", ") : "Instagram ou Facebook"} convertidas no mês.
        {" "}CAC = investimento ÷ alunos. ROI = (alunos × LTV − investimento) ÷ investimento, com LTV = ticket médio × permanência média.
        {r.nomes.length === 0 && " Nenhuma oportunidade com origem Instagram ou Facebook neste mês: confira se a recepção está marcando a origem no cadastro."}
      </p>
    </ChartCard>
  );
}
