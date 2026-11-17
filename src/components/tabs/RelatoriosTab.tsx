import { useMemo, useState } from "react";
import { Presentation } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { MonthData } from "@/data/dashboardData";
import type { Meta } from "@/data/metas";
import { formatMonthLong, isPartialMonth } from "@/data/periods";
import { diasFechados } from "@/data/vendasDia";
import { ID_BIG, INDICADORES_PADRAO, RANKINGS, mesesParaRelatorio, montarRelatorio, resumoDosSlides, type ModeloRelatorio } from "@/data/relatorio";
import { ID_CONVERSAO, INDICADORES_SEMANA_PADRAO, SEMANAIS, estadoDaSemana, montarRelatorioSemanal, rotuloDaSemana, semanasNoMes, temSemanas } from "@/data/relatorioSemana";
import { getUsuario, podeGerarRelatorios, unidadesProprias } from "@/lib/auth";
import { registrarExportacao } from "@/lib/atividade";

const ESTADO: Record<string, string> = { fechada: "", andamento: " (em andamento)", futura: " (ainda não começou)" };

/** Menu Relatórios: a pessoa escolhe o período (mês fechado ou uma semana), as unidades e os indicadores e baixa uma apresentação (.pptx) editável. */
export function RelatoriosTab({ dados, atualizadoEm = null, metas = [] }: { dados: MonthData[]; atualizadoEm?: string | null; metas?: Meta[] }) {
  const meses = useMemo(() => mesesParaRelatorio(dados.map((d) => d.month)), [dados]);
  const mesesSemana = useMemo(() => dados.filter(temSemanas).map((d) => d.month).sort().reverse(), [dados]);
  const [tipo, setTipo] = useState<"mes" | "semana">(() => (mesesSemana.length ? "semana" : "mes")); // a semana é o uso principal (reunião semanal)
  const [mes, setMes] = useState(meses[0] ?? "");
  const [mesSem, setMesSem] = useState(mesesSemana[0] ?? "");
  const fechadosDe = (m: string) => diasFechados(m, isPartialMonth(m), atualizadoEm);
  /** Semana que abre sozinha: a mais recente que já começou. */
  const padraoSemana = (m: string) => { for (let n = semanasNoMes(m); n >= 1; n--) if (estadoDaSemana(m, n, fechadosDe(m)) !== "futura") return n; return 1; };
  const [semana, setSemana] = useState(() => (mesesSemana[0] ? padraoSemana(mesesSemana[0]) : 1));
  // Quem vê só algumas unidades recebe, nos dados, as outras com o nome escondido ("Unidade 07"): o relatório fica só com as unidades da própria pessoa.
  const proprias = unidadesProprias();
  const nomes = useMemo(() => (dados.find((d) => d.month === (tipo === "mes" ? mes : mesSem))?.units.map((u) => u.name) ?? []).filter((n) => !proprias || proprias.includes(n)), [dados, tipo, mes, mesSem, proprias]);
  const [escopo, setEscopo] = useState<"todas" | "algumas">("todas");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [indMes, setIndMes] = useState<string[]>(INDICADORES_PADRAO);
  const [indSem, setIndSem] = useState<string[]>(INDICADORES_SEMANA_PADRAO);
  const [gerando, setGerando] = useState(false);

  if (!podeGerarRelatorios()) return <Notice>Esta tela não está liberada para o seu acesso.</Notice>;
  if (!meses.length && !mesesSemana.length) return <div><SectionTitle level="page">Relatórios</SectionTitle><Notice>Ainda não há dados para gerar o relatório.</Notice></div>;

  const indicadores = tipo === "mes" ? indMes : indSem;
  const setIndicadores = tipo === "mes" ? setIndMes : setIndSem;
  const unidades = escopo === "algumas" ? marcadas : proprias ? nomes : null;
  const umaUnidade = escopo === "algumas" ? marcadas.length === 1 : nomes.length === 1;
  const prefixo = umaUnidade ? "" : "Ranking: ";
  const modelo: ModeloRelatorio | null = tipo === "mes"
    ? montarRelatorio(dados, mes, indicadores, unidades, metas)
    : montarRelatorioSemanal(dados, mesSem, semana, indicadores, unidades, fechadosDe(mesSem));
  const mesDoRelatorio = tipo === "mes" ? mes : mesSem;
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
      registrarExportacao("relatorios", { unidade: unidades?.length === 1 ? unidades[0] : null, mes: mesDoRelatorio });
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
              <h3 className="text-sm font-semibold text-foreground">Indicadores</h3>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setIndicadores(tipo === "mes" ? [ID_BIG, ...RANKINGS.map((r) => r.id)] : [ID_BIG, ...SEMANAIS.map((r) => r.id), ID_CONVERSAO])}>Marcar todos</button>
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setIndicadores([])}>Limpar</button>
              </div>
            </div>
            <div className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={indicadores.includes(ID_BIG)} onChange={() => alternar(ID_BIG)} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                {tipo === "mes" ? "Números gerais (faturamento, adimplentes, contratos, ticket, inadimplência, vendas online e conversão)" : "Números gerais (faturamento, recebimento, contratos, vendas online, oportunidades, cancelamentos e conversão)"}
              </label>
              {(tipo === "mes" ? RANKINGS : [...SEMANAIS.slice(0, 6), { id: ID_CONVERSAO, rotulo: "Conversão (com a base: convertidas de cadastradas)" }, ...SEMANAIS.slice(6)]).map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={indicadores.includes(r.id)} onChange={() => alternar(r.id)} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />{prefixo}{r.rotulo}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{tipo === "mes"
              ? `${umaUnidade ? "Cada indicador vira um slide com o valor em destaque." : "Cada ranking vira um slide, com gráfico editável."} Notas (NPS, Google e Reclame Aqui) só entram nas unidades que têm nota no mês.`
              : "Na semana só entram indicadores que existem por semana. Ticket médio, inadimplência, churn e notas são do mês e ficam de fora. Todo percentual leva a base (ex.: 4 de 12)."}</p>
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
