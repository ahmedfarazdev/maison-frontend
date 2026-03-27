// ============================================================
// Revenue Comparison — Subscription vs One-Time Orders
// Enterprise Power BI-style report with Overview + Detailed views
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp, TrendingDown, Download, DollarSign, Droplets,
  Package, BarChart3, ArrowUpDown, Minus, Calendar, Users,
  RefreshCcw, ShoppingCart, Crown, Target, Percent, ArrowRight,
  Box, Truck, Activity, Layers, Award, Eye, ChevronDown, ChevronUp, ChevronRight,
  ArrowUp, ArrowDown, Minus as MinusIcon, Filter, Table2, PieChart,
  Zap, TrendingUp as TrendUp, Hash, CreditCard, Wallet, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import type { Order } from '@/types';
import { calculateOrderCost } from '@/components/orders/OrderCostBreakdown';

// ---- Date Range Presets ----
const DATE_PRESETS = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Quarter', value: 'this_quarter' },
  { label: 'This Year', value: 'this_year' },
];

function getDateRange(preset: string): { start: Date | null; end: Date | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case '7d': return { start: new Date(today.getTime() - 7 * 86400000), end: now };
    case '30d': return { start: new Date(today.getTime() - 30 * 86400000), end: now };
    case '90d': return { start: new Date(today.getTime() - 90 * 86400000), end: now };
    case 'this_month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start: s, end: e };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), q, 1), end: now };
    }
    case 'this_year': return { start: new Date(now.getFullYear(), 0, 1), end: now };
    default: return { start: null, end: null };
  }
}

// ---- Types ----
interface StreamMetrics {
  revenue: number;
  cost: number;
  margin: number;
  margin_pct: number;
  orders: number;
  units: number;
  customers: number;
  avg_order_value: number;
  avg_margin_per_order: number;
  perfume_cost: number;
  packaging_cost: number;
  labor_cost: number;
  monthly_revenue: number[];
  monthly_orders: number[];
  monthly_margin: number[];
}

interface OrderDetail {
  id: string;
  customer: string;
  type: 'one_time' | 'subscription';
  tier?: string;
  date: string;
  revenue: number;
  cost: number;
  margin: number;
  margin_pct: number;
  items: number;
  perfume_cost: number;
  packaging_cost: number;
  labor_cost: number;
}

// ---- Helper: format currency ----
const fmtAED = (v: number) => `AED ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtK = (v: number) => v >= 1000 ? `AED ${(v / 1000).toFixed(1)}K` : fmtAED(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// ---- KPI Card (local, enterprise-sized) ----
function ReportKPI({ label, value, sub, icon: Icon, accent = 'border-l-gold', delta, deltaLabel }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: string;
  delta?: number; deltaLabel?: string;
}) {
  return (
    <Card className={cn('border-l-[3px] card-hover', accent)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">{label}</p>
          <Icon className="w-4 h-4 text-muted-foreground/50" />
        </div>
        <p className="text-[26px] font-bold tracking-tight leading-none font-mono">{value}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
          {delta !== undefined && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
              delta > 0 ? 'bg-success/10 text-success' : delta < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
            )}>
              {delta > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : delta < 0 ? <ArrowDown className="w-2.5 h-2.5" /> : <MinusIcon className="w-2.5 h-2.5" />}
              {deltaLabel || `${Math.abs(delta).toFixed(1)}%`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Sparkline ----
function Sparkline({ data, color = 'text-gold', h = 32, w = 80 }: { data: number[]; color?: string; h?: number; w?: number }) {
  if (!data.length || data.every(v => v === 0)) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className={cn('inline-block', color)}>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// ---- Donut Chart ----
function DonutChart({ segments, size = 140, strokeWidth = 20 }: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total <= 0) return null;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const dashOffset = -offset;
          offset += dashLen;
          return (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={seg.color} strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
          );
        })}
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
          className="fill-foreground text-xs font-semibold rotate-90" style={{ transformOrigin: `${size/2}px ${size/2}px` }}>
          {fmtK(total)}
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-mono font-medium ml-auto">{fmtAED(seg.value)}</span>
            <span className="text-muted-foreground/60">({((seg.value / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Comparison Bar ----
function ComparisonBar({ label, sub, one_time, subscription, format = 'currency' }: {
  label: string; sub?: string; one_time: number; subscription: number; format?: 'currency' | 'number' | 'percent';
}) {
  const total = one_time + subscription;
  const otPct = total > 0 ? (one_time / total) * 100 : 50;
  const subPct = total > 0 ? (subscription / total) * 100 : 50;
  const fmt = (v: number) => {
    if (format === 'currency') return fmtAED(v);
    if (format === 'percent') return fmtPct(v);
    return v.toLocaleString();
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
      </div>
      <div className="flex h-7 rounded-lg overflow-hidden bg-muted/30">
        <div
          className="bg-blue-500 flex items-center justify-center text-[10px] font-mono text-white font-medium transition-all duration-700"
          style={{ width: `${Math.max(otPct, 8)}%` }}
        >
          {otPct > 15 ? fmt(one_time) : ''}
        </div>
        <div
          className="bg-purple-500 flex items-center justify-center text-[10px] font-mono text-white font-medium transition-all duration-700"
          style={{ width: `${Math.max(subPct, 8)}%` }}
        >
          {subPct > 15 ? fmt(subscription) : ''}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>One-Time: {fmt(one_time)} ({otPct.toFixed(0)}%)</span>
        <span>Subscription: {fmt(subscription)} ({subPct.toFixed(0)}%)</span>
      </div>
    </div>
  );
}

// ---- Monthly Comparison Chart ----
function MonthlyComparisonChart({ otData, subData, labels }: {
  otData: number[]; subData: number[]; labels: string[];
}) {
  const maxVal = Math.max(...otData, ...subData, 1);
  const barH = 120;
  return (
    <div className="flex items-end gap-1.5 h-[160px]">
      {labels.map((label, i) => {
        const otH = (otData[i] / maxVal) * barH;
        const subH = (subData[i] / maxVal) * barH;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-end gap-0.5 h-[120px]">
              <div
                className="w-3 bg-blue-500 rounded-t-sm transition-all duration-500"
                style={{ height: `${Math.max(otH, 2)}px` }}
                title={`One-Time: AED ${otData[i].toFixed(0)}`}
              />
              <div
                className="w-3 bg-purple-500 rounded-t-sm transition-all duration-500"
                style={{ height: `${Math.max(subH, 2)}px` }}
                title={`Subscription: AED ${subData[i].toFixed(0)}`}
              />
            </div>
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Stacked Area Chart for Margin Trend ----
function MarginTrendChart({ otMargin, subMargin, labels }: {
  otMargin: number[]; subMargin: number[]; labels: string[];
}) {
  const combined = otMargin.map((v, i) => v + subMargin[i]);
  const maxVal = Math.max(...combined, 1);
  const w = 100;
  const h = 80;
  const stepX = w / (labels.length - 1);

  const otPoints = otMargin.map((v, i) => `${i * stepX},${h - (v / maxVal) * h}`);
  const subPoints = combined.map((v, i) => `${i * stepX},${h - (v / maxVal) * h}`);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
        {/* Subscription area (stacked on top) */}
        <polygon
          points={`0,${h} ${subPoints.join(' ')} ${w},${h}`}
          fill="oklch(0.55 0.15 290 / 0.15)"
        />
        <polyline
          points={subPoints.join(' ')}
          fill="none" stroke="oklch(0.55 0.15 290)" strokeWidth="0.8"
        />
        {/* One-time area */}
        <polygon
          points={`0,${h} ${otPoints.join(' ')} ${w},${h}`}
          fill="oklch(0.55 0.15 250 / 0.2)"
        />
        <polyline
          points={otPoints.join(' ')}
          fill="none" stroke="oklch(0.55 0.15 250)" strokeWidth="0.8"
        />
      </svg>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}

// ---- Horizontal Bar (for cost breakdown) ----
function HorizontalBar({ label, value, maxValue, color, pct }: {
  label: string; value: number; maxValue: number; color: string; pct: number;
}) {
  const barPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-muted-foreground w-20 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
          style={{ width: `${Math.max(barPct, 3)}%`, backgroundColor: color }}
        >
          {barPct > 20 && <span className="text-[9px] font-mono text-white font-medium">{fmtAED(value)}</span>}
        </div>
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function RevenueComparison() {
  const [datePreset, setDatePreset] = useState('all');
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');
  const [sortField, setSortField] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailFilter, setDetailFilter] = useState<'all' | 'one_time' | 'subscription'>('all');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Fetch orders
  const { data: ordersData } = useApiQuery(() => api.orders.list());
  const orders: Order[] = (ordersData as any)?.data ?? [];

  // Date range
  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return orders;
    return orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= dateRange.start! && d <= dateRange.end!;
    });
  }, [orders, dateRange]);

  // Split by type
  const oneTimeOrders = useMemo(() => filteredOrders.filter(o => o.type === 'one_time'), [filteredOrders]);
  const subscriptionOrders = useMemo(() => filteredOrders.filter(o => o.type === 'subscription'), [filteredOrders]);

  // Calculate metrics for each stream
  const calcMetrics = (orderList: Order[]): StreamMetrics => {
    let revenue = 0, cost = 0, perfumeCost = 0, packagingCost = 0, laborCost = 0, units = 0;
    const customerSet = new Set<string>();
    const monthlyRevenue = [0, 0, 0, 0, 0, 0];
    const monthlyOrders = [0, 0, 0, 0, 0, 0];
    const monthlyMargin = [0, 0, 0, 0, 0, 0];

    orderList.forEach(order => {
      const breakdown = calculateOrderCost(order);
      revenue += order.total_amount;
      cost += breakdown.total_cost;
      perfumeCost += breakdown.total_perfume_cost;
      packagingCost += breakdown.total_packaging_cost;
      laborCost += breakdown.total_labor_cost + breakdown.total_syringe_cost;
      units += order.items.reduce((s, i) => s + i.qty, 0);
      customerSet.add(order.customer.email);

      const orderDate = new Date(order.created_at);
      const monthIdx = Math.min(5, Math.max(0, 5 - Math.floor((Date.now() - orderDate.getTime()) / (30 * 86400000))));
      monthlyRevenue[monthIdx] += order.total_amount;
      monthlyOrders[monthIdx] += 1;
      monthlyMargin[monthIdx] += order.total_amount - breakdown.total_cost;
    });

    const margin = revenue - cost;
    return {
      revenue, cost, margin,
      margin_pct: revenue > 0 ? (margin / revenue) * 100 : 0,
      orders: orderList.length, units,
      customers: customerSet.size,
      avg_order_value: orderList.length > 0 ? revenue / orderList.length : 0,
      avg_margin_per_order: orderList.length > 0 ? margin / orderList.length : 0,
      perfume_cost: perfumeCost,
      packaging_cost: packagingCost,
      labor_cost: laborCost,
      monthly_revenue: monthlyRevenue,
      monthly_orders: monthlyOrders,
      monthly_margin: monthlyMargin,
    };
  };

  const otMetrics = useMemo(() => calcMetrics(oneTimeOrders), [oneTimeOrders]);
  const subMetrics = useMemo(() => calcMetrics(subscriptionOrders), [subscriptionOrders]);

  // Combined totals
  const totalRevenue = otMetrics.revenue + subMetrics.revenue;
  const totalCost = otMetrics.cost + subMetrics.cost;
  const totalMargin = otMetrics.margin + subMetrics.margin;
  const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const totalOrders = otMetrics.orders + subMetrics.orders;

  // Monthly labels
  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      labels.push(d.toLocaleString('default', { month: 'short' }));
    }
    return labels;
  }, []);

  // Full month labels for detailed view
  const fullMonthLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      labels.push(d.toLocaleString('default', { month: 'long', year: 'numeric' }));
    }
    return labels;
  }, []);

  // Subscription tier breakdown
  const tierBreakdown = useMemo(() => {
    const tiers: Record<string, { orders: number; revenue: number; cost: number; customers: Set<string> }> = {};
    subscriptionOrders.forEach(o => {
      const breakdown = calculateOrderCost(o);
      const tier = o.subscription_tier || 'unknown';
      if (!tiers[tier]) tiers[tier] = { orders: 0, revenue: 0, cost: 0, customers: new Set() };
      tiers[tier].orders += 1;
      tiers[tier].revenue += o.total_amount;
      tiers[tier].cost += breakdown.total_cost;
      tiers[tier].customers.add(o.customer.email);
    });
    return Object.entries(tiers).map(([tier, data]) => ({
      tier,
      label: tier === 'gm1' ? 'Grand Master 1' : tier === 'gm2' ? 'Grand Master 2' : tier === 'gm3' ? 'Grand Master 3' : tier === 'gm4' ? 'Grand Master 4' : tier === 'explorer' ? 'Grand Master 1' : tier === 'alchemist' ? 'Grand Master 2' : tier === 'grand_master' ? 'Grand Master 3' : tier,
      orders: data.orders,
      revenue: data.revenue,
      cost: data.cost,
      margin: data.revenue - data.cost,
      margin_pct: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
      customers: data.customers.size,
      avg_order: data.orders > 0 ? data.revenue / data.orders : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [subscriptionOrders]);

  // Order-level detail rows for the detailed view
  const orderDetails: OrderDetail[] = useMemo(() => {
    const list = (detailFilter === 'all' ? filteredOrders : detailFilter === 'one_time' ? oneTimeOrders : subscriptionOrders);
    return list.map(o => {
      const breakdown = calculateOrderCost(o);
      const cost = breakdown.total_cost;
      const margin = o.total_amount - cost;
      return {
        id: o.order_id,
        customer: o.customer.name,
        type: o.type as 'one_time' | 'subscription',
        tier: o.subscription_tier,
        date: new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        revenue: o.total_amount,
        cost,
        margin,
        margin_pct: o.total_amount > 0 ? (margin / o.total_amount) * 100 : 0,
        items: o.items.reduce((s, i) => s + i.qty, 0),
        perfume_cost: breakdown.total_perfume_cost,
        packaging_cost: breakdown.total_packaging_cost,
        labor_cost: breakdown.total_labor_cost + breakdown.total_syringe_cost,
      };
    }).sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'date') return dir * (new Date(a.date).getTime() - new Date(b.date).getTime());
      if (sortField === 'revenue') return dir * (a.revenue - b.revenue);
      if (sortField === 'cost') return dir * (a.cost - b.cost);
      if (sortField === 'margin') return dir * (a.margin - b.margin);
      if (sortField === 'margin_pct') return dir * (a.margin_pct - b.margin_pct);
      if (sortField === 'items') return dir * (a.items - b.items);
      return 0;
    });
  }, [filteredOrders, oneTimeOrders, subscriptionOrders, detailFilter, sortField, sortDir]);

  // Monthly breakdown for detailed view
  const monthlyBreakdown = useMemo(() => {
    return fullMonthLabels.map((label, idx) => {
      const otRev = otMetrics.monthly_revenue[idx];
      const subRev = subMetrics.monthly_revenue[idx];
      const otOrd = otMetrics.monthly_orders[idx];
      const subOrd = subMetrics.monthly_orders[idx];
      const otMar = otMetrics.monthly_margin[idx];
      const subMar = subMetrics.monthly_margin[idx];
      return {
        label,
        shortLabel: monthLabels[idx],
        ot_revenue: otRev,
        sub_revenue: subRev,
        total_revenue: otRev + subRev,
        ot_orders: otOrd,
        sub_orders: subOrd,
        total_orders: otOrd + subOrd,
        ot_margin: otMar,
        sub_margin: subMar,
        total_margin: otMar + subMar,
        ot_margin_pct: otRev > 0 ? (otMar / otRev) * 100 : 0,
        sub_margin_pct: subRev > 0 ? (subMar / subRev) * 100 : 0,
        total_margin_pct: (otRev + subRev) > 0 ? ((otMar + subMar) / (otRev + subRev)) * 100 : 0,
      };
    });
  }, [otMetrics, subMetrics, monthLabels, fullMonthLabels]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="inline-flex ml-1">
      {sortField === field ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
    </span>
  );

  const handleExportCSV = () => {
    const headers = ['Metric', 'One-Time', 'Subscription', 'Total', 'Difference'];
    const rows = [
      ['Revenue (AED)', otMetrics.revenue.toFixed(2), subMetrics.revenue.toFixed(2), totalRevenue.toFixed(2), (otMetrics.revenue - subMetrics.revenue).toFixed(2)],
      ['Total Cost (AED)', otMetrics.cost.toFixed(2), subMetrics.cost.toFixed(2), totalCost.toFixed(2), (otMetrics.cost - subMetrics.cost).toFixed(2)],
      ['Gross Margin (AED)', otMetrics.margin.toFixed(2), subMetrics.margin.toFixed(2), totalMargin.toFixed(2), (otMetrics.margin - subMetrics.margin).toFixed(2)],
      ['Margin %', otMetrics.margin_pct.toFixed(1), subMetrics.margin_pct.toFixed(1), totalMarginPct.toFixed(1), (otMetrics.margin_pct - subMetrics.margin_pct).toFixed(1)],
      ['Orders', otMetrics.orders.toString(), subMetrics.orders.toString(), totalOrders.toString(), (otMetrics.orders - subMetrics.orders).toString()],
      ['Units Sold', otMetrics.units.toString(), subMetrics.units.toString(), (otMetrics.units + subMetrics.units).toString(), (otMetrics.units - subMetrics.units).toString()],
      ['Customers', otMetrics.customers.toString(), subMetrics.customers.toString(), (otMetrics.customers + subMetrics.customers).toString(), ''],
      ['Avg Order Value (AED)', otMetrics.avg_order_value.toFixed(2), subMetrics.avg_order_value.toFixed(2), '', ''],
      ['Perfume Cost (AED)', otMetrics.perfume_cost.toFixed(2), subMetrics.perfume_cost.toFixed(2), (otMetrics.perfume_cost + subMetrics.perfume_cost).toFixed(2), ''],
      ['Packaging Cost (AED)', otMetrics.packaging_cost.toFixed(2), subMetrics.packaging_cost.toFixed(2), (otMetrics.packaging_cost + subMetrics.packaging_cost).toFixed(2), ''],
      ['Labor Cost (AED)', otMetrics.labor_cost.toFixed(2), subMetrics.labor_cost.toFixed(2), (otMetrics.labor_cost + subMetrics.labor_cost).toFixed(2), ''],
    ];
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `revenue-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Revenue Comparison"
        subtitle="Subscription vs One-Time — revenue streams, margins, cost analysis & profitability"
        breadcrumbs={[
          { label: 'Reports', href: '/reports/guide' },
          { label: 'Revenue Comparison' },
        ]}
        actions={
          <Button variant="outline" onClick={handleExportCSV} className="gap-1.5">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6 page-enter">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
            <button
              onClick={() => setViewMode('overview')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-150',
                viewMode === 'overview'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Eye className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-150',
                viewMode === 'detailed'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Table2 className="w-4 h-4" />
              Detailed
            </button>
          </div>
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-44">
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredOrders.length === 0 ? (
          <EmptyState icon={BarChart3} title="No order data" description="Revenue comparison will appear once orders are processed." />
        ) : viewMode === 'overview' ? (
          /* ============================================================
             OVERVIEW MODE — Executive summary with charts
             ============================================================ */
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <ReportKPI label="Total Revenue" value={fmtK(totalRevenue)} sub={`${totalOrders} orders`} icon={DollarSign} accent="border-l-info" />
              <ReportKPI label="Total Cost" value={fmtK(totalCost)} sub="All COGS" icon={Box} accent="border-l-warning" />
              <ReportKPI label="Gross Margin" value={fmtK(totalMargin)} sub={`${totalMarginPct.toFixed(1)}% overall`} icon={TrendingUp} accent="border-l-success" delta={totalMarginPct > 40 ? totalMarginPct - 40 : -(40 - totalMarginPct)} deltaLabel={`${totalMarginPct.toFixed(0)}% margin`} />
              <ReportKPI label="One-Time Rev" value={fmtAED(otMetrics.revenue)} sub={`${otMetrics.orders} orders · ${otMetrics.margin_pct.toFixed(0)}% margin`} icon={ShoppingCart} accent="border-l-blue-500" />
              <ReportKPI label="Subscription Rev" value={fmtAED(subMetrics.revenue)} sub={`${subMetrics.orders} orders · ${subMetrics.margin_pct.toFixed(0)}% margin`} icon={RefreshCcw} accent="border-l-purple-500" />
              <ReportKPI label="Higher Margin" value={otMetrics.margin_pct > subMetrics.margin_pct ? 'One-Time' : 'Subscription'} sub={`${Math.abs(otMetrics.margin_pct - subMetrics.margin_pct).toFixed(1)}% difference`} icon={Award} accent="border-l-gold" />
            </div>

            {/* Revenue Split Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-l-[3px] border-l-blue-500 card-hover">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold">One-Time Orders</h3>
                      <p className="text-[10px] text-muted-foreground">{otMetrics.orders} orders · {otMetrics.customers} customers</p>
                    </div>
                    <Sparkline data={otMetrics.monthly_revenue} color="text-blue-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
                      <p className="text-lg font-bold font-mono">{fmtAED(otMetrics.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Margin</p>
                      <p className={cn('text-lg font-bold', otMetrics.margin_pct >= 40 ? 'text-success' : otMetrics.margin_pct >= 20 ? 'text-gold' : 'text-warning')}>
                        {otMetrics.margin_pct.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Avg Order</p>
                      <p className="text-lg font-bold font-mono">{fmtAED(otMetrics.avg_order_value)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-[3px] border-l-purple-500 card-hover">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <RefreshCcw className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold">Subscription Orders</h3>
                      <p className="text-[10px] text-muted-foreground">{subMetrics.orders} orders · {subMetrics.customers} subscribers</p>
                    </div>
                    <Sparkline data={subMetrics.monthly_revenue} color="text-purple-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
                      <p className="text-lg font-bold font-mono">{fmtAED(subMetrics.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Margin</p>
                      <p className={cn('text-lg font-bold', subMetrics.margin_pct >= 40 ? 'text-success' : subMetrics.margin_pct >= 20 ? 'text-gold' : 'text-warning')}>
                        {subMetrics.margin_pct.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Avg Order</p>
                      <p className="text-lg font-bold font-mono">{fmtAED(subMetrics.avg_order_value)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comparison Bars */}
            <Card className="card-hover">
              <CardContent className="p-5 space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Side-by-Side Comparison</h3>
                <ComparisonBar label="Revenue" one_time={otMetrics.revenue} subscription={subMetrics.revenue} />
                <ComparisonBar label="Total Cost (COGS)" one_time={otMetrics.cost} subscription={subMetrics.cost} />
                <ComparisonBar label="Gross Margin" one_time={otMetrics.margin} subscription={subMetrics.margin} />
                <ComparisonBar label="Perfume Cost" one_time={otMetrics.perfume_cost} subscription={subMetrics.perfume_cost} />
                <ComparisonBar label="Packaging Cost" one_time={otMetrics.packaging_cost} subscription={subMetrics.packaging_cost} />
                <ComparisonBar label="Labor Cost" one_time={otMetrics.labor_cost} subscription={subMetrics.labor_cost} />
              </CardContent>
            </Card>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="card-hover">
                <CardContent className="p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Revenue Distribution</h4>
                  <DonutChart segments={[
                    { label: 'One-Time', value: otMetrics.revenue, color: '#3b82f6' },
                    { label: 'Subscription', value: subMetrics.revenue, color: '#8b5cf6' },
                  ]} />
                </CardContent>
              </Card>

              <Card className="card-hover">
                <CardContent className="p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Monthly Revenue Trend</h4>
                  <MonthlyComparisonChart
                    otData={otMetrics.monthly_revenue}
                    subData={subMetrics.monthly_revenue}
                    labels={monthLabels}
                  />
                  <div className="flex items-center gap-4 mt-3 justify-center text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> One-Time</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> Subscription</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> One-Time Orders</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500" /> Subscription Orders</span>
            </div>
          </>
        ) : (
          /* ============================================================
             DETAILED MODE — Power BI-style drill-down report
             Monthly breakdown, order-level table, cost waterfall, tier analysis
             ============================================================ */
          <>
            {/* Summary KPIs — compact row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {[
                { label: 'Revenue', value: fmtK(totalRevenue), icon: DollarSign, accent: 'border-l-info' },
                { label: 'COGS', value: fmtK(totalCost), icon: Receipt, accent: 'border-l-warning' },
                { label: 'Margin', value: fmtK(totalMargin), icon: TrendingUp, accent: 'border-l-success' },
                { label: 'Margin %', value: fmtPct(totalMarginPct), icon: Percent, accent: 'border-l-gold' },
                { label: 'OT Orders', value: otMetrics.orders.toString(), icon: ShoppingCart, accent: 'border-l-blue-500' },
                { label: 'Sub Orders', value: subMetrics.orders.toString(), icon: RefreshCcw, accent: 'border-l-purple-500' },
                { label: 'Avg OT Value', value: fmtAED(otMetrics.avg_order_value), icon: CreditCard, accent: 'border-l-blue-400' },
                { label: 'Avg Sub Value', value: fmtAED(subMetrics.avg_order_value), icon: Wallet, accent: 'border-l-purple-400' },
              ].map((kpi, i) => (
                <Card key={i} className={cn('border-l-[3px]', kpi.accent)}>
                  <CardContent className="p-3">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{kpi.label}</p>
                    <p className="text-lg font-bold font-mono mt-0.5 leading-tight">{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Row 1: Monthly P&L Breakdown + Cost Waterfall */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Monthly P&L Table — 2 cols wide */}
              <Card className="lg:col-span-2 card-hover">
                <CardContent className="p-0">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Monthly P&L Breakdown</h3>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">Revenue, cost, and margin by month — click to expand</p>
                    </div>
                    <Sparkline data={monthlyBreakdown.map(m => m.total_revenue)} color="text-gold" w={100} h={24} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="enterprise-table">
                      <thead>
                        <tr>
                          <th className="text-left">Month</th>
                          <th className="text-right" style={{ color: '#3b82f6' }}>OT Revenue</th>
                          <th className="text-right" style={{ color: '#8b5cf6' }}>Sub Revenue</th>
                          <th className="text-right">Total</th>
                          <th className="text-right">Margin</th>
                          <th className="text-right">Margin %</th>
                          <th className="text-right">Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyBreakdown.map((m, idx) => (
                          <>
                            <tr
                              key={m.label}
                              className={cn('cursor-pointer', expandedMonth === m.label && 'bg-accent/30')}
                              onClick={() => setExpandedMonth(expandedMonth === m.label ? null : m.label)}
                            >
                              <td className="font-medium text-xs">
                                <span className="flex items-center gap-1.5">
                                  {expandedMonth === m.label ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                                  {m.label}
                                </span>
                              </td>
                              <td className="text-right font-mono text-xs">{fmtAED(m.ot_revenue)}</td>
                              <td className="text-right font-mono text-xs">{fmtAED(m.sub_revenue)}</td>
                              <td className="text-right font-mono text-xs font-semibold">{fmtAED(m.total_revenue)}</td>
                              <td className="text-right font-mono text-xs">{fmtAED(m.total_margin)}</td>
                              <td className="text-right">
                                <span className={cn(
                                  'text-xs font-semibold',
                                  m.total_margin_pct >= 40 ? 'text-success' : m.total_margin_pct >= 20 ? 'text-gold' : 'text-destructive',
                                )}>
                                  {fmtPct(m.total_margin_pct)}
                                </span>
                              </td>
                              <td className="text-right font-mono text-xs">{m.total_orders}</td>
                            </tr>
                            {expandedMonth === m.label && (
                              <tr key={`${m.label}-detail`} className="bg-muted/10">
                                <td colSpan={7} className="px-8 py-3">
                                  <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-1.5">
                                      <p className="font-semibold text-blue-500 flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> One-Time</p>
                                      <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                                        <div><span className="block text-[9px] uppercase">Revenue</span><span className="font-mono font-medium text-foreground">{fmtAED(m.ot_revenue)}</span></div>
                                        <div><span className="block text-[9px] uppercase">Margin</span><span className="font-mono font-medium text-foreground">{fmtAED(m.ot_margin)}</span></div>
                                        <div><span className="block text-[9px] uppercase">Margin %</span><span className={cn('font-medium', m.ot_margin_pct >= 40 ? 'text-success' : 'text-warning')}>{fmtPct(m.ot_margin_pct)}</span></div>
                                      </div>
                                    </div>
                                    <div className="space-y-1.5">
                                      <p className="font-semibold text-purple-500 flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> Subscription</p>
                                      <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                                        <div><span className="block text-[9px] uppercase">Revenue</span><span className="font-mono font-medium text-foreground">{fmtAED(m.sub_revenue)}</span></div>
                                        <div><span className="block text-[9px] uppercase">Margin</span><span className="font-mono font-medium text-foreground">{fmtAED(m.sub_margin)}</span></div>
                                        <div><span className="block text-[9px] uppercase">Margin %</span><span className={cn('font-medium', m.sub_margin_pct >= 40 ? 'text-success' : 'text-warning')}>{fmtPct(m.sub_margin_pct)}</span></div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="font-bold text-xs">Total</td>
                          <td className="text-right font-mono text-xs font-bold">{fmtAED(otMetrics.revenue)}</td>
                          <td className="text-right font-mono text-xs font-bold">{fmtAED(subMetrics.revenue)}</td>
                          <td className="text-right font-mono text-xs font-bold">{fmtAED(totalRevenue)}</td>
                          <td className="text-right font-mono text-xs font-bold">{fmtAED(totalMargin)}</td>
                          <td className="text-right font-bold text-xs">{fmtPct(totalMarginPct)}</td>
                          <td className="text-right font-mono text-xs font-bold">{totalOrders}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Waterfall / Breakdown */}
              <Card className="card-hover">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold tracking-tight mb-1">Cost Structure</h3>
                  <p className="text-[10px] text-muted-foreground/70 mb-4">COGS breakdown by category</p>

                  <div className="space-y-6">
                    {/* One-Time costs */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-2 flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> One-Time</p>
                      <div className="space-y-2">
                        <HorizontalBar label="Perfume" value={otMetrics.perfume_cost} maxValue={otMetrics.cost} color="#8b5cf6" pct={otMetrics.cost > 0 ? (otMetrics.perfume_cost / otMetrics.cost) * 100 : 0} />
                        <HorizontalBar label="Packaging" value={otMetrics.packaging_cost} maxValue={otMetrics.cost} color="#3b82f6" pct={otMetrics.cost > 0 ? (otMetrics.packaging_cost / otMetrics.cost) * 100 : 0} />
                        <HorizontalBar label="Labor" value={otMetrics.labor_cost} maxValue={otMetrics.cost} color="#f59e0b" pct={otMetrics.cost > 0 ? (otMetrics.labor_cost / otMetrics.cost) * 100 : 0} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2 text-right">Total: <span className="font-mono font-semibold text-foreground">{fmtAED(otMetrics.cost)}</span></p>
                    </div>

                    {/* Subscription costs */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-500 mb-2 flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> Subscription</p>
                      <div className="space-y-2">
                        <HorizontalBar label="Perfume" value={subMetrics.perfume_cost} maxValue={subMetrics.cost} color="#8b5cf6" pct={subMetrics.cost > 0 ? (subMetrics.perfume_cost / subMetrics.cost) * 100 : 0} />
                        <HorizontalBar label="Packaging" value={subMetrics.packaging_cost} maxValue={subMetrics.cost} color="#3b82f6" pct={subMetrics.cost > 0 ? (subMetrics.packaging_cost / subMetrics.cost) * 100 : 0} />
                        <HorizontalBar label="Labor" value={subMetrics.labor_cost} maxValue={subMetrics.cost} color="#f59e0b" pct={subMetrics.cost > 0 ? (subMetrics.labor_cost / subMetrics.cost) * 100 : 0} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2 text-right">Total: <span className="font-mono font-semibold text-foreground">{fmtAED(subMetrics.cost)}</span></p>
                    </div>

                    {/* Margin trend */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Margin Trend</p>
                      <MarginTrendChart otMargin={otMetrics.monthly_margin} subMargin={subMetrics.monthly_margin} labels={monthLabels} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Subscription Tier Analysis + Metrics Comparison Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Subscription Tier Analysis */}
              {tierBreakdown.length > 0 && (
                <Card className="card-hover">
                  <CardContent className="p-0">
                    <div className="px-5 py-4 border-b border-border">
                      <h3 className="text-sm font-bold tracking-tight">Subscription Tier Analysis</h3>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">Revenue, margin, and customer breakdown by tier</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="enterprise-table">
                        <thead>
                          <tr>
                            <th className="text-left">Tier</th>
                            <th className="text-right">Revenue</th>
                            <th className="text-right">COGS</th>
                            <th className="text-right">Margin</th>
                            <th className="text-right">Margin %</th>
                            <th className="text-right">Orders</th>
                            <th className="text-right">Avg Order</th>
                            <th className="text-right">Subscribers</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tierBreakdown.map((tier, idx) => (
                            <tr key={tier.tier}>
                              <td className="font-medium text-xs">
                                <span className="flex items-center gap-1.5">
                                  <Crown className={cn('w-3.5 h-3.5', idx === 0 ? 'text-gold' : 'text-muted-foreground/40')} />
                                  {tier.label}
                                </span>
                              </td>
                              <td className="text-right font-mono text-xs">{fmtAED(tier.revenue)}</td>
                              <td className="text-right font-mono text-xs">{fmtAED(tier.cost)}</td>
                              <td className="text-right font-mono text-xs">{fmtAED(tier.margin)}</td>
                              <td className="text-right">
                                <span className={cn(
                                  'text-xs font-semibold',
                                  tier.margin_pct >= 40 ? 'text-success' : tier.margin_pct >= 20 ? 'text-gold' : 'text-destructive',
                                )}>
                                  {fmtPct(tier.margin_pct)}
                                </span>
                              </td>
                              <td className="text-right font-mono text-xs">{tier.orders}</td>
                              <td className="text-right font-mono text-xs">{fmtAED(tier.avg_order)}</td>
                              <td className="text-right font-mono text-xs">{tier.customers}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td className="font-bold text-xs">Total</td>
                            <td className="text-right font-mono text-xs font-bold">{fmtAED(subMetrics.revenue)}</td>
                            <td className="text-right font-mono text-xs font-bold">{fmtAED(subMetrics.cost)}</td>
                            <td className="text-right font-mono text-xs font-bold">{fmtAED(subMetrics.margin)}</td>
                            <td className="text-right font-bold text-xs">{fmtPct(subMetrics.margin_pct)}</td>
                            <td className="text-right font-mono text-xs font-bold">{subMetrics.orders}</td>
                            <td className="text-right font-mono text-xs font-bold">{fmtAED(subMetrics.avg_order_value)}</td>
                            <td className="text-right font-mono text-xs font-bold">{subMetrics.customers}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Full Metrics Comparison Matrix */}
              <Card className="card-hover">
                <CardContent className="p-0">
                  <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-sm font-bold tracking-tight">Metrics Comparison Matrix</h3>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">Head-to-head: One-Time vs Subscription</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="enterprise-table">
                      <thead>
                        <tr>
                          <th className="text-left">Metric</th>
                          <th className="text-right" style={{ color: '#3b82f6' }}>One-Time</th>
                          <th className="text-right" style={{ color: '#8b5cf6' }}>Subscription</th>
                          <th className="text-right">Delta</th>
                          <th className="text-center">Winner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Revenue', ot: otMetrics.revenue, sub: subMetrics.revenue, fmt: 'currency' as const, higherBetter: true },
                          { label: 'Total Cost', ot: otMetrics.cost, sub: subMetrics.cost, fmt: 'currency' as const, higherBetter: false },
                          { label: 'Gross Margin', ot: otMetrics.margin, sub: subMetrics.margin, fmt: 'currency' as const, higherBetter: true },
                          { label: 'Margin %', ot: otMetrics.margin_pct, sub: subMetrics.margin_pct, fmt: 'percent' as const, higherBetter: true },
                          { label: 'Orders', ot: otMetrics.orders, sub: subMetrics.orders, fmt: 'number' as const, higherBetter: true },
                          { label: 'Units Sold', ot: otMetrics.units, sub: subMetrics.units, fmt: 'number' as const, higherBetter: true },
                          { label: 'Customers', ot: otMetrics.customers, sub: subMetrics.customers, fmt: 'number' as const, higherBetter: true },
                          { label: 'Avg Order Value', ot: otMetrics.avg_order_value, sub: subMetrics.avg_order_value, fmt: 'currency' as const, higherBetter: true },
                          { label: 'Avg Margin/Order', ot: otMetrics.avg_margin_per_order, sub: subMetrics.avg_margin_per_order, fmt: 'currency' as const, higherBetter: true },
                          { label: 'Perfume Cost', ot: otMetrics.perfume_cost, sub: subMetrics.perfume_cost, fmt: 'currency' as const, higherBetter: false },
                          { label: 'Packaging Cost', ot: otMetrics.packaging_cost, sub: subMetrics.packaging_cost, fmt: 'currency' as const, higherBetter: false },
                          { label: 'Labor Cost', ot: otMetrics.labor_cost, sub: subMetrics.labor_cost, fmt: 'currency' as const, higherBetter: false },
                        ].map((row) => {
                          const diff = row.ot - row.sub;
                          const fmtVal = (v: number) => {
                            if (row.fmt === 'currency') return fmtAED(v);
                            if (row.fmt === 'percent') return fmtPct(v);
                            return v.toLocaleString();
                          };
                          const otWins = row.higherBetter ? row.ot > row.sub : row.ot < row.sub;
                          const subWins = row.higherBetter ? row.sub > row.ot : row.sub < row.ot;
                          const tied = Math.abs(diff) < 0.01;
                          return (
                            <tr key={row.label}>
                              <td className="text-xs font-medium">{row.label}</td>
                              <td className={cn('text-right font-mono text-xs', otWins && !tied && 'font-bold text-blue-600')}>{fmtVal(row.ot)}</td>
                              <td className={cn('text-right font-mono text-xs', subWins && !tied && 'font-bold text-purple-600')}>{fmtVal(row.sub)}</td>
                              <td className="text-right">
                                <span className={cn(
                                  'text-[11px] font-mono font-medium',
                                  !row.higherBetter
                                    ? (diff > 0 ? 'text-destructive' : 'text-success')
                                    : (diff > 0 ? 'text-success' : diff < 0 ? 'text-destructive' : 'text-muted-foreground'),
                                )}>
                                  {diff > 0 ? '+' : ''}{fmtVal(diff)}
                                </span>
                              </td>
                              <td className="text-center">
                                {tied ? (
                                  <span className="text-[9px] font-bold uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Tie</span>
                                ) : otWins ? (
                                  <span className="text-[9px] font-bold uppercase text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">OT</span>
                                ) : (
                                  <span className="text-[9px] font-bold uppercase text-purple-600 bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded-full">Sub</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Order-Level Detail Table */}
            <Card className="card-hover">
              <CardContent className="p-0">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Order-Level Detail</h3>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {orderDetails.length} orders · Click column headers to sort
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={detailFilter} onValueChange={(v: any) => setDetailFilter(v)}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <Filter className="w-3 h-3 mr-1" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Orders</SelectItem>
                        <SelectItem value="one_time">One-Time Only</SelectItem>
                        <SelectItem value="subscription">Subscription Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th className="text-left">Order</th>
                        <th className="text-left">Customer</th>
                        <th className="text-center">Type</th>
                        <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('date')}>
                          Date <SortIcon field="date" />
                        </th>
                        <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('items')}>
                          Items <SortIcon field="items" />
                        </th>
                        <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('revenue')}>
                          Revenue <SortIcon field="revenue" />
                        </th>
                        <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('cost')}>
                          COGS <SortIcon field="cost" />
                        </th>
                        <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('margin')}>
                          Margin <SortIcon field="margin" />
                        </th>
                        <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('margin_pct')}>
                          Margin % <SortIcon field="margin_pct" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderDetails.slice(0, 50).map((o) => (
                        <tr key={o.id}>
                          <td className="font-mono text-[11px] font-medium">{o.id.slice(0, 8)}</td>
                          <td className="text-xs truncate max-w-[120px]">{o.customer}</td>
                          <td className="text-center">
                            <span className={cn(
                              'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                              o.type === 'one_time' ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
                            )}>
                              {o.type === 'one_time' ? 'OT' : 'Sub'}
                            </span>
                            {o.tier && <span className="text-[9px] text-muted-foreground ml-1">{o.tier}</span>}
                          </td>
                          <td className="text-right text-xs text-muted-foreground">{o.date}</td>
                          <td className="text-right font-mono text-xs">{o.items}</td>
                          <td className="text-right font-mono text-xs font-medium">{fmtAED(o.revenue)}</td>
                          <td className="text-right font-mono text-xs text-muted-foreground">{fmtAED(o.cost)}</td>
                          <td className="text-right font-mono text-xs">{fmtAED(o.margin)}</td>
                          <td className="text-right">
                            <span className={cn(
                              'text-xs font-semibold',
                              o.margin_pct >= 40 ? 'text-success' : o.margin_pct >= 20 ? 'text-gold' : 'text-destructive',
                            )}>
                              {fmtPct(o.margin_pct)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {orderDetails.length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={4} className="font-bold text-xs">
                            Total ({orderDetails.length} orders)
                          </td>
                          <td className="text-right font-mono text-xs font-bold">
                            {orderDetails.reduce((s, o) => s + o.items, 0)}
                          </td>
                          <td className="text-right font-mono text-xs font-bold">
                            {fmtAED(orderDetails.reduce((s, o) => s + o.revenue, 0))}
                          </td>
                          <td className="text-right font-mono text-xs font-bold">
                            {fmtAED(orderDetails.reduce((s, o) => s + o.cost, 0))}
                          </td>
                          <td className="text-right font-mono text-xs font-bold">
                            {fmtAED(orderDetails.reduce((s, o) => s + o.margin, 0))}
                          </td>
                          <td className="text-right font-bold text-xs">
                            {(() => {
                              const totRev = orderDetails.reduce((s, o) => s + o.revenue, 0);
                              const totMar = orderDetails.reduce((s, o) => s + o.margin, 0);
                              return fmtPct(totRev > 0 ? (totMar / totRev) * 100 : 0);
                            })()}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {orderDetails.length > 50 && (
                  <div className="px-5 py-2 border-t border-border text-[10px] text-muted-foreground text-center">
                    Showing 50 of {orderDetails.length} orders. Export CSV for full data.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> One-Time Orders</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500" /> Subscription Orders</span>
              <span className="text-[10px]">· Margin color: <span className="text-success">≥40%</span> / <span className="text-gold">≥20%</span> / <span className="text-destructive">&lt;20%</span></span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
