// ============================================================
// Perfume Forecast — Standalone page under Subscription Management
// Projects perfume requirements based on subscription volume
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  TrendingUp, Beaker, Search, Loader2, Droplets,
  BarChart3, Package, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { SubscriptionCycle, Order } from '@/types';

export default function PerfumeForecast() {
  const [forecastMonths, setForecastMonths] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');

  // Fetch data
  const { data: cyclesRes, isLoading: loadingCycles } = useApiQuery<any>(api.subscriptions.cycles);
  const { data: ordersRes, isLoading: loadingOrders } = useApiQuery<any>(() => api.orders.list(), []);

  const cycles = ((cyclesRes as any)?.data ?? cyclesRes ?? []) as SubscriptionCycle[];
  const allOrders = ((ordersRes as any)?.data ?? ordersRes ?? []) as Order[];
  const subOrders = allOrders.filter(o => o.type === 'subscription');

  const activeCycle = cycles.find((c: any) =>
    ['collecting', 'locked', 'active', 'processing'].includes(c.status)
  ) ?? cycles[0];

  const loading = loadingCycles || loadingOrders;

  // Aggregate perfume needs from subscription orders + cycle forecast
  const forecast = useMemo(() => {
    const perfumeMap = new Map<string, { master_id: string; name: string; total_ml: number; order_count: number }>();

    // Use cycle forecast if available
    if (activeCycle?.forecast_summary?.perfumes_needed) {
      for (const p of activeCycle.forecast_summary.perfumes_needed) {
        perfumeMap.set(p.master_id, {
          master_id: p.master_id,
          name: p.name,
          total_ml: p.total_ml,
          order_count: 0,
        });
      }
    }

    // Also aggregate from actual orders
    for (const order of subOrders) {
      for (const item of order.items) {
        const existing = perfumeMap.get(item.master_id);
        if (existing) {
          existing.total_ml += item.size_ml * item.qty;
          existing.order_count += item.qty;
        } else {
          perfumeMap.set(item.master_id, {
            master_id: item.master_id,
            name: item.perfume_name,
            total_ml: item.size_ml * item.qty,
            order_count: item.qty,
          });
        }
      }
    }

    // Scale by forecast months and filter by search
    return Array.from(perfumeMap.values())
      .map(p => ({
        ...p,
        total_ml: Math.round(p.total_ml * forecastMonths),
        order_count: Math.round(p.order_count * forecastMonths),
      }))
      .filter(p => {
        if (!search) return true;
        return p.name.toLowerCase().includes(search.toLowerCase()) ||
               p.master_id.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => b.total_ml - a.total_ml);
  }, [activeCycle, subOrders, forecastMonths, search]);

  const totalMl = forecast.reduce((sum, p) => sum + p.total_ml, 0);
  const totalDecants = forecast.reduce((sum, p) => sum + p.order_count, 0);

  return (
    <div>
      <PageHeader
        title="Perfume Forecast"
        subtitle="Projected perfume requirements based on current subscription volume"
        breadcrumbs={[{ label: 'Subscription Management' }, { label: 'Perfume Forecast' }]}
      />

      <div className="p-6 space-y-6">
        {/* Time Horizon + KPIs */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            {([1, 2, 3] as const).map(m => (
              <button
                key={m}
                onClick={() => setForecastMonths(m)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded transition-colors',
                  forecastMonths === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m} {m === 1 ? 'Month' : 'Months'}
              </button>
            ))}
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search perfumes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Beaker className="w-5 h-5 text-blue-600" /></div>
                <div><p className="text-2xl font-bold">{forecast.length}</p><p className="text-xs text-muted-foreground">Unique Perfumes</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center"><Droplets className="w-5 h-5 text-gold" /></div>
                <div><p className="text-2xl font-bold font-mono">{totalMl}ml</p><p className="text-xs text-muted-foreground">Total ML Needed</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><Package className="w-5 h-5 text-purple-600" /></div>
                <div><p className="text-2xl font-bold">{totalDecants}</p><p className="text-xs text-muted-foreground">Total Decants</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                <div><p className="text-2xl font-bold text-gold">{forecastMonths}mo</p><p className="text-xs text-muted-foreground">Forecast Horizon</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

        {/* Forecast Table */}
        {!loading && (
          <SectionCard
            title="Perfume Requirements"
            subtitle={`${forecastMonths}-month projection based on ${subOrders.length} subscription orders`}
            className="overflow-hidden"
          >
            {forecast.length === 0 ? (
              <EmptyState
                icon={Beaker}
                title="No forecast data"
                description="Perfume requirements will appear here once subscription orders are collected."
              />
            ) : (
              <div className="overflow-x-auto -m-4">
                <table className="w-full ops-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Perfume</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Master ID</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">ML Needed</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Decants</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">% of Total</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.map(p => {
                      const pct = totalMl > 0 ? ((p.total_ml / totalMl) * 100).toFixed(1) : '0';
                      return (
                        <tr key={p.master_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{p.master_id}</td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-right text-gold">{p.total_ml}ml</td>
                          <td className="px-4 py-3 text-sm font-mono text-right">{p.order_count}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-gold rounded-full" style={{ width: `${Math.min(Number(pct), 100)}%` }} />
                              </div>
                              <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge variant="muted">Check inventory</StatusBadge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td className="px-4 py-3 text-sm font-semibold" colSpan={2}>Total ({forecastMonths}mo)</td>
                      <td className="px-4 py-3 text-sm font-mono font-bold text-right text-gold">{totalMl}ml</td>
                      <td className="px-4 py-3 text-sm font-mono font-bold text-right">{totalDecants}</td>
                      <td className="px-4 py-3" colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
