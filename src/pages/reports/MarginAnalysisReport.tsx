// ============================================================
// Margin Analysis Report — Profitability per-perfume and per-order
// Compares total COGS (procurement + packaging) against revenue
// from orders to show gross profit and margin percentages.
// ============================================================

import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpDown,
  ArrowUp, ArrowDown, Download, BarChart3, PieChart,
  ShoppingCart, Package, AlertTriangle, Percent, Target,
  ChevronRight, ChevronDown, Layers, FlaskConical, Box,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Order, Perfume, InventoryBottle, DecantBottle, PackagingSKU } from '@/types';

// ---- Types ----
interface PerfumeMarginRow {
  master_id: string;
  perfume_name: string;
  brand: string;
  revenue: number;
  units_sold: number;
  cogs: number;
  procurement_cost: number;
  packaging_cost_alloc: number;
  gross_profit: number;
  margin_pct: number;
}

interface BatchCostDetail {
  type: 'po' | 'bottle';
  // PO fields
  po_id?: string;
  supplier_name?: string;
  po_date?: string;
  po_status?: string;
  unit_price?: number;
  qty?: number;
  size_ml?: number;
  total_cost?: number;
  // Bottle fields
  bottle_id?: string;
  purchase_price?: number;
  bottle_size_ml?: number;
  bottle_status?: string;
  location?: string;
}

interface OrderMarginRow {
  order_id: string;
  customer_name: string;
  type: 'one_time' | 'subscription';
  items_count: number;
  revenue: number;
  estimated_cogs: number;
  gross_profit: number;
  margin_pct: number;
  created_at: string;
}

type TimeRange = 'all' | '6m' | '3m' | '1m';
type ViewTab = 'overview' | 'by_perfume' | 'by_order';
type PerfumeSortField = 'perfume_name' | 'brand' | 'revenue' | 'cogs' | 'gross_profit' | 'margin_pct' | 'units_sold';
type OrderSortField = 'order_id' | 'customer_name' | 'revenue' | 'estimated_cogs' | 'gross_profit' | 'margin_pct' | 'created_at';
type SortDir = 'asc' | 'desc';

// ---- Helpers ----
function fmtAED(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `AED ${(n / 1000).toFixed(1)}K`;
  }
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtAEDFull(n: number): string {
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const [y, m] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function getTimeRangeFilter(range: TimeRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  const months = range === '6m' ? 6 : range === '3m' ? 3 : 1;
  return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
}

// ---- Component ----
export default function MarginAnalysisReport() {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [viewTab, setViewTab] = useState<ViewTab>('overview');
  const [perfumeSortField, setPerfumeSortField] = useState<PerfumeSortField>('gross_profit');
  const [perfumeSortDir, setPerfumeSortDir] = useState<SortDir>('desc');
  const [orderSortField, setOrderSortField] = useState<OrderSortField>('created_at');
  const [orderSortDir, setOrderSortDir] = useState<SortDir>('desc');
  const [expandedPerfumes, setExpandedPerfumes] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((masterId: string) => {
    setExpandedPerfumes(prev => {
      const next = new Set(prev);
      if (next.has(masterId)) next.delete(masterId);
      else next.add(masterId);
      return next;
    });
  }, []);

  // Fetch data
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: perfumesRes } = useApiQuery(() => api.master.perfumes(), []);
  const { data: sealedRes } = useApiQuery(() => api.inventory.sealedBottles(), []);
  const { data: decantRes } = useApiQuery(() => api.inventory.decantBottles(), []);
  const { data: perfumePOsRes } = useApiQuery(() => api.purchaseOrders.list(), []);
  const { data: packagingPOsRes } = useApiQuery(() => api.mutations.packagingPOs.list() as Promise<any>, []);
  const { data: packagingSKUsRes } = useApiQuery(() => api.master.packagingSKUs(), []);

  // Extract data
  const allOrders = ((ordersRes as any)?.data || []) as Order[];
  const perfumes = ((perfumesRes as any)?.data || []) as Perfume[];
  const sealed = ((sealedRes as any)?.data || []) as InventoryBottle[];
  const decant = ((decantRes as any)?.data || []) as DecantBottle[];
  const perfumePOs = ((perfumePOsRes as any)?.data || perfumePOsRes || []) as any[];
  const packagingPOs = (Array.isArray(packagingPOsRes) ? packagingPOsRes : (packagingPOsRes as any)?.data || []) as any[];
  const packagingSKUs = ((packagingSKUsRes as any)?.data || []) as PackagingSKU[];

  // Time-filtered orders
  const orders = useMemo(() => {
    const cutoff = getTimeRangeFilter(timeRange);
    if (!cutoff) return allOrders;
    return allOrders.filter(o => new Date(o.created_at) >= cutoff);
  }, [allOrders, timeRange]);

  // Build perfume name map
  const perfumeMap = useMemo(() => {
    const map: Record<string, { name: string; brand: string }> = {};
    perfumes.forEach(p => { map[p.master_id] = { name: p.name, brand: p.brand }; });
    return map;
  }, [perfumes]);

  // Build per-perfume COGS from confirmed POs
  const perfumeCOGS = useMemo(() => {
    const costMap: Record<string, number> = {};
    const cutoff = getTimeRangeFilter(timeRange);
    
    // Perfume PO costs
    perfumePOs.forEach((po: any) => {
      if (po.status !== 'confirmed') return;
      if (cutoff && new Date(po.createdAt || po.created_at) < cutoff) return;
      (po.items || []).forEach((item: any) => {
        const masterId = item.masterId || item.master_id;
        const cost = (Number(item.unitPrice || item.unit_price) || 0) * (item.qty || 0);
        if (masterId) {
          costMap[masterId] = (costMap[masterId] || 0) + cost;
        }
      });
    });
    return costMap;
  }, [perfumePOs, timeRange]);

  // Build per-perfume batch details from POs and sealed bottles
  const batchDetails = useMemo(() => {
    const map: Record<string, BatchCostDetail[]> = {};
    const cutoff = getTimeRangeFilter(timeRange);

    // From perfume POs
    perfumePOs.forEach((po: any) => {
      if (cutoff && new Date(po.createdAt || po.created_at) < cutoff) return;
      (po.items || []).forEach((item: any) => {
        const masterId = item.masterId || item.master_id;
        if (!masterId) return;
        if (!map[masterId]) map[masterId] = [];
        const unitPrice = Number(item.unitPrice || item.unit_price) || 0;
        const qty = item.qty || 0;
        map[masterId].push({
          type: 'po',
          po_id: po.poId || po.po_id,
          supplier_name: po.supplierName || po.supplier_name || 'Unknown',
          po_date: po.createdAt || po.created_at,
          po_status: po.status,
          unit_price: unitPrice,
          qty,
          size_ml: item.sizeMl || item.size_ml,
          total_cost: unitPrice * qty,
        });
      });
    });

    // From sealed bottles in inventory
    sealed.forEach(b => {
      if (!map[b.master_id]) map[b.master_id] = [];
      map[b.master_id].push({
        type: 'bottle',
        bottle_id: b.bottle_id,
        purchase_price: b.purchase_price,
        bottle_size_ml: b.size_ml,
        bottle_status: b.status,
        location: b.location_code,
      });
    });

    return map;
  }, [perfumePOs, sealed, timeRange]);

  // Total packaging spend (allocated proportionally to all perfumes)
  const totalPackagingSpend = useMemo(() => {
    const cutoff = getTimeRangeFilter(timeRange);
    let total = 0;
    packagingPOs.forEach((po: any) => {
      if (po.status !== 'confirmed') return;
      if (cutoff && new Date(po.createdAt || po.created_at) < cutoff) return;
      total += Number(po.totalAmount || po.total_amount) || 0;
    });
    return total;
  }, [packagingPOs, timeRange]);

  // Per-perfume margin data
  const perfumeMargins = useMemo(() => {
    const revenueMap: Record<string, { revenue: number; units: number }> = {};
    
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!revenueMap[item.master_id]) {
          revenueMap[item.master_id] = { revenue: 0, units: 0 };
        }
        revenueMap[item.master_id].revenue += item.unit_price * item.qty;
        revenueMap[item.master_id].units += item.qty;
      });
    });

    // Get all perfume IDs that have either revenue or COGS
    const allIds = new Set([...Object.keys(revenueMap), ...Object.keys(perfumeCOGS)]);
    const totalRevenue = Object.values(revenueMap).reduce((s, r) => s + r.revenue, 0);
    
    const rows: PerfumeMarginRow[] = [];
    allIds.forEach(masterId => {
      const info = perfumeMap[masterId] || { name: masterId, brand: 'Unknown' };
      const rev = revenueMap[masterId]?.revenue || 0;
      const units = revenueMap[masterId]?.units || 0;
      const procCost = perfumeCOGS[masterId] || 0;
      // Allocate packaging cost proportionally based on revenue share
      const revenueShare = totalRevenue > 0 ? rev / totalRevenue : 0;
      const pkgAlloc = totalPackagingSpend * revenueShare;
      const totalCogs = procCost + pkgAlloc;
      const profit = rev - totalCogs;
      const margin = rev > 0 ? profit / rev : 0;

      rows.push({
        master_id: masterId,
        perfume_name: info.name,
        brand: info.brand,
        revenue: rev,
        units_sold: units,
        cogs: totalCogs,
        procurement_cost: procCost,
        packaging_cost_alloc: pkgAlloc,
        gross_profit: profit,
        margin_pct: margin,
      });
    });

    return rows;
  }, [orders, perfumeCOGS, totalPackagingSpend, perfumeMap]);

  // Per-order margin data
  const orderMargins = useMemo(() => {
    // Build cost-per-ml map from inventory for estimating per-order COGS
    const costPerMlMap: Record<string, number> = {};
    
    // From sealed bottles
    sealed.forEach(b => {
      const costPerMl = (b.purchase_price || 0) / (b.size_ml || 1);
      if (!costPerMlMap[b.master_id] || costPerMl > costPerMlMap[b.master_id]) {
        costPerMlMap[b.master_id] = costPerMl;
      }
    });
    
    // From decant bottles - use cost-per-ml from sealed bottles as proxy
    // (DecantBottle doesn't have purchase_price, so we skip if no sealed data exists)

    // Fallback: use PO data for cost per ml
    perfumePOs.forEach((po: any) => {
      if (po.status !== 'confirmed') return;
      (po.items || []).forEach((item: any) => {
        const masterId = item.masterId || item.master_id;
        const sizeMl = item.sizeMl || item.size_ml || 100;
        const unitPrice = Number(item.unitPrice || item.unit_price) || 0;
        if (masterId && unitPrice > 0) {
          const cpm = unitPrice / sizeMl;
          if (!costPerMlMap[masterId] || cpm > 0) {
            costPerMlMap[masterId] = cpm;
          }
        }
      });
    });

    const totalOrderRevenue = orders.reduce((s, o) => s + o.total_amount, 0);

    return orders.map(order => {
      let estimatedCogs = 0;
      (order.items || []).forEach(item => {
        const cpm = costPerMlMap[item.master_id] || 0;
        estimatedCogs += cpm * item.size_ml * item.qty;
      });
      // Add proportional packaging allocation
      const revShare = totalOrderRevenue > 0 ? order.total_amount / totalOrderRevenue : 0;
      estimatedCogs += totalPackagingSpend * revShare;

      const profit = order.total_amount - estimatedCogs;
      const margin = order.total_amount > 0 ? profit / order.total_amount : 0;

      return {
        order_id: order.order_id,
        customer_name: order.customer?.name || 'Unknown',
        type: order.type as 'one_time' | 'subscription',
        items_count: (order.items || []).reduce((s, i) => s + i.qty, 0),
        revenue: order.total_amount,
        estimated_cogs: estimatedCogs,
        gross_profit: profit,
        margin_pct: margin,
        created_at: order.created_at,
      } as OrderMarginRow;
    });
  }, [orders, sealed, decant, perfumePOs, totalPackagingSpend]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0);
    const totalPerfumeCOGS = Object.values(perfumeCOGS).reduce((s, c) => s + c, 0);
    const totalCOGS = totalPerfumeCOGS + totalPackagingSpend;
    const grossProfit = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;
    const avgOrderMargin = orderMargins.length > 0
      ? orderMargins.reduce((s, o) => s + o.margin_pct, 0) / orderMargins.length
      : 0;
    const profitablePerfumes = perfumeMargins.filter(p => p.margin_pct > 0 && p.revenue > 0).length;
    const totalPerfumesWithRevenue = perfumeMargins.filter(p => p.revenue > 0).length;

    return {
      totalRevenue,
      totalCOGS,
      totalPerfumeCOGS,
      totalPackagingSpend,
      grossProfit,
      grossMargin,
      avgOrderMargin,
      profitablePerfumes,
      totalPerfumesWithRevenue,
      orderCount: orders.length,
    };
  }, [orders, perfumeCOGS, totalPackagingSpend, orderMargins, perfumeMargins]);

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const months: Record<string, { revenue: number; cogs: number; profit: number }> = {};
    
    orders.forEach(order => {
      const key = getMonthKey(order.created_at);
      if (!months[key]) months[key] = { revenue: 0, cogs: 0, profit: 0 };
      months[key].revenue += order.total_amount;
    });

    // Distribute COGS across months proportionally
    const totalRev = Object.values(months).reduce((s, m) => s + m.revenue, 0);
    Object.entries(months).forEach(([key, m]) => {
      const share = totalRev > 0 ? m.revenue / totalRev : 0;
      m.cogs = kpis.totalCOGS * share;
      m.profit = m.revenue - m.cogs;
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({ month: key, label: getMonthLabel(key), ...data }));
  }, [orders, kpis.totalCOGS]);

  // Top/bottom perfumes by margin
  const topPerfumes = useMemo(() => {
    return [...perfumeMargins]
      .filter(p => p.revenue > 0)
      .sort((a, b) => b.margin_pct - a.margin_pct)
      .slice(0, 5);
  }, [perfumeMargins]);

  const bottomPerfumes = useMemo(() => {
    return [...perfumeMargins]
      .filter(p => p.revenue > 0)
      .sort((a, b) => a.margin_pct - b.margin_pct)
      .slice(0, 5);
  }, [perfumeMargins]);

  // Sorted perfume margins
  const sortedPerfumeMargins = useMemo(() => {
    return [...perfumeMargins].sort((a, b) => {
      const aVal = a[perfumeSortField];
      const bVal = b[perfumeSortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return perfumeSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return perfumeSortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [perfumeMargins, perfumeSortField, perfumeSortDir]);

  // Sorted order margins
  const sortedOrderMargins = useMemo(() => {
    return [...orderMargins].sort((a, b) => {
      const aVal = a[orderSortField];
      const bVal = b[orderSortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return orderSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return orderSortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [orderMargins, orderSortField, orderSortDir]);

  // Sort handlers
  const handlePerfumeSort = useCallback((field: PerfumeSortField) => {
    if (perfumeSortField === field) {
      setPerfumeSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setPerfumeSortField(field);
      setPerfumeSortDir('desc');
    }
  }, [perfumeSortField]);

  const handleOrderSort = useCallback((field: OrderSortField) => {
    if (orderSortField === field) {
      setOrderSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderSortField(field);
      setOrderSortDir('desc');
    }
  }, [orderSortField]);

  // CSV export
  const exportCSV = useCallback(() => {
    const headers = ['Perfume', 'Brand', 'Revenue', 'COGS', 'Procurement', 'Packaging Alloc', 'Gross Profit', 'Margin %', 'Units Sold'];
    const rows = sortedPerfumeMargins.map(r => [
      r.perfume_name, r.brand, r.revenue.toFixed(2), r.cogs.toFixed(2),
      r.procurement_cost.toFixed(2), r.packaging_cost_alloc.toFixed(2),
      r.gross_profit.toFixed(2), (r.margin_pct * 100).toFixed(1), r.units_sold,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `margin-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [sortedPerfumeMargins]);

  // Sort icon helper
  const SortIcon = ({ field, currentField, dir }: { field: string; currentField: string; dir: SortDir }) => {
    if (field !== currentField) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  // Max values for bar widths
  const maxRevenue = Math.max(...perfumeMargins.map(p => p.revenue), 1);
  const maxProfit = Math.max(...perfumeMargins.map(p => Math.abs(p.gross_profit)), 1);
  const maxMonthlyVal = Math.max(...monthlyTrend.map(m => Math.max(m.revenue, m.cogs)), 1);

  return (
    <div>
      <PageHeader
        title="Margin Analysis"
        subtitle={`${orders.length} orders · ${fmtAED(kpis.totalRevenue)} revenue · ${pct(kpis.grossMargin)} margin`}
        breadcrumbs={[{ label: 'Reports' }, { label: 'Margin Analysis' }]}
        actions={
          <div className="flex items-center gap-2">
            {(['all', '6m', '3m', '1m'] as TimeRange[]).map(r => (
              <Button
                key={r}
                size="sm"
                variant={timeRange === r ? 'default' : 'outline'}
                onClick={() => setTimeRange(r)}
                className={cn(
                  'text-xs',
                  timeRange === r && 'bg-gold hover:bg-gold/90 text-gold-foreground',
                )}
              >
                {r === 'all' ? 'All Time' : r === '6m' ? '6 Months' : r === '3m' ? '3 Months' : '1 Month'}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPIBox
            label="TOTAL REVENUE"
            value={fmtAEDFull(kpis.totalRevenue)}
            icon={<ShoppingCart className="w-4 h-4 text-emerald-500" />}
            sublabel={`${orders.length} orders`}
          />
          <KPIBox
            label="TOTAL COGS"
            value={fmtAEDFull(kpis.totalCOGS)}
            icon={<Package className="w-4 h-4 text-blue-500" />}
            sublabel={`Perf ${fmtAED(kpis.totalPerfumeCOGS)} · Pkg ${fmtAED(kpis.totalPackagingSpend)}`}
          />
          <KPIBox
            label="GROSS PROFIT"
            value={fmtAEDFull(kpis.grossProfit)}
            icon={kpis.grossProfit >= 0
              ? <TrendingUp className="w-4 h-4 text-emerald-500" />
              : <TrendingDown className="w-4 h-4 text-red-500" />
            }
            sublabel="Revenue − COGS"
            highlight={kpis.grossProfit >= 0 ? 'positive' : 'negative'}
          />
          <KPIBox
            label="GROSS MARGIN"
            value={pct(kpis.grossMargin)}
            icon={<Percent className="w-4 h-4 text-gold" />}
            sublabel={kpis.grossMargin >= 0.3 ? 'Healthy' : kpis.grossMargin >= 0.15 ? 'Moderate' : 'Low'}
            highlight={kpis.grossMargin >= 0.3 ? 'positive' : kpis.grossMargin >= 0.15 ? 'neutral' : 'negative'}
          />
          <KPIBox
            label="AVG ORDER MARGIN"
            value={pct(kpis.avgOrderMargin)}
            icon={<Target className="w-4 h-4 text-purple-500" />}
            sublabel={`${kpis.orderCount} orders analyzed`}
          />
          <KPIBox
            label="PROFITABLE PERFUMES"
            value={`${kpis.profitablePerfumes} / ${kpis.totalPerfumesWithRevenue}`}
            icon={<BarChart3 className="w-4 h-4 text-amber-500" />}
            sublabel={kpis.totalPerfumesWithRevenue > 0
              ? `${((kpis.profitablePerfumes / kpis.totalPerfumesWithRevenue) * 100).toFixed(0)}% profitable`
              : 'No data'
            }
          />
        </div>

        {/* View Tabs */}
        <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as ViewTab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="by_perfume">By Perfume</TabsTrigger>
            <TabsTrigger value="by_order">By Order</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Overview Tab */}
        {viewTab === 'overview' && (
          <div className="space-y-6">
            {/* Revenue vs COGS Waterfall */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Revenue vs COGS Breakdown" subtitle="Where the money goes">
                <div className="space-y-4 pt-2">
                  {/* Revenue bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-mono font-semibold text-emerald-500">{fmtAEDFull(kpis.totalRevenue)}</span>
                    </div>
                    <div className="h-8 bg-muted/30 rounded-md overflow-hidden">
                      <div
                        className="h-full bg-emerald-500/80 rounded-md transition-all"
                        style={{ width: kpis.totalRevenue > 0 ? '100%' : '0%' }}
                      />
                    </div>
                  </div>
                  {/* Perfume COGS bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Perfume Procurement</span>
                      <span className="font-mono font-semibold text-blue-500">{fmtAEDFull(kpis.totalPerfumeCOGS)}</span>
                    </div>
                    <div className="h-8 bg-muted/30 rounded-md overflow-hidden">
                      <div
                        className="h-full bg-blue-500/80 rounded-md transition-all"
                        style={{ width: kpis.totalRevenue > 0 ? `${(kpis.totalPerfumeCOGS / kpis.totalRevenue) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                  {/* Packaging COGS bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Packaging Cost</span>
                      <span className="font-mono font-semibold text-amber-500">{fmtAEDFull(kpis.totalPackagingSpend)}</span>
                    </div>
                    <div className="h-8 bg-muted/30 rounded-md overflow-hidden">
                      <div
                        className="h-full bg-amber-500/80 rounded-md transition-all"
                        style={{ width: kpis.totalRevenue > 0 ? `${(kpis.totalPackagingSpend / kpis.totalRevenue) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                  {/* Gross Profit bar */}
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">Gross Profit</span>
                      <span className={cn(
                        'font-mono font-bold',
                        kpis.grossProfit >= 0 ? 'text-emerald-500' : 'text-red-500',
                      )}>
                        {fmtAEDFull(kpis.grossProfit)} ({pct(kpis.grossMargin)})
                      </span>
                    </div>
                    <div className="h-8 bg-muted/30 rounded-md overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-md transition-all',
                          kpis.grossProfit >= 0 ? 'bg-emerald-500/30' : 'bg-red-500/30',
                        )}
                        style={{ width: kpis.totalRevenue > 0 ? `${Math.abs(kpis.grossProfit / kpis.totalRevenue) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Monthly Trend */}
              <SectionCard title="Monthly Revenue vs COGS" subtitle="Trend over time">
                {monthlyTrend.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    {monthlyTrend.map(m => (
                      <div key={m.month}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{m.label}</span>
                          <span className="text-muted-foreground">
                            Margin: <span className={cn(
                              'font-semibold',
                              m.profit >= 0 ? 'text-emerald-500' : 'text-red-500',
                            )}>
                              {m.revenue > 0 ? pct(m.profit / m.revenue) : '0%'}
                            </span>
                          </span>
                        </div>
                        <div className="flex gap-1 h-6">
                          <div
                            className="bg-emerald-500/70 rounded-sm transition-all"
                            style={{ width: `${(m.revenue / maxMonthlyVal) * 100}%` }}
                            title={`Revenue: ${fmtAEDFull(m.revenue)}`}
                          />
                        </div>
                        <div className="flex gap-1 h-4 mt-0.5">
                          <div
                            className="bg-blue-500/50 rounded-sm transition-all"
                            style={{ width: `${(m.cogs / maxMonthlyVal) * 100}%` }}
                            title={`COGS: ${fmtAEDFull(m.cogs)}`}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-4 text-[10px] text-muted-foreground pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-2 rounded-sm bg-emerald-500/70" /> Revenue
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-2 rounded-sm bg-blue-500/50" /> COGS
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No order data in selected period</p>
                )}
              </SectionCard>
            </div>

            {/* Top & Bottom Perfumes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Highest Margin Perfumes" subtitle="Top 5 by gross margin %">
                {topPerfumes.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {topPerfumes.map((p, i) => (
                      <div key={p.master_id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/20 transition-colors">
                        <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.perfume_name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.brand} · {p.units_sold} units</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono font-bold text-emerald-500">{pct(p.margin_pct)}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtAED(p.gross_profit)} profit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No perfume data</p>
                )}
              </SectionCard>

              <SectionCard title="Lowest Margin Perfumes" subtitle="Bottom 5 by gross margin %">
                {bottomPerfumes.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {bottomPerfumes.map((p, i) => (
                      <div key={p.master_id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/20 transition-colors">
                        <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.perfume_name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.brand} · {p.units_sold} units</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn(
                            'text-sm font-mono font-bold',
                            p.margin_pct >= 0 ? 'text-amber-500' : 'text-red-500',
                          )}>
                            {pct(p.margin_pct)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{fmtAED(p.gross_profit)} profit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No perfume data</p>
                )}
              </SectionCard>
            </div>

            {/* Margin Distribution */}
            <SectionCard title="Margin Distribution" subtitle="Per-perfume margin spread (perfumes with revenue only)">
              {perfumeMargins.filter(p => p.revenue > 0).length > 0 ? (
                <div className="space-y-1.5 pt-2">
                  {[...perfumeMargins]
                    .filter(p => p.revenue > 0)
                    .sort((a, b) => b.margin_pct - a.margin_pct)
                    .map(p => (
                      <div key={p.master_id} className="flex items-center gap-3">
                        <div className="w-32 truncate text-xs text-muted-foreground" title={p.perfume_name}>
                          {p.perfume_name}
                        </div>
                        <div className="flex-1 h-5 bg-muted/20 rounded-sm overflow-hidden relative">
                          <div
                            className={cn(
                              'h-full rounded-sm transition-all',
                              p.margin_pct >= 0.3 ? 'bg-emerald-500/70' :
                              p.margin_pct >= 0.15 ? 'bg-amber-500/70' :
                              p.margin_pct >= 0 ? 'bg-orange-500/70' : 'bg-red-500/70',
                            )}
                            style={{ width: `${Math.min(Math.max(p.margin_pct * 100, 0), 100)}%` }}
                          />
                        </div>
                        <span className={cn(
                          'text-xs font-mono font-semibold w-14 text-right',
                          p.margin_pct >= 0.3 ? 'text-emerald-500' :
                          p.margin_pct >= 0.15 ? 'text-amber-500' :
                          p.margin_pct >= 0 ? 'text-orange-500' : 'text-red-500',
                        )}>
                          {pct(p.margin_pct)}
                        </span>
                      </div>
                    ))}
                  <div className="flex gap-4 text-[10px] text-muted-foreground pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-emerald-500/70" /> &ge;30%</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-amber-500/70" /> 15-30%</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-orange-500/70" /> 0-15%</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-red-500/70" /> Negative</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No perfume revenue data</p>
              )}
            </SectionCard>
          </div>
        )}

        {/* By Perfume Tab */}
        {viewTab === 'by_perfume' && (
          <SectionCard title="Per-Perfume Profitability" subtitle={`${perfumeMargins.length} perfumes analyzed`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      { field: 'perfume_name' as PerfumeSortField, label: 'PERFUME' },
                      { field: 'brand' as PerfumeSortField, label: 'BRAND' },
                      { field: 'units_sold' as PerfumeSortField, label: 'UNITS' },
                      { field: 'revenue' as PerfumeSortField, label: 'REVENUE' },
                      { field: 'cogs' as PerfumeSortField, label: 'COGS' },
                      { field: 'gross_profit' as PerfumeSortField, label: 'PROFIT' },
                      { field: 'margin_pct' as PerfumeSortField, label: 'MARGIN' },
                    ].map(col => (
                      <th
                        key={col.field}
                        className="text-left py-3 px-3 text-[10px] font-semibold text-muted-foreground tracking-wider cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handlePerfumeSort(col.field)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          <SortIcon field={col.field} currentField={perfumeSortField} dir={perfumeSortDir} />
                        </div>
                      </th>
                    ))}
                    <th className="text-left py-3 px-3 text-[10px] font-semibold text-muted-foreground tracking-wider w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPerfumeMargins.map(row => {
                    const isExpanded = expandedPerfumes.has(row.master_id);
                    const details = batchDetails[row.master_id] || [];
                    const poDetails = details.filter(d => d.type === 'po');
                    const bottleDetails = details.filter(d => d.type === 'bottle');
                    const hasDetails = details.length > 0;

                    return (
                      <>
                        <tr
                          key={row.master_id}
                          className={cn(
                            'border-b border-border/50 transition-colors cursor-pointer',
                            isExpanded ? 'bg-muted/20' : 'hover:bg-muted/10',
                          )}
                          onClick={() => hasDetails && toggleExpand(row.master_id)}
                        >
                          <td className="py-3 px-3 font-medium max-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className="truncate" title={row.perfume_name}>{row.perfume_name}</span>
                              {hasDetails && (
                                <Badge variant="outline" className="text-[9px] shrink-0 px-1 py-0">
                                  {poDetails.length}PO · {bottleDetails.length}btl
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">{row.brand}</td>
                          <td className="py-3 px-3 font-mono">{row.units_sold}</td>
                          <td className="py-3 px-3 font-mono text-emerald-500">{fmtAEDFull(row.revenue)}</td>
                          <td className="py-3 px-3 font-mono text-blue-500">{fmtAEDFull(row.cogs)}</td>
                          <td className={cn('py-3 px-3 font-mono font-semibold', row.gross_profit >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                            {fmtAEDFull(row.gross_profit)}
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className={cn(
                              'font-mono text-xs',
                              row.margin_pct >= 0.3 ? 'border-emerald-500/30 text-emerald-500' :
                              row.margin_pct >= 0.15 ? 'border-amber-500/30 text-amber-500' :
                              row.margin_pct >= 0 ? 'border-orange-500/30 text-orange-500' : 'border-red-500/30 text-red-500',
                            )}>
                              {pct(row.margin_pct)}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            {hasDetails ? (
                              isExpanded
                                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <span className="text-[10px] text-muted-foreground/40">—</span>
                            )}
                          </td>
                        </tr>

                        {/* Drill-down expanded row */}
                        {isExpanded && hasDetails && (
                          <tr key={`${row.master_id}-detail`} className="bg-muted/5">
                            <td colSpan={8} className="p-0">
                              <div className="px-6 py-4 space-y-4 border-l-2 border-gold/40 ml-3">
                                {/* PO Batches */}
                                {poDetails.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Layers className="w-3.5 h-3.5 text-blue-500" />
                                      <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Purchase Order Batches</span>
                                      <span className="text-[10px] text-muted-foreground">({poDetails.length} line items)</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-border/30">
                                            <th className="text-left py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">PO ID</th>
                                            <th className="text-left py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">SUPPLIER</th>
                                            <th className="text-left py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">DATE</th>
                                            <th className="text-left py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">STATUS</th>
                                            <th className="text-right py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">SIZE</th>
                                            <th className="text-right py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">QTY</th>
                                            <th className="text-right py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">UNIT PRICE</th>
                                            <th className="text-right py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">TOTAL COST</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {poDetails.map((d, i) => (
                                            <tr key={`po-${i}`} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                                              <td className="py-1.5 px-2 font-mono text-blue-400">{d.po_id?.slice(0, 8)}...</td>
                                              <td className="py-1.5 px-2 text-muted-foreground max-w-[120px] truncate" title={d.supplier_name}>{d.supplier_name}</td>
                                              <td className="py-1.5 px-2 text-muted-foreground">
                                                {d.po_date ? new Date(d.po_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                                              </td>
                                              <td className="py-1.5 px-2">
                                                <Badge variant="outline" className={cn(
                                                  'text-[9px] px-1.5 py-0',
                                                  d.po_status === 'confirmed' ? 'border-emerald-500/30 text-emerald-500' :
                                                  d.po_status === 'delivered' ? 'border-blue-500/30 text-blue-500' :
                                                  d.po_status === 'cancelled' ? 'border-red-500/30 text-red-500' :
                                                  'border-amber-500/30 text-amber-500',
                                                )}>
                                                  {(d.po_status || '').replace(/_/g, ' ')}
                                                </Badge>
                                              </td>
                                              <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">{d.size_ml ? `${d.size_ml}ml` : '—'}</td>
                                              <td className="py-1.5 px-2 text-right font-mono">{d.qty}</td>
                                              <td className="py-1.5 px-2 text-right font-mono">{fmtAEDFull(d.unit_price || 0)}</td>
                                              <td className="py-1.5 px-2 text-right font-mono font-semibold text-blue-500">{fmtAEDFull(d.total_cost || 0)}</td>
                                            </tr>
                                          ))}
                                          <tr className="border-t border-border/40">
                                            <td colSpan={7} className="py-1.5 px-2 text-right text-[10px] font-semibold text-muted-foreground">PO Subtotal</td>
                                            <td className="py-1.5 px-2 text-right font-mono font-bold text-blue-500">
                                              {fmtAEDFull(poDetails.reduce((s, d) => s + (d.total_cost || 0), 0))}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Sealed Bottles */}
                                {bottleDetails.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <FlaskConical className="w-3.5 h-3.5 text-purple-500" />
                                      <span className="text-xs font-semibold text-purple-500 uppercase tracking-wider">Sealed Bottles in Inventory</span>
                                      <span className="text-[10px] text-muted-foreground">({bottleDetails.length} bottles)</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-border/30">
                                            <th className="text-left py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">BOTTLE ID</th>
                                            <th className="text-right py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">SIZE</th>
                                            <th className="text-left py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">STATUS</th>
                                            <th className="text-left py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">LOCATION</th>
                                            <th className="text-right py-2 px-2 text-[9px] font-semibold text-muted-foreground tracking-wider">PURCHASE PRICE</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {bottleDetails.slice(0, 10).map((d, i) => (
                                            <tr key={`btl-${i}`} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                                              <td className="py-1.5 px-2 font-mono text-purple-400">{(d.bottle_id || '').slice(0, 10)}...</td>
                                              <td className="py-1.5 px-2 text-right font-mono">{d.bottle_size_ml}ml</td>
                                              <td className="py-1.5 px-2">
                                                <Badge variant="outline" className={cn(
                                                  'text-[9px] px-1.5 py-0',
                                                  d.bottle_status === 'available' ? 'border-emerald-500/30 text-emerald-500' :
                                                  d.bottle_status === 'allocated' ? 'border-amber-500/30 text-amber-500' :
                                                  d.bottle_status === 'sold' ? 'border-blue-500/30 text-blue-500' :
                                                  'border-muted-foreground/30 text-muted-foreground',
                                                )}>
                                                  {d.bottle_status}
                                                </Badge>
                                              </td>
                                              <td className="py-1.5 px-2 text-muted-foreground">{d.location || '—'}</td>
                                              <td className="py-1.5 px-2 text-right font-mono font-semibold text-purple-500">{fmtAEDFull(d.purchase_price || 0)}</td>
                                            </tr>
                                          ))}
                                          {bottleDetails.length > 10 && (
                                            <tr>
                                              <td colSpan={5} className="py-1.5 px-2 text-center text-[10px] text-muted-foreground">
                                                +{bottleDetails.length - 10} more bottles
                                              </td>
                                            </tr>
                                          )}
                                          <tr className="border-t border-border/40">
                                            <td colSpan={4} className="py-1.5 px-2 text-right text-[10px] font-semibold text-muted-foreground">Inventory Value</td>
                                            <td className="py-1.5 px-2 text-right font-mono font-bold text-purple-500">
                                              {fmtAEDFull(bottleDetails.reduce((s, d) => s + (d.purchase_price || 0), 0))}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Packaging allocation note */}
                                {row.packaging_cost_alloc > 0 && (
                                  <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                                    <Box className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-xs text-muted-foreground">
                                      Packaging allocation: <span className="font-mono font-semibold text-amber-500">{fmtAEDFull(row.packaging_cost_alloc)}</span>
                                      <span className="text-[10px] ml-1">(proportional to revenue share)</span>
                                    </span>
                                  </div>
                                )}

                                {/* Summary bar */}
                                <div className="flex items-center gap-4 pt-2 border-t border-border/20">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground">Total COGS:</span>
                                    <span className="text-xs font-mono font-bold text-blue-500">{fmtAEDFull(row.cogs)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground">Revenue:</span>
                                    <span className="text-xs font-mono font-bold text-emerald-500">{fmtAEDFull(row.revenue)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground">Margin:</span>
                                    <span className={cn(
                                      'text-xs font-mono font-bold',
                                      row.margin_pct >= 0.3 ? 'text-emerald-500' :
                                      row.margin_pct >= 0.15 ? 'text-amber-500' :
                                      row.margin_pct >= 0 ? 'text-orange-500' : 'text-red-500',
                                    )}>
                                      {pct(row.margin_pct)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* By Order Tab */}
        {viewTab === 'by_order' && (
          <SectionCard title="Per-Order Profitability" subtitle={`${orderMargins.length} orders analyzed · COGS estimated from inventory cost-per-ml`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      { field: 'order_id' as OrderSortField, label: 'ORDER' },
                      { field: 'customer_name' as OrderSortField, label: 'CUSTOMER' },
                      { field: 'created_at' as OrderSortField, label: 'DATE' },
                      { field: 'revenue' as OrderSortField, label: 'REVENUE' },
                      { field: 'estimated_cogs' as OrderSortField, label: 'EST. COGS' },
                      { field: 'gross_profit' as OrderSortField, label: 'PROFIT' },
                      { field: 'margin_pct' as OrderSortField, label: 'MARGIN' },
                    ].map(col => (
                      <th
                        key={col.field}
                        className="text-left py-3 px-3 text-[10px] font-semibold text-muted-foreground tracking-wider cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleOrderSort(col.field)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          <SortIcon field={col.field} currentField={orderSortField} dir={orderSortDir} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedOrderMargins.map(row => (
                    <tr key={row.order_id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{row.order_id}</span>
                          <Badge variant="outline" className="text-[9px]">
                            {row.type === 'subscription' ? 'Sub' : 'OT'}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate">{row.customer_name}</td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">
                        {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-mono text-emerald-500">{fmtAEDFull(row.revenue)}</td>
                      <td className="py-3 px-3 font-mono text-blue-500">{fmtAEDFull(row.estimated_cogs)}</td>
                      <td className={cn('py-3 px-3 font-mono font-semibold', row.gross_profit >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                        {fmtAEDFull(row.gross_profit)}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={cn(
                          'font-mono text-xs',
                          row.margin_pct >= 0.3 ? 'border-emerald-500/30 text-emerald-500' :
                          row.margin_pct >= 0.15 ? 'border-amber-500/30 text-amber-500' :
                          row.margin_pct >= 0 ? 'border-orange-500/30 text-orange-500' : 'border-red-500/30 text-red-500',
                        )}>
                          {pct(row.margin_pct)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ---- KPI Box Component ----
function KPIBox({ label, value, icon, sublabel, highlight }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sublabel: string;
  highlight?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">{label}</span>
        {icon}
      </div>
      <p className={cn(
        'text-xl font-bold font-mono',
        highlight === 'positive' ? 'text-emerald-500' :
        highlight === 'negative' ? 'text-red-500' :
        highlight === 'neutral' ? 'text-amber-500' : 'text-foreground',
      )}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{sublabel}</p>
    </div>
  );
}
