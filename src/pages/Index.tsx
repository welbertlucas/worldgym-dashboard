import { useCallback, useEffect, useRef, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { RevenueChart } from "@/components/RevenueChart";
import NovosContratosChart from "@/components/NovosContratosChart";
import { VendasOnlineChart } from "@/components/VendasOnlineChart";
import InadimplenciaChart from "@/components/InadimplenciaChart";
import { DateFilter } from "@/components/DateFilter";
import { ComparisonCard } from "@/components/ComparisonCard";
import { PerfilOportunidades } from "@/components/PerfilOportunidades";
import { OrigemOportunidades } from "@/components/OrigemOportunidades";
import { ContratosVendidos, ProdutosVendidos, TaxasCobradas } from "@/components/ContratosVendidos";
import { BandeirasCartao, FormasPagamento, GatewaysCartao } from "@/components/FormasPagamento";
import { CampanhasTab } from "@/components/tabs/CampanhasTab";
import { CobrancasRecusa } from "@/components/CobrancasRecusa";
import { AlunosTab } from "@/components/tabs/AlunosTab";
import { RetencaoTab } from "@/components/tabs/RetencaoTab";
import { UnidadesTab } from "@/components/tabs/UnidadesTab";
import { BenchmarkTab } from "@/components/tabs/BenchmarkTab";
import { MapaAlunosTab } from "@/components/tabs/MapaAlunosTab";
import { UnitNavProvider } from "@/components/UnitLink";
import { SectionTitle } from "@/components/SectionTitle";
import { ExecutivaTab } from "@/components/tabs/ExecutivaTab";
import { RiscosTab } from "@/components/tabs/RiscosTab";
import { MetasTab } from "@/components/tabs/MetasTab";
import { AcessosTab } from "@/components/tabs/AcessosTab";
import { KpiGrid, type KpiContext } from "@/components/kpi/KpiGrid";
import { comercialSpecs, complementaresSpecs, financeiroSpecs, retencaoSpecs } from "@/components/kpi/tabSpecs";
import { viewFor } from "@/data/kpiView";
import { computeAlerts, sameMonthLastYear } from "@/data/alerts";
import { computeUnitDeltas } from "@/data/unitMetrics";
import { metasData, metasRede, syncMetasFromSheets } from "@/data/metas";
import { formatMonthLong, getLastClosedMonth, isPartialMonth } from "@/data/periods";
import {
  getLatestData, getDataByMonth, getDataByMonthRede, comparePeriods, dashboardData, dashboardDataRede,
  getLast12MonthsAverage, getUnitData, syncDashboardDataFromSheets, evoAtualizadoEm, receitaComplementar,
} from "@/data/dashboardData";
import { Button } from "@/components/ui/button";
import { Sidebar, MobileDrawer } from "@/components/Sidebar";
import { Notice } from "@/components/Notice";
import { DonutList } from "@/components/DonutList";
import {
  TrendingUp, Users, DollarSign, AlertCircle, ShoppingCart,
  RefreshCw, LogOut, Menu, Calendar, Dumbbell, Shirt, Coffee, Star, Smile, MessageSquare,
} from "lucide-react";
import { formatAbbreviatedNumber } from "@/lib/utils";
import { getToken, getUsuario, podeAtualizar, podeGerirAcessos, sair } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

/** Intervalo da atualização automática dos dados (planilha e metas). */
const AUTO_REFRESH_MS = 5 * 60 * 1000;
const NOME_DO_NIVEL = { dono: "Dono", master: "Master", unidades: "Unidades" } as const;

const Index = () => {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [compareMonth, setCompareMonth] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  /** Unidade aberta pelos links de nome; a página de detalhe começa nela. */
  // Abas com seletor de unidade próprio (Unidades, Mapa, Tráfego pago) avisam a unidade escolhida, para o cabeçalho acompanhar.
  const [unidadeDaAba, setUnidadeDaAba] = useState<string | null>(null);
  const ABAS_COM_SELETOR = ["mapa", "campanhas"];
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("executiva");
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("wg-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCollapsed((c) => {
    try { localStorage.setItem("wg-sidebar-collapsed", c ? "0" : "1"); } catch { /* armazenamento indisponível */ }
    return !c;
  });
  const mainRef = useRef<HTMLElement>(null);
  const changeTab = (id: string) => {
    // O detalhe da unidade compara períodos: no mês em andamento quase tudo está parcial ou sem dado,
    // então ao entrar nele o mês passa para o último mês fechado (dá para voltar pelo filtro).
    setActiveTab(id);
    mainRef.current?.scrollIntoView({ block: "start" });
  };
  // Abrir uma unidade compara períodos: no mês em andamento quase tudo está parcial ou sem dado,
  // então o mês passa para o último mês fechado (dá para voltar pelo filtro).
  const openUnit = (name: string) => {
    const fechado = getLastClosedMonth(dashboardData.map((d) => d.month));
    setSelectedMonth((cur) => (fechado && isPartialMonth(cur) ? fechado : cur));
    setSelectedUnit(name); // a unidade vai para o filtro do topo: o mesmo filtro vale em todas as abas
    changeTab("unidades");
  };
  const [, forceTick] = useState(0);

  /** `keepSelection`: atualização automática, que não troca o mês que o usuário está olhando. */
  const refresh = async (silent = false, keepSelection = false) => {
    setSyncing(true);
    const [res] = await Promise.all([syncDashboardDataFromSheets(), syncMetasFromSheets()]);
    setSyncing(false);
    if (res.ok) {
      setLoadedAt(new Date());
      // Abre no último mês FECHADO: o mês em andamento é parcial (e a planilha só ganha a linha dele no fim).
      const abre = getLastClosedMonth(dashboardData.map((d) => d.month)) ?? getLatestData().month;
      setSelectedMonth((cur) => (keepSelection && cur ? cur : abre));
      forceTick((n) => n + 1);
      if (!silent) toast({ title: "Dados atualizados", description: `${res.count} meses carregados.` });
    } else if (!silent) {
      toast({ title: "Falha ao atualizar", description: res.error, variant: "destructive" });
    }
  };

  useEffect(() => {
    refresh(true);
    // Acompanhamento em tempo real: recarrega a planilha a cada 5 minutos, só com a aba visível.
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh(true, true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fullMonthData = (selectedMonth ? getDataByMonth(selectedMonth) : null) || getLatestData();
  const unitData = selectedUnit ? getUnitData(fullMonthData.month, selectedUnit) : null;


  // Visão Executiva e Benchmark são sempre da rede: o filtro de unidade não aparece nem vale nelas.
  const semFiltroDeUnidade = activeTab === "executiva" || activeTab === "benchmark";
  const comparison = compareMonth ? comparePeriods(fullMonthData.month, compareMonth, semFiltroDeUnidade ? null : selectedUnit) : null;

  const months = dashboardData.map((d) => d.month);
  const evalMonth = getLastClosedMonth(months);
  const alerts = computeAlerts(dashboardData, metasData);
  const evalIdx = evalMonth ? months.indexOf(evalMonth) : -1;
  const unitDeltas = evalIdx > 0 ? computeUnitDeltas(dashboardData[evalIdx], dashboardData[evalIdx - 1]) : [];
  // A Visão Executiva e o Benchmark olham a rede inteira (para quem tem acesso só a algumas unidades, as outras vêm com o nome escondido).
  const monthsRede = dashboardDataRede.map((d) => d.month);
  const evalMonthRede = getLastClosedMonth(monthsRede);
  const evalIdxRede = evalMonthRede ? monthsRede.indexOf(evalMonthRede) : -1;
  const unitDeltasRede = evalIdxRede > 0 ? computeUnitDeltas(dashboardDataRede[evalIdxRede], dashboardDataRede[evalIdxRede - 1]) : [];
  const redeMonthData = getDataByMonthRede(fullMonthData.month) ?? fullMonthData;
  const selIdxRede = monthsRede.indexOf(redeMonthData.month);
  const redePrevMonthData = selIdxRede > 0 ? dashboardDataRede[selIdxRede - 1] : undefined;
  const selIdx = months.indexOf(fullMonthData.month);
  const prevMonthData = selIdx > 0 ? dashboardData[selIdx - 1] : undefined;
  const partialSelected = isPartialMonth(fullMonthData.month);
  // Indicadores em meia-lua: rede ou unidade selecionada, sempre comparados ao mês anterior (e ao mesmo mês do ano anterior se fechado).
  const kpiUnit = selectedUnit && unitData ? selectedUnit : null;
  const kpiCtx: KpiContext = {
    cur: viewFor(fullMonthData.month, kpiUnit) ?? fullMonthData,
    // Com um mês de comparação marcado, os velocímetros mostram só ele (qualquer mês/ano); sem marcação, mês anterior e mesmo mês do ano anterior.
    prev: viewFor(compareMonth ?? prevMonthData?.month, kpiUnit),
    ly: partialSelected || compareMonth ? undefined : viewFor(sameMonthLastYear(fullMonthData.month), kpiUnit),
    partial: partialSelected,
  };
  // Receitas complementares da rede ou da unidade selecionada (com Brinquedoteca, WG Plus e Pro+).
  const rc = kpiCtx.cur.total;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const parseMonth = (value: string) => {
    const [y, m] = value.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1);
  };

  const formatDate = (month: string) => {
    if (!month) return "";
    const date = parseMonth(month);
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  if (!fullMonthData.month) {
    return (
      <div className="min-h-screen bg-background lg:flex" role="status" aria-live="polite" aria-label="Carregando os dados do dashboard">
        <div className="hidden lg:block w-64 shrink-0 border-r border-border p-4 space-y-3" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-9 rounded-lg bg-secondary animate-pulse motion-reduce:animate-none" />)}
        </div>
        <div className="flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-5 space-y-6" aria-hidden>
          <div className="h-8 w-64 rounded-lg bg-secondary animate-pulse motion-reduce:animate-none" />
          <div className="flex gap-3">
            <div className="h-9 w-48 rounded-lg bg-secondary animate-pulse motion-reduce:animate-none" />
            <div className="h-9 w-48 rounded-lg bg-secondary animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="card-surface grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="p-5 flex flex-col items-center gap-3">
                <div className="h-4 w-24 rounded bg-secondary animate-pulse motion-reduce:animate-none self-start" />
                <div className="h-24 w-40 rounded-t-full bg-secondary animate-pulse motion-reduce:animate-none" />
                <div className="h-5 w-32 rounded-full bg-secondary animate-pulse motion-reduce:animate-none" />
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <UnitNavProvider value={openUnit}>
    <div className="min-h-screen bg-background lg:flex">
      <Sidebar
        active={activeTab}
        onChange={changeTab}
        criticalCount={criticalCount}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
      />
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} active={activeTab} onChange={changeTab} criticalCount={criticalCount} />

      <div className="flex-1 min-w-0">
        <header className="border-b border-border sticky top-0 z-40 bg-white/85 backdrop-blur-md">
          <div className="px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Abrir menu de navegação"
                aria-haspopup="dialog"
                className="lg:hidden rounded-xl p-2 -ml-1 text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Menu className="w-5 h-5" aria-hidden />
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-semibold tracking-tight text-foreground leading-tight sm:truncate">
                  Dashboard de resultados
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm sm:truncate first-letter:uppercase">
                  {(ABAS_COM_SELETOR.includes(activeTab) ? unidadeDaAba : semFiltroDeUnidade ? null : selectedUnit) ?? "Rede"} • {formatDate(fullMonthData.month)}
                  {compareMonth && ` x ${formatDate(compareMonth)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
            {loadedAt && (
              <p
                className="hidden xl:block text-xs text-muted-foreground tabular-nums"
                title="Primeira hora: quando este navegador buscou os dados. EVO atualizado: última vez que a rotina leu o EVO (faturamento, recebimento e inadimplência). Não indica a última edição da planilha."
              >
                Dados carregados às {loadedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                {evoAtualizadoEm && <> · EVO atualizado em {new Date(evoAtualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</>}
              </p>
            )}
            {getUsuario() && !getUsuario()!.legado && (
              <p className="hidden md:block text-xs text-muted-foreground truncate max-w-[14rem]" title={getUsuario()!.email}>
                {getUsuario()!.nome} · {NOME_DO_NIVEL[getUsuario()!.papel]}
              </p>
            )}
            {podeAtualizar() && (
              <button
                type="button"
                onClick={() => refresh(false)}
                disabled={syncing}
                aria-label={syncing ? "Atualizando da planilha" : "Atualizar da planilha"}
                title={`${syncing ? "Atualizando da planilha…" : "Atualizar da planilha"}${loadedAt ? ` · dados carregados às ${loadedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${evoAtualizadoEm ? ` · EVO atualizado em ${new Date(evoAtualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}` : ""}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-foreground/25 hover:text-foreground disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden />
              </button>
            )}
            {getToken() && (
              <Button variant="ghost" size="sm" onClick={sair} aria-label="Sair" className="shrink-0 text-xs font-medium">
                <LogOut className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            )}
            </div>
          </div>
        </header>

        <main ref={mainRef} className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-8 max-w-[1600px] scroll-mt-20">
        {/* Filtros */}
        {activeTab !== "mapa" && activeTab !== "campanhas" && activeTab !== "acessos" && <DateFilter
          selectedMonth={fullMonthData.month}
          compareMonth={compareMonth}
          selectedUnit={selectedUnit}
          onMonthChange={setSelectedMonth}
          onCompareMonthChange={setCompareMonth}
          onUnitChange={setSelectedUnit}
          hideUnit={semFiltroDeUnidade}
        />}

        {/* Aviso de unidade filtrada: nos menus temáticos o filtro vale para a tela toda e segue ao trocar de menu. */}
        {selectedUnit && ["comercial", "metas", "financeiro", "alunos", "retencao"].includes(activeTab) && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
            <span className="text-foreground">Mostrando só <b>{selectedUnit}</b>. Os números desta tela são desta unidade, não da rede.</span>
            <span className="flex flex-wrap gap-2">
              <button type="button" onClick={() => changeTab("unidades")} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">Ver retrato de {selectedUnit}</button>
              <button type="button" onClick={() => setSelectedUnit(null)} className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90">Voltar para a rede</button>
            </span>
          </div>
        )}

        {/* Comparativo */}
        {comparison && activeTab !== "unidades" && activeTab !== "mapa" && activeTab !== "campanhas" && activeTab !== "acessos" && (
          <section>
            <SectionTitle>Comparativo de períodos</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <ComparisonCard title="Faturamento" value1={comparison.faturamento.month1} value2={comparison.faturamento.month2} diff={comparison.faturamento.diff} month1={comparison.month1} month2={comparison.month2} format="currency" />
              <ComparisonCard title="Ticket Médio" value1={comparison.ticketMedio.month1} value2={comparison.ticketMedio.month2} diff={comparison.ticketMedio.diff} month1={comparison.month1} month2={comparison.month2} format="currency" />
              <ComparisonCard title="Clientes Ativos" value1={comparison.adimplentes.month1} value2={comparison.adimplentes.month2} diff={comparison.adimplentes.diff} month1={comparison.month1} month2={comparison.month2} format="number" />
              <ComparisonCard title="Taxa de Churn" value1={comparison.churn.month1.toFixed(1)} value2={comparison.churn.month2.toFixed(1)} diff={comparison.churn.diff} month1={comparison.month1} month2={comparison.month2} format="percentage" invertColors />
              <ComparisonCard title="Conversão de Cadastros" value1={comparison.icv.month1.toFixed(1)} value2={comparison.icv.month2.toFixed(1)} diff={comparison.icv.diff} month1={comparison.month1} month2={comparison.month2} format="percentage" />
              <ComparisonCard title="Vendas Online" value1={comparison.vendasOnline.month1} value2={comparison.vendasOnline.month2} diff={comparison.vendasOnline.diff} month1={comparison.month1} month2={comparison.month2} format="currency" />
              <ComparisonCard title="Novos Contratos" value1={comparison.novosContratos.month1} value2={comparison.novosContratos.month2} diff={comparison.novosContratos.diff} month1={comparison.month1} month2={comparison.month2} format="number" />
              <ComparisonCard title="Saldo de Clientes" value1={comparison.saldoClientes.month1} value2={comparison.saldoClientes.month2} diff={comparison.saldoClientes.diff} month1={comparison.month1} month2={comparison.month2} format="number" />
              <ComparisonCard title="Taxa de Inadimplência" value1={comparison.inadimplenciaPerc.month1.toFixed(1)} value2={comparison.inadimplenciaPerc.month2.toFixed(1)} diff={comparison.inadimplenciaPerc.diff} month1={comparison.month1} month2={comparison.month2} format="percentage" invertColors />
              <ComparisonCard title="Taxa de Renovação" value1={comparison.renovacoes.month1.toFixed(1)} value2={comparison.renovacoes.month2.toFixed(1)} diff={comparison.renovacoes.diff} month1={comparison.month1} month2={comparison.month2} format="percentage" />
            </div>
          </section>
        )}

        {partialSelected && activeTab !== "executiva" && activeTab !== "mapa" && activeTab !== "campanhas" && activeTab !== "acessos" && (
          <Notice><b>{formatDate(fullMonthData.month)}</b> está em andamento — os valores são parciais.</Notice>
        )}

        {activeTab === "executiva" && (
          <ExecutivaTab
            month={redeMonthData}
            prev={compareMonth ? getDataByMonthRede(compareMonth) ?? redePrevMonthData : redePrevMonthData}
            comparaMesEscolhido={!!compareMonth}
            alerts={alerts}
            evalMonth={evalMonthRede}
            deltas={unitDeltasRede}
            metas={metasRede}
            onOpenRiscos={() => changeTab("riscos")}
            onOpenUnidades={() => changeTab("benchmark")}
            onOpenMetas={() => changeTab("metas")}
          />
        )}

        {activeTab === "comercial" && (
          <section>
            <SectionTitle>Comercial</SectionTitle>
          <div className="mb-8"><KpiGrid ctx={kpiCtx} specs={comercialSpecs} /></div>
            <SectionTitle hint={selectedUnit ? `Soma das receitas complementares de ${selectedUnit}` : "Soma das receitas complementares da rede; escolha uma unidade no filtro para ver só ela"}>Receitas complementares</SectionTitle>
            <div className="mb-6"><KpiGrid ctx={kpiCtx} specs={complementaresSpecs} columns="xl:grid-cols-4" /></div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <NovosContratosChart selectedUnit={selectedUnit} />
              <VendasOnlineChart selectedUnit={selectedUnit} />
            </div>
            <div className="mb-6"><ContratosVendidos total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} partial={partialSelected} unitLabel={selectedUnit ?? "Rede"} porFamilia={!selectedUnit} /></div>
            <div className="mb-6"><OrigemOportunidades total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} partial={partialSelected} unitLabel={selectedUnit ?? "Rede"} /></div>
            <div className="mb-6"><PerfilOportunidades total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} partial={partialSelected} unitLabel={selectedUnit ?? "Rede"} /></div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <DonutList
              title="Receitas complementares"
              subtitle="Participação de cada receita na soma"
              center={{ value: formatAbbreviatedNumber(receitaComplementar(rc)), caption: "soma" }}
              empty="Sem receitas complementares lançadas neste mês."
              items={[
                { label: "Diárias", value: rc.diarias, color: "hsl(222 25% 22%)", valueText: formatCurrency(rc.diarias) },
                { label: "Taxa de personal", value: rc.personal, color: "hsl(4 90% 50%)", valueText: formatCurrency(rc.personal) },
                { label: "Brinquedoteca", value: rc.kids ?? 0, color: "hsl(142 50% 38%)", valueText: formatCurrency(rc.kids ?? 0) },
                { label: "WG Plus", value: rc.plus ?? 0, color: "hsl(32 85% 50%)", valueText: formatCurrency(rc.plus ?? 0) },
                { label: "Pro+", value: rc.proMais ?? 0, color: "hsl(262 45% 52%)", valueText: formatCurrency(rc.proMais ?? 0) },
                { label: "Camisetas", value: rc.camisetas, color: "hsl(222 14% 52%)", valueText: formatCurrency(rc.camisetas) },
                { label: "Coqueteleiras", value: rc.coqueteleiras, color: "hsl(220 14% 78%)", valueText: formatCurrency(rc.coqueteleiras) },
              ]}
            />
              <ProdutosVendidos total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} partial={partialSelected} unitLabel={selectedUnit ?? "Rede"} />
            </div>
          </section>
        )}

        {activeTab === "financeiro" && (
          <section>
            <SectionTitle>Financeiro</SectionTitle>
          <div className="mb-6"><KpiGrid ctx={kpiCtx} specs={financeiroSpecs} columns="xl:grid-cols-3" /></div>
            <div className="grid grid-cols-1 gap-6 mb-10">
              <RevenueChart selectedUnit={selectedUnit} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <FormasPagamento total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} unitLabel={selectedUnit ?? "Rede"} />
                <BandeirasCartao total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} unitLabel={selectedUnit ?? "Rede"} />
                <GatewaysCartao total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} unitLabel={selectedUnit ?? "Rede"} />
                <TaxasCobradas total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} partial={partialSelected} unitLabel={selectedUnit ?? "Rede"} />
              </div>
            </div>
            <SectionTitle hint="Quem está pagando em dia, quem está em atraso e por que as cobranças no cartão falham">Cobrança e inadimplência</SectionTitle>
            <div className="mb-6"><KpiGrid ctx={kpiCtx} specs={retencaoSpecs(false).filter((s) => s.title === "Adimplentes" || s.title === "Inadimplência")} columns="xl:grid-cols-2" /></div>
            <div className="mb-6"><InadimplenciaChart selectedUnit={selectedUnit} /></div>
            <div className="mb-6"><CobrancasRecusa total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} partial={partialSelected} unitLabel={selectedUnit ?? "Rede"} /></div>
          </section>
        )}

        {activeTab === "alunos" && <AlunosTab ctx={kpiCtx} month={fullMonthData.month} unit={kpiUnit} />}

        {activeTab === "retencao" && <RetencaoTab ctx={kpiCtx} month={fullMonthData.month} unit={kpiUnit} />}

        {activeTab === "unidades" && (
          <UnidadesTab
            selectedMonth={fullMonthData.month}
            unit={selectedUnit}
            compareMonth={compareMonth}
            metas={metasData}
            onPick={openUnit}
            onOpenMetas={() => changeTab("metas")}
            onOpenTab={changeTab}
          />
        )}

        {activeTab === "benchmark" && (
          <BenchmarkTab
            selectedMonth={fullMonthData.month}
            evalMonth={evalMonthRede}
            prevEvalMonth={evalIdxRede > 0 ? dashboardDataRede[evalIdxRede - 1].month : null}
            deltas={unitDeltasRede}
          />
        )}


        {activeTab === "mapa" && <MapaAlunosTab initialUnit={selectedUnit} onUnitChange={setUnidadeDaAba} />}
        {activeTab === "campanhas" && <CampanhasTab initialUnit={selectedUnit} onUnitChange={setUnidadeDaAba} month={fullMonthData.month} />}

        {activeTab === "metas" && <MetasTab data={dashboardData} metas={metasData} month={fullMonthData.month} unit={selectedUnit} />}

        {activeTab === "riscos" && <RiscosTab alerts={alerts} evalMonth={evalMonth} />}

        {activeTab === "acessos" && podeGerirAcessos() && <AcessosTab />}
        </main>
      </div>
    </div>
    </UnitNavProvider>
  );
};

export default Index;
