// ============================================================
// SupplierSpendChart — Supplier spend analytics using real PO data
// Shows total spend per supplier over time from confirmed POs
// ============================================================

import { useState, useMemo } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  BarChart3, TrendingUp, DollarSign, Package,
  Calendar, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

const CHART_COLORS = ['#c8a951', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

interface SupplierSpendChartProps {
  className?: string;
}

export function SupplierSpendChart({ className }: SupplierSpendChartProps) {
  const [view, setView] = useState<'bar' | 'trend'>('bar');

  // Fetch all POs with items
  const { data: posData } = useApiQuery(() => api.purchaseOrders.list());
  const { data: statsData } = useApiQuery(() => api.purchaseOrders.stats());

  const allPOs = useMemo(() => {
    const raw = (posData as any)?.data || [];
    return raw;
  }, [posData]);

  const stats = statsData as any;

  // Spend by supplier (from stats endpoint)
  const spendBySupplier = useMemo(() => {
    return (stats?.supplierSpend || []).map((s: any, idx: number) => ({
      name: s.name || 'Unknown',
      spent: s.amount || 0,
      orders: s.count || 0,
      fill: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [stats]);

  // Monthly spend trend from confirmed POs
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { month: string; spent: number; orders: number }> = {};
    allPOs.filter((po: any) => po.status === 'confirmed' && po.totalAmount).forEach((po: any) => {
      const d = new Date(po.confirmedAt || po.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!map[key]) map[key] = { month: label, spent: 0, orders: 0 };
      map[key].spent += Number(po.totalAmount || 0);
      map[key].orders += 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [allPOs]);

  // Spend per supplier over time (for stacked area)
  const supplierMonthlySpend = useMemo(() => {
    const supplierNames = new Set<string>();
    const monthMap: Record<string, Record<string, any>> = {};

    allPOs.filter((po: any) => po.status === 'confirmed' && po.totalAmount).forEach((po: any) => {
      const d = new Date(po.confirmedAt || po.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const name = po.supplierName || 'Unknown';
      supplierNames.add(name);
      if (!monthMap[key]) monthMap[key] = { month: label };
      monthMap[key][name] = (monthMap[key][name] || 0) + Number(po.totalAmount || 0);
    });

    const data = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    return { data, suppliers: Array.from(supplierNames) };
  }, [allPOs]);

  const totalSpend = stats?.totalSpend || 0;
  const totalConfirmed = (stats?.byStatus?.confirmed || 0);

  return (
    <div className={cn('space-y-6', className)}>
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-gold">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Spend</p>
          </div>
          <p className="text-xl font-mono font-bold">AED {totalSpend.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-blue-500">
          <div className="flex items-center gap-1.5 mb-1">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Confirmed POs</p>
          </div>
          <p className="text-xl font-mono font-bold">{totalConfirmed}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-emerald-500">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Suppliers</p>
          </div>
          <p className="text-xl font-mono font-bold">{spendBySupplier.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-purple-500">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avg PO Value</p>
          </div>
          <p className="text-xl font-mono font-bold">
            AED {totalConfirmed > 0 ? Math.round(totalSpend / totalConfirmed).toLocaleString() : '0'}
          </p>
        </div>
      </div>

      {/* Chart Toggle */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          <button onClick={() => setView('bar')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              view === 'bar' ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
            By Supplier
          </button>
          <button onClick={() => setView('trend')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              view === 'trend' ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
            Monthly Trend
          </button>
        </div>
        <div className="flex-1" />
        <Link href="/master/supplier-analytics">
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            Full Analytics <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      {/* Charts */}
      {view === 'bar' ? (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-bold">Spend by Supplier</h3>
          </div>
          {spendBySupplier.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={spendBySupplier} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [`AED ${value.toLocaleString()}`, 'Spent']}
                />
                <Bar dataKey="spent" fill="#c8a951" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No confirmed PO spend data yet</p>
              <p className="text-xs mt-1">Confirm purchase orders to see spend analytics</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-bold">Monthly Spend Trend</h3>
          </div>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c8a951" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c8a951" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [`AED ${value.toLocaleString()}`, 'Spent']}
                />
                <Area type="monotone" dataKey="spent" stroke="#c8a951" fill="url(#spendGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
              <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No monthly trend data yet</p>
              <p className="text-xs mt-1">Confirmed POs will appear in the monthly trend</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
