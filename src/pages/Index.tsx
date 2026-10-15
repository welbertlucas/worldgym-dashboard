import { useCallback, useEffect, useRef, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { RevenueChart } from "@/components/RevenueChart";
import { ChurnChart } from "@/components/ChurnChart";
import { RenovacoesChart } from "@/components/RenovacoesChart";
import NovosContratosChart from "@/components/NovosContratosChart";
import { VendasOnlineChart } from "@/components/VendasOnlineChart";
import InadimplenciaChart from "@/components/InadimplenciaChart";
import { DateFilter } from "@/components/DateFilter";
import { ComparisonCard } from "@/components/ComparisonCard";
import { UnidadesTab } from "@/components/tabs/UnidadesTab";
import { SectionTitle } from "@/components/SectionTitle";
import { ExecutivaTab } from "@/components/tabs/ExecutivaTab";
import { RiscosTab } from "@/components/tabs/RiscosTab";
import { MetasTab } from "@/components/tabs/MetasTab";
import { computeAlerts } from "@/data/alerts";
import { computeUnitDeltas } from "@/data/unitMetrics";
import { metasData, syncMetasFromSheets } from "@/data/metas";
import { getLastClosedMonth, isPartialMonth } from "@/data/periods";
import {
  getLatestData, getDataByMonth, comparePeriods, dashboardData,
  getLast12MonthsAverage, getUnitData, syncDashboardDataFromSheets,
} from "@/data/dashboardData";
import { Button } from "@/components/ui/button";
import { Sidebar, MobileDrawer } from "@/components/Sidebar";
import { Notice } from "@/components/Notice";
import {
  TrendingUp, Users, DollarSign, AlertCircle, ShoppingCart,
  RefreshCw, Menu, Calendar, Dumbbell, Shirt, Coffee, Star, Smile, MessageSquare,
} from "lucide-react";
import { formatAbbreviatedNumber } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [compareMonth, setCompareMonth] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
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
    setActiveTab(id);
    mainRef.current?.scrollIntoView({ block: "start" });
  };
  const [, forceTick] = useState(0);

  const refresh = async (silent = false) => {
    setSyncing(true);
    const [res] = await Promise.all([syncDashboardDataFromSheets(), syncMetasFromSheets()]);
    setSyncing(false);
    if (res.ok) {
      setLoadedAt(new Date());
      setSelectedMonth(getLatestData().month);
      forceTick((n) => n + 1);
      if (!silent) toast({ title: "Dados atualizados", description: `${res.count} meses carregados da planilha.` });
    } else if (!silent) {
      toast({ title: "Falha ao atualizar", description: res.error, variant: "destructive" });
    }
  };

  useEffect(() => {
    refresh(true);
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

  const comparison = compareMonth ? comparePeriods(fullMonthData.month, compareMonth, selectedUnit) : null;

  const months = dashboardData.map((d) => d.month);
  const evalMonth = getLastClosedMonth(months);
  const alerts = computeAlerts(dashboardData, metasData);
  const evalIdx = evalMonth ? months.indexOf(evalMonth) : -1;
  const unitDeltas = evalIdx > 0 ? computeUnitDeltas(dashboardData[evalIdx], dashboardData[evalIdx - 1]) : [];
  const selIdx = months.indexOf(fullMonthData.month);
  const prevMonthData = selIdx > 0 ? dashboardData[selIdx - 1] : undefined;
  const partialSelected = isPartialMonth(fullMonthData.month);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Carregando dados da planilha...</p>
        </div>
      </div>
    );
  }

  return (
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
                <h1 className="text-base sm:text-xl font-semibold tracking-tight text-foreground leading-tight truncate">
                  Dashboard de resultados
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm truncate first-letter:uppercase">
                  {selectedUnit ? selectedUnit : "Rede"} • {formatDate(fullMonthData.month)}
                  {compareMonth && ` x ${formatDate(compareMonth)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
            {loadedAt && (
              <p className="hidden md:block text-xs text-muted-foreground tabular-nums">
                Carregado às {loadedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh(false)}
              disabled={syncing}
              aria-label="Atualizar da planilha"
              className="shrink-0 text-xs font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
              <span className="hidden sm:inline">{syncing ? "Atualizando..." : "Atualizar da planilha"}</span>
            </Button>
            </div>
          </div>
        </header>

        <main ref={mainRef} className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-8 max-w-[1600px] scroll-mt-20">
        {/* Filtros */}
        <DateFilter
          selectedMonth={fullMonthData.month}
          compareMonth={compareMonth}
          selectedUnit={selectedUnit}
          onMonthChange={setSelectedMonth}
          onCompareMonthChange={setCompareMonth}
          onUnitChange={setSelectedUnit}
        />

        {/* Comparativo */}
        {comparison && (
          <section>
            <SectionTitle>Comparativo de períodos</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <ComparisonCard title="Faturamento" value1={comparison.faturamento.month1} value2={comparison.faturamento.month2} diff={comparison.faturamento.diff} month1={comparison.month1} month2={comparison.month2} format="currency" />
              <ComparisonCard title="Ticket Médio" value1={comparison.ticketMedio.month1} value2={comparison.ticketMedio.month2} diff={comparison.ticketMedio.diff} month1={comparison.month1} month2={comparison.month2} format="currency" />
              <ComparisonCard title="Clientes Ativos" value1={comparison.adimplentes.month1} value2={comparison.adimplentes.month2} diff={comparison.adimplentes.diff} month1={comparison.month1} month2={comparison.month2} format="number" />
              <ComparisonCard title="Taxa de Churn" value1={comparison.churn.month1.toFixed(1)} value2={comparison.churn.month2.toFixed(1)} diff={comparison.churn.diff} month1={comparison.month1} month2={comparison.month2} format="percentage" invertColors />
              <ComparisonCard title="Taxa de Conversão" value1={comparison.icv.month1.toFixed(1)} value2={comparison.icv.month2.toFixed(1)} diff={comparison.icv.diff} month1={comparison.month1} month2={comparison.month2} format="percentage" />
              <ComparisonCard title="Vendas Online" value1={comparison.vendasOnline.month1} value2={comparison.vendasOnline.month2} diff={comparison.vendasOnline.diff} month1={comparison.month1} month2={comparison.month2} format="currency" />
              <ComparisonCard title="Novos Contratos" value1={comparison.novosContratos.month1} value2={comparison.novosContratos.month2} diff={comparison.novosContratos.diff} month1={comparison.month1} month2={comparison.month2} format="number" />
              <ComparisonCard title="Saldo de Clientes" value1={comparison.saldoClientes.month1} value2={comparison.saldoClientes.month2} diff={comparison.saldoClientes.diff} month1={comparison.month1} month2={comparison.month2} format="number" />
              <ComparisonCard title="Taxa de Inadimplência" value1={comparison.inadimplenciaPerc.month1.toFixed(1)} value2={comparison.inadimplenciaPerc.month2.toFixed(1)} diff={comparison.inadimplenciaPerc.diff} month1={comparison.month1} month2={comparison.month2} format="percentage" invertColors />
              <ComparisonCard title="Taxa de Renovação" value1={comparison.renovacoes.month1.toFixed(1)} value2={comparison.renovacoes.month2.toFixed(1)} diff={comparison.renovacoes.diff} month1={comparison.month1} month2={comparison.month2} format="percentage" />
            </div>
          </section>
        )}

        {partialSelected && activeTab !== "executiva" && (
          <Notice><b>{formatDate(fullMonthData.month)}</b> está em andamento — os valores são parciais.</Notice>
        )}

        {activeTab === "executiva" && (
          <ExecutivaTab
            month={fullMonthData}
            prev={prevMonthData}
            alerts={alerts}
            evalMonth={evalMonth}
            deltas={unitDeltas}
            metas={metasData}
            onOpenRiscos={() => changeTab("riscos")}
            onOpenUnidades={() => changeTab("unidades")}
          />
        )}

        {activeTab === "comercial" && (
          <section>
            <SectionTitle>Comercial</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6 mb-6">
            <MetricCard title="Novos Contratos" value={currentData.units.reduce((sum, unit) => sum + unit.novosContratos, 0).toLocaleString("pt-BR")} icon={TrendingUp} variant="success" className="lg:col-span-2" />
            <MetricCard title="Saldo de Clientes" value={(currentData.units.reduce((sum, unit) => sum + unit.novosContratos, 0) - currentData.total.cancelados).toLocaleString("pt-BR")} icon={Users} variant="default" className="lg:col-span-2" />
            <MetricCard title="Taxa de Conversão" value={formatPercentage(currentData.total.icv)} icon={TrendingUp} variant="success" className="lg:col-span-2" />
            <MetricCard title="Vendas Online" value={formatCurrency(currentData.total.vendasOnline)} subtitle={currentData.total.faturamento ? `${((currentData.total.vendasOnline / currentData.total.faturamento) * 100).toFixed(2)}% do faturamento` : undefined} icon={ShoppingCart} variant="default" className="lg:col-span-2" />
            <MetricCard title="Diárias" value={currentData.total.diarias ? formatCurrency(currentData.total.diarias) : "—"} icon={Calendar} variant="default" className="lg:col-span-2" />
            <MetricCard title="Taxa de Personal" value={currentData.total.personal ? formatCurrency(currentData.total.personal) : "—"} icon={Dumbbell} variant="default" className="lg:col-span-2" />
            <MetricCard title="Camisetas" value={currentData.total.camisetas ? formatCurrency(currentData.total.camisetas) : "—"} icon={Shirt} variant="default" className="lg:col-span-2" />
            <MetricCard title="Coqueteleiras" value={currentData.total.coqueteleiras ? formatCurrency(currentData.total.coqueteleiras) : "—"} icon={Coffee} variant="default" className="lg:col-span-2" />
          </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <NovosContratosChart selectedUnit={selectedUnit} />
              <VendasOnlineChart selectedUnit={selectedUnit} />
            </div>
          </section>
        )}

        {activeTab === "financeiro" && (
          <section>
            <SectionTitle>Financeiro</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6 mb-6">
            <MetricCard title="Faturamento" value={formatAbbreviatedNumber(currentData.total.faturamento)} icon={DollarSign} variant="success" className="lg:col-span-2" />
            <MetricCard title="Recebimento" value={formatAbbreviatedNumber(currentData.total.recebimento)} icon={DollarSign} variant="success" className="lg:col-span-2" />
            <MetricCard title="Ticket Médio" value={formatCurrency(currentData.total.ticketMedio)} icon={DollarSign} variant="default" className="lg:col-span-2" />
          </div>
            <div className="grid grid-cols-1 gap-6 mb-6">
              <RevenueChart selectedUnit={selectedUnit} />
            </div>
          </section>
        )}

        {activeTab === "retencao" && (
          <section>
            <SectionTitle>Retenção e Satisfação</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6 mb-6">
            <MetricCard title="Adimplentes" value={currentData.total.adimplentes.toLocaleString("pt-BR")} icon={Users} variant="default" className="lg:col-span-2" />
            <MetricCard title="Taxa de Renovação" value={formatPercentage(currentData.total.renovacoes)} icon={TrendingUp} variant="success" className="lg:col-span-2" />
            <MetricCard title="Taxa de Churn" value={formatPercentage(currentData.total.churn)} icon={AlertCircle} variant={currentData.total.churn < 5 ? "success" : currentData.total.churn < 8 ? "warning" : "destructive"} className="lg:col-span-2" />
            <MetricCard title="Taxa de Inadimplência" value={formatPercentage(currentData.total.inadimplenciaPerc)} icon={AlertCircle} variant={currentData.total.inadimplenciaPerc < 5 ? "success" : currentData.total.inadimplenciaPerc < 8 ? "warning" : "destructive"} className="lg:col-span-2" />
            <MetricCard title="Nota do Google" value={currentData.total.notaGoogle ? currentData.total.notaGoogle.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "—"} icon={Star} variant="success" className="lg:col-span-2" />
            <MetricCard title="NPS" value={currentData.total.nps ? currentData.total.nps.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "—"} icon={Smile} variant="success" className="lg:col-span-2" />
            {!selectedUnit && (
              <MetricCard title="Nota Reclame Aqui" value={fullMonthData.total.reclameAqui ? fullMonthData.total.reclameAqui.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "—"} icon={MessageSquare} variant="success" className="lg:col-span-2" />
            )}
          </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <ChurnChart selectedUnit={selectedUnit} />
              <InadimplenciaChart selectedUnit={selectedUnit} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <RenovacoesChart selectedUnit={selectedUnit} />
            </div>
          </section>
        )}

        {activeTab === "unidades" && (
          <UnidadesTab
            selectedMonth={fullMonthData.month}
            evalMonth={evalMonth}
            prevEvalMonth={evalIdx > 0 ? dashboardData[evalIdx - 1].month : null}
            deltas={unitDeltas}
          />
        )}

        {activeTab === "metas" && <MetasTab data={dashboardData} metas={metasData} month={fullMonthData.month} />}

        {activeTab === "riscos" && <RiscosTab alerts={alerts} evalMonth={evalMonth} />}
        </main>
      </div>
    </div>
  );
};

export default Index;
