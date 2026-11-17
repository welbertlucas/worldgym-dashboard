import { useMemo, useState } from "react";
import { Presentation } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { MonthData } from "@/data/dashboardData";
import { formatMonthLong } from "@/data/periods";
import { ID_BIG, INDICADORES_PADRAO, RANKINGS, mesesParaRelatorio, montarRelatorio, resumoDosSlides } from "@/data/relatorio";
import { getUsuario, podeGerarRelatorios } from "@/lib/auth";
import { registrarExportacao } from "@/lib/atividade";

/** Menu Relatórios: a pessoa escolhe o mês, as unidades e os indicadores e baixa uma apresentação (.pptx) editável. */
export function RelatoriosTab({ dados }: { dados: MonthData[] }) {
  const meses = useMemo(() => mesesParaRelatorio(dados.map((d) => d.month)), [dados]);
  const [mes, setMes] = useState(meses[0] ?? "");
  const nomes = useMemo(() => dados.find((d) => d.month === mes)?.units.map((u) => u.name) ?? [], [dados, mes]);
  const [escopo, setEscopo] = useState<"todas" | "algumas">("todas");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [indicadores, setIndicadores] = useState<string[]>(INDICADORES_PADRAO);
  const [gerando, setGerando] = useState(false);

  if (!podeGerarRelatorios()) return <Notice>Esta tela não está liberada para o seu acesso.</Notice>;
  if (!meses.length) return <div><SectionTitle level="page">Relatórios</SectionTitle><Notice>Ainda não há um mês fechado para gerar o relatório.</Notice></div>;

  const unidades = escopo === "algumas" ? marcadas : null;
  const modelo = montarRelatorio(dados, mes, indicadores, unidades);
  const alternar = (id: string) => setIndicadores((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const alternarUnidade = (u: string) => setMarcadas((l) => (l.includes(u) ? l.filter((x) => x !== u) : [...l, u]));
  const semNada = !indicadores.length;
  const semUnidade = escopo === "algumas" && !marcadas.length;

  const gerar = async () => {
    if (!modelo) return;
    setGerando(true);
    try {
      const { gerarApresentacao } = await import("@/lib/relatorioPptx");
      await gerarApresentacao(modelo, { email: getUsuario()?.email ?? "" });
      registrarExportacao("relatorios", { unidade: unidades?.length === 1 ? unidades[0] : null, mes });
      toast({ title: "Apresentação gerada", description: "O arquivo foi baixado. Abra no PowerPoint ou no Keynote para editar." });
    } catch {
      toast({ title: "Não consegui gerar agora", description: "Tente de novo em instantes.", variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle level="page" hint="Monta uma apresentação (.pptx) com os dados do Atlas, nos slides do Report Operacional. Dá para editar tudo no PowerPoint depois.">Relatórios</SectionTitle>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Período</h3>
            <label className="mt-3 block space-y-1.5 text-sm font-medium text-foreground">Mês fechado
              <Select value={mes} onChange={(e) => setMes(e.target.value)}>
                {meses.map((m) => <option key={m} value={m}>{formatMonthLong(m)}</option>)}
              </Select>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">Por enquanto só meses fechados. Períodos livres (do dia 1 ao 9, por exemplo) vêm numa próxima etapa.</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Unidades</h3>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-foreground">
              <label className="flex items-center gap-2"><input type="radio" name="escopo" checked={escopo === "todas"} onChange={() => setEscopo("todas")} className="accent-[hsl(var(--primary))]" />Todas que eu enxergo ({nomes.length})</label>
              <label className="flex items-center gap-2"><input type="radio" name="escopo" checked={escopo === "algumas"} onChange={() => setEscopo("algumas")} className="accent-[hsl(var(--primary))]" />Escolher unidades</label>
            </div>
            {escopo === "algumas" && (
              <div className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {nomes.map((u) => (
                  <label key={u} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={marcadas.includes(u)} onChange={() => alternarUnidade(u)} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />{u}
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Indicadores</h3>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setIndicadores([ID_BIG, ...RANKINGS.map((r) => r.id)])}>Marcar todos</button>
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setIndicadores([])}>Limpar</button>
              </div>
            </div>
            <div className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={indicadores.includes(ID_BIG)} onChange={() => alternar(ID_BIG)} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />Números gerais (faturamento, adimplentes, contratos, ticket, inadimplência, vendas online e conversão)
              </label>
              {RANKINGS.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={indicadores.includes(r.id)} onChange={() => alternar(r.id)} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />Ranking: {r.rotulo}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Cada ranking vira um slide, com gráfico editável. Notas (NPS, Google e Reclame Aqui) só entram nas unidades que têm nota no mês.</p>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-4">
          <h3 className="text-sm font-semibold text-foreground">Slides desta apresentação</h3>
          {modelo ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
              {resumoDosSlides(modelo).map((s, i) => <li key={`${s}-${i}`}>{s}</li>)}
            </ol>
          ) : <p className="text-sm text-muted-foreground">{semUnidade ? "Marque ao menos uma unidade." : "Sem dados para este mês."}</p>}
          <Button onClick={gerar} disabled={gerando || !modelo || semNada || semUnidade} className="w-full">
            <Presentation className="h-4 w-4" aria-hidden />{gerando ? "Gerando..." : "Gerar apresentação"}
          </Button>
          {semNada && <p className="text-xs text-muted-foreground">Marque ao menos um indicador.</p>}
          <p className="text-xs text-muted-foreground">O arquivo leva no rodapé o seu e-mail e a data. A fonte dos títulos é a Impact; a Montserrat aparece se estiver instalada.</p>
        </aside>
      </div>
    </div>
  );
}
