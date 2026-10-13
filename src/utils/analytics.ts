import { SaleTicket, Product } from '../types/pos';
import { INITIAL_PRODUCTS, INITIAL_CASHIERS } from '../data/mockData';

export interface DailySalesMetric {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g., 'Lun 06', 'Hoy Lun 12'
  dayName: string; // 'Lunes', 'Martes', etc.
  totalSales: number;
  ticketCount: number;
  averageTicket: number;
  itemsSold: number;
}

export interface TopProductMetric {
  productId: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  costPrice: number;
  unitsSold: number;
  totalRevenue: number;
  totalProfit: number;
  profitMarginPercent: number;
}

export interface PaymentMethodMetric {
  method: string;
  label: string;
  totalSales: number;
  ticketCount: number;
  percentage: number;
  color: string;
}

export interface CategoryMetric {
  category: string;
  totalSales: number;
  unitsSold: number;
  percentage: number;
}

export interface AnalyticsSummary {
  totalSalesWeek: number;
  totalTicketsWeek: number;
  averageTicketWeek: number;
  totalUnitsSoldWeek: number;
  estimatedGrossProfit: number;
  grossMarginPercent: number;
  topProduct: TopProductMetric | null;
  dailyMetrics: DailySalesMetric[];
  topProducts: TopProductMetric[];
  paymentMetrics: PaymentMethodMetric[];
  categoryMetrics: CategoryMetric[];
}

/**
 * Format currency in Colombian Pesos
 */
export const formatCurrencyCOP = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
};

/**
 * Short currency formatter for chart axis (e.g., $150K, $1.2M)
 */
export const formatCompactCOP = (amount: number): string => {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}k`;
  }
  return `$${amount}`;
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const FULL_DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Generate a realistic baseline of tickets for the last 7 days anchored to today
 * Ensures the charts display comprehensive, beautiful historical data
 */
export const generateWeeklyBaselineTickets = (): SaleTicket[] => {
  const tickets: SaleTicket[] = [];
  const today = new Date();

  // Baseline sales pattern for the last 7 days (daysAgo 6 down to 0)
  // [6 days ago, 5 days ago, ..., today]
  const pattern = [
    { daysAgo: 6, count: 5, baseSales: 185000 },
    { daysAgo: 5, count: 6, baseSales: 240000 },
    { daysAgo: 4, count: 7, baseSales: 310000 },
    { daysAgo: 3, count: 8, baseSales: 420000 },
    { daysAgo: 2, count: 11, baseSales: 580000 }, // Weekend spike
    { daysAgo: 1, count: 9, baseSales: 490000 }, // Sunday
    { daysAgo: 0, count: 4, baseSales: 165000 }, // Today
  ];

  let ticketCounter = 1000;

  pattern.forEach(({ daysAgo, count }) => {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysAgo);
    const dateStr = targetDate.toISOString().split('T')[0];

    for (let i = 0; i < count; i++) {
      ticketCounter++;
      // Pick 1 to 3 products
      const pIdx1 = (ticketCounter * 3) % INITIAL_PRODUCTS.length;
      const pIdx2 = (ticketCounter * 7 + 1) % INITIAL_PRODUCTS.length;
      const qty1 = (ticketCounter % 3) + 1;
      const qty2 = ((ticketCounter + 2) % 2) + 1;

      const p1 = INITIAL_PRODUCTS[pIdx1];
      const p2 = INITIAL_PRODUCTS[pIdx2];

      const items = [
        { product: p1, quantity: qty1, discountPercent: 0 },
        ...(pIdx1 !== pIdx2 ? [{ product: p2, quantity: qty2, discountPercent: ticketCounter % 5 === 0 ? 5 : 0 }] : []),
      ];

      const rawSubtotal = items.reduce((acc, it) => acc + it.product.price * it.quantity, 0);
      const discountTotal = items.reduce(
        (acc, it) => acc + (it.product.price * it.quantity * it.discountPercent) / 100,
        0
      );
      const total = Math.max(0, rawSubtotal - discountTotal);
      const taxTotal = Math.round(
        items.reduce((acc, it) => {
          const itemNet = (it.product.price * it.quantity * (100 - it.discountPercent)) / 100;
          return acc + (itemNet * it.product.taxRate) / (1 + it.product.taxRate);
        }, 0)
      );

      const paymentMethods: ('efectivo' | 'tarjeta' | 'qr_transfer')[] = [
        'efectivo',
        'tarjeta',
        'qr_transfer',
        'efectivo',
        'qr_transfer',
      ];
      const method = paymentMethods[ticketCounter % paymentMethods.length];
      const cashier = INITIAL_CASHIERS[ticketCounter % INITIAL_CASHIERS.length];

      const hours = String(8 + ((ticketCounter * 2) % 12)).padStart(2, '0');
      const minutes = String((ticketCounter * 17) % 60).padStart(2, '0');

      tickets.push({
        id: `t-${ticketCounter}`,
        ticketNumber: `#T-${ticketCounter}`,
        timestamp: `${dateStr} ${hours}:${minutes}:00 COT`,
        date: dateStr,
        cashierId: cashier.id,
        cashierName: cashier.name,
        customerName: ticketCounter % 3 === 0 ? 'Cliente Ocasional' : `Cliente #${ticketCounter % 40}`,
        items,
        subtotal: total - taxTotal,
        taxTotal,
        discountTotal,
        total,
        paymentMethod: method,
        amountPaid: method === 'efectivo' ? total + (ticketCounter % 4) * 2000 : total,
        changeReturned: method === 'efectivo' ? (ticketCounter % 4) * 2000 : 0,
        status: 'completada',
      });
    }
  });

  return tickets;
};

/**
 * Calculate weekly analytics metrics from a list of tickets
 */
export const calculateAnalyticsMetrics = (
  tickets: SaleTicket[],
  currentProducts: Product[]
): AnalyticsSummary => {
  const today = new Date();
  const completedTickets = tickets.filter((t) => t.status === 'completada');

  // Generate date keys for the last 7 days (index 0 = 6 days ago, index 6 = today)
  const last7Days: { dateStr: string; dayLabel: string; dayName: string; isToday: boolean }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();
    const dayOfMonth = String(d.getDate()).padStart(2, '0');
    const dayLabel = i === 0 ? `Hoy ${DAY_NAMES[dayOfWeek]} ${dayOfMonth}` : `${DAY_NAMES[dayOfWeek]} ${dayOfMonth}`;
    const dayName = FULL_DAY_NAMES[dayOfWeek];

    last7Days.push({
      dateStr,
      dayLabel,
      dayName,
      isToday: i === 0,
    });
  }

  // 1. Daily Sales aggregation for last 7 days
  const dailyMetricsMap = new Map<string, DailySalesMetric>();
  last7Days.forEach(({ dateStr, dayLabel, dayName }) => {
    dailyMetricsMap.set(dateStr, {
      date: dateStr,
      dayLabel,
      dayName,
      totalSales: 0,
      ticketCount: 0,
      averageTicket: 0,
      itemsSold: 0,
    });
  });

  const todayStr = today.toISOString().split('T')[0];

  completedTickets.forEach((ticket) => {
    // Determine ticket date: use ticket.date or match timestamp
    let ticketDate = ticket.date;
    if (!ticketDate) {
      if (ticket.timestamp.includes('Hoy')) {
        ticketDate = todayStr;
      } else {
        const match = ticket.timestamp.match(/\d{4}-\d{2}-\d{2}/);
        if (match) {
          ticketDate = match[0];
        } else {
          ticketDate = todayStr;
        }
      }
    }

    if (dailyMetricsMap.has(ticketDate)) {
      const metric = dailyMetricsMap.get(ticketDate)!;
      metric.totalSales += ticket.total;
      metric.ticketCount += 1;
      const soldInTicket = ticket.items.reduce((acc, it) => acc + it.quantity, 0);
      metric.itemsSold += soldInTicket;
    }
  });

  // Finalize average tickets
  const dailyMetrics: DailySalesMetric[] = last7Days.map(({ dateStr }) => {
    const m = dailyMetricsMap.get(dateStr)!;
    m.averageTicket = m.ticketCount > 0 ? Math.round(m.totalSales / m.ticketCount) : 0;
    return m;
  });

  // 2. Top-Selling Products aggregation across the last 7 days
  const validDatesSet = new Set(last7Days.map((d) => d.dateStr));
  const productStatsMap = new Map<
    string,
    {
      units: number;
      revenue: number;
      product: Product;
    }
  >();

  // Initialize with catalog items so metadata is available
  currentProducts.forEach((p) => {
    productStatsMap.set(p.id, {
      units: 0,
      revenue: 0,
      product: p,
    });
  });

  completedTickets.forEach((ticket) => {
    let ticketDate = ticket.date;
    if (!ticketDate) {
      ticketDate = ticket.timestamp.includes('Hoy') ? todayStr : todayStr;
    }

    // Only count if within the 7-day window
    if (validDatesSet.has(ticketDate) || ticketDate === todayStr) {
      ticket.items.forEach((item) => {
        const pId = item.product.id;
        const existing = productStatsMap.get(pId);
        const itemNetRevenue = (item.product.price * item.quantity * (100 - item.discountPercent)) / 100;

        if (existing) {
          existing.units += item.quantity;
          existing.revenue += itemNetRevenue;
        } else {
          productStatsMap.set(pId, {
            units: item.quantity,
            revenue: itemNetRevenue,
            product: item.product,
          });
        }
      });
    }
  });

  const topProducts: TopProductMetric[] = Array.from(productStatsMap.values())
    .filter((entry) => entry.units > 0)
    .map(({ units, revenue, product }) => {
      const totalCost = product.costPrice * units;
      const profit = Math.max(0, revenue - totalCost);
      const profitMarginPercent = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price,
        costPrice: product.costPrice,
        unitsSold: units,
        totalRevenue: Math.round(revenue),
        totalProfit: Math.round(profit),
        profitMarginPercent,
      };
    })
    .sort((a, b) => b.unitsSold - a.unitsSold);

  // 3. Payment methods aggregation
  let cashTotal = 0;
  let cashCount = 0;
  let cardTotal = 0;
  let cardCount = 0;
  let qrTotal = 0;
  let qrCount = 0;

  completedTickets.forEach((ticket) => {
    let ticketDate = ticket.date || todayStr;
    if (validDatesSet.has(ticketDate) || ticketDate === todayStr) {
      if (ticket.paymentMethod === 'efectivo') {
        cashTotal += ticket.total;
        cashCount += 1;
      } else if (ticket.paymentMethod === 'tarjeta') {
        cardTotal += ticket.total;
        cardCount += 1;
      } else {
        qrTotal += ticket.total;
        qrCount += 1;
      }
    }
  });

  const totalPaymentSales = cashTotal + cardTotal + qrTotal || 1;

  const paymentMetrics: PaymentMethodMetric[] = [
    {
      method: 'efectivo',
      label: 'Efectivo en Caja',
      totalSales: cashTotal,
      ticketCount: cashCount,
      percentage: Math.round((cashTotal / totalPaymentSales) * 100),
      color: '#10b981', // Emerald
    },
    {
      method: 'tarjeta',
      label: 'Datáfono / Tarjetas',
      totalSales: cardTotal,
      ticketCount: cardCount,
      percentage: Math.round((cardTotal / totalPaymentSales) * 100),
      color: '#3b82f6', // Blue
    },
    {
      method: 'qr_transfer',
      label: 'Nequi / Bancolombia QR',
      totalSales: qrTotal,
      ticketCount: qrCount,
      percentage: Math.round((qrTotal / totalPaymentSales) * 100),
      color: '#f59e0b', // Amber
    },
  ];

  // 4. Category breakdown
  const categoryMap = new Map<string, { totalSales: number; unitsSold: number }>();
  topProducts.forEach((p) => {
    const existing = categoryMap.get(p.category) || { totalSales: 0, unitsSold: 0 };
    existing.totalSales += p.totalRevenue;
    existing.unitsSold += p.unitsSold;
    categoryMap.set(p.category, existing);
  });

  const totalWeekSales = dailyMetrics.reduce((sum, d) => sum + d.totalSales, 0);

  const categoryMetrics: CategoryMetric[] = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      totalSales: stats.totalSales,
      unitsSold: stats.unitsSold,
      percentage: totalWeekSales > 0 ? Math.round((stats.totalSales / totalWeekSales) * 100) : 0,
    }))
    .sort((a, b) => b.totalSales - a.totalSales);

  // Summary figures
  const totalTicketsWeek = dailyMetrics.reduce((sum, d) => sum + d.ticketCount, 0);
  const averageTicketWeek = totalTicketsWeek > 0 ? Math.round(totalWeekSales / totalTicketsWeek) : 0;
  const totalUnitsSoldWeek = topProducts.reduce((sum, p) => sum + p.unitsSold, 0);
  const estimatedGrossProfit = topProducts.reduce((sum, p) => sum + p.totalProfit, 0);
  const grossMarginPercent =
    totalWeekSales > 0 ? Math.round((estimatedGrossProfit / totalWeekSales) * 100) : 0;

  return {
    totalSalesWeek: totalWeekSales,
    totalTicketsWeek,
    averageTicketWeek,
    totalUnitsSoldWeek,
    estimatedGrossProfit,
    grossMarginPercent,
    topProduct: topProducts.length > 0 ? topProducts[0] : null,
    dailyMetrics,
    topProducts,
    paymentMetrics,
    categoryMetrics,
  };
};
