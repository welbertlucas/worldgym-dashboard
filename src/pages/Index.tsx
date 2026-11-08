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
import { KpiGrid, type KpiContext } from "@/components/kpi/KpiGrid";
import { comercialSpecs, complementaresSpecs, financeiroSpecs, retencaoSpecs } from "@/components/kpi/tabSpecs";
import { viewFor } from "@/data/kpiView";
import { computeAlerts, sameMonthLastYear } from "@/data/alerts";
import { computeUnitDeltas } from "@/data/unitMetrics";
import { metasData, syncMetasFromSheets } from "@/data/metas";
import { formatMonthLong, getLastClosedMonth, isPartialMonth } from "@/data/periods";
import {
  getLatestData, getDataByMonth, comparePeriods, dashboardData,
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
import { getToken, sair } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

/** Intervalo da atualização automática dos dados (planilha e metas). */
const AUTO_REFRESH_MS = 5 * 60 * 1000;

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

  const currentData = selectedUnit && unitData
    ? {
        month: fullMonthData.month,
        units: [unitData],
        total: {
          faturamento: unitData.faturamento,
          recebimento: unitData.recebimento,
          cac: unitData.cac,
          ticketMedio: unitData.ticketMedio,
          adimplentes: unitData.adimplentes,
          inadimplentes: unitData.inadimplentes,
          inadimplenciaPerc: unitData.inadimplenciaPerc,
          churn: unitData.churn,
          renovacoes: unitData.renovacoes,
          icv: unitData.icv,
          vendasOnline: unitData.vendasOnline,
          cancelados: unitData.cancelados,
          oportunidades: unitData.oportunidades,
          conversoes: unitData.conversoes,
          lifetime: unitData.lifetime,
          diarias: unitData.diarias,
          personal: unitData.personal,
          camisetas: unitData.camisetas,
          coqueteleiras: unitData.coqueteleiras,
          notaGoogle: unitData.notaGoogle,
          nps: unitData.nps,
          reclameAqui: unitData.reclameAqui,
        },
      }
    : fullMonthData;

  // Visão Executiva e Benchmark são sempre da rede: o filtro de unidade não aparece nem vale nelas.
  const semFiltroDeUnidade = activeTab === "executiva" || activeTab === "benchmark";
  const comparison = compareMonth ? comparePeriods(fullMonthData.month, compareMonth, semFiltroDeUnidade ? null : selectedUnit) : null;

  const months = dashboardData.map((d) => d.month);
  const evalMonth = getLastClosedMonth(months);
  const alerts = computeAlerts(dashboardData, metasData);
  const evalIdx = evalMonth ? months.indexOf(evalMonth) : -1;
  const unitDeltas = evalIdx > 0 ? computeUnitDeltas(dashboardData[evalIdx], dashboardData[evalIdx - 1]) : [];
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh(false)}
              disabled={syncing}
              aria-label="Atualizar da planilha"
              title={loadedAt ? `Dados carregados às ${loadedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${evoAtualizadoEm ? ` · EVO atualizado em ${new Date(evoAtualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}` : undefined}
              className="shrink-0 text-xs font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
              <span className="hidden sm:inline">{syncing ? "Atualizando..." : "Atualizar da planilha"}</span>
            </Button>
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
        {activeTab !== "mapa" && activeTab !== "campanhas" && <DateFilter
          selectedMonth={fullMonthData.month}
          compareMonth={compareMonth}
          selectedUnit={selectedUnit}
          onMonthChange={setSelectedMonth}
          onCompareMonthChange={setCompareMonth}
          onUnitChange={setSelectedUnit}
          hideUnit={semFiltroDeUnidade}
        />}

        {/* Comparativo */}
        {comparison && activeTab !== "unidades" && activeTab !== "mapa" && activeTab !== "campanhas" && (
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

        {partialSelected && activeTab !== "executiva" && activeTab !== "mapa" && activeTab !== "campanhas" && (
          <Notice><b>{formatDate(fullMonthData.month)}</b> está em andamento — os valores são parciais.</Notice>
        )}

        {activeTab === "executiva" && (
          <ExecutivaTab
            month={fullMonthData}
            prev={compareMonth ? getDataByMonth(compareMonth) ?? prevMonthData : prevMonthData}
            comparaMesEscolhido={!!compareMonth}
            alerts={alerts}
            evalMonth={evalMonth}
            deltas={unitDeltas}
            metas={metasData}
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
            <div className="mb-6"><KpiGrid ctx={kpiCtx} specs={complementaresSpecs} columns="xl:grid-cols-3" /></div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <NovosContratosChart selectedUnit={selectedUnit} />
              <VendasOnlineChart selectedUnit={selectedUnit} />
            </div>
            <div className="mb-6"><OrigemOportunidades total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} partial={partialSelected} unitLabel={selectedUnit ?? "Rede"} /></div>
            <div className="mb-6"><PerfilOportunidades total={kpiCtx.cur.total} monthLabel={formatMonthLong(fullMonthData.month)} partial={partialSelected} unitLabel={selectedUnit ?? "Rede"} /></div>
            <DonutList
              title="Receitas complementares"
              subtitle="Participação de cada receita na soma das cinco"
              center={{ value: formatAbbreviatedNumber(receitaComplementar(currentData.total)), caption: "soma das cinco" }}
              empty="Sem receitas complementares lançadas neste mês."
              items={[
                { label: "Diárias", value: currentData.total.diarias, color: "hsl(222 25% 22%)", valueText: formatCurrency(currentData.total.diarias) },
                { label: "Taxa de personal", value: currentData.total.personal, color: "hsl(4 90% 50%)", valueText: formatCurrency(currentData.total.personal) },
                { label: "Brinquedoteca", value: (currentData.total as { kids?: number }).kids ?? 0, color: "hsl(142 50% 38%)", valueText: formatCurrency((currentData.total as { kids?: number }).kids ?? 0) },
                { label: "Camisetas", value: currentData.total.camisetas, color: "hsl(222 14% 52%)", valueText: formatCurrency(currentData.total.camisetas) },
                { label: "Coqueteleiras", value: currentData.total.coqueteleiras, color: "hsl(220 14% 78%)", valueText: formatCurrency(currentData.total.coqueteleiras) },
              ]}
            />
          </section>
        )}

        {activeTab === "financeiro" && (
          <section>
            <SectionTitle>Financeiro</SectionTitle>
          <div className="mb-6"><KpiGrid ctx={kpiCtx} specs={financeiroSpecs} columns="xl:grid-cols-3" /></div>
            <div className="grid grid-cols-1 gap-6 mb-10">
              <RevenueChart selectedUnit={selectedUnit} />
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
          />
        )}

        {activeTab === "benchmark" && (
          <BenchmarkTab
            selectedMonth={fullMonthData.month}
            evalMonth={evalMonth}
            prevEvalMonth={evalIdx > 0 ? dashboardData[evalIdx - 1].month : null}
            deltas={unitDeltas}
          />
        )}


        {activeTab === "mapa" && <MapaAlunosTab initialUnit={selectedUnit} onUnitChange={setUnidadeDaAba} />}
        {activeTab === "campanhas" && <CampanhasTab initialUnit={selectedUnit} onUnitChange={setUnidadeDaAba} />}

        {activeTab === "metas" && <MetasTab data={dashboardData} metas={metasData} month={fullMonthData.month} unit={selectedUnit} />}

        {activeTab === "riscos" && <RiscosTab alerts={alerts} evalMonth={evalMonth} />}
        </main>
      </div>
    </div>
    </UnitNavProvider>
  );
};

export default Index;
