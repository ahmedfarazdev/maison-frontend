// ============================================================
// Gift Set Performance — Analytics & Sales Tracking
// Same structure as Capsule Performance but for gift sets
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Gift, TrendingUp, Package, DollarSign, BarChart3, Loader2,
  ArrowUp, ArrowDown, Minus, Heart, Users, ShoppingBag,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  for_him: 'For Him',
  for_her: 'For Her',
  seasonal: 'Seasonal',
  unisex: 'Unisex',
  corporate: 'Corporate',
};

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  for_him: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20' },
  for_her: { bg: 'bg-pink-500/10', text: 'text-pink-600', border: 'border-pink-500/20' },
  seasonal: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20' },
  unisex: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20' },
  corporate: { bg: 'bg-zinc-500/10', text: 'text-zinc-600', border: 'border-zinc-500/20' },
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  draft: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  discontinued: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  sold_out: 'bg-red-500/10 text-red-600 border-red-500/20',
  seasonal_ended: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

export default function GiftSetPerformance() {
  const { data: setsData, isLoading } = useApiQuery<any>(api.gifting.listSets);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const sets = (setsData as any)?.data ?? [];

  // Compute stats
  const stats = useMemo(() => {
    const totalSets = sets.length;
    const activeSets = sets.filter((s: any) => s.status === 'active').length;
    const totalSold = sets.reduce((sum: number, s: any) => sum + (s.sold ?? 0), 0);
    const totalRevenue = sets.reduce((sum: number, s: any) => sum + ((s.sold ?? 0) * (s.finalPrice ?? s.price ?? 0)), 0);
    const totalStock = sets.reduce((sum: number, s: any) => sum + (s.stock ?? 0), 0);
    const avgSellThrough = totalSets > 0
      ? Math.round(sets.reduce((sum: number, s: any) => {
          const total = (s.stock ?? 0) + (s.sold ?? 0);
          return sum + (total > 0 ? ((s.sold ?? 0) / total) * 100 : 0);
        }, 0) / totalSets)
      : 0;
    return { totalSets, activeSets, totalSold, totalRevenue, totalStock, avgSellThrough };
  }, [sets]);

  // Ranked by sell-through
  const rankedSets = useMemo(() => {
    let filtered = [...sets].map((s: any) => {
      const total = (s.stock ?? 0) + (s.sold ?? 0);
      return {
        ...s,
        sellThrough: total > 0 ? Math.round(((s.sold ?? 0) / total) * 100) : 0,
        totalAllocation: total,
        revenue: (s.sold ?? 0) * (s.finalPrice ?? s.price ?? 0),
      };
    });
    if (typeFilter !== 'all') filtered = filtered.filter(s => s.type === typeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => s.name?.toLowerCase().includes(q));
    }
    return filtered.sort((a: any, b: any) => b.sellThrough - a.sellThrough);
  }, [sets, typeFilter, searchQuery]);

  // Aggregate by type
  const typeStats = useMemo(() => {
    return sets.reduce((acc: any, s: any) => {
      const t = s.type || 'unisex';
      if (!acc[t]) acc[t] = { count: 0, sold: 0, revenue: 0, stock: 0 };
      acc[t].count++;
      acc[t].sold += s.sold ?? 0;
      acc[t].revenue += (s.sold ?? 0) * (s.finalPrice ?? s.price ?? 0);
      acc[t].stock += s.stock ?? 0;
      return acc;
    }, {} as Record<string, { count: number; sold: number; revenue: number; stock: number }>);
  }, [sets]);

  return (
    <div>
      <PageHeader
        title="Gift Set Performance"
        subtitle="Sales analytics, revenue tracking, and gift set rankings"
      />

      <div className="p-6 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Top-Level KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Gift Sets', value: stats.totalSets, icon: Gift, color: 'pink' },
                { label: 'Active Sets', value: stats.activeSets, icon: TrendingUp, color: 'emerald' },
                { label: 'Units Sold', value: stats.totalSold, icon: ShoppingBag, color: 'blue' },
                { label: 'In Stock', value: stats.totalStock, icon: Package, color: 'amber' },
                { label: 'Avg Sell-Through', value: `${stats.avgSellThrough}%`, icon: BarChart3, color: 'gold' },
                { label: 'Total Revenue', value: `AED ${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'emerald' },
              ].map((kpi) => (
                <Card key={kpi.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', `bg-${kpi.color}-500/10`)}>
                        <kpi.icon className={cn('w-5 h-5', `text-${kpi.color}-600`)} />
                      </div>
                      <div>
                        <p className="text-xl font-bold">{kpi.value}</p>
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Performance by Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(typeStats).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No gift set data yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {Object.entries(typeStats).map(([type, s]: [string, any]) => {
                      const total = s.stock + s.sold;
                      const sellThrough = total > 0 ? Math.round((s.sold / total) * 100) : 0;
                      const tc = TYPE_COLORS[type] ?? TYPE_COLORS.unisex;
                      return (
                        <div key={type} className={cn('border rounded-lg p-4 space-y-2', tc.border)}>
                          <div className="flex items-center justify-between">
                            <span className={cn('font-medium text-sm', tc.text)}>{TYPE_LABELS[type] ?? type}</span>
                            <Badge variant="outline" className="text-[10px]">{s.count} sets</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-lg font-bold">{s.sold}</p>
                              <p className="text-[10px] text-muted-foreground">Sold</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{sellThrough}%</p>
                              <p className="text-[10px] text-muted-foreground">Sell-Through</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-nowrap">AED {s.revenue.toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">Revenue</p>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={cn('h-2 rounded-full transition-all', tc.bg.replace('/10', ''))}
                              style={{ width: `${Math.min(sellThrough, 100)}%`, backgroundColor: type === 'for_him' ? '#3b82f6' : type === 'for_her' ? '#ec4899' : type === 'seasonal' ? '#f59e0b' : type === 'corporate' ? '#71717a' : '#a855f7' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gift Set Rankings Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Gift Set Rankings — by Sell-Through</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search sets..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-gold/30 w-48"
                    />
                  </div>
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-border rounded-md bg-background"
                  >
                    <option value="all">All Types</option>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {rankedSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No gift sets found. Create your first gift set to see performance data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-3 font-medium">#</th>
                          <th className="text-left py-2 px-3 font-medium">Gift Set</th>
                          <th className="text-left py-2 px-3 font-medium">Type</th>
                          <th className="text-left py-2 px-3 font-medium">Status</th>
                          <th className="text-center py-2 px-3 font-medium">Vials</th>
                          <th className="text-right py-2 px-3 font-medium">Price</th>
                          <th className="text-right py-2 px-3 font-medium">Sold</th>
                          <th className="text-right py-2 px-3 font-medium">Stock</th>
                          <th className="text-right py-2 px-3 font-medium">Sell-Through</th>
                          <th className="text-right py-2 px-3 font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedSets.map((set: any, idx: number) => {
                          const tc = TYPE_COLORS[set.type] ?? TYPE_COLORS.unisex;
                          return (
                            <tr key={set.setId} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="py-2.5 px-3 font-mono text-muted-foreground">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div>
                                  <span className="font-medium">{set.name}</span>
                                  {set.perfumes && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]">
                                      {set.perfumes.slice(0, 3).join(', ')}{set.perfumes.length > 3 ? ` +${set.perfumes.length - 3}` : ''}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className={cn('text-[10px]', tc.bg, tc.text, tc.border)}>
                                  {TYPE_LABELS[set.type] ?? set.type}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className={cn('text-[10px] uppercase', STATUS_COLORS[set.status] ?? STATUS_COLORS.active)}>
                                  {set.status?.replace('_', ' ')}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">{set.vialCount ?? '-'}</td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {set.discountPercent > 0 ? (
                                  <div>
                                    <span className="line-through text-muted-foreground text-[10px]">AED {set.price}</span>
                                    <br />
                                    <span>AED {set.finalPrice}</span>
                                  </div>
                                ) : (
                                  `AED ${set.price}`
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">{set.sold ?? 0}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{set.stock ?? 0}</td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {set.sellThrough >= 75 ? (
                                    <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : set.sellThrough >= 40 ? (
                                    <Minus className="w-3.5 h-3.5 text-amber-500" />
                                  ) : (
                                    <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                                  )}
                                  <span className="font-mono font-medium">{set.sellThrough}%</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">AED {set.revenue.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Perfume Popularity from Gift Sets */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most Featured Perfumes in Gift Sets</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const perfumeCounts: Record<string, number> = {};
                  sets.forEach((s: any) => {
                    (s.perfumes ?? []).forEach((p: string) => {
                      perfumeCounts[p] = (perfumeCounts[p] ?? 0) + 1;
                    });
                  });
                  const sorted = Object.entries(perfumeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
                  if (sorted.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No perfume data yet</p>;
                  const maxCount = sorted[0][1];
                  return (
                    <div className="space-y-2">
                      {sorted.map(([name, count], idx) => (
                        <div key={name} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-5 text-right font-mono">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium truncate">{name}</span>
                              <span className="text-xs text-muted-foreground">{count} set{count > 1 ? 's' : ''}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className="bg-pink-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${(count / maxCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
