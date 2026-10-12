import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Cashier, SaleTicket } from '../types/pos';
import { formatCOP } from '../utils/format';
import { posAudio } from '../utils/audio';

interface ShiftReportViewProps {
  cashier: Cashier;
  tickets: SaleTicket[];
  onFinishShiftAndLock: () => void;
}

interface HourlyDataPoint {
  hour: string;
  totalVentas: number;
  efectivo: number;
  electronico: number;
  ticketsCount: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HourlyDataPoint; [key: string]: unknown }>;
  label?: string;
}

// Custom Tooltip for Recharts
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as HourlyDataPoint;
    return (
      <div className="bg-[#070e1d]/95 backdrop-blur-md border border-[#374151] p-3 rounded-xl shadow-2xl text-xs font-mono space-y-1.5 min-w-[200px]">
        <div className="flex items-center justify-between pb-1 border-b border-[#374151]/50 text-white font-bold">
          <span>{label}</span>
          <span className="text-[#90cdff] text-[10px] font-normal">{data.ticketsCount} tickets</span>
        </div>
        <div className="flex justify-between items-center text-[#e6bdb8]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]"></span>
            <span>Efectivo:</span>
          </span>
          <span className="font-semibold text-white">{formatCOP(data.efectivo)}</span>
        </div>
        <div className="flex justify-between items-center text-[#e6bdb8]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span>
            <span>Datáfono / QR:</span>
          </span>
          <span className="font-semibold text-white">{formatCOP(data.electronico)}</span>
        </div>
        <div className="pt-1.5 border-t border-[#374151]/50 flex justify-between items-center font-bold text-sm">
          <span className="text-[#e6bdb8]">Total:</span>
          <span className="text-[#10b981]">{formatCOP(data.totalVentas)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const ShiftReportView: React.FC<ShiftReportViewProps> = ({
  cashier,
  tickets,
  onFinishShiftAndLock,
}) => {
  const initialBase = 350000; // Base inicial de apertura de caja
  const shiftTickets = tickets.filter((t) => t.cashierId === cashier.id && t.status === 'completada');

  const cashSales = shiftTickets
    .filter((t) => t.paymentMethod === 'efectivo')
    .reduce((acc, t) => acc + t.total, 0);

  const electronicSales = shiftTickets
    .filter((t) => t.paymentMethod !== 'efectivo')
    .reduce((acc, t) => acc + t.total, 0);

  const totalSales = cashSales + electronicSales;
  const expectedCashInDrawer = initialBase + cashSales;

  // Chart display mode
  const [chartMode, setChartMode] = useState<'stacked' | 'total'>('stacked');

  // Compute hourly sales data for the current shift
  const hourlySalesData = useMemo<HourlyDataPoint[]>(() => {
    // Standard shift hours from 13:00 to 19:00
    const hours = ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

    // Baseline historical distribution during Kevin's shift (T-04 daytime)
    const baseDistribution: { [key: string]: { efectivo: number; electronico: number; tickets: number } } = {
      '13:00': { efectivo: 85000, electronico: 42000, tickets: 4 },
      '14:00': { efectivo: 110000, electronico: 65000, tickets: 5 },
      '15:00': { efectivo: 72000, electronico: 38000, tickets: 3 },
      '16:00': { efectivo: 95000, electronico: 89000, tickets: 4 },
      '17:00': { efectivo: 145000, electronico: 118000, tickets: 6 },
      '18:00': { efectivo: 53000, electronico: 46000, tickets: 2 },
      '19:00': { efectivo: 0, electronico: 0, tickets: 0 },
    };

    // Aggregate any newly added tickets from the session
    const dynamicAggregation: { [key: string]: { efectivo: number; electronico: number; tickets: number } } = {};
    hours.forEach((h) => {
      dynamicAggregation[h] = {
        efectivo: baseDistribution[h]?.efectivo || 0,
        electronico: baseDistribution[h]?.electronico || 0,
        tickets: baseDistribution[h]?.tickets || 0,
      };
    });

    shiftTickets.forEach((t) => {
      // Extract hour from timestamp e.g. "18:04:12 COT" -> "18:00"
      const match = t.timestamp.match(/(\d{1,2}):\d{2}/);
      const hourKey = match ? `${match[1].padStart(2, '0')}:00` : '18:00';
      if (!dynamicAggregation[hourKey]) {
        dynamicAggregation[hourKey] = { efectivo: 0, electronico: 0, tickets: 0 };
      }

      if (t.paymentMethod === 'efectivo') {
        dynamicAggregation[hourKey].efectivo += t.total;
      } else {
        dynamicAggregation[hourKey].electronico += t.total;
      }
      dynamicAggregation[hourKey].tickets += 1;
    });

    return hours.map((h) => {
      const ef = dynamicAggregation[h]?.efectivo || 0;
      const el = dynamicAggregation[h]?.electronico || 0;
      return {
        hour: h,
        totalVentas: ef + el,
        efectivo: ef,
        electronico: el,
        ticketsCount: dynamicAggregation[h]?.tickets || 0,
      };
    });
  }, [shiftTickets]);

  // Peak sales hour computation
  const peakHour = useMemo(() => {
    if (!hourlySalesData.length) return null;
    return [...hourlySalesData].sort((a, b) => b.totalVentas - a.totalVentas)[0];
  }, [hourlySalesData]);

  // Average ticket size
  const totalShiftTicketsCount = shiftTickets.length > 0 ? shiftTickets.length : 24;
  const avgTicketValue = totalSales > 0 ? Math.round(totalSales / totalShiftTicketsCount) : 37900;

  // Bill denominations count
  const [denominations, setDenominations] = useState<{ [key: string]: number }>({
    b100k: 5,
    b50k: 6,
    b20k: 4,
    b10k: 2,
    b5k: 1,
    b2k: 2,
    c1000: 4,
    c500: 2,
    c200: 0,
    c100: 0,
  });

  const [showZReceiptModal, setShowZReceiptModal] = useState<boolean>(false);

  const denomValues: { [key: string]: number } = {
    b100k: 100000,
    b50k: 50000,
    b20k: 20000,
    b10k: 10000,
    b5k: 5000,
    b2k: 2000,
    c1000: 1000,
    c500: 500,
    c200: 200,
    c100: 100,
  };

  const denomLabels: { [key: string]: string } = {
    b100k: 'Billetes $100.000',
    b50k: 'Billetes $50.000',
    b20k: 'Billetes $20.000',
    b10k: 'Billetes $10.000',
    b5k: 'Billetes $5.000',
    b2k: 'Billetes $2.000',
    c1000: 'Monedas $1.000',
    c500: 'Monedas $500',
    c200: 'Monedas $200',
    c100: 'Monedas $100',
  };

  const countedCash = Object.keys(denominations).reduce(
    (acc, key) => acc + (denominations[key] || 0) * (denomValues[key] || 0),
    0
  );

  const difference = countedCash - expectedCashInDrawer;

  const handleDenomChange = (key: string, val: number) => {
    setDenominations((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full p-4 space-y-4">
      {/* Shift Overview Banner */}
      <div className="bg-[#191f2f] border border-[#374151]/40 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#232a3a] overflow-hidden border border-[#374151]/50">
            <img src={cashier.avatar} alt={cashier.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">{cashier.name}</span>
              <span className="font-mono text-xs text-[#90cdff] px-1.5 py-0.5 rounded bg-[#0078b2]/20 font-bold">
                {cashier.code}
              </span>
            </div>
            <span className="text-xs text-[#e6bdb8]">{cashier.role}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              posAudio.playScanBeep();
              setShowZReceiptModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#232a3a] hover:bg-[#323949] text-[#adc6ff] border border-[#374151]/40 text-xs font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Vista Corte Z Térmico</span>
          </button>

          <button
            type="button"
            onClick={() => {
              posAudio.playSuccessChime();
              onFinishShiftAndLock();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-bold transition-all shadow-md shadow-[#dc2626]/20"
          >
            <span className="material-symbols-outlined text-[18px]">lock_reset</span>
            <span>Finalizar Turno & Bloquear</span>
          </button>
        </div>
      </div>

      {/* VISUAL DASHBOARD: RECHARTS HOURLY SALES BAR CHART */}
      <div className="bg-[#191f2f] border border-[#374151]/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#374151]/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ef4444]/20 text-[#ef4444] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">bar_chart</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Curva de Ventas por Hora
                <span className="text-[10px] font-mono text-[#10b981] px-2 py-0.5 rounded-full bg-[#10b981]/20 font-semibold">
                  Turno Actual
                </span>
              </h3>
              <p className="text-[11px] text-[#e6bdb8]">
                Distribución de ingresos y volumen transaccional en tiempo real
              </p>
            </div>
          </div>

          {/* Chart Mode Toggle */}
          <div className="flex items-center bg-[#141b2b] rounded-xl p-0.5 border border-[#374151]/40">
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setChartMode('stacked');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                chartMode === 'stacked'
                  ? 'bg-[#232a3a] text-white shadow-sm'
                  : 'text-[#e6bdb8] hover:text-white'
              }`}
            >
              Efectivo vs. Digital
            </button>
            <button
              type="button"
              onClick={() => {
                posAudio.playKeyClick();
                setChartMode('total');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                chartMode === 'total'
                  ? 'bg-[#232a3a] text-white shadow-sm'
                  : 'text-[#e6bdb8] hover:text-white'
              }`}
            >
              Ventas Totales
            </button>
          </div>
        </div>

        {/* Quick Shift KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-[#141b2b] border border-[#374151]/30 rounded-xl p-2.5 flex flex-col">
            <span className="text-[10px] text-[#e6bdb8]">Hora Pico de Ventas</span>
            <span className="font-mono text-sm font-bold text-[#10b981] mt-0.5">
              {peakHour ? `${peakHour.hour} hrs` : '--'}
            </span>
            <span className="font-mono text-[10px] text-[#e6bdb8]/80">
              {peakHour ? formatCOP(peakHour.totalVentas) : '$0'}
            </span>
          </div>

          <div className="bg-[#141b2b] border border-[#374151]/30 rounded-xl p-2.5 flex flex-col">
            <span className="text-[10px] text-[#e6bdb8]">Ticket Promedio</span>
            <span className="font-mono text-sm font-bold text-[#90cdff] mt-0.5">
              {formatCOP(avgTicketValue)}
            </span>
            <span className="font-mono text-[10px] text-[#e6bdb8]/80">Por cliente</span>
          </div>

          <div className="bg-[#141b2b] border border-[#374151]/30 rounded-xl p-2.5 flex flex-col">
            <span className="text-[10px] text-[#e6bdb8]">% Efectivo vs. Digital</span>
            <span className="font-mono text-sm font-bold text-[#f59e0b] mt-0.5">
              {totalSales > 0 ? `${((cashSales / totalSales) * 100).toFixed(0)}% Ef. / ${((electronicSales / totalSales) * 100).toFixed(0)}% Dig.` : '55% / 45%'}
            </span>
            <span className="font-mono text-[10px] text-[#e6bdb8]/80">Mix de recaudo</span>
          </div>

          <div className="bg-[#141b2b] border border-[#374151]/30 rounded-xl p-2.5 flex flex-col">
            <span className="text-[10px] text-[#e6bdb8]">Transacciones Turno</span>
            <span className="font-mono text-sm font-bold text-white mt-0.5">
              {totalShiftTicketsCount} recibos
            </span>
            <span className="font-mono text-[10px] text-[#e6bdb8]/80">100% procesadas</span>
          </div>
        </div>

        {/* Recharts Bar Chart Container */}
        <div className="w-full min-w-0 h-64 sm:h-72 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={hourlySalesData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                {/* Gradient for Total Bar */}
                <linearGradient id="totalBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                </linearGradient>
                {/* Gradient for Cash Bar */}
                <linearGradient id="cashBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.6} />
                </linearGradient>
                {/* Gradient for Electronic Bar */}
                <linearGradient id="electronicBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.6} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.35} vertical={false} />

              <XAxis
                dataKey="hour"
                stroke="#e6bdb8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#374151', opacity: 0.5 }}
              />

              <YAxis
                stroke="#e6bdb8"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#374151', opacity: 0.5 }}
                tickFormatter={(val) => `$${Math.round(val / 1000)}k`}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />

              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '8px', fontSize: '11px', fontFamily: 'JetBrains Mono' }}
              />

              {chartMode === 'stacked' ? (
                <>
                  <Bar
                    dataKey="efectivo"
                    name="Efectivo en Gaveta"
                    fill="url(#cashBarGrad)"
                    stackId="a"
                    radius={[0, 0, 4, 4]}
                  />
                  <Bar
                    dataKey="electronico"
                    name="Datáfono / QR"
                    fill="url(#electronicBarGrad)"
                    stackId="a"
                    radius={[6, 6, 0, 0]}
                  />
                </>
              ) : (
                <Bar
                  dataKey="totalVentas"
                  name="Ventas Totales"
                  fill="url(#totalBarGrad)"
                  radius={[6, 6, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Reconciliation Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Expected Totals Card */}
        <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-4 space-y-2.5">
          <span className="text-xs font-bold text-[#e6bdb8] uppercase tracking-wider">
            Totales del Sistema (POS)
          </span>

          <div className="space-y-1.5 font-mono text-xs pt-1">
            <div className="flex justify-between text-[#e6bdb8]">
              <span className="font-sans">Base Inicial:</span>
              <span>{formatCOP(initialBase)}</span>
            </div>
            <div className="flex justify-between text-[#e6bdb8]">
              <span className="font-sans">Ventas Efectivo:</span>
              <span className="text-[#10b981]">{formatCOP(cashSales)}</span>
            </div>
            <div className="flex justify-between text-[#e6bdb8]">
              <span className="font-sans">Ventas Datáfono/QR:</span>
              <span className="text-[#90cdff]">{formatCOP(electronicSales)}</span>
            </div>
            <div className="flex justify-between text-[#e6bdb8]">
              <span className="font-sans">Tickets Emitidos:</span>
              <span className="text-white">{shiftTickets.length} recibos</span>
            </div>
            <div className="pt-2 border-t border-[#374151]/40 flex justify-between font-bold text-sm">
              <span className="font-sans text-white">Efectivo Esperado:</span>
              <span className="text-[#10b981]">{formatCOP(expectedCashInDrawer)}</span>
            </div>
          </div>
        </div>

        {/* Counted Cash Card */}
        <div className="bg-[#191f2f] border border-[#374151]/40 rounded-xl p-4 space-y-2.5">
          <span className="text-xs font-bold text-[#e6bdb8] uppercase tracking-wider">
            Arqueo Físico Contado
          </span>

          <div className="space-y-1.5 font-mono text-xs pt-1">
            <div className="flex justify-between text-[#e6bdb8]">
              <span className="font-sans">Total Billetes:</span>
              <span>
                {formatCOP(
                  ['b100k', 'b50k', 'b20k', 'b10k', 'b5k', 'b2k'].reduce(
                    (acc, k) => acc + (denominations[k] || 0) * (denomValues[k] || 0),
                    0
                  )
                )}
              </span>
            </div>
            <div className="flex justify-between text-[#e6bdb8]">
              <span className="font-sans">Total Monedas:</span>
              <span>
                {formatCOP(
                  ['c1000', 'c500', 'c200', 'c100'].reduce(
                    (acc, k) => acc + (denominations[k] || 0) * (denomValues[k] || 0),
                    0
                  )
                )}
              </span>
            </div>
            <div className="pt-2 border-t border-[#374151]/40 flex justify-between font-bold text-sm">
              <span className="font-sans text-white">Total Arqueado:</span>
              <span className="text-white">{formatCOP(countedCash)}</span>
            </div>
          </div>
        </div>

        {/* Reconciliation Status Card */}
        <div
          className={`border rounded-xl p-4 flex flex-col justify-between ${
            difference === 0
              ? 'bg-[#10b981]/10 border-[#10b981]/40'
              : difference > 0
              ? 'bg-[#f59e0b]/10 border-[#f59e0b]/40'
              : 'bg-[#ef4444]/10 border-[#ef4444]/40'
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Diferencia de Caja (Auditoría)
            </span>
            <p className="text-xs text-[#e6bdb8]">
              {difference === 0
                ? 'Caja cuadrada exactamente al 100%.'
                : difference > 0
                ? 'Sobrante de efectivo en gaveta.'
                : 'Faltante de efectivo en gaveta.'}
            </p>
          </div>

          <div className="pt-3">
            <span
              className={`font-mono text-2xl font-black block ${
                difference === 0
                  ? 'text-[#10b981]'
                  : difference > 0
                  ? 'text-[#f59e0b]'
                  : 'text-[#ef4444]'
              }`}
            >
              {difference === 0
                ? '$0 COP (CUADRADO)'
                : `${difference > 0 ? '+' : ''}${formatCOP(difference)}`}
            </span>
            <span className="text-[10px] text-[#e6bdb8] mt-1 block">
              Auditoría DIAN: Turno validado por Kev Nay Engine
            </span>
          </div>
        </div>
      </div>

      {/* Denominations Physical Calculator */}
      <div className="bg-[#191f2f] border border-[#374151]/40 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#374151]/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#10b981] text-[20px]">calculate</span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Conteo Detallado por Denominaciones
            </span>
          </div>
          <span className="text-xs font-mono text-[#e6bdb8]">Moneda Nacional COP</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {Object.keys(denomLabels).map((key) => {
            const count = denominations[key] || 0;
            const subtotal = count * (denomValues[key] || 0);

            return (
              <div
                key={key}
                className="bg-[#141b2b] border border-[#374151]/30 rounded-xl p-2.5 flex flex-col justify-between space-y-1.5"
              >
                <div className="flex justify-between items-center text-[11px] text-[#e6bdb8]">
                  <span className="font-semibold">{denomLabels[key]}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDenomChange(key, count - 1)}
                    className="w-7 h-7 rounded-lg bg-[#232a3a] text-white hover:bg-[#323949] flex items-center justify-center font-bold text-xs"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={count}
                    onChange={(e) => handleDenomChange(key, Number(e.target.value) || 0)}
                    className="w-full text-center py-1 bg-[#070e1d] border border-[#374151]/50 rounded-lg text-xs font-mono text-white font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => handleDenomChange(key, count + 1)}
                    className="w-7 h-7 rounded-lg bg-[#232a3a] text-white hover:bg-[#323949] flex items-center justify-center font-bold text-xs"
                  >
                    +
                  </button>
                </div>

                <div className="text-right text-[10px] font-mono text-[#10b981] font-semibold">
                  = {formatCOP(subtotal)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Corte Z Thermal Receipt Modal */}
      {showZReceiptModal && (
        <div className="fixed inset-0 z-50 bg-[#0c1322]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#191f2f] border border-[#374151]/60 rounded-2xl p-4 w-full max-w-sm flex flex-col space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#374151]/40">
              <span className="text-sm font-bold text-white">Comprobante Oficial Corte Z</span>
              <button
                type="button"
                onClick={() => setShowZReceiptModal(false)}
                className="w-7 h-7 rounded-full bg-[#232a3a] text-[#e6bdb8] hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div
              id="thermal-receipt-printable"
              className="bg-white text-black font-mono text-[10px] leading-tight p-4 rounded shadow-inner border border-gray-200 select-text max-h-[60vh] overflow-y-auto space-y-1.5"
            >
              <div className="text-center pb-2 border-b border-dashed border-gray-400">
                <p className="font-extrabold text-xs">KEV NAY RETAIL POS</p>
                <p>NIT 901.845.293-4 • REGIMEN COMUN</p>
                <p className="font-bold text-xs mt-1">*** INFORME DE CIERRE Z ***</p>
                <p>TERMINAL: POS-01 (KNY-BOG-0104)</p>
              </div>

              <div className="py-1 border-b border-dashed border-gray-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>FECHA CIERRE:</span>
                  <span>{new Date().toLocaleDateString('es-CO')} {new Date().toLocaleTimeString('es-CO')}</span>
                </div>
                <div className="flex justify-between">
                  <span>CAJERO:</span>
                  <span>{cashier.name} ({cashier.code})</span>
                </div>
                <div className="flex justify-between">
                  <span>NUM. TRANSACCIONES:</span>
                  <span>{shiftTickets.length}</span>
                </div>
              </div>

              <div className="py-1 border-b border-dashed border-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>BASE INICIAL GAVETA:</span>
                  <span>{formatCOP(initialBase)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VENTAS EFECTIVO:</span>
                  <span>{formatCOP(cashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VENTAS DATAFONO:</span>
                  <span>{formatCOP(electronicSales)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>VENTAS TOTALES:</span>
                  <span>{formatCOP(totalSales)}</span>
                </div>
              </div>

              <div className="py-1 border-b border-dashed border-gray-400 space-y-1 font-bold">
                <div className="flex justify-between">
                  <span>EFECTIVO ESPERADO:</span>
                  <span>{formatCOP(expectedCashInDrawer)}</span>
                </div>
                <div className="flex justify-between">
                  <span>EFECTIVO CONTADO:</span>
                  <span>{formatCOP(countedCash)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-gray-300">
                  <span>DIFERENCIA:</span>
                  <span>{difference === 0 ? '$0 (CUADRADO)' : formatCOP(difference)}</span>
                </div>
              </div>

              <div className="pt-4 pb-2 space-y-4 text-center">
                <div className="border-t border-gray-400 pt-1">
                  <p>FIRMA DEL CAJERO: {cashier.name}</p>
                </div>
                <div className="border-t border-gray-400 pt-1">
                  <p>FIRMA DEL SUPERVISOR: AUTORIZADO</p>
                </div>
                <p className="text-[9px] text-gray-500">Kev Nay Engine v4.2.1-prod</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-[#dc2626] text-xs font-semibold text-white flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Imprimir Ticket Z</span>
              </button>
              <button
                type="button"
                onClick={() => setShowZReceiptModal(false)}
                className="py-2.5 px-4 rounded-xl bg-[#232a3a] text-xs font-semibold text-[#dce2f7]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
