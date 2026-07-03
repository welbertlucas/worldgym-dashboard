import { useEffect, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { RevenueChart } from "@/components/RevenueChart";
import { TopUnitsTable } from "@/components/TopUnitsTable";
import { ChurnChart } from "@/components/ChurnChart";
import { RenovacoesChart } from "@/components/RenovacoesChart";
import NovosContratosChart from "@/components/NovosContratosChart";
import { VendasOnlineChart } from "@/components/VendasOnlineChart";
import InadimplenciaChart from "@/components/InadimplenciaChart";
import { DateFilter } from "@/components/DateFilter";
import { ComparisonCard } from "@/components/ComparisonCard";
import { UnitComparison } from "@/components/UnitComparison";
import {
  getLatestData, getDataByMonth, comparePeriods, dashboardData,
  getLast12MonthsAverage, getUnitData, syncDashboardDataFromSheets,
} from "@/data/dashboardData";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, Users, DollarSign, AlertCircle, ShoppingCart,
  RefreshCw, Calendar, Dumbbell, Shirt, Coffee, Star,
} from "lucide-react";
import { formatAbbreviatedNumber } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import wgLogo from "@/assets/wg-logo.png";

const Index = () => {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [compareMonth, setCompareMonth] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [, forceTick] = useState(0);

  const refresh = async (silent = false) => {
    setSyncing(true);
    const res = await syncDashboardDataFromSheets();
    setSyncing(false);
    if (res.ok) {
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
        },
      }
    : fullMonthData;

  const comparison = compareMonth ? comparePeriods(fullMonthData.month, compareMonth, selectedUnit) : null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 backdrop-blur-sm sticky top-0 z-50 bg-background/95 shadow-sm">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
              <img src={wgLogo} alt="World Gym" className="h-10 sm:h-14 w-auto" />
              <div className="sm:border-l border-border/60 sm:pl-6">
                <h1 className="font-display text-xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Dashboard de Resultados
                </h1>
                <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
                  {selectedUnit ? selectedUnit : "Rede"} • {formatDate(fullMonthData.month)}
                  {compareMonth && ` vs ${formatDate(compareMonth)}`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh(false)}
              disabled={syncing}
              className="self-start sm:self-auto text-xs font-semibold"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Atualizando..." : "Atualizar da planilha"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
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
            <div className="flex items-center gap-4 mb-4 sm:mb-6">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">Comparativo de Períodos</h2>
              <div className="h-px flex-1 bg-border/60" />
            </div>
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

        {/* KPIs */}
        <section>
          <div className="flex items-center gap-4 mb-4 sm:mb-6">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">Métricas Principais</h2>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
            <MetricCard title="Faturamento" value={formatAbbreviatedNumber(currentData.total.faturamento)} icon={DollarSign} variant="success" className="lg:col-span-2" />
            <MetricCard title="Ticket Médio" value={formatCurrency(currentData.total.ticketMedio)} icon={DollarSign} variant="default" className="lg:col-span-2" />
            <MetricCard title="Vendas Online" value={formatCurrency(currentData.total.vendasOnline)} subtitle={currentData.total.faturamento ? `${((currentData.total.vendasOnline / currentData.total.faturamento) * 100).toFixed(2)}% do faturamento` : undefined} icon={ShoppingCart} variant="default" className="lg:col-span-2" />
            <MetricCard title="Novos Contratos" value={currentData.units.reduce((sum, unit) => sum + unit.novosContratos, 0).toLocaleString("pt-BR")} icon={TrendingUp} variant="success" className="lg:col-span-2" />
            <MetricCard title="Adimplentes" value={currentData.total.adimplentes.toLocaleString("pt-BR")} icon={Users} variant="default" className="lg:col-span-2" />
            <MetricCard title="Saldo de Clientes" value={(currentData.units.reduce((sum, unit) => sum + unit.novosContratos, 0) - currentData.total.cancelados).toLocaleString("pt-BR")} icon={Users} variant="default" className="lg:col-span-2" />
            <MetricCard title="Taxa de Renovação" value={formatPercentage(currentData.total.renovacoes)} icon={TrendingUp} variant="success" className="lg:col-span-2" />
            <MetricCard title="Taxa de Churn" value={formatPercentage(currentData.total.churn)} icon={AlertCircle} variant={currentData.total.churn < 0.05 ? "success" : currentData.total.churn < 0.08 ? "warning" : "destructive"} className="lg:col-span-2" />
            <MetricCard title="Taxa de Inadimplência" value={formatPercentage(currentData.total.inadimplenciaPerc / 100)} icon={AlertCircle} variant={currentData.total.inadimplenciaPerc < 5 ? "success" : currentData.total.inadimplenciaPerc < 8 ? "warning" : "destructive"} className="lg:col-span-2" />
            <MetricCard title="Taxa de Conversão" value={formatPercentage(currentData.total.icv)} icon={TrendingUp} variant="success" className="lg:col-span-2" />
            <MetricCard title="Diárias" value={formatCurrency(currentData.total.diarias ?? 0)} icon={Calendar} variant="default" className="lg:col-span-2" />
            <MetricCard title="Taxa de Personal" value={formatCurrency(currentData.total.personal ?? 0)} icon={Dumbbell} variant="default" className="lg:col-span-2" />
            <MetricCard title="Camisetas" value={formatCurrency(currentData.total.camisetas ?? 0)} icon={Shirt} variant="default" className="lg:col-span-2" />
            <MetricCard title="Coqueteleiras" value={formatCurrency(currentData.total.coqueteleiras ?? 0)} icon={Coffee} variant="default" className="lg:col-span-2" />
            <MetricCard title="Nota do Google" value={(currentData.total.notaGoogle ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} icon={Star} variant="success" className="lg:col-span-2" />
          </div>
        </section>

        {/* Gráficos */}
        <section>
          <div className="flex items-center gap-4 mb-4 sm:mb-6">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">Gráficos de Performance</h2>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <RevenueChart selectedUnit={selectedUnit} />
            <NovosContratosChart selectedUnit={selectedUnit} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <VendasOnlineChart selectedUnit={selectedUnit} />
            <ChurnChart selectedUnit={selectedUnit} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <RenovacoesChart selectedUnit={selectedUnit} />
            <InadimplenciaChart selectedUnit={selectedUnit} />
          </div>
        </section>

        {/* Tabela por unidade */}
        <section>
          <TopUnitsTable selectedMonth={fullMonthData.month} />
        </section>

        {/* Comparativo unidade vs unidade */}
        <section>
          <UnitComparison selectedMonth={fullMonthData.month} />
        </section>
      </main>
    </div>
  );
};

export default Index;
