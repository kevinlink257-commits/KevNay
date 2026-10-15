import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { SaleTicket, Product, Cashier, OperatingHoursConfig } from '../types/pos';
import {
  calculateAnalyticsMetrics,
  formatCurrencyCOP,
  formatCompactCOP,
  DailySalesMetric,
  TopProductMetric,
} from '../utils/analytics';
import { posAudio } from '../utils/audio';
import { StoreOperatingHoursSection } from './StoreOperatingHoursSection';
import {
  checkIsWithinOperatingHours,
  DEFAULT_OPERATING_HOURS,
} from '../utils/operatingHours';

interface AdminAnalyticsDashboardProps {
  tickets: SaleTicket[];
  products: Product[];
  currentCashier: Cashier;
  onOpenPos?: () => void;
  onOpenInventory?: () => void;
  onSimulateSale?: () => void;
  operatingHours?: OperatingHoursConfig;
  onUpdateOperatingHours?: (newConfig: OperatingHoursConfig) => void;
}

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  tickets,
  products,
  currentCashier,
  onOpenPos,
  onOpenInventory,
  onSimulateSale,
  operatingHours = DEFAULT_OPERATING_HOURS,
  onUpdateOperatingHours,
}) => {
  // View states
  const [salesChartType, setSalesChartType] = useState<'area' | 'bar'>('area');
  const [productRankingBy, setProductRankingBy] = useState<'units' | 'revenue'>('units');
  const [activeTabSection, setActiveTabSection] = useState<'overview' | 'products' | 'daily' | 'schedule'>('overview');
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<boolean>(false);

  // Calculate metrics based on current tickets and catalog
  const analytics = useMemo(() => {
    return calculateAnalyticsMetrics(tickets, products);
  }, [tickets, products]);

  // Real-time operating hours status for today
  const storeStatus = useMemo(() => {
    return checkIsWithinOperatingHours(operatingHours);
  }, [operatingHours]);

  // Prepared data for Top Products Chart (top 7)
  const topProductsChartData = useMemo(() => {
    const list = [...analytics.topProducts];
    if (productRankingBy === 'revenue') {
      list.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } else {
      list.sort((a, b) => b.unitsSold - a.unitsSold);
    }
    return list.slice(0, 7).map((item) => ({
      name: item.name.length > 22 ? `${item.name.slice(0, 20)}...` : item.name,
      fullName: item.name,
      sku: item.sku,
      category: item.category,
      unitsSold: item.unitsSold,
      totalRevenue: item.totalRevenue,
      formattedRevenue: formatCurrencyCOP(item.totalRevenue),
      price: item.price,
      profit: item.totalProfit,
    }));
  }, [analytics.topProducts, productRankingBy]);

  // Export CSV summary of the weekly sales
  const handleExportCSV = () => {
    posAudio.playKeyClick();
    const rows = [
      ['Reporte de Ventas Semanales - Kev Nay POS'],
      [`Fecha de Exportación: ${new Date().toLocaleString('es-CO')}`],
      [`Generado por: ${currentCashier.name} (${currentCashier.code})`],
      [''],
      ['--- DESGLOSE DIARIO DE LA ULTIMA SEMANA ---'],
      ['Fecha', 'Día', 'Total Ventas (COP)', 'Tickets', 'Ticket Promedio (COP)', 'Unidades'],
      ...analytics.dailyMetrics.map((d) => [
        d.date,
        d.dayName,
        d.totalSales,
        d.ticketCount,
        d.averageTicket,
        d.itemsSold,
      ]),
      [''],
      ['--- PRODUCTOS MAS VENDIDOS ---'],
      ['SKU', 'Producto', 'Categoría', 'Unidades Vendidas', 'Ingresos Totales (COP)', 'Utilidad Estimada (COP)'],
      ...analytics.topProducts.map((p) => [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        p.category,
        p.unitsSold,
        p.totalRevenue,
        p.totalProfit,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `reporte_ventas_semana_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccessNotice(true);
    setTimeout(() => setDownloadSuccessNotice(false), 3500);
  };

  return (
    <div className="flex flex-col space-y-6 pb-20 max-w-7xl mx-auto w-full">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#191f2f] p-5 rounded-2xl border border-[#374151]/40 shadow-xl">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-[#f59e0b]/20 border border-[#f59e0b]/40 rounded-xl text-[#f59e0b] shrink-0">
            <span className="material-symbols-outlined text-[26px]">monitoring</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Métricas & Analítica de Ventas
              </h2>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 font-semibold">
                Últimos 7 Días
              </span>
            </div>
            <p className="text-xs text-[#e6bdb8] mt-0.5">
              Rendimiento comercial del terminal POS-01 · Datos consolidados en tiempo real
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onSimulateSale && (
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onSimulateSale();
              }}
              title="Registra una venta rápida aleatoria para probar la actualización en vivo de las métricas"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] border border-[#374151]/40 text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
              <span>+ Venta de Prueba</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#10b981]/20 hover:bg-[#10b981] text-[#10b981] hover:text-black border border-[#10b981]/40 text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Exportar CSV</span>
          </button>

          {onOpenPos && (
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onOpenPos();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
              <span>Ir a Caja</span>
            </button>
          )}
        </div>
      </div>

      {/* Zero State Notice when all sales have been reset to 0 */}
      {tickets.length === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs shadow-lg animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <span className="material-symbols-outlined text-[24px]">restart_alt</span>
            </div>
            <div>
              <p className="font-bold text-white text-sm">Sistema de Ventas Restablecido a $0</p>
              <p className="text-[11px] text-gray-300">
                Se han borrado los datos anteriores de ventas. Las métricas y gráficos iniciarán limpios con tus nuevas transacciones.
              </p>
            </div>
          </div>
          {onOpenPos && (
            <button
              type="button"
              onClick={onOpenPos}
              className="px-4 py-2 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-bold transition-all shadow-md active:scale-95 shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
              <span>Comenzar Nuevas Ventas</span>
            </button>
          )}
        </div>
      )}

      {/* CSV Export Notice */}
      {downloadSuccessNotice && (
        <div className="flex items-center gap-2 p-3 bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981] rounded-xl text-xs font-semibold animate-fadeIn">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>Reporte CSV de la última semana generado y descargado exitosamente.</span>
        </div>
      )}

      {/* Key KPI Summary Strip (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Ventas Semana */}
        <div className="bg-[#191f2f] p-4 rounded-xl border border-[#374151]/30 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-[#e6bdb8] text-xs">
            <span className="font-medium">Ventas Totales (7 días)</span>
            <span className="material-symbols-outlined text-[18px] text-[#10b981]">payments</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {formatCurrencyCOP(analytics.totalSalesWeek)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#10b981] font-mono">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            <span>{analytics.totalTicketsWeek} transacciones completadas</span>
          </div>
        </div>

        {/* KPI 2: Ticket Promedio */}
        <div className="bg-[#191f2f] p-4 rounded-xl border border-[#374151]/30 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-[#e6bdb8] text-xs">
            <span className="font-medium">Ticket Promedio (AOV)</span>
            <span className="material-symbols-outlined text-[18px] text-[#3b82f6]">receipt</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {formatCurrencyCOP(analytics.averageTicketWeek)}
            </div>
          </div>
          <div className="text-[11px] text-[#90cdff] font-mono">
            <span>{analytics.totalUnitsSoldWeek} unidades totales vendidas</span>
          </div>
        </div>

        {/* KPI 3: Producto Estrella */}
        <div className="bg-[#191f2f] p-4 rounded-xl border border-[#374151]/30 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-[#e6bdb8] text-xs">
            <span className="font-medium">Producto Más Vendido</span>
            <span className="material-symbols-outlined text-[18px] text-[#f59e0b]">star</span>
          </div>
          <div className="my-1.5">
            <div className="text-sm font-bold text-white truncate" title={analytics.topProduct?.name || 'N/A'}>
              {analytics.topProduct ? analytics.topProduct.name : 'Sin ventas registradas'}
            </div>
            <div className="text-xs text-[#f59e0b] font-mono font-bold mt-0.5">
              {analytics.topProduct
                ? `${analytics.topProduct.unitsSold} uds · ${formatCurrencyCOP(analytics.topProduct.totalRevenue)}`
                : '$0'}
            </div>
          </div>
          <div className="text-[11px] text-[#e6bdb8]">
            {analytics.topProduct ? `SKU: ${analytics.topProduct.sku}` : 'Catálogo activo'}
          </div>
        </div>

        {/* KPI 4: Utilidad Bruta Estimada */}
        <div className="bg-[#191f2f] p-4 rounded-xl border border-[#374151]/30 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-[#e6bdb8] text-xs">
            <span className="font-medium">Utilidad Bruta Estimada</span>
            <span className="material-symbols-outlined text-[18px] text-[#a855f7]">account_balance_wallet</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {formatCurrencyCOP(analytics.estimatedGrossProfit)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#c084fc] font-mono">
            <span className="material-symbols-outlined text-[14px]">percent</span>
            <span>Margen bruto est. {analytics.grossMarginPercent}%</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#141b2b] rounded-xl border border-[#374151]/30 w-full sm:w-fit overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            posAudio.playKeyClick();
            setActiveTabSection('overview');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTabSection === 'overview'
              ? 'bg-[#232a3a] text-white shadow-sm'
              : 'text-[#e6bdb8] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">dashboard</span>
          <span>Vista General</span>
        </button>
        <button
          type="button"
          onClick={() => {
            posAudio.playKeyClick();
            setActiveTabSection('daily');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTabSection === 'daily'
              ? 'bg-[#232a3a] text-white shadow-sm'
              : 'text-[#e6bdb8] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">calendar_view_week</span>
          <span>Desglose Día por Día</span>
        </button>
        <button
          type="button"
          onClick={() => {
            posAudio.playKeyClick();
            setActiveTabSection('products');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTabSection === 'products'
              ? 'bg-[#232a3a] text-white shadow-sm'
              : 'text-[#e6bdb8] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">leaderboard</span>
          <span>Ranking de Productos</span>
        </button>
        <button
          type="button"
          onClick={() => {
            posAudio.playKeyClick();
            setActiveTabSection('schedule');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap border ${
            activeTabSection === 'schedule'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
              : 'text-[#f59e0b] hover:text-white border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">schedule</span>
          <span>Horario Operativo</span>
          {operatingHours.enabled ? (
            storeStatus.isWithinHours ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )
          ) : null}
        </button>
      </div>

      {/* RENDER HORARIO OPERATIVO SECTION */}
      {activeTabSection === 'schedule' && (
        <StoreOperatingHoursSection
          config={operatingHours}
          onUpdateConfig={onUpdateOperatingHours || (() => {})}
          onOpenPos={onOpenPos}
        />
      )}

      {/* RENDER ANALYTICS CHARTS & KPI VIEW */}
      {activeTabSection !== 'schedule' && (
        <>
          {/* Quick Horario Operativo Summary Strip on Overview */}
          {activeTabSection === 'overview' && (
            <div className="bg-[#191f2f] border border-[#374151]/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    !operatingHours.enabled
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                      : storeStatus.isWithinHours
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">schedule</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">Horario Operativo de la Tienda</span>
                    {operatingHours.enabled ? (
                      storeStatus.isWithinHours ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                          ● ABIERTO (Hasta las {storeStatus.closeTimeFormatted})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                          ● FUERA DE HORARIO
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                        24/7 SIN RESTRICCIÓN
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#e6bdb8] mt-0.5">
                    {storeStatus.reason} · {storeStatus.nextChangeNote}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  setActiveTabSection('schedule');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#f59e0b] border border-[#f59e0b]/40 text-xs font-bold transition-all shadow-sm shrink-0 self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                <span>Configurar Horario</span>
              </button>
            </div>
          )}

          {/* MAIN SECTION 1: CHART 1 - Ventas Totales por Día durante la Última Semana */}
          <div className="bg-[#191f2f] p-5 rounded-2xl border border-[#374151]/40 shadow-xl flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#374151]/30">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#10b981]">calendar_view_week</span>
              <span>Ventas Totales por Día durante la Última Semana</span>
            </h3>
            <p className="text-xs text-[#e6bdb8] mt-0.5">
              Evolución de facturación diaria ($ COP) en los últimos 7 días calendario
            </p>
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#141b2b] rounded-lg border border-[#374151]/30 shrink-0">
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setSalesChartType('area');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                salesChartType === 'area'
                  ? 'bg-[#dc2626] text-white shadow-sm'
                  : 'text-[#e6bdb8] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">show_chart</span>
              <span>Área</span>
            </button>
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setSalesChartType('bar');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                salesChartType === 'bar'
                  ? 'bg-[#dc2626] text-white shadow-sm'
                  : 'text-[#e6bdb8] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">bar_chart</span>
              <span>Barras</span>
            </button>
          </div>
        </div>

        {/* Recharts Area / Bar Chart Container */}
        <div className="w-full h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {salesChartType === 'area' ? (
              <AreaChart data={analytics.dailyMetrics} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3346" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#8f9eb5"
                  tick={{ fontSize: 11, fill: '#8f9eb5' }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis
                  stroke="#8f9eb5"
                  tick={{ fontSize: 11, fill: '#8f9eb5' }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={formatCompactCOP}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DailySalesMetric;
                      return (
                        <div className="bg-[#0f172a] p-3 rounded-xl border border-[#374151] shadow-2xl text-xs font-sans space-y-1.5 min-w-[180px]">
                          <div className="font-bold text-white border-b border-[#374151]/50 pb-1 flex justify-between">
                            <span>{data.dayName}</span>
                            <span className="font-mono text-[#94a3b8]">{label}</span>
                          </div>
                          <div className="flex justify-between items-center text-[#10b981]">
                            <span>Ventas Totales:</span>
                            <span className="font-mono font-bold">{formatCurrencyCOP(data.totalSales)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[#90cdff]">
                            <span>Tickets Emitidos:</span>
                            <span className="font-mono font-bold">{data.ticketCount} transacciones</span>
                          </div>
                          <div className="flex justify-between items-center text-[#e6bdb8]">
                            <span>Ticket Promedio:</span>
                            <span className="font-mono">{formatCurrencyCOP(data.averageTicket)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[#f59e0b] text-[11px] pt-1 border-t border-[#374151]/30">
                            <span>Artículos Vendidos:</span>
                            <span className="font-mono font-bold">{data.itemsSold} uds.</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalSales"
                  name="Ventas Totales"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#salesGrad)"
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <BarChart data={analytics.dailyMetrics} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3346" vertical={false} />
                <XAxis
                  dataKey="dayLabel"
                  stroke="#8f9eb5"
                  tick={{ fontSize: 11, fill: '#8f9eb5' }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis
                  stroke="#8f9eb5"
                  tick={{ fontSize: 11, fill: '#8f9eb5' }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={formatCompactCOP}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DailySalesMetric;
                      return (
                        <div className="bg-[#0f172a] p-3 rounded-xl border border-[#374151] shadow-2xl text-xs font-sans space-y-1.5 min-w-[180px]">
                          <div className="font-bold text-white border-b border-[#374151]/50 pb-1 flex justify-between">
                            <span>{data.dayName}</span>
                            <span className="font-mono text-[#94a3b8]">{label}</span>
                          </div>
                          <div className="flex justify-between items-center text-[#10b981]">
                            <span>Ventas Totales:</span>
                            <span className="font-mono font-bold">{formatCurrencyCOP(data.totalSales)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[#90cdff]">
                            <span>Tickets:</span>
                            <span className="font-mono font-bold">{data.ticketCount}</span>
                          </div>
                          <div className="flex justify-between items-center text-[#e6bdb8]">
                            <span>Ticket Promedio:</span>
                            <span className="font-mono">{formatCurrencyCOP(data.averageTicket)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="totalSales"
                  name="Ventas Totales"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Quick summary below chart */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#374151]/30 text-xs">
          {analytics.dailyMetrics.slice(-4).map((m, idx) => (
            <div key={idx} className="flex flex-col p-2 bg-[#141b2b] rounded-lg border border-[#374151]/20">
              <span className="text-[#8f9eb5] text-[10px]">{m.dayName} ({m.dayLabel})</span>
              <span className="font-mono font-bold text-white text-xs mt-0.5">{formatCurrencyCOP(m.totalSales)}</span>
              <span className="text-[10px] text-[#10b981]">{m.ticketCount} ventas</span>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN SECTION 2: GRID FOR TOP PRODUCTS & PAYMENT METHODS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CHART 2: Productos Más Vendidos (7 cols on lg) */}
        <div className="lg:col-span-7 bg-[#191f2f] p-5 rounded-2xl border border-[#374151]/40 shadow-xl flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#374151]/30">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#f59e0b]">leaderboard</span>
                <span>Top Productos Más Vendidos</span>
              </h3>
              <p className="text-xs text-[#e6bdb8] mt-0.5">
                Artículos con mayor rotación e ingresos generados durante la semana
              </p>
            </div>

            {/* Toggle metric */}
            <div className="flex items-center gap-1 p-1 bg-[#141b2b] rounded-lg border border-[#374151]/30 shrink-0">
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  setProductRankingBy('units');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  productRankingBy === 'units'
                    ? 'bg-[#f59e0b] text-[#1a1200] font-bold shadow-sm'
                    : 'text-[#e6bdb8] hover:text-white'
                }`}
              >
                Por Unidades
              </button>
              <button
                type="button"
                onClick={() => {
                  posAudio.playKeyClick();
                  setProductRankingBy('revenue');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  productRankingBy === 'revenue'
                    ? 'bg-[#f59e0b] text-[#1a1200] font-bold shadow-sm'
                    : 'text-[#e6bdb8] hover:text-white'
                }`}
              >
                Por Ingresos ($)
              </button>
            </div>
          </div>

          {/* Recharts BarChart for Top Products */}
          <div className="w-full h-80 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProductsChartData}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3346" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#8f9eb5"
                  tick={{ fontSize: 10, fill: '#8f9eb5' }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={productRankingBy === 'revenue' ? formatCompactCOP : (val) => `${val} u`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#8f9eb5"
                  tick={{ fontSize: 11, fill: '#dce2f7' }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  width={110}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#0f172a] p-3 rounded-xl border border-[#374151] shadow-2xl text-xs space-y-1 min-w-[210px]">
                          <div className="font-bold text-white border-b border-[#374151]/50 pb-1">
                            {data.fullName}
                          </div>
                          <div className="text-[#8f9eb5] font-mono text-[10px]">
                            SKU: {data.sku} · {data.category}
                          </div>
                          <div className="flex justify-between items-center text-[#f59e0b] pt-1">
                            <span>Unidades Vendidas:</span>
                            <span className="font-mono font-bold text-white">{data.unitsSold} uds</span>
                          </div>
                          <div className="flex justify-between items-center text-[#10b981]">
                            <span>Ingresos Totales:</span>
                            <span className="font-mono font-bold">{data.formattedRevenue}</span>
                          </div>
                          <div className="flex justify-between items-center text-[#c084fc]">
                            <span>Utilidad Generada:</span>
                            <span className="font-mono">{formatCurrencyCOP(data.profit)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey={productRankingBy === 'revenue' ? 'totalRevenue' : 'unitsSold'}
                  name={productRankingBy === 'revenue' ? 'Ingresos ($)' : 'Unidades Vendidas'}
                  fill={productRankingBy === 'revenue' ? '#10b981' : '#f59e0b'}
                  radius={[0, 6, 6, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 3: Distribución por Método de Pago & Categoría (5 cols on lg) */}
        <div className="lg:col-span-5 bg-[#191f2f] p-5 rounded-2xl border border-[#374151]/40 shadow-xl flex flex-col justify-between space-y-4">
          <div className="pb-3 border-b border-[#374151]/30">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#3b82f6]">pie_chart</span>
              <span>Métodos de Pago Utilizados</span>
            </h3>
            <p className="text-xs text-[#e6bdb8] mt-0.5">
              Participación de cada canal de recaudo en la semana
            </p>
          </div>

          {/* Recharts PieChart */}
          <div className="w-full h-52 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.paymentMetrics}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={4}
                  dataKey="totalSales"
                  nameKey="label"
                >
                  {analytics.paymentMetrics.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as (typeof analytics.paymentMetrics)[0];
                      return (
                        <div className="bg-[#0f172a] p-2.5 rounded-xl border border-[#374151] shadow-xl text-xs space-y-1">
                          <span className="font-bold text-white block">{data.label}</span>
                          <div className="flex justify-between gap-4 font-mono text-[#10b981]">
                            <span>Ventas:</span>
                            <span className="font-bold">{formatCurrencyCOP(data.totalSales)}</span>
                          </div>
                          <div className="flex justify-between gap-4 font-mono text-[#94a3b8] text-[11px]">
                            <span>Participación:</span>
                            <span>{data.percentage}% ({data.ticketCount} tickets)</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Clean Legend breakdown */}
          <div className="flex flex-col space-y-2 pt-2 border-t border-[#374151]/30">
            {analytics.paymentMetrics.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  ></span>
                  <span className="text-[#dce2f7]">{p.label}</span>
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-white font-bold">{formatCurrencyCOP(p.totalSales)}</span>
                  <span className="text-[#8f9eb5] text-[11px] w-9 text-right">{p.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3: DETAILED TABULAR BREAKDOWN */}
      <div className="bg-[#191f2f] p-5 rounded-2xl border border-[#374151]/40 shadow-xl flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#374151]/30">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#dc2626]">format_list_numbered</span>
              <span>Tabla de Detalle: Rotación de Productos & Stock</span>
            </h3>
            <p className="text-xs text-[#e6bdb8] mt-0.5">
              Consolidado de unidades vendidas vs inventario restante disponible en góndola
            </p>
          </div>

          {onOpenInventory && (
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                onOpenInventory();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] border border-[#374151]/40 text-xs font-semibold transition-colors w-fit"
            >
              <span className="material-symbols-outlined text-[16px]">inventory_2</span>
              <span>Ver Inventario Completo</span>
            </button>
          )}
        </div>

        {/* High-Density Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#374151]/50 text-[#8f9eb5] text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Producto / SKU</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3 text-right">Precio Venta</th>
                <th className="py-2.5 px-3 text-right">Uds. Vendidas</th>
                <th className="py-2.5 px-3 text-right">Ingresos Totales</th>
                <th className="py-2.5 px-3 text-right">Utilidad Est.</th>
                <th className="py-2.5 px-3 text-right">Stock Góndola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#374151]/20 font-sans">
              {analytics.topProducts.map((prod, index) => {
                const catalogProd = products.find((p) => p.id === prod.productId);
                const currentStock = catalogProd ? catalogProd.stock : 0;
                const minStock = catalogProd ? catalogProd.minStock : 5;
                const isLowStock = currentStock <= minStock;

                return (
                  <tr
                    key={prod.productId}
                    className="hover:bg-[#232a3a]/50 transition-colors group"
                  >
                    <td className="py-2.5 px-3 font-mono text-[#8f9eb5] font-bold">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white group-hover:text-[#90cdff]">
                          {prod.name}
                        </span>
                        <span className="font-mono text-[10px] text-[#8f9eb5]">{prod.sku}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[#dce2f7]">{prod.category}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-white">
                      {formatCurrencyCOP(prod.price)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#f59e0b]">
                      {prod.unitsSold} uds
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#10b981]">
                      {formatCurrencyCOP(prod.totalRevenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#c084fc]">
                      {formatCurrencyCOP(prod.totalProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          currentStock === 0
                            ? 'bg-[#dc2626]/20 text-[#ef4444]'
                            : isLowStock
                            ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                            : 'bg-[#10b981]/20 text-[#10b981]'
                        }`}
                      >
                        {currentStock} disp.
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
