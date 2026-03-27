// ============================================================
// E1 — Product P&L — PE-Grade Analytics
// Two views: Perfume Analysis (per-perfume decant economics)
// and End Product Analysis (per-product BOM + shipping + margin)
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { PageHeader, StatusBadge, EmptyState, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp, TrendingDown, Search, Download, DollarSign, Droplets,
  Package, BarChart3, ArrowUpDown, Minus, Filter, ShoppingCart,
  Users, Star, Layers, Award, Target, Zap, Eye, ChevronDown, ChevronUp,
  Box, Truck, Calendar, Beaker, FlaskConical, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import type { Perfume, Order } from '@/types';
import { calculateOrderCost } from '@/components/orders/OrderCostBreakdown';
import { endProducts, bomComponents } from '@/lib/bom-data';

type ViewMode = 'perfumes' | 'end_products';

// ---- Perfume P&L Types ----
interface PerfumePnLRow {
  master_id: string;
  name: string;
  brand: string;
  total_units_sold: number;
  total_ml_sold: number;
  total_revenue: number;
  total_perfume_cost: number;
  total_packaging_cost: number;
  total_labor_cost: number;
  total_cost: number;
  gross_margin: number;
  margin_pct: number;
  avg_margin_per_unit: number;
  order_count: number;
  cost_per_ml: number;
  revenue_per_ml: number;
  margin_per_ml: number;
  // usage across products
  product_usage: { product_name: string; ml_used: number; orders: number }[];
  // monthly trend
  monthly_revenue: number[];
  monthly_units: number[];
  trend: 'up' | 'down' | 'stable';
}

// ---- End Product P&L Types ----
interface EndProductPnLRow {
  product_id: string;
  name: string;
  sku: string;
  category: string;
  status: string;
  selling_price: number;
  bom_fixed_cost: number;
  bom_variable_cost: number;
  shipping_cost: number;
  total_cost: number;
  gross_margin: number;
  margin_pct: number;
  multiplier: number;
  // Simulated sales data
  total_units_sold: number;
  total_revenue: number;
  total_cogs: number;
  total_gross_profit: number;
  avg_cost_per_order: number;
  unique_customers: number;
  lifetime_value: number;
  repeat_rate: number;
  performance_rank: number;
  trend: 'up' | 'down' | 'stable';
  monthly_sales: number[];
}

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  subscription_box: 'Subscription',
  em_set: 'Em Set',
  aura_play: 'Aura Play',
  box_bundle: 'Box Bundle',
  one_time: 'One-Time',
  gift_set: 'Gift Set',
  collector_edition: 'Collector',
};

// Simulated historical sales data for end products
function generateEndProductPnL(): EndProductPnLRow[] {
  const salesData: Record<string, { units: number; customers: number; repeatRate: number; trend: 'up' | 'down' | 'stable'; monthly: number[] }> = {
    'ep-std-decant': { units: 342, customers: 287, repeatRate: 0.38, trend: 'up', monthly: [28, 32, 35, 38, 42, 45] },
    'ep-sub-explorer': { units: 156, customers: 89, repeatRate: 0.72, trend: 'up', monthly: [18, 22, 25, 28, 30, 33] },
    'ep-sub-alchemist': { units: 98, customers: 52, repeatRate: 0.78, trend: 'up', monthly: [12, 14, 16, 18, 19, 19] },
    'ep-sub-connoisseur': { units: 34, customers: 18, repeatRate: 0.85, trend: 'stable', monthly: [4, 5, 6, 6, 7, 6] },
    'ep-emset-traveler': { units: 187, customers: 165, repeatRate: 0.22, trend: 'up', monthly: [22, 28, 30, 32, 38, 37] },
    'ep-emset-connoisseur': { units: 67, customers: 54, repeatRate: 0.31, trend: 'stable', monthly: [9, 10, 11, 12, 13, 12] },
    'ep-auraplay-sampler': { units: 523, customers: 498, repeatRate: 0.15, trend: 'up', monthly: [65, 78, 85, 92, 98, 105] },
    'ep-discovery-bundle': { units: 112, customers: 98, repeatRate: 0.28, trend: 'down', monthly: [22, 20, 19, 18, 17, 16] },
  };

  const rows: EndProductPnLRow[] = endProducts.map((ep, idx) => {
    const sd = salesData[ep.product_id] || { units: 0, customers: 0, repeatRate: 0, trend: 'stable' as const, monthly: [0,0,0,0,0,0] };
    const sellingPrice = ep.selling_price ?? 0;
    const fixedPrice = ep.fixed_price ?? 0;
    const variablePrice = ep.variable_price ?? 0;
    const shippingCost = ep.shipping_cost ?? 0;
    const totalRevenue = sd.units * sellingPrice;
    const totalCogs = sd.units * (fixedPrice + variablePrice + shippingCost);
    const totalGrossProfit = totalRevenue - totalCogs;
    const marginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const avgCostPerOrder = sd.units > 0 ? totalCogs / sd.units : 0;
    const ltv = sd.customers > 0 ? totalRevenue / sd.customers : 0;
    const totalUnitCost = fixedPrice + variablePrice + shippingCost;

    return {
      product_id: ep.product_id,
      name: ep.name,
      sku: ep.sku,
      category: ep.category,
      status: ep.active ? 'active' : 'inactive',
      selling_price: sellingPrice,
      bom_fixed_cost: fixedPrice,
      bom_variable_cost: variablePrice,
      shipping_cost: shippingCost,
      total_cost: totalUnitCost,
      gross_margin: sellingPrice - totalUnitCost,
      margin_pct: sellingPrice > 0 ? ((sellingPrice - totalUnitCost) / sellingPrice) * 100 : 0,
      multiplier: ep.selling_price_multiplier || (sellingPrice / Math.max(totalUnitCost, 1)),
      total_units_sold: sd.units,
      total_revenue: totalRevenue,
      total_cogs: totalCogs,
      total_gross_profit: totalGrossProfit,
      avg_cost_per_order: avgCostPerOrder,
      unique_customers: sd.customers,
      lifetime_value: ltv,
      repeat_rate: sd.repeatRate,
      performance_rank: 0,
      trend: sd.trend,
      monthly_sales: sd.monthly,
    };
  });

  // Assign performance rank by revenue
  rows.sort((a, b) => b.total_revenue - a.total_revenue);
  rows.forEach((r, i) => r.performance_rank = i + 1);

  return rows;
}

// ---- Mini Sparkline ----
function Sparkline({ data, color = 'text-gold' }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 24;
  const w = 60;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className={cn('inline-block', color)}>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// ---- KPI Card ----
function KPICard({ label, value, sub, icon: Icon, accent = 'border-l-gold' }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: string;
}) {
  return (
    <Card className={cn('border-l-[3px]', accent)}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <p className="text-xl font-semibold mt-0.5 font-mono">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ---- Horizontal Bar ----
function CostBar({ fixed, variable, shipping, total }: { fixed: number; variable: number; shipping: number; total: number }) {
  if (total <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  const fixedPct = (fixed / total) * 100;
  const variablePct = (variable / total) * 100;
  const shippingPct = (shipping / total) * 100;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-2 w-20 rounded-full overflow-hidden bg-muted/30">
        <div className="bg-blue-500/70" style={{ width: `${fixedPct}%` }} title={`Fixed: ${fixedPct.toFixed(0)}%`} />
        <div className="bg-purple-500/70" style={{ width: `${variablePct}%` }} title={`Variable: ${variablePct.toFixed(0)}%`} />
        <div className="bg-amber-500/70" style={{ width: `${shippingPct}%` }} title={`Shipping: ${shippingPct.toFixed(0)}%`} />
      </div>
    </div>
  );
}

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

// ---- Donut Chart (SVG) ----
function DonutChart({ segments, size = 120, strokeWidth = 18 }: {
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
      </svg>
      <div className="space-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-mono font-medium ml-auto">{((seg.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Horizontal Bar Chart ----
function HBarChart({ items, maxValue }: {
  items: { label: string; value: number; color: string; sub?: string }[];
  maxValue?: number;
}) {
  const max = maxValue || Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground w-24 truncate" title={item.label}>{item.label}</span>
          <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, backgroundColor: item.color }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-medium">
              {item.sub || `AED ${item.value.toFixed(0)}`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProductPnL() {
  const [viewMode, setViewMode] = useState<ViewMode>('end_products');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState('all');
  const [perfExpandedRow, setPerfExpandedRow] = useState<string | null>(null);

  // Perfume data
  const { data: perfumesData } = useApiQuery(() => api.master.perfumes());
  const { data: ordersData } = useApiQuery(() => api.orders.list());
  const perfumes: Perfume[] = (perfumesData as any)?.data ?? [];
  const orders: Order[] = (ordersData as any)?.data ?? [];

  // End product data
  const endProductPnL = useMemo(() => generateEndProductPnL(), []);

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

  // Perfume P&L calculation — enhanced with cost/ml, usage, trends
  const perfumePnL = useMemo(() => {
    const productMap = new Map<string, PerfumePnLRow>();
    const usageMap = new Map<string, Map<string, { product_name: string; ml_used: number; orders: number }>>(); // master_id -> product_name -> usage
    const monthlyMap = new Map<string, { revenue: number[]; units: number[] }>(); // master_id -> monthly

    perfumes.forEach(p => {
      productMap.set(p.master_id, {
        master_id: p.master_id, name: p.name, brand: p.brand,
        total_units_sold: 0, total_ml_sold: 0, total_revenue: 0,
        total_perfume_cost: 0, total_packaging_cost: 0, total_labor_cost: 0,
        total_cost: 0, gross_margin: 0, margin_pct: 0, avg_margin_per_unit: 0, order_count: 0,
        cost_per_ml: p.price_per_ml || 0, revenue_per_ml: 0, margin_per_ml: 0,
        product_usage: [], monthly_revenue: [0,0,0,0,0,0], monthly_units: [0,0,0,0,0,0], trend: 'stable',
      });
      usageMap.set(p.master_id, new Map());
      monthlyMap.set(p.master_id, { revenue: [0,0,0,0,0,0], units: [0,0,0,0,0,0] });
    });

    filteredOrders.forEach(order => {
      const costBreakdown = calculateOrderCost(order);
      const orderIds = new Set<string>();
      const orderDate = new Date(order.created_at);
      const monthIdx = Math.min(5, Math.max(0, 5 - Math.floor((Date.now() - orderDate.getTime()) / (30 * 86400000))));

      costBreakdown.items.forEach(itemCost => {
        const orderItem = order.items.find(i => i.item_id === itemCost.item_id);
        if (!orderItem) return;
        let row = productMap.get(orderItem.master_id);
        if (!row) {
          row = { master_id: orderItem.master_id, name: itemCost.perfume_name, brand: 'Unknown',
            total_units_sold: 0, total_ml_sold: 0, total_revenue: 0,
            total_perfume_cost: 0, total_packaging_cost: 0, total_labor_cost: 0,
            total_cost: 0, gross_margin: 0, margin_pct: 0, avg_margin_per_unit: 0, order_count: 0,
            cost_per_ml: 0, revenue_per_ml: 0, margin_per_ml: 0,
            product_usage: [], monthly_revenue: [0,0,0,0,0,0], monthly_units: [0,0,0,0,0,0], trend: 'stable' };
          productMap.set(orderItem.master_id, row);
          usageMap.set(orderItem.master_id, new Map());
          monthlyMap.set(orderItem.master_id, { revenue: [0,0,0,0,0,0], units: [0,0,0,0,0,0] });
        }
        row.total_units_sold += itemCost.qty;
        row.total_ml_sold += itemCost.size_ml * itemCost.qty;
        row.total_revenue += itemCost.revenue;
        row.total_perfume_cost += itemCost.perfume_cost;
        row.total_packaging_cost += itemCost.packaging_cost;
        row.total_labor_cost += itemCost.labor_cost + itemCost.syringe_cost;
        row.total_cost += itemCost.total_cost;
        if (!orderIds.has(order.order_id)) { row.order_count += 1; orderIds.add(order.order_id); }

        // Track usage across products (order type)
        const productName = order.type === 'subscription' ? 'Subscription Box' : order.type === 'one_time' ? 'One-Time Order' : 'Manual Decant';
        const usage = usageMap.get(orderItem.master_id)!;
        if (!usage.has(productName)) usage.set(productName, { product_name: productName, ml_used: 0, orders: 0 });
        const u = usage.get(productName)!;
        u.ml_used += itemCost.size_ml * itemCost.qty;
        u.orders += 1;

        // Monthly tracking
        const monthly = monthlyMap.get(orderItem.master_id)!;
        monthly.revenue[monthIdx] += itemCost.revenue;
        monthly.units[monthIdx] += itemCost.qty;
      });
    });

    productMap.forEach((row, id) => {
      row.gross_margin = row.total_revenue - row.total_cost;
      row.margin_pct = row.total_revenue > 0 ? (row.gross_margin / row.total_revenue) * 100 : 0;
      row.avg_margin_per_unit = row.total_units_sold > 0 ? row.gross_margin / row.total_units_sold : 0;
      row.cost_per_ml = row.total_ml_sold > 0 ? row.total_perfume_cost / row.total_ml_sold : 0;
      row.revenue_per_ml = row.total_ml_sold > 0 ? row.total_revenue / row.total_ml_sold : 0;
      row.margin_per_ml = row.total_ml_sold > 0 ? row.gross_margin / row.total_ml_sold : 0;
      row.product_usage = Array.from(usageMap.get(id)?.values() || []);
      const monthly = monthlyMap.get(id);
      if (monthly) {
        row.monthly_revenue = monthly.revenue;
        row.monthly_units = monthly.units;
      }
      // Determine trend from last 3 months
      const last3 = row.monthly_revenue.slice(-3);
      if (last3.length >= 2) {
        const avg1 = last3[0]; const avg2 = last3[last3.length - 1];
        row.trend = avg2 > avg1 * 1.1 ? 'up' : avg2 < avg1 * 0.9 ? 'down' : 'stable';
      }
    });
    return Array.from(productMap.values()).filter(r => r.total_units_sold > 0);
  }, [perfumes, filteredOrders]);

  // Brands for perfume filter
  const brands = useMemo(() => {
    const set = new Set(perfumePnL.map(r => r.brand));
    return Array.from(set).sort();
  }, [perfumePnL]);

  // Categories for end product filter
  const categories = useMemo(() => {
    const set = new Set(endProductPnL.map(r => r.category));
    return Array.from(set).sort();
  }, [endProductPnL]);

  // Filter and sort — Perfumes
  const filteredPerfumes = useMemo(() => {
    let result = perfumePnL;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q));
    }
    if (brandFilter !== 'all') result = result.filter(r => r.brand === brandFilter);
    const sortMap: Record<string, keyof PerfumePnLRow> = {
      revenue: 'total_revenue', margin: 'gross_margin', margin_pct: 'margin_pct',
      units: 'total_units_sold', ml: 'total_ml_sold', cost_per_ml: 'cost_per_ml',
    };
    const key = sortMap[sortBy] || 'total_revenue';
    result.sort((a, b) => sortDir === 'desc' ? (b[key] as number) - (a[key] as number) : (a[key] as number) - (b[key] as number));
    return result;
  }, [perfumePnL, search, brandFilter, sortBy, sortDir]);

  // Filter and sort — End Products
  const filteredEndProducts = useMemo(() => {
    let result = endProductPnL;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') result = result.filter(r => r.category === categoryFilter);
    const sortMap: Record<string, keyof EndProductPnLRow> = {
      revenue: 'total_revenue', margin: 'total_gross_profit', margin_pct: 'margin_pct',
      units: 'total_units_sold', ltv: 'lifetime_value', rank: 'performance_rank',
    };
    const key = sortMap[sortBy] || 'total_revenue';
    result = [...result].sort((a, b) => {
      const aVal = a[key] as number;
      const bVal = b[key] as number;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [endProductPnL, search, categoryFilter, sortBy, sortDir]);

  // Totals — End Products
  const epTotals = useMemo(() => ({
    revenue: endProductPnL.reduce((s, r) => s + r.total_revenue, 0),
    cogs: endProductPnL.reduce((s, r) => s + r.total_cogs, 0),
    profit: endProductPnL.reduce((s, r) => s + r.total_gross_profit, 0),
    units: endProductPnL.reduce((s, r) => s + r.total_units_sold, 0),
    customers: endProductPnL.reduce((s, r) => s + r.unique_customers, 0),
    products: endProductPnL.length,
  }), [endProductPnL]);

  // Totals — Perfumes
  const perfTotals = useMemo(() => ({
    revenue: perfumePnL.reduce((s, r) => s + r.total_revenue, 0),
    cost: perfumePnL.reduce((s, r) => s + r.total_cost, 0),
    margin: perfumePnL.reduce((s, r) => s + r.gross_margin, 0),
    units: perfumePnL.reduce((s, r) => s + r.total_units_sold, 0),
    ml: perfumePnL.reduce((s, r) => s + r.total_ml_sold, 0),
    perfumeCost: perfumePnL.reduce((s, r) => s + r.total_perfume_cost, 0),
    products: perfumePnL.length,
  }), [perfumePnL]);

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const handleExportCSV = () => {
    if (viewMode === 'end_products') {
      const headers = ['Rank', 'Product', 'SKU', 'Category', 'Selling Price', 'BOM Fixed', 'BOM Variable', 'Shipping', 'Total Cost', 'Margin', 'Margin %', 'Units Sold', 'Revenue', 'COGS', 'Gross Profit', 'Customers', 'LTV', 'Repeat Rate'];
      const rows = filteredEndProducts.map(r => [
        r.performance_rank, r.name, r.sku, r.category, r.selling_price.toFixed(2),
        r.bom_fixed_cost.toFixed(2), r.bom_variable_cost.toFixed(2), r.shipping_cost.toFixed(2),
        r.total_cost.toFixed(2), r.gross_margin.toFixed(2), r.margin_pct.toFixed(1),
        r.total_units_sold, r.total_revenue.toFixed(2), r.total_cogs.toFixed(2),
        r.total_gross_profit.toFixed(2), r.unique_customers, r.lifetime_value.toFixed(2),
        (r.repeat_rate * 100).toFixed(0) + '%',
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `end-product-pnl-${new Date().toISOString().split('T')[0]}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } else {
      const headers = ['Product', 'Brand', 'Units Sold', 'ML Sold', 'Revenue (AED)', 'Perfume Cost', 'Packaging Cost', 'Labor Cost', 'Total Cost', 'Gross Margin', 'Margin %'];
      const rows = filteredPerfumes.map(r => [
        r.name, r.brand, r.total_units_sold, r.total_ml_sold.toFixed(1),
        r.total_revenue.toFixed(2), r.total_perfume_cost.toFixed(2),
        r.total_packaging_cost.toFixed(2), r.total_labor_cost.toFixed(2),
        r.total_cost.toFixed(2), r.gross_margin.toFixed(2), r.margin_pct.toFixed(1),
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `perfume-pnl-${new Date().toISOString().split('T')[0]}.csv`;
      a.click(); URL.revokeObjectURL(url);
    }
  };

  const epOverallMarginPct = epTotals.revenue > 0 ? (epTotals.profit / epTotals.revenue) * 100 : 0;
  const perfOverallMarginPct = perfTotals.revenue > 0 ? (perfTotals.margin / perfTotals.revenue) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Product P&L"
        subtitle="Real-time profit & loss analytics — perfume economics and end product performance"
        breadcrumbs={[
          { label: 'Reports', href: '/reports/guide' },
          { label: 'Product P&L' },
        ]}
        actions={
          <Button variant="outline" onClick={handleExportCSV} className="gap-1.5">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          <button
            onClick={() => { setViewMode('end_products'); setSearch(''); setCategoryFilter('all'); setSortBy('revenue'); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all',
              viewMode === 'end_products'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Package className="w-4 h-4" />
            End Products
          </button>
          <button
            onClick={() => { setViewMode('perfumes'); setSearch(''); setBrandFilter('all'); setSortBy('revenue'); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all',
              viewMode === 'perfumes'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Droplets className="w-4 h-4" />
            Perfume Analysis
          </button>
        </div>

        {/* ============================================================ */}
        {/* END PRODUCTS VIEW */}
        {/* ============================================================ */}
        {viewMode === 'end_products' && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPICard label="Total Revenue" value={`AED ${(epTotals.revenue / 1000).toFixed(0)}K`} sub={`${epTotals.units.toLocaleString()} units sold`} icon={DollarSign} accent="border-l-info" />
              <KPICard label="Total COGS" value={`AED ${(epTotals.cogs / 1000).toFixed(0)}K`} sub="BOM + shipping costs" icon={Box} accent="border-l-warning" />
              <KPICard label="Gross Profit" value={`AED ${(epTotals.profit / 1000).toFixed(0)}K`} sub={`${epOverallMarginPct.toFixed(1)}% margin`} icon={TrendingUp} accent="border-l-success" />
              <KPICard label="Avg LTV" value={`AED ${(epTotals.revenue / Math.max(epTotals.customers, 1)).toFixed(0)}`} sub={`${epTotals.customers} customers`} icon={Users} accent="border-l-gold" />
              <KPICard label="Products" value={`${epTotals.products}`} sub={`${endProductPnL.filter(r => r.status === 'active').length} active`} icon={Package} accent="border-l-primary" />
              <KPICard label="Top Performer" value={endProductPnL[0]?.name.split(' — ')[0] || '—'} sub={`AED ${(endProductPnL[0]?.total_revenue / 1000).toFixed(0)}K revenue`} icon={Award} accent="border-l-gold" />
            </div>

            {/* Top 3 Products Highlight */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {endProductPnL.slice(0, 3).map((ep, idx) => (
                <Card key={ep.product_id} className={cn(
                  'relative overflow-hidden',
                  idx === 0 ? 'border-gold/40 bg-gold/5' : 'border-border',
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                          idx === 0 ? 'bg-gold text-gold-foreground' : idx === 1 ? 'bg-muted-foreground/20 text-foreground' : 'bg-amber-800/20 text-amber-700',
                        )}>
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{ep.name}</p>
                          <p className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[ep.category] || ep.category}</p>
                        </div>
                      </div>
                      <Sparkline data={ep.monthly_sales} color={ep.trend === 'up' ? 'text-green-500' : ep.trend === 'down' ? 'text-red-400' : 'text-muted-foreground'} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
                        <p className="text-sm font-semibold font-mono">AED {(ep.total_revenue / 1000).toFixed(0)}K</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Margin</p>
                        <p className={cn('text-sm font-semibold', ep.margin_pct >= 50 ? 'text-success' : ep.margin_pct >= 30 ? 'text-gold' : 'text-warning')}>
                          {ep.margin_pct.toFixed(0)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">LTV</p>
                        <p className="text-sm font-semibold font-mono">AED {ep.lifetime_value.toFixed(0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by product or SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={sortBy} onValueChange={v => { setSortBy(v); setSortDir('desc'); }}>
                <SelectTrigger className="w-44">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">By Revenue</SelectItem>
                  <SelectItem value="margin">By Profit</SelectItem>
                  <SelectItem value="margin_pct">By Margin %</SelectItem>
                  <SelectItem value="units">By Units Sold</SelectItem>
                  <SelectItem value="ltv">By LTV</SelectItem>
                  <SelectItem value="rank">By Rank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* End Products Table */}
            {filteredEndProducts.length === 0 ? (
              <EmptyState icon={BarChart3} title="No product data" description="End product P&L data will appear once products are configured." />
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-center px-2 py-2.5 text-[10px] font-medium text-muted-foreground w-10">#</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('units')}>
                          Units {sortBy === 'units' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('revenue')}>
                          Revenue {sortBy === 'revenue' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cost Split</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Cost</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('margin')}>
                          Profit {sortBy === 'margin' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('margin_pct')}>
                          Margin {sortBy === 'margin_pct' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('ltv')}>
                          LTV {sortBy === 'ltv' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Trend</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEndProducts.map((row, idx) => (
                        <>
                          <tr key={row.product_id} className={cn(
                            'border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer',
                            idx % 2 === 0 && 'bg-muted/10',
                            expandedRow === row.product_id && 'bg-gold/5',
                          )} onClick={() => setExpandedRow(expandedRow === row.product_id ? null : row.product_id)}>
                            <td className="text-center px-2 py-2.5">
                              <span className={cn(
                                'inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold',
                                row.performance_rank <= 3 ? 'bg-gold/20 text-gold' : 'bg-muted text-muted-foreground',
                              )}>
                                {row.performance_rank}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div>
                                <span className="font-medium text-xs">{row.name}</span>
                                <p className="text-[10px] text-muted-foreground font-mono">{row.sku}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[row.category] || row.category}</Badge>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs">{row.total_units_sold.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-medium">AED {row.total_revenue.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center">
                              <CostBar fixed={row.bom_fixed_cost} variable={row.bom_variable_cost} shipping={row.shipping_cost} total={row.total_cost} />
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs">AED {row.total_cost.toFixed(0)}</td>
                            <td className={cn('px-3 py-2.5 text-right font-mono text-xs font-medium', row.total_gross_profit >= 0 ? 'text-success' : 'text-destructive')}>
                              AED {(row.total_gross_profit / 1000).toFixed(1)}K
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={cn(
                                'inline-flex items-center gap-0.5 text-xs font-semibold',
                                row.margin_pct >= 50 ? 'text-success' : row.margin_pct >= 30 ? 'text-gold' : row.margin_pct >= 15 ? 'text-warning' : 'text-destructive',
                              )}>
                                {row.margin_pct.toFixed(0)}%
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs">AED {row.lifetime_value.toFixed(0)}</td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Sparkline data={row.monthly_sales} color={row.trend === 'up' ? 'text-green-500' : row.trend === 'down' ? 'text-red-400' : 'text-muted-foreground'} />
                                {row.trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> : row.trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-muted-foreground" />}
                              </div>
                            </td>
                            <td className="px-1 py-2.5">
                              {expandedRow === row.product_id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                            </td>
                          </tr>
                          {/* Expanded Detail Row */}
                          {expandedRow === row.product_id && (
                            <tr key={`${row.product_id}-detail`} className="bg-muted/20 border-b border-border">
                              <td colSpan={12} className="px-6 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Selling Price</p>
                                    <p className="text-sm font-semibold font-mono">AED {row.selling_price.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">BOM Fixed</p>
                                    <p className="text-sm font-mono text-blue-500">AED {row.bom_fixed_cost.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">BOM Variable</p>
                                    <p className="text-sm font-mono text-purple-500">AED {row.bom_variable_cost.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Shipping</p>
                                    <p className="text-sm font-mono text-amber-500">AED {row.shipping_cost.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Multiplier</p>
                                    <p className="text-sm font-semibold">{row.multiplier.toFixed(1)}x</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg Cost / Order</p>
                                    <p className="text-sm font-mono">AED {row.avg_cost_per_order.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Unique Customers</p>
                                    <p className="text-sm font-semibold">{row.unique_customers}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Repeat Rate</p>
                                    <p className="text-sm font-semibold">{(row.repeat_rate * 100).toFixed(0)}%</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total COGS</p>
                                    <p className="text-sm font-mono">AED {row.total_cogs.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Gross Profit</p>
                                    <p className={cn('text-sm font-semibold font-mono', row.total_gross_profit >= 0 ? 'text-success' : 'text-destructive')}>
                                      AED {row.total_gross_profit.toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lifetime Value</p>
                                    <p className="text-sm font-semibold font-mono text-gold">AED {row.lifetime_value.toFixed(0)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</p>
                                    <StatusBadge variant={row.status === 'active' ? 'success' : 'muted'}>{row.status}</StatusBadge>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 border-t-2 border-border font-medium">
                        <td className="px-2 py-2.5"></td>
                        <td className="px-3 py-2.5 text-xs">Total ({filteredEndProducts.length} products)</td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{filteredEndProducts.reduce((s, r) => s + r.total_units_sold, 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">AED {filteredEndProducts.reduce((s, r) => s + r.total_revenue, 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">AED {filteredEndProducts.reduce((s, r) => s + r.total_cost, 0).toFixed(0)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-success">AED {(filteredEndProducts.reduce((s, r) => s + r.total_gross_profit, 0) / 1000).toFixed(1)}K</td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold">
                          {(() => {
                            const rev = filteredEndProducts.reduce((s, r) => s + r.total_revenue, 0);
                            const prof = filteredEndProducts.reduce((s, r) => s + r.total_gross_profit, 0);
                            return rev > 0 ? `${((prof / rev) * 100).toFixed(1)}%` : '—';
                          })()}
                        </td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Cost Structure Legend */}
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/70" /> Fixed (BOM)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500/70" /> Variable (Perfume)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500/70" /> Shipping</span>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* PERFUME ANALYSIS VIEW */}
        {/* ============================================================ */}
        {viewMode === 'perfumes' && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPICard label="Total Revenue" value={`AED ${perfTotals.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} accent="border-l-info" />
              <KPICard label="Total Cost" value={`AED ${perfTotals.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={Box} accent="border-l-warning" />
              <KPICard label="Gross Margin" value={`AED ${perfTotals.margin.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub={`${perfOverallMarginPct.toFixed(1)}%`} icon={TrendingUp} accent="border-l-success" />
              <KPICard label="Avg Cost/ml" value={`AED ${perfTotals.ml > 0 ? (perfTotals.perfumeCost / perfTotals.ml).toFixed(2) : '0'}`} sub={`${perfTotals.ml.toFixed(0)} ml total`} icon={Droplets} accent="border-l-gold" />
              <KPICard label="Revenue/ml" value={`AED ${perfTotals.ml > 0 ? (perfTotals.revenue / perfTotals.ml).toFixed(2) : '0'}`} sub={`${perfTotals.products} perfumes`} icon={FlaskConical} accent="border-l-primary" />
              <KPICard label="Top Performer" value={filteredPerfumes[0]?.name?.split(' ').slice(0, 2).join(' ') || '—'} sub={filteredPerfumes[0] ? `AED ${filteredPerfumes[0].total_revenue.toFixed(0)} rev` : ''} icon={Award} accent="border-l-gold" />
            </div>

            {/* Top 3 Perfumes Highlight */}
            {filteredPerfumes.length >= 3 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filteredPerfumes.slice(0, 3).map((pf, idx) => (
                  <Card key={pf.master_id} className={cn(
                    'relative overflow-hidden',
                    idx === 0 ? 'border-gold/40 bg-gold/5' : 'border-border',
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                            idx === 0 ? 'bg-gold text-gold-foreground' : idx === 1 ? 'bg-muted-foreground/20 text-foreground' : 'bg-amber-800/20 text-amber-700',
                          )}>
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{pf.name}</p>
                            <p className="text-[10px] text-muted-foreground">{pf.brand}</p>
                          </div>
                        </div>
                        <Sparkline data={pf.monthly_revenue} color={pf.trend === 'up' ? 'text-green-500' : pf.trend === 'down' ? 'text-red-400' : 'text-muted-foreground'} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
                          <p className="text-sm font-semibold font-mono">AED {pf.total_revenue.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Margin</p>
                          <p className={cn('text-sm font-semibold', pf.margin_pct >= 50 ? 'text-success' : pf.margin_pct >= 30 ? 'text-gold' : 'text-warning')}>
                            {pf.margin_pct.toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Cost/ml</p>
                          <p className="text-sm font-semibold font-mono">AED {pf.cost_per_ml.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by product or brand..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={sortBy} onValueChange={v => { setSortBy(v); setSortDir('desc'); }}>
                <SelectTrigger className="w-44">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">By Revenue</SelectItem>
                  <SelectItem value="margin">By Margin</SelectItem>
                  <SelectItem value="margin_pct">By Margin %</SelectItem>
                  <SelectItem value="units">By Units Sold</SelectItem>
                  <SelectItem value="ml">By ML Sold</SelectItem>
                  <SelectItem value="cost_per_ml">By Cost/ml</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cost Structure Charts */}
            {filteredPerfumes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Cost Structure Breakdown</h4>
                    <DonutChart segments={[
                      { label: 'Perfume Cost', value: filteredPerfumes.reduce((s, r) => s + r.total_perfume_cost, 0), color: '#8b5cf6' },
                      { label: 'Packaging', value: filteredPerfumes.reduce((s, r) => s + r.total_packaging_cost, 0), color: '#3b82f6' },
                      { label: 'Labor + Syringe', value: filteredPerfumes.reduce((s, r) => s + r.total_labor_cost, 0), color: '#f59e0b' },
                    ]} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top Perfumes by Total Spend</h4>
                    <HBarChart items={filteredPerfumes.slice(0, 6).map((pf, i) => ({
                      label: pf.name.length > 18 ? pf.name.slice(0, 18) + '…' : pf.name,
                      value: pf.total_cost,
                      color: ['#c9a961', '#8b5cf6', '#3b82f6', '#f59e0b', '#10b981', '#ef4444'][i % 6],
                    }))} />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Perfume P&L Table */}
            {filteredPerfumes.length === 0 ? (
              <EmptyState icon={BarChart3} title="No P&L data" description="Product P&L data will appear once orders are processed." />
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Brand</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('units')}>
                          Units {sortBy === 'units' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('ml')}>
                          ML {sortBy === 'ml' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('revenue')}>
                          Revenue {sortBy === 'revenue' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('cost_per_ml')}>
                          Cost/ml {sortBy === 'cost_per_ml' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Cost</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('margin')}>
                          Margin {sortBy === 'margin' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort('margin_pct')}>
                          Margin % {sortBy === 'margin_pct' && <ArrowUpDown className="w-3 h-3 inline" />}
                        </th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Trend</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPerfumes.map((row, idx) => (
                        <>
                          <tr key={row.master_id} className={cn(
                            'border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer',
                            idx % 2 === 0 && 'bg-muted/10',
                            perfExpandedRow === row.master_id && 'bg-gold/5',
                          )} onClick={() => setPerfExpandedRow(perfExpandedRow === row.master_id ? null : row.master_id)}>
                            <td className="px-4 py-2.5"><span className="font-medium text-xs">{row.name}</span></td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.brand}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs">{row.total_units_sold}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs">{row.total_ml_sold.toFixed(0)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-medium">AED {row.total_revenue.toFixed(0)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">AED {row.cost_per_ml.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs">AED {row.total_cost.toFixed(0)}</td>
                            <td className={cn('px-3 py-2.5 text-right font-mono text-xs font-medium', row.gross_margin >= 0 ? 'text-success' : 'text-destructive')}>
                              AED {row.gross_margin.toFixed(0)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={cn(
                                'inline-flex items-center gap-0.5 text-xs font-semibold',
                                row.margin_pct >= 50 ? 'text-success' : row.margin_pct >= 30 ? 'text-gold' : row.margin_pct >= 15 ? 'text-warning' : 'text-destructive',
                              )}>
                                {row.margin_pct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Sparkline data={row.monthly_revenue} color={row.trend === 'up' ? 'text-green-500' : row.trend === 'down' ? 'text-red-400' : 'text-muted-foreground'} />
                                {row.trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> : row.trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-muted-foreground" />}
                              </div>
                            </td>
                            <td className="px-1 py-2.5">
                              {perfExpandedRow === row.master_id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                            </td>
                          </tr>
                          {/* Expanded Detail Row */}
                          {perfExpandedRow === row.master_id && (
                            <tr key={`${row.master_id}-detail`} className="bg-muted/20 border-b border-border">
                              <td colSpan={11} className="px-6 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Cost / ml</p>
                                    <p className="text-sm font-semibold font-mono">AED {row.cost_per_ml.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Revenue / ml</p>
                                    <p className="text-sm font-mono text-info">AED {row.revenue_per_ml.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Margin / ml</p>
                                    <p className={cn('text-sm font-mono font-semibold', row.margin_per_ml >= 0 ? 'text-success' : 'text-destructive')}>AED {row.margin_per_ml.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Perfume Cost</p>
                                    <p className="text-sm font-mono text-purple-500">AED {row.total_perfume_cost.toFixed(0)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Packaging Cost</p>
                                    <p className="text-sm font-mono text-blue-500">AED {row.total_packaging_cost.toFixed(0)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Labor + Syringe</p>
                                    <p className="text-sm font-mono text-amber-500">AED {row.total_labor_cost.toFixed(0)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total ML Sold</p>
                                    <p className="text-sm font-semibold">{row.total_ml_sold.toFixed(1)} ml</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg Margin / Unit</p>
                                    <p className="text-sm font-semibold font-mono text-gold">AED {row.avg_margin_per_unit.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Orders</p>
                                    <p className="text-sm font-semibold">{row.order_count}</p>
                                  </div>
                                </div>
                                {/* Usage across products */}
                                {row.product_usage.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-border/50">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">Usage Across Order Types</p>
                                    <div className="flex flex-wrap gap-3">
                                      {row.product_usage.map((u, i) => (
                                        <div key={i} className="px-3 py-2 rounded-md bg-background border border-border text-xs">
                                          <span className="font-medium">{u.product_name}</span>
                                          <span className="text-muted-foreground ml-2">{u.ml_used.toFixed(0)} ml</span>
                                          <span className="text-muted-foreground ml-1">({u.orders} orders)</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 border-t-2 border-border font-medium">
                        <td className="px-4 py-2.5 text-xs">Total ({filteredPerfumes.length} products)</td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{filteredPerfumes.reduce((s, r) => s + r.total_units_sold, 0)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{filteredPerfumes.reduce((s, r) => s + r.total_ml_sold, 0).toFixed(0)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">AED {filteredPerfumes.reduce((s, r) => s + r.total_revenue, 0).toFixed(0)}</td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">AED {filteredPerfumes.reduce((s, r) => s + r.total_cost, 0).toFixed(0)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-success">AED {filteredPerfumes.reduce((s, r) => s + r.gross_margin, 0).toFixed(0)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold">
                          {(() => {
                            const rev = filteredPerfumes.reduce((s, r) => s + r.total_revenue, 0);
                            const mar = filteredPerfumes.reduce((s, r) => s + r.gross_margin, 0);
                            return rev > 0 ? `${((mar / rev) * 100).toFixed(1)}%` : '—';
                          })()}
                        </td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Cost Structure Legend */}
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500/70" /> Perfume Cost</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/70" /> Packaging</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500/70" /> Labor + Syringe</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
