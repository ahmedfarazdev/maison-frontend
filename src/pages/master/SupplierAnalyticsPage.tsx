// ============================================================
// Supplier Analytics — Spend, Reliability, Trends
// Design: "Maison Ops" — Luxury Operations
// Now powered by DB-backed API data (not mock inventory-store)
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Package,
  ShieldCheck, ShieldAlert, Clock, CheckCircle2, XCircle,
  ArrowLeft, Users, AlertTriangle, Calendar, Truck,
  PieChart as PieChartIcon, Activity, PackageOpen, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from 'recharts';

const CHART_COLORS = ['#c8a951', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

// Helper to normalize PO data from API
function normalizePO(po: any) {
  const items = (po.items || []).map((i: any) => ({
    id: i.id,
    master_id: i.masterId || i.master_id || '',
    perfume_name: i.perfumeName || i.perfume_name || 'Unknown',
    qty: i.qty || i.quantity || 0,
    size_ml: i.sizeMl || i.size_ml || 0,
    bottle_type: i.bottleType || i.bottle_type || 'sealed',
    unit_price: Number(i.unitPrice ?? i.unit_price ?? 0),
    received_qty: i.receivedQty || i.received_qty || 0,
  }));
  return {
    po_id: po.poId || po.po_number || `PO-${po.id}`,
    supplier_id: String(po.supplierId || po.supplier_id || ''),
    supplier_name: po.supplierName || po.supplier_name || 'Unknown',
    status: po.status || 'draft',
    total_amount: Number(po.totalAmount ?? po.total_amount ?? 0),
    created_at: po.createdAt || po.created_at || '',
    confirmed_at: po.confirmedAt || po.confirmed_at || '',
    delivered_at: po.deliveredAt || po.delivered_at || '',
    payment_status: po.paymentStatus || po.payment_status || 'unpaid',
    amount_paid: Number(po.amountPaid ?? po.amount_paid ?? 0),
    items,
  };
}

function normalizeSupplier(s: any) {
  return {
    supplier_id: s.supplierId || s.supplier_id || '',
    name: s.name || '',
    type: s.type || 'wholesaler',
    supplier_type: s.supplierType || s.supplier_type || 'perfume',
    country: s.country || '',
    risk_flag: s.riskFlag ?? s.risk_flag ?? false,
    active: s.active !== false,
  };
}

export default function SupplierAnalyticsPage() {
  // Load from DB API
  const { data: suppliersRes } = useApiQuery(() => api.master.suppliers(), []);
  const { data: posRes } = useApiQuery(() => api.purchaseOrders.list(), []);
  const { data: pkgPosRaw } = useApiQuery<any[]>(() => api.mutations.packagingPOs.list(), []);

  const suppliers = useMemo(() => ((suppliersRes as any)?.data || []).map(normalizeSupplier), [suppliersRes]);
  const perfumePOs = useMemo(() => ((posRes as any)?.data || []).map(normalizePO), [posRes]);

  // Normalize packaging POs
  const packagingPOs = useMemo(() => {
    if (!pkgPosRaw || !Array.isArray(pkgPosRaw)) return [];
    return pkgPosRaw.map(normalizePO);
  }, [pkgPosRaw]);

  // View mode: perfume | packaging | all
  const [viewMode, setViewMode] = useState<'all' | 'perfume' | 'packaging'>('all');

  // Combine POs based on view mode
  const purchaseOrders = useMemo(() => {
    if (viewMode === 'perfume') return perfumePOs;
    if (viewMode === 'packaging') return packagingPOs;
    return [...perfumePOs, ...packagingPOs];
  }, [perfumePOs, packagingPOs, viewMode]);

  const [timeRange, setTimeRange] = useState<'all' | '6m' | '3m' | '1m'>('all');

  // Filter POs by time range
  const filteredPOs = useMemo(() => {
    if (timeRange === 'all') return purchaseOrders;
    const now = new Date();
    const months = timeRange === '6m' ? 6 : timeRange === '3m' ? 3 : 1;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return purchaseOrders.filter((po: any) => new Date(po.created_at) >= cutoff);
  }, [purchaseOrders, timeRange]);

  // ---- KPIs ----
  // "confirmed" = received/completed POs in our pipeline
  const confirmedPOs = filteredPOs.filter((po: any) => po.status === 'confirmed');
  const totalSpent = confirmedPOs.reduce((s: number, po: any) => s + po.total_amount, 0);
  const totalItems = confirmedPOs.reduce((s: number, po: any) => s + po.items.reduce((a: number, i: any) => a + i.qty, 0), 0);
  const totalPOs = filteredPOs.length;
  const receivedCount = confirmedPOs.length;
  const cancelledPOs = filteredPOs.filter((po: any) => po.status === 'cancelled').length;
  const pendingPOs = filteredPOs.filter((po: any) => !['confirmed', 'cancelled', 'draft'].includes(po.status)).length;
  const avgOrderValue = receivedCount > 0 ? totalSpent / receivedCount : 0;
  const fulfillmentRate = (receivedCount + cancelledPOs) > 0 ? ((receivedCount / (receivedCount + cancelledPOs)) * 100) : 100;

  // ---- Amount Paid stats ----
  const totalPaid = filteredPOs.reduce((s: number, po: any) => s + po.amount_paid, 0);
  const paidPOs = filteredPOs.filter((po: any) => po.payment_status === 'paid').length;

  // ---- Spend by Supplier (Bar Chart) ----
  const spendBySupplier = useMemo(() => {
    const map: Record<string, { name: string; spent: number; paid: number; items: number; orders: number }> = {};
    confirmedPOs.forEach((po: any) => {
      if (!map[po.supplier_id]) {
        map[po.supplier_id] = { name: po.supplier_name, spent: 0, paid: 0, items: 0, orders: 0 };
      }
      map[po.supplier_id].spent += po.total_amount;
      map[po.supplier_id].paid += po.amount_paid;
      map[po.supplier_id].items += po.items.reduce((a: number, i: any) => a + i.qty, 0);
      map[po.supplier_id].orders += 1;
    });
    return Object.values(map).sort((a, b) => b.spent - a.spent);
  }, [confirmedPOs]);

  // ---- Top Perfumes by Spend ----
  const topPerfumes = useMemo(() => {
    const map: Record<string, { name: string; spent: number; qty: number }> = {};
    confirmedPOs.forEach((po: any) => {
      po.items.forEach((item: any) => {
        const key = item.master_id || item.perfume_name;
        if (!map[key]) {
          map[key] = { name: item.perfume_name, spent: 0, qty: 0 };
        }
        map[key].spent += item.qty * item.unit_price;
        map[key].qty += item.qty;
      });
    });
    return Object.values(map).sort((a, b) => b.spent - a.spent).slice(0, 8);
  }, [confirmedPOs]);

  // ---- Supplier Type Distribution (Pie) ----
  const typeDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    suppliers.forEach((s: any) => {
      const label = s.type === 'private_collector' ? 'Private Collector' : s.type === 'direct' ? 'Brand Direct' : s.type.charAt(0).toUpperCase() + s.type.slice(1);
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [suppliers]);

  // ---- Monthly Spend Trend (Area Chart) ----
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { month: string; spent: number; paid: number; orders: number }> = {};
    confirmedPOs.forEach((po: any) => {
      const dateStr = po.confirmed_at || po.created_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!map[key]) map[key] = { month: label, spent: 0, paid: 0, orders: 0 };
      map[key].spent += po.total_amount;
      map[key].paid += po.amount_paid;
      map[key].orders += 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [confirmedPOs]);

  // ---- Supplier Reliability Scores ----
  const reliabilityScores = useMemo(() => {
    return suppliers.map((s: any) => {
      const supplierPOs = filteredPOs.filter((po: any) => po.supplier_id === s.supplier_id);
      const received = supplierPOs.filter((po: any) => po.status === 'confirmed').length;
      const cancelled = supplierPOs.filter((po: any) => po.status === 'cancelled').length;
      const total = received + cancelled;
      const score = total > 0 ? Math.round((received / total) * 100) : 100;
      const avgDeliveryDays = received > 0 ? Math.round(
        supplierPOs.filter((po: any) => po.status === 'confirmed' && po.confirmed_at && po.created_at)
          .reduce((sum: number, po: any) => {
            const created = new Date(po.created_at).getTime();
            const recv = new Date(po.confirmed_at).getTime();
            return sum + Math.max(0, (recv - created) / (1000 * 60 * 60 * 24));
          }, 0) / received
      ) : 0;
      return {
        supplier_id: s.supplier_id,
        name: s.name,
        type: s.type,
        score,
        totalPOs: supplierPOs.length,
        received,
        cancelled,
        pending: supplierPOs.filter((po: any) => !['confirmed', 'cancelled', 'draft'].includes(po.status)).length,
        avgDeliveryDays,
        totalSpent: supplierPOs.filter((po: any) => po.status === 'confirmed').reduce((a: number, po: any) => a + po.total_amount, 0),
        totalPaid: supplierPOs.reduce((a: number, po: any) => a + po.amount_paid, 0),
        risk_flag: s.risk_flag,
      };
    }).filter((s: any) => s.totalPOs > 0).sort((a: any, b: any) => b.score - a.score || b.totalSpent - a.totalSpent);
  }, [suppliers, filteredPOs]);

  // ---- Bottle Type Distribution from POs ----
  const bottleTypeDist = useMemo(() => {
    const map: Record<string, number> = { Sealed: 0, Open: 0, Tester: 0 };
    confirmedPOs.forEach((po: any) => {
      po.items.forEach((item: any) => {
        const type = item.bottle_type || 'sealed';
        const label = type.charAt(0).toUpperCase() + type.slice(1);
        map[label] = (map[label] || 0) + item.qty;
      });
    });
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [confirmedPOs]);

  return (
    <div>
      <PageHeader
        title="Supplier Analytics"
        subtitle={`${suppliers.length} suppliers · ${totalPOs} purchase orders · AED ${totalSpent.toLocaleString()} total spend`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Suppliers' }, { label: 'Analytics' }]}
        actions={
          <div className="flex items-center gap-3">
            {/* Procurement Type Toggle */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              {([['all', 'All', Layers], ['perfume', 'Perfume', Package], ['packaging', 'Packaging', PackageOpen]] as const).map(([val, label, Icon]) => (
                <button key={val} onClick={() => setViewMode(val as any)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    viewMode === val ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
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
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Total Spend', value: `AED ${totalSpent.toLocaleString()}`, icon: DollarSign, color: 'border-l-gold' },
            { label: 'Total Paid', value: `AED ${totalPaid.toLocaleString()}`, icon: CheckCircle2, color: 'border-l-emerald-500' },
            { label: 'Total Items', value: totalItems.toLocaleString(), icon: viewMode === 'packaging' ? PackageOpen : Package, color: 'border-l-blue-500' },           { label: 'Total POs', value: totalPOs.toString(), icon: Truck, color: 'border-l-violet-500' },
            { label: 'Confirmed', value: receivedCount.toString(), icon: CheckCircle2, color: 'border-l-emerald-500' },
            { label: 'In Progress', value: pendingPOs.toString(), icon: Clock, color: 'border-l-amber-500' },
            { label: 'Avg Order Value', value: `AED ${Math.round(avgOrderValue).toLocaleString()}`, icon: TrendingUp, color: 'border-l-cyan-500' },
            { label: 'Fulfillment Rate', value: `${fulfillmentRate.toFixed(1)}%`, icon: ShieldCheck, color: 'border-l-emerald-500' },
          ].map(kpi => (
            <div key={kpi.label} className={cn('bg-card border border-border rounded-xl p-3 border-l-[3px]', kpi.color)}>
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className="w-3 h-3 text-muted-foreground" />
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{kpi.label}</p>
              </div>
              <p className="text-lg font-mono font-bold">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Row 1: Spend by Supplier + Monthly Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spend by Supplier */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-gold" />
              <h3 className="text-sm font-bold">Spend by Supplier</h3>
            </div>
            {spendBySupplier.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={spendBySupplier} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number, name: string) => [`AED ${value.toLocaleString()}`, name === 'spent' ? 'Total Spent' : 'Amount Paid']}
                  />
                  <Bar dataKey="spent" fill="#c8a951" radius={[0, 4, 4, 0]} name="spent" />
                  <Bar dataKey="paid" fill="#10b981" radius={[0, 4, 4, 0]} name="paid" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p>No confirmed purchase orders yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Confirm POs to see spend analytics</p>
                </div>
              </div>
            )}
          </div>

          {/* Monthly Spend Trend */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-gold" />
              <h3 className="text-sm font-bold">Monthly Spend Trend</h3>
            </div>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c8a951" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#c8a951" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number, name: string) => [`AED ${value.toLocaleString()}`, name === 'spent' ? 'Total Spent' : 'Amount Paid']}
                  />
                  <Area type="monotone" dataKey="spent" stroke="#c8a951" fill="url(#spendGrad)" strokeWidth={2} name="spent" />
                  <Area type="monotone" dataKey="paid" stroke="#10b981" fill="url(#paidGrad)" strokeWidth={2} name="paid" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p>No spend data yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Confirm POs to see monthly trends</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charts Row 2: Top Perfumes + Type Distribution + Bottle Types */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Perfumes */}
          <div className="bg-card border border-border rounded-xl p-5 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-gold" />
              <h3 className="text-sm font-bold">{viewMode === 'packaging' ? 'Top SKUs by Spend' : 'Top Perfumes by Spend'}</h3>
            </div>
            <div className="space-y-2.5">
              {topPerfumes.map((p, idx) => {
                const maxSpent = topPerfumes[0]?.spent || 1;
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate max-w-[60%]">{p.name}</span>
                      <span className="text-xs font-mono font-bold text-gold">AED {p.spent.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gold/70 rounded-full transition-all" style={{ width: `${(p.spent / maxSpent) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.qty} {viewMode === 'packaging' ? 'units' : 'bottles'}</p>
                  </div>
                );
              })}
              {topPerfumes.length === 0 && (
                <div className="text-center py-8">
                  <Package className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Supplier Type Distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-gold" />
              <h3 className="text-sm font-bold">Supplier Types</h3>
            </div>
            {typeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={typeDistribution} cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {typeDistribution.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data</div>
            )}
          </div>

          {/* Bottle Type Distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-gold" />
              <h3 className="text-sm font-bold">Bottle Types Purchased</h3>
            </div>
            {bottleTypeDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={bottleTypeDist} cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {bottleTypeDist.map((_, idx) => <Cell key={idx} fill={['#c8a951', '#3b82f6', '#10b981'][idx % 3]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                <div className="text-center">
                  <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p>No data yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Supplier Reliability Scorecard */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
            <ShieldCheck className="w-4.5 h-4.5 text-gold" />
            <div className="flex-1">
              <h3 className="text-sm font-bold">Supplier Reliability Scorecard</h3>
              <p className="text-[10px] text-muted-foreground">Based on PO fulfillment rate and delivery performance</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/10 border-b border-border">
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-5 py-3">Supplier</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Score</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Total POs</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Confirmed</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">In Progress</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Avg Delivery</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Total Spent</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-5 py-3">Total Paid</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {reliabilityScores.map((s: any) => (
                  <tr key={s.supplier_id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {s.risk_flag && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{s.type.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
                        s.score >= 90 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' :
                        s.score >= 70 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' :
                        'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                      )}>
                        {s.score >= 90 ? <ShieldCheck className="w-3 h-3" /> : s.score >= 70 ? <ShieldAlert className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {s.score}%
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-sm font-mono">{s.totalPOs}</td>
                    <td className="px-3 py-3 text-center text-sm font-mono text-emerald-600">{s.received}</td>
                    <td className="px-3 py-3 text-center text-sm font-mono text-amber-500">{s.pending}</td>
                    <td className="px-3 py-3 text-center text-sm font-mono">{s.avgDeliveryDays > 0 ? `${s.avgDeliveryDays}d` : '—'}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono font-bold text-gold">AED {s.totalSpent.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-sm font-mono text-emerald-600">AED {s.totalPaid.toLocaleString()}</td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge variant={s.score >= 90 ? 'success' : s.score >= 70 ? 'warning' : 'destructive'}>
                        {s.score >= 90 ? 'Reliable' : s.score >= 70 ? 'Moderate' : 'At Risk'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
                {reliabilityScores.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-sm text-muted-foreground">
                      No supplier data available — create and confirm purchase orders to see analytics
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
