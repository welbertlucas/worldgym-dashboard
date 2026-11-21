import { useEffect, useMemo, useState } from "react";
import { Archive, Presentation } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { MonthData } from "@/data/dashboardData";
import type { Meta } from "@/data/metas";
import type { ResultadoVigente } from "@/data/alertasVigentes";
import { carregarFeitos, type Feito } from "@/data/planoFeitos";
import { planoDaUnidade } from "@/data/relatorioPlano";
import { formatMonthLong, isPartialMonth } from "@/data/periods";
import { diasFechados } from "@/data/vendasDia";
import { INDICADORES_PADRAO, LEGENDA_COMPLEMENTARES, mesesParaRelatorio, montarRelatorio, resumoDosSlides, type ModeloRelatorio } from "@/data/relatorio";
import { ID_PLANO, INDICADORES_SEMANA_PADRAO, estadoDaSemana, montarRelatorioSemanal, rotuloDaSemana, semanasNoMes, temSemanas } from "@/data/relatorioSemana";
import { AVISO_DO_RECEBIMENTO, GRUPOS_DO_RELATORIO, previaDoItem, rotuloDaOpcao } from "@/data/relatorioOpcoes";
import { lerEscolhas, salvarEscolhas } from "@/lib/relatorioEscolhas";
import { getUsuario, podeGerarRelatorios, unidadesProprias } from "@/lib/auth";
import { registrarExportacao } from "@/lib/atividade";
import { cn } from "@/lib/utils";

const ESTADO: Record<string, string> = { fechada: "", andamento: " (em andamento)", futura: " (ainda não começou)" };

/** Menu Relatórios: a pessoa escolhe o período (mês fechado ou uma semana), as unidades e os indicadores e baixa uma apresentação (.pptx) editável. */
export function RelatoriosTab({ dados, atualizadoEm = null, metas = [], vigentes = null }: { dados: MonthData[]; atualizadoEm?: string | null; metas?: Meta[]; /** Plano de ação do mês em andamento (alertas vigentes). */ vigentes?: ResultadoVigente | null }) {
  const meses = useMemo(() => mesesParaRelatorio(dados.map((d) => d.month)), [dados]);
  const mesesSemana = useMemo(() => dados.filter(temSemanas).map((d) => d.month).sort().reverse(), [dados]);
  const email = getUsuario()?.email ?? "";
  const lembrado = useMemo(() => lerEscolhas(email), [email]);
  const [tipo, setTipo] = useState<"mes" | "semana">(() => (lembrado.tipo === "mes" || (lembrado.tipo === "semana" && mesesSemana.length) ? lembrado.tipo : mesesSemana.length ? "semana" : "mes")); // a semana é o uso principal (reunião semanal)
  const [mes, setMes] = useState(meses[0] ?? "");
  const [mesSem, setMesSem] = useState(mesesSemana[0] ?? "");
  const fechadosDe = (m: string) => diasFechados(m, isPartialMonth(m), atualizadoEm);
  /** Semana que abre sozinha: a mais recente que já começou. */
  const padraoSemana = (m: string) => { for (let n = semanasNoMes(m); n >= 1; n--) if (estadoDaSemana(m, n, fechadosDe(m)) !== "futura") return n; return 1; };
  const [semana, setSemana] = useState(() => (mesesSemana[0] ? padraoSemana(mesesSemana[0]) : 1));
  // Quem vê só algumas unidades recebe, nos dados, as outras com o nome escondido ("Unidade 07"): o relatório fica só com as unidades da própria pessoa.
  const proprias = unidadesProprias();
  const nomes = useMemo(() => (dados.find((d) => d.month === (tipo === "mes" ? mes : mesSem))?.units.map((u) => u.name) ?? []).filter((n) => !proprias || proprias.includes(n)), [dados, tipo, mes, mesSem, proprias]);
  const [escopo, setEscopo] = useState<"todas" | "algumas">(lembrado.escopo ?? "todas");
  const [marcadas, setMarcadas] = useState<string[]>(lembrado.marcadas ?? []);
  const [indMes, setIndMes] = useState<string[]>(lembrado.indMes ?? INDICADORES_PADRAO);
  const [indSem, setIndSem] = useState<string[]>(lembrado.indSem ?? INDICADORES_SEMANA_PADRAO);
  const [obs, setObs] = useState("");
  // Lembra a última escolha (o texto das observações é de cada relatório e não fica guardado)
  useEffect(() => { salvarEscolhas(email, { tipo, escopo, marcadas, indMes, indSem }); }, [email, tipo, escopo, marcadas, indMes, indSem]);
  const [gerando, setGerando] = useState(false);
  // Feitos do plano do mês em andamento (para o slide do plano de ação)
  const [feitos, setFeitos] = useState<Record<string, Feito>>({});
  const mesDoPlano = vigentes?.month ?? null;
  useEffect(() => { let vivo = true; if (mesDoPlano) carregarFeitos(mesDoPlano).then((f) => vivo && setFeitos(f)); return () => { vivo = false; }; }, [mesDoPlano]);

  if (!podeGerarRelatorios()) return <Notice>Esta tela não está liberada para o seu acesso.</Notice>;
  if (!meses.length && !mesesSemana.length) return <div><SectionTitle level="page">Relatórios</SectionTitle><Notice>Ainda não há dados para gerar o relatório.</Notice></div>;

  const indicadores = tipo === "mes" ? indMes : indSem;
  const setIndicadores = tipo === "mes" ? setIndMes : setIndSem;
  const marcadasValidas = marcadas.filter((n) => nomes.includes(n));
  const unidades = escopo === "algumas" ? marcadasValidas : proprias ? nomes : null;
  const umaUnidade = escopo === "algumas" ? marcadasValidas.length === 1 : nomes.length === 1;
  const prefixo = umaUnidade ? "" : "Ranking: ";
  const unidadeUnica = escopo === "algumas" ? (marcadasValidas.length === 1 ? marcadasValidas[0] : null) : nomes.length === 1 ? nomes[0] : null;
  // O plano é do mês em andamento: na semana só vale se a semana é desse mês; no relatório de mês fechado entra o plano atual (o slide diz de qual mês é)
  const mesDoRelatorioPlano = tipo === "semana" ? mesSem : mesDoPlano ?? "";
  const plano = vigentes && unidadeUnica && mesDoPlano ? planoDaUnidade(vigentes, unidadeUnica, mesDoRelatorioPlano, feitos, atualizadoEm) : null;
  const motivoSemPlano = !unidadeUnica ? "escolha uma unidade só" : !mesDoPlano ? "o plano do mês em andamento ainda não foi lido" : tipo === "semana" && mesSem !== mesDoPlano ? "só no mês em andamento" : "";
  const montar = (selecao: string[] | null, pl: typeof plano): ModeloRelatorio | null => {
    const m = tipo === "mes"
      ? montarRelatorio(dados, mes, indicadores, selecao, metas, pl)
      : montarRelatorioSemanal(dados, mesSem, semana, indicadores, selecao, fechadosDe(mesSem), metas, pl);
    return m ? { ...m, observacoes: obs.trim() || null } : null;
  };
  const modelo = montar(unidades, plano);
  // Quem pode gerar um arquivo para cada unidade: relatório com mais de uma unidade
  const listaPorUnidade = escopo === "algumas" ? marcadasValidas : nomes;
  const podePorUnidade = !umaUnidade && listaPorUnidade.length > 1;
  const mesDoRelatorio = tipo === "mes" ? mes : mesSem;
  const alternar = (id: string) => setIndicadores((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const alternarUnidade = (u: string) => setMarcadas((l) => (l.includes(u) ? l.filter((x) => x !== u) : [...l, u]));
  const semNada = !indicadores.length;
  const semUnidade = escopo === "algumas" && !marcadasValidas.length;

  const gerar = async () => {
    if (!modelo) return;
    setGerando(true);
    try {
      const { gerarApresentacao } = await import("@/lib/relatorioPptx");
      await gerarApresentacao(modelo, { email: getUsuario()?.email ?? "" });
      registrarExportacao("relatorios", { unidade: unidades?.length === 1 ? unidades[0] : null, mes: mesDoRelatorio });
      toast({ title: "Apresentação gerada", description: "O arquivo foi baixado. Abra no PowerPoint ou no Keynote para editar." });
    } catch {
      toast({ title: "Não consegui gerar agora", description: "Tente de novo em instantes.", variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const gerarPorUnidade = async () => {
    setGerando(true);
    try {
      const modelos = listaPorUnidade
        .map((nome) => montar([nome], vigentes && mesDoPlano ? planoDaUnidade(vigentes, nome, mesDoRelatorioPlano, feitos, atualizadoEm) : null))
        .filter((m): m is ModeloRelatorio => !!m);
      if (!modelos.length) { toast({ title: "Nada para gerar", description: "Nenhuma unidade tem dados neste período.", variant: "destructive" }); return; }
      const { gerarZipPorUnidade } = await import("@/lib/relatorioPptx");
      await gerarZipPorUnidade(modelos, { email }, `Atlas-Relatorios-${mesDoRelatorio}-por-unidade`);
      registrarExportacao("relatorios", { unidade: null, mes: mesDoRelatorio });
      toast({ title: `${modelos.length} apresentações geradas`, description: "O arquivo .zip foi baixado, com um .pptx para cada unidade." });
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
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-foreground">
              <label className="flex items-center gap-2"><input type="radio" name="tipo" checked={tipo === "semana"} onChange={() => setTipo("semana")} className="accent-[hsl(var(--primary))]" />Semana</label>
              <label className="flex items-center gap-2"><input type="radio" name="tipo" checked={tipo === "mes"} onChange={() => setTipo("mes")} className="accent-[hsl(var(--primary))]" />Mês fechado</label>
            </div>
            {tipo === "mes" ? (
              <>
                <label className="mt-3 block space-y-1.5 text-sm font-medium text-foreground">Mês
                  <Select value={mes} onChange={(e) => setMes(e.target.value)}>
                    {meses.map((m) => <option key={m} value={m}>{formatMonthLong(m)}</option>)}
                  </Select>
                </label>
                <p className="mt-2 text-xs text-muted-foreground">Compara com o mesmo mês do ano anterior, quando ele está guardado.</p>
              </>
            ) : mesesSemana.length ? (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium text-foreground">Mês
                    <Select value={mesSem} onChange={(e) => { setMesSem(e.target.value); setSemana(padraoSemana(e.target.value)); }}>
                      {mesesSemana.map((m) => <option key={m} value={m}>{formatMonthLong(m)}</option>)}
                    </Select>
                  </label>
                  <label className="space-y-1.5 text-sm font-medium text-foreground">Semana
                    <Select value={semana} onChange={(e) => setSemana(Number(e.target.value))}>
                      {Array.from({ length: semanasNoMes(mesSem) }, (_, i) => i + 1).map((n) => {
                        const estado = estadoDaSemana(mesSem, n, fechadosDe(mesSem));
                        return <option key={n} value={n} disabled={estado === "futura"}>Semana {n} · {rotuloDaSemana(mesSem, n)}{ESTADO[estado]}</option>;
                      })}
                    </Select>
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">As semanas são de 7 dias dentro do mês (1 a 7, 8 a 14, 15 a 21, 22 a 28 e, quando existir, 29 em diante) e comparam com a mesma semana do mês anterior. Os dados vão até a véspera: semana em andamento sai sem comparação.</p>
              </>
            ) : <p className="mt-3 text-sm text-muted-foreground">Os números por semana ainda estão sendo calculados. Eles aparecem aqui depois da próxima atualização noturna do EVO.</p>}
            <p className="mt-2 text-xs text-muted-foreground">Na capa vão o nome da unidade (ou da rede) e o período{modelo ? `: ${modelo.periodo}` : ""}.</p>
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
              <h3 className="text-sm font-semibold text-foreground">O que vai na apresentação</h3>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setIndicadores(GRUPOS_DO_RELATORIO.flatMap((g) => g.itens).filter((i) => (tipo === "mes" ? i.mes : i.semana)).map((i) => i.id))}>Marcar todos</button>
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setIndicadores([])}>Limpar</button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Cada item marcado vira um slide, e embaixo dele aparecem os números que vão nele. O que só existe no {tipo === "mes" ? "relatório da semana" : "mês fechado"} fica apagado.</p>
            <div className="mt-4 space-y-5">
              {GRUPOS_DO_RELATORIO.map((g) => (
                <div key={g.titulo}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</h4>
                  <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                    {g.itens.map((it) => {
                      const existe = tipo === "mes" ? it.mes : it.semana;
                      const marcado = existe && indicadores.includes(it.id);
                      const previa = marcado && modelo ? previaDoItem(modelo, it.id) : null;
                      const ranking = it.id !== ID_PLANO && !["big", "mes", "metas", "conv", "compl", "freq", "satisf"].includes(it.id);
                      const rotulo = `${ranking ? prefixo : ""}${rotuloDaOpcao(it.id, tipo)}`;
                      return (
                        <label key={it.id} className={cn("flex items-start gap-2 text-sm", existe ? "text-foreground" : "cursor-not-allowed text-muted-foreground/50")}>
                          <input type="checkbox" disabled={!existe} checked={marcado} onChange={() => alternar(it.id)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))] disabled:opacity-40" />
                          <span>
                            {rotulo}
                            {!existe && <span className="block text-xs">só {tipo === "mes" ? "no relatório da semana" : "no mês fechado"}</span>}
                            {existe && it.id === ID_PLANO && motivoSemPlano && <span className="block text-xs text-muted-foreground">{motivoSemPlano}</span>}
                            {existe && it.id === "rec" && <span className="block text-xs text-muted-foreground">{AVISO_DO_RECEBIMENTO}</span>}
                            {existe && it.id === "compl" && <span className="block text-xs text-muted-foreground">{LEGENDA_COMPLEMENTARES}</span>}
                            {marcado && modelo && (previa
                              ? <span className="block text-xs font-medium text-primary">{previa}</span>
                              : <span className="block text-xs text-muted-foreground">Sem dado neste período: o slide não será gerado.</span>)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{tipo === "mes"
              ? "Churn e Cancelamentos trazem um slide com os motivos; Inadimplência, um com os principais motivos de recusa do cartão. Notas só entram para quem tem nota no mês."
              : "Na semana só entram indicadores que existem por semana. Todo percentual leva a base (ex.: 4 de 12)."}</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Observações (opcional)</h3>
            <p className="mt-1 text-xs text-muted-foreground">O que você escrever aqui vira um slide "Observações" antes do encerramento, uma linha por tópico. Não fica guardado para o próximo relatório.</p>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={4} maxLength={1500} placeholder={"Ex.: Meta de novos contratos em risco na Arniqueira\nReforçar a cobrança dos cartões recusados"} className="mt-3 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-4">
          <h3 className="text-sm font-semibold text-foreground">Sua apresentação</h3>
          {modelo ? (
            <details className="text-sm text-foreground">
              <summary className="cursor-pointer font-medium">{resumoDosSlides(modelo).length} slides</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {resumoDosSlides(modelo).map((s, i) => <li key={`${s}-${i}`}>{s}</li>)}
              </ol>
            </details>
          ) : <p className="text-sm text-muted-foreground">{semUnidade ? "Marque ao menos uma unidade." : "Sem dados para este mês."}</p>}
          <Button onClick={gerar} disabled={gerando || !modelo || semNada || semUnidade} className="w-full">
            <Presentation className="h-4 w-4" aria-hidden />{gerando ? "Gerando..." : "Gerar apresentação"}
          </Button>
          {podePorUnidade && (
            <Button variant="outline" onClick={gerarPorUnidade} disabled={gerando || semNada || semUnidade} className="w-full">
              <Archive className="h-4 w-4" aria-hidden />Um arquivo para cada unidade ({listaPorUnidade.length})
            </Button>
          )}
          {podePorUnidade && <p className="text-xs text-muted-foreground">Baixa um .zip com uma apresentação para cada unidade, com os mesmos indicadores.</p>}
          {semNada && <p className="text-xs text-muted-foreground">Marque ao menos um item.</p>}
          <p className="text-xs text-muted-foreground">O arquivo leva no rodapé o seu e-mail e a data. A fonte dos títulos é a Impact; a Montserrat aparece se estiver instalada.</p>
        </aside>
      </div>
    </div>
  );
}
