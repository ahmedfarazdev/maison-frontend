// ============================================================
// Capsule Performance — Analytics & Sell-Through Tracking
// ============================================================

import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Gem, TrendingUp, Package, DollarSign, BarChart3, Loader2,
  ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  themed_set: 'Themed Set',
  house_chapter: 'House Chapter',
  layering_set: 'Layering Set',
};

const STATUS_COLORS: Record<string, string> = {
  live: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  scheduled: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  ended: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  sold_out: 'bg-red-500/10 text-red-600 border-red-500/20',
  draft: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

export default function CapsulePerformance() {
  const { data: statsData, isLoading: statsLoading } = useApiQuery<any>(api.capsules.stats);
  const { data: dropsData, isLoading: dropsLoading } = useApiQuery<any>(api.capsules.listDrops);

  const stats = statsData ?? { totalDrops: 0, liveDrops: 0, totalSold: 0, totalRevenue: 0, sellThrough: 0, remainingAllocation: 0 };
  const drops = (dropsData as any)?.data ?? [];
  const loading = statsLoading || dropsLoading;

  // Sort by sell-through rate descending
  const rankedDrops = [...drops]
    .map((d: any) => ({
      ...d,
      sellThrough: d.maxAllocation > 0 ? Math.round((d.sold / d.maxAllocation) * 100) : 0,
    }))
    .sort((a: any, b: any) => b.sellThrough - a.sellThrough);

  // Aggregate by type
  const typeStats = drops.reduce((acc: any, d: any) => {
    const t = d.type || 'themed_set';
    if (!acc[t]) acc[t] = { count: 0, sold: 0, revenue: 0, allocation: 0 };
    acc[t].count++;
    acc[t].sold += d.sold ?? 0;
    acc[t].revenue += d.revenue ?? 0;
    acc[t].allocation += d.maxAllocation ?? 0;
    return acc;
  }, {} as Record<string, { count: number; sold: number; revenue: number; allocation: number }>);

  return (
    <div>
      <PageHeader
        title="Capsule Performance"
        subtitle="Sell-through analytics, revenue tracking, and drop rankings"
      />

      <div className="p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <>
            {/* Top-Level KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Capsules', value: stats.totalDrops, icon: Gem, color: 'purple' },
                { label: 'Live Now', value: stats.liveDrops, icon: TrendingUp, color: 'emerald' },
                { label: 'Units Sold', value: stats.totalSold, icon: Package, color: 'blue' },
                { label: 'Avg Sell-Through', value: `${stats.sellThrough}%`, icon: BarChart3, color: 'gold' },
                { label: 'Total Revenue', value: `AED ${(stats.totalRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: 'amber' },
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
                <CardTitle className="text-base">Performance by Type</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(typeStats).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No capsule data yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(typeStats).map(([type, s]: [string, any]) => {
                      const sellThrough = s.allocation > 0 ? Math.round((s.sold / s.allocation) * 100) : 0;
                      return (
                        <div key={type} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{TYPE_LABELS[type] ?? type}</span>
                            <Badge variant="outline" className="text-[10px]">{s.count} drops</Badge>
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
                              <p className="text-lg font-bold">AED {s.revenue.toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">Revenue</p>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-purple-500 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(sellThrough, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Drop Rankings Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Drop Rankings — by Sell-Through</CardTitle>
              </CardHeader>
              <CardContent>
                {rankedDrops.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No capsules created yet. Create your first capsule drop to see performance data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-3 font-medium">#</th>
                          <th className="text-left py-2 px-3 font-medium">Capsule</th>
                          <th className="text-left py-2 px-3 font-medium">Type</th>
                          <th className="text-left py-2 px-3 font-medium">Status</th>
                          <th className="text-right py-2 px-3 font-medium">Sold</th>
                          <th className="text-right py-2 px-3 font-medium">Allocation</th>
                          <th className="text-right py-2 px-3 font-medium">Sell-Through</th>
                          <th className="text-right py-2 px-3 font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedDrops.map((drop: any, idx: number) => (
                          <tr key={drop.dropId} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2.5 px-3 font-mono text-muted-foreground">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-medium">{drop.name}</td>
                            <td className="py-2.5 px-3">{TYPE_LABELS[drop.type] ?? drop.type}</td>
                            <td className="py-2.5 px-3">
                              <Badge variant="outline" className={cn('text-[10px] uppercase', STATUS_COLORS[drop.status])}>
                                {drop.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{drop.sold ?? 0}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{drop.maxAllocation ?? 0}</td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {drop.sellThrough >= 75 ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
                                ) : drop.sellThrough >= 40 ? (
                                  <Minus className="w-3.5 h-3.5 text-amber-500" />
                                ) : (
                                  <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                                )}
                                <span className="font-mono font-medium">{drop.sellThrough}%</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">AED {(drop.revenue ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
