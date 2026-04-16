// ============================================================
// Packaging Cost Report — Spend analytics by category over time
// Uses confirmed packaging PO data + SKU inventory from DB
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  DollarSign, TrendingUp, TrendingDown, Package, PackageOpen,
  BarChart3, Layers, Tag, Box, Ruler, Archive,
  ArrowUpDown, ArrowUp, ArrowDown, Calendar, PieChart as PieChartIcon,
  Download, Users, AlertTriangle, ShoppingCart,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { Button } from '@/components/ui/button';
import type { PackagingSKU } from '@/types';

// ---- Constants ----
const CATEGORY_LABELS: Record<string, string> = {
  atomizers_vials: 'Atomizers & Vials',
  'Atomiser & Vials': 'Atomizers & Vials',
  decant_bottles: 'Decant Bottles',
  'Decant Bottles': 'Decant Bottles',
  packaging_materials: 'Packaging Material',
  'Packaging Material': 'Packaging Material',
  packaging_accessories: 'Packaging Accessories',
  'Packaging Accessories': 'Packaging Accessories',
  shipping_materials: 'Shipping Material',
  'Shipping Material': 'Shipping Material',
  accessories: 'Others',
  labels: 'Labels',
  'Labels': 'Labels',
  other: 'Others',
  'Other': 'Others',
  'Others': 'Others',
  packaging: 'Packaging Material',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Atomizers & Vials': '#c8a951',
  'Decant Bottles': '#3b82f6',
  'Packaging Material': '#10b981',
  'Packaging Accessories': '#f59e0b',
  'Shipping Material': '#8b5cf6',
  'Labels': '#ec4899',
  'Others': '#6b7280',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Atomizers & Vials': Package,
  'Decant Bottles': Box,
  'Packaging Material': Layers,
  'Packaging Accessories': Tag,
  'Shipping Material': Archive,
  'Labels': Tag,
  'Others': PackageOpen,
};

// ---- Helpers ----
function fmtAED(n: number): string {
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeCat(raw: string): string {
  return CATEGORY_LABELS[raw] || raw || 'Others';
}

type SortField = 'supplier' | 'total_spent' | 'orders' | 'units' | 'avg_unit_cost';
type SortDir = 'asc' | 'desc';

// ---- Component ----
export default function PackagingCostReport() {
  const [timeRange, setTimeRange] = useState<'all' | '6m' | '3m' | '1m'>('all');
  const [sortField, setSortField] = useState<SortField>('total_spent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Fetch data
  const { data: pkgPosRaw, isLoading: loadingPOs } = useApiQuery<any[]>(
    () => api.mutations.packagingPOs.list(), []
  );
  const { data: skusRes, isLoading: loadingSKUs } = useApiQuery(
    () => api.master.packagingSKUs(), []
  );

  const isLoading = loadingPOs || loadingSKUs;

  const allPOs = useMemo(() => {
    if (!pkgPosRaw || !Array.isArray(pkgPosRaw)) return [];
    return pkgPosRaw;
  }, [pkgPosRaw]);

  const skus: PackagingSKU[] = useMemo(() => {
    return (skusRes as any)?.data || [];
  }, [skusRes]);

  // Build SKU lookup for category mapping
  const skuMap = useMemo(() => {
    const map: Record<string, PackagingSKU> = {};
    skus.forEach(s => { map[s.sku_id] = s; });
    return map;
  }, [skus]);

  // Filter POs by time range
  const filteredPOs = useMemo(() => {
    if (timeRange === 'all') return allPOs;
    const now = new Date();
    const months = timeRange === '6m' ? 6 : timeRange === '3m' ? 3 : 1;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return allPOs.filter((po: any) => {
      const d = new Date(po.confirmedAt || po.createdAt);
      return d >= cutoff;
    });
  }, [allPOs, timeRange]);

  // Only confirmed POs for spend analysis
  const confirmedPOs = useMemo(() => {
    return filteredPOs.filter((po: any) => po.status === 'confirmed');
  }, [filteredPOs]);

  // ---- KPIs ----
  const totalSpend = useMemo(() => {
    return confirmedPOs.reduce((sum: number, po: any) => sum + Number(po.totalAmount || 0), 0);
  }, [confirmedPOs]);

  const totalOrders = confirmedPOs.length;
  const activePOs = filteredPOs.filter((po: any) =>
    ['pending_quote', 'quote_approved', 'pending_delivery', 'delivered'].includes(po.status)
  ).length;

  const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;

  // Previous period comparison
  const prevPeriodSpend = useMemo(() => {
    if (timeRange === 'all') return null;
    const now = new Date();
    const months = timeRange === '6m' ? 6 : timeRange === '3m' ? 3 : 1;
    const periodStart = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    const prevStart = new Date(now.getFullYear(), now.getMonth() - months * 2, now.getDate());
    const prevPOs = allPOs.filter((po: any) => {
      if (po.status !== 'confirmed') return false;
      const d = new Date(po.confirmedAt || po.createdAt);
      return d >= prevStart && d < periodStart;
    });
    return prevPOs.reduce((sum: number, po: any) => sum + Number(po.totalAmount || 0), 0);
  }, [allPOs, timeRange]);

  const spendTrend = prevPeriodSpend !== null && prevPeriodSpend > 0
    ? ((totalSpend - prevPeriodSpend) / prevPeriodSpend * 100)
    : null;

  // ---- Spend by Category (for pie chart + bar chart) ----
  const spendByCategory = useMemo(() => {
    const map: Record<string, { category: string; spent: number; units: number; orders: Set<string> }> = {};

    confirmedPOs.forEach((po: any) => {
      const items = po.items || [];
      items.forEach((item: any) => {
        const skuId = item.masterId || item.skuId;
        const sku = skuMap[skuId];
        const cat = normalizeCat(sku?.category || item.bottleType || 'Other');
        if (!map[cat]) map[cat] = { category: cat, spent: 0, units: 0, orders: new Set() };
        const price = Number(item.unitPrice || 0);
        const qty = Number(item.qty || 0);
        map[cat].spent += price * qty;
        map[cat].units += qty;
        map[cat].orders.add(po.poId);
      });
    });

    return Object.values(map)
      .map(v => ({ ...v, orderCount: v.orders.size, orders: undefined }))
      .sort((a, b) => b.spent - a.spent);
  }, [confirmedPOs, skuMap]);

  const topCategory = spendByCategory[0]?.category || 'N/A';

  // ---- Monthly Spend by Category (stacked bar chart) ----
  const monthlyByCategory = useMemo(() => {
    const categories = new Set<string>();
    const monthMap: Record<string, Record<string, any>> = {};

    confirmedPOs.forEach((po: any) => {
      const d = new Date(po.confirmedAt || po.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const items = po.items || [];
      items.forEach((item: any) => {
        const skuId = item.masterId || item.skuId;
        const sku = skuMap[skuId];
        const cat = normalizeCat(sku?.category || item.bottleType || 'Other');
        categories.add(cat);
        if (!monthMap[key]) monthMap[key] = { month: label };
        monthMap[key][cat] = (monthMap[key][cat] || 0) + Number(item.unitPrice || 0) * Number(item.qty || 0);
      });
    });

    const data = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    return { data, categories: Array.from(categories) };
  }, [confirmedPOs, skuMap]);

  // ---- Supplier Breakdown ----
  const supplierBreakdown = useMemo(() => {
    const map: Record<string, { supplier: string; total_spent: number; orders: number; units: number; totalUnitCost: number; itemCount: number }> = {};

    confirmedPOs.forEach((po: any) => {
      const name = po.supplierName || 'Unknown';
      if (!map[name]) map[name] = { supplier: name, total_spent: 0, orders: 0, units: 0, totalUnitCost: 0, itemCount: 0 };
      map[name].orders += 1;
      map[name].total_spent += Number(po.totalAmount || 0);

      const items = po.items || [];
      items.forEach((item: any) => {
        const qty = Number(item.qty || 0);
        const price = Number(item.unitPrice || 0);
        map[name].units += qty;
        map[name].totalUnitCost += price;
        map[name].itemCount += 1;
      });
    });

    return Object.values(map).map(v => ({
      ...v,
      avg_unit_cost: v.itemCount > 0 ? v.totalUnitCost / v.itemCount : 0,
    }));
  }, [confirmedPOs]);

  // Sort supplier breakdown
  const sortedSuppliers = useMemo(() => {
    return [...supplierBreakdown].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [supplierBreakdown, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-gold" /> : <ArrowDown className="w-3 h-3 text-gold" />;
  };

  // ---- Inventory value from current stock ----
  const inventoryValue = useMemo(() => {
    return skus.reduce((sum, s) => sum + (s.qty_on_hand * s.unit_cost), 0);
  }, [skus]);

  const lowStockCount = useMemo(() => {
    return skus.filter(s => s.active && s.qty_on_hand <= s.min_stock_level && s.min_stock_level > 0).length;
  }, [skus]);

  // ---- CSV Export ----
  const handleExportCSV = () => {
    const headers = ['Category', 'Total Spent (AED)', 'Units Purchased', 'Orders'];
    const rows = spendByCategory.map(c => [c.category, c.spent.toFixed(2), c.units, c.orderCount]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `packaging-cost-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ---- Recharts custom tooltip ----
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-mono font-bold">{fmtAED(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground">{d.name}</p>
        <p className="font-mono text-gold font-bold">{fmtAED(d.value)}</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Packaging Cost Report" subtitle="Loading..." breadcrumbs={[{ label: 'Reports' }, { label: 'Packaging Cost' }]} />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Packaging Cost Report"
        subtitle={`${totalOrders} confirmed orders · ${spendByCategory.length} categories · AED ${totalSpend.toLocaleString('en-AE', { minimumFractionDigits: 0 })} total spend`}
        breadcrumbs={[{ label: 'Reports' }, { label: 'Packaging Cost' }]}
        actions={
          <div className="flex items-center gap-3">
            {/* Time Range */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              {([['all', 'All Time'], ['6m', '6 Months'], ['3m', '3 Months'], ['1m', '1 Month']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setTimeRange(val)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    timeRange === val ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* ---- KPI Strip ---- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Spend', value: fmtAED(totalSpend), icon: DollarSign, color: 'border-l-gold', trend: spendTrend },
            { label: 'Confirmed Orders', value: totalOrders.toString(), icon: ShoppingCart, color: 'border-l-emerald-500' },
            { label: 'Active POs', value: activePOs.toString(), icon: Package, color: 'border-l-blue-500' },
            { label: 'Avg Order Value', value: fmtAED(avgOrderValue), icon: TrendingUp, color: 'border-l-amber-500' },
            { label: 'Inventory Value', value: fmtAED(inventoryValue), icon: PackageOpen, color: 'border-l-purple-500' },
            { label: 'Low Stock SKUs', value: lowStockCount.toString(), icon: AlertTriangle, color: lowStockCount > 0 ? 'border-l-destructive' : 'border-l-emerald-500' },
          ].map((kpi) => (
            <div key={kpi.label} className={cn('bg-card border border-border rounded-xl p-4 border-l-4', kpi.color)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{kpi.label}</span>
                <kpi.icon className="w-4 h-4 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-bold font-mono">{kpi.value}</p>
              {kpi.trend !== undefined && kpi.trend !== null && (
                <div className={cn('flex items-center gap-1 mt-1 text-[10px] font-medium',
                  kpi.trend >= 0 ? 'text-destructive' : 'text-emerald-600')}>
                  {kpi.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(kpi.trend).toFixed(1)}% vs prev period
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ---- Charts Row: Pie + Stacked Bar ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Category Pie Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
              <PieChartIcon className="w-4.5 h-4.5 text-gold" />
              <div>
                <h3 className="text-sm font-bold">Spend by Category</h3>
                <p className="text-[10px] text-muted-foreground">Proportion of total packaging spend</p>
              </div>
            </div>
            <div className="p-4">
              {spendByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={spendByCategory.map(c => ({ name: c.category, value: c.spent }))}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {spendByCategory.map((c, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[c.category] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
                      iconType="circle"
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  No confirmed packaging POs yet
                </div>
              )}
            </div>
          </div>

          {/* Monthly Spend by Category (Stacked Bar) */}
          <div className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
              <BarChart3 className="w-4.5 h-4.5 text-gold" />
              <div>
                <h3 className="text-sm font-bold">Monthly Spend by Category</h3>
                <p className="text-[10px] text-muted-foreground">Stacked breakdown over time</p>
              </div>
            </div>
            <div className="p-4">
              {monthlyByCategory.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyByCategory.data} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    {monthlyByCategory.categories.map((cat, i) => (
                      <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat] || '#6b7280'} radius={i === monthlyByCategory.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  No monthly data available — confirm packaging POs to see trends
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Cumulative Spend Trend (Area Chart) ---- */}
        {monthlyByCategory.data.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
              <TrendingUp className="w-4.5 h-4.5 text-gold" />
              <div>
                <h3 className="text-sm font-bold">Cumulative Spend Trend</h3>
                <p className="text-[10px] text-muted-foreground">Running total of packaging procurement spend</p>
              </div>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={(() => {
                  let running = 0;
                  return monthlyByCategory.data.map(d => {
                    const total = monthlyByCategory.categories.reduce((s, cat) => s + (Number(d[cat]) || 0), 0);
                    running += total;
                    return { month: d.month, total, cumulative: running };
                  });
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <defs>
                    <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c8a951" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#c8a951" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="cumulative" name="Cumulative Spend" stroke="#c8a951" fill="url(#goldGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ---- Category Detail Cards ---- */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
            <Layers className="w-4.5 h-4.5 text-gold" />
            <div className="flex-1">
              <h3 className="text-sm font-bold">Category Breakdown</h3>
              <p className="text-[10px] text-muted-foreground">Detailed spend per packaging category</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0.5 p-4">
            {spendByCategory.length > 0 ? spendByCategory.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.category] || PackageOpen;
              const color = CATEGORY_COLORS[cat.category] || '#6b7280';
              const pctOfTotal = totalSpend > 0 ? (cat.spent / totalSpend * 100) : 0;
              return (
                <div key={cat.category} className="bg-muted/20 rounded-lg p-4 border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{cat.category}</p>
                      <p className="text-[10px] text-muted-foreground">{pctOfTotal.toFixed(1)}% of total</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold font-mono text-gold mb-2">{fmtAED(cat.spent)}</p>
                  <div className="w-full bg-muted/50 rounded-full h-1.5 mb-2">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pctOfTotal}%`, backgroundColor: color }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{cat.units.toLocaleString()} units</span>
                    <span>{cat.orderCount} orders</span>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-4 text-center py-10 text-sm text-muted-foreground">
                No category data available — confirm packaging POs to see breakdown
              </div>
            )}
          </div>
        </div>

        {/* ---- Supplier Spend Table ---- */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
            <Users className="w-4.5 h-4.5 text-gold" />
            <div className="flex-1">
              <h3 className="text-sm font-bold">Supplier Spend Breakdown</h3>
              <p className="text-[10px] text-muted-foreground">Packaging spend per supplier from confirmed POs</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/10 border-b border-border">
                  {[
                    { field: 'supplier' as SortField, label: 'Supplier', align: 'left' },
                    { field: 'total_spent' as SortField, label: 'Total Spent', align: 'right' },
                    { field: 'orders' as SortField, label: 'Orders', align: 'center' },
                    { field: 'units' as SortField, label: 'Units', align: 'center' },
                    { field: 'avg_unit_cost' as SortField, label: 'Avg Unit Cost', align: 'right' },
                  ].map(col => (
                    <th key={col.field}
                      onClick={() => toggleSort(col.field)}
                      className={cn(
                        'text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-5 py-3 cursor-pointer hover:text-foreground transition-colors select-none',
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      )}>
                      <span className="inline-flex items-center gap-1">
                        {col.label} <SortIcon field={col.field} />
                      </span>
                    </th>
                  ))}
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-5 py-3">Share</th>
                </tr>
              </thead>
              <tbody>
                {sortedSuppliers.length > 0 ? sortedSuppliers.map((s) => {
                  const share = totalSpend > 0 ? (s.total_spent / totalSpend * 100) : 0;
                  return (
                    <tr key={s.supplier} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium">{s.supplier}</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm font-mono font-bold text-gold">{fmtAED(s.total_spent)}</span>
                      </td>
                      <td className="px-5 py-3 text-center text-sm font-mono">{s.orders}</td>
                      <td className="px-5 py-3 text-center text-sm font-mono">{s.units.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-sm font-mono">{fmtAED(s.avg_unit_cost)}</td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 bg-muted/50 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-gold transition-all" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                      No supplier data available — confirm packaging POs to see breakdown
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Current Stock Value by Category ---- */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
            <PackageOpen className="w-4.5 h-4.5 text-gold" />
            <div className="flex-1">
              <h3 className="text-sm font-bold">Current Stock Value</h3>
              <p className="text-[10px] text-muted-foreground">On-hand inventory value by category (qty × unit cost)</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/10 border-b border-border">
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-5 py-3">Category</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">SKUs</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">On Hand</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Avg Unit Cost</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-5 py-3">Stock Value</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Low Stock</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const catMap: Record<string, { category: string; skuCount: number; onHand: number; totalValue: number; totalCost: number; lowStock: number }> = {};
                  skus.filter(s => s.active).forEach(s => {
                    const cat = normalizeCat(s.category);
                    if (!catMap[cat]) catMap[cat] = { category: cat, skuCount: 0, onHand: 0, totalValue: 0, totalCost: 0, lowStock: 0 };
                    catMap[cat].skuCount += 1;
                    catMap[cat].onHand += s.qty_on_hand;
                    catMap[cat].totalValue += s.qty_on_hand * s.unit_cost;
                    catMap[cat].totalCost += s.unit_cost;
                    if (s.qty_on_hand <= s.min_stock_level && s.min_stock_level > 0) catMap[cat].lowStock += 1;
                  });
                  const rows = Object.values(catMap).sort((a, b) => b.totalValue - a.totalValue);
                  if (rows.length === 0) {
                    return (
                      <tr><td colSpan={6} className="text-center py-10 text-sm text-muted-foreground">No packaging SKUs in inventory</td></tr>
                    );
                  }
                  return rows.map(r => (
                    <tr key={r.category} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {(() => { const Icon = CATEGORY_ICONS[r.category] || PackageOpen; const color = CATEGORY_COLORS[r.category] || '#6b7280'; return (
                            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                              <Icon className="w-3.5 h-3.5" style={{ color }} />
                            </div>
                          ); })()}
                          <span className="text-sm font-medium">{r.category}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-mono">{r.skuCount}</td>
                      <td className="px-3 py-3 text-center text-sm font-mono">{r.onHand.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">{fmtAED(r.skuCount > 0 ? r.totalCost / r.skuCount : 0)}</td>
                      <td className="px-5 py-3 text-right text-sm font-mono font-bold text-gold">{fmtAED(r.totalValue)}</td>
                      <td className="px-3 py-3 text-center">
                        {r.lowStock > 0 ? (
                          <StatusBadge variant="destructive">{r.lowStock} low</StatusBadge>
                        ) : (
                          <StatusBadge variant="success">OK</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
