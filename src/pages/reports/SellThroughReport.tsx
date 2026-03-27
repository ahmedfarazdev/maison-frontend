// ============================================================
// Sell-Through Report — Capsule & Vault performance analytics
// ============================================================

import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Gem, Lock, TrendingUp, DollarSign, Package, BarChart3, Loader2,
  ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SellThroughReport() {
  const { data: capsuleStats, isLoading: capsuleLoading } = useApiQuery<any>(api.capsules.stats);
  const { data: vaultStats, isLoading: vaultLoading } = useApiQuery<any>(api.emVault.stats);
  const { data: capsuleDrops, isLoading: dropsLoading } = useApiQuery<any>(api.capsules.listDrops);
  const { data: vaultReleases, isLoading: releasesLoading } = useApiQuery<any>(api.emVault.listReleases);

  const loading = capsuleLoading || vaultLoading || dropsLoading || releasesLoading;
  const cs = capsuleStats ?? { totalDrops: 0, liveDrops: 0, totalSold: 0, totalRevenue: 0, sellThrough: 0 };
  const vs = vaultStats ?? { totalReleases: 0, liveReleases: 0, totalSold: 0, totalRevenue: 0, totalRequests: 0 };
  const drops = (capsuleDrops as any)?.data ?? [];
  const releases = (vaultReleases as any)?.data ?? [];

  const combinedRevenue = (cs.totalRevenue ?? 0) + (vs.totalRevenue ?? 0);
  const combinedSold = (cs.totalSold ?? 0) + (vs.totalSold ?? 0);

  return (
    <div>
      <PageHeader
        title="Sell-Through Report"
        subtitle="Capsule & Vault performance — sell-through rates, revenue, and allocation tracking"
      />

      <div className="p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <>
            {/* Combined KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">AED {combinedRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Combined Revenue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{combinedSold}</p>
                      <p className="text-xs text-muted-foreground">Total Units Sold</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Gem className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{cs.sellThrough}%</p>
                      <p className="text-xs text-muted-foreground">Capsule Sell-Through</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{vs.totalRequests}</p>
                      <p className="text-xs text-muted-foreground">Vault Access Requests</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Capsules Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gem className="w-4 h-4 text-purple-600" /> Capsule Drops
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div><p className="text-lg font-bold">{cs.totalDrops}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
                    <div><p className="text-lg font-bold">{cs.liveDrops}</p><p className="text-[10px] text-muted-foreground">Live</p></div>
                    <div><p className="text-lg font-bold">AED {(cs.totalRevenue ?? 0).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Revenue</p></div>
                  </div>
                  {drops.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No capsule drops yet</p>
                  ) : (
                    <div className="space-y-2">
                      {drops.slice(0, 8).map((d: any) => {
                        const st = d.maxAllocation > 0 ? Math.round((d.sold / d.maxAllocation) * 100) : 0;
                        return (
                          <div key={d.dropId} className="flex items-center gap-3 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium">{d.name}</p>
                            </div>
                            <div className="w-24 bg-muted rounded-full h-1.5">
                              <div className={cn('h-1.5 rounded-full', st >= 75 ? 'bg-emerald-500' : st >= 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(st, 100)}%` }} />
                            </div>
                            <span className="font-mono text-xs w-10 text-right">{st}%</span>
                            {st >= 75 ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : st >= 40 ? <Minus className="w-3 h-3 text-amber-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vault Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-600" /> Vault Releases
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div><p className="text-lg font-bold">{vs.totalReleases}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
                    <div><p className="text-lg font-bold">{vs.liveReleases}</p><p className="text-[10px] text-muted-foreground">Live</p></div>
                    <div><p className="text-lg font-bold">AED {(vs.totalRevenue ?? 0).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Revenue</p></div>
                  </div>
                  {releases.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No vault releases yet</p>
                  ) : (
                    <div className="space-y-2">
                      {releases.slice(0, 8).map((r: any) => {
                        const st = r.maxSkus > 0 ? Math.round(((r.totalSold ?? 0) / r.maxSkus) * 100) : 0;
                        return (
                          <div key={r.releaseId} className="flex items-center gap-3 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium">{r.month} — {r.theme || 'Untitled'}</p>
                            </div>
                            <div className="w-24 bg-muted rounded-full h-1.5">
                              <div className={cn('h-1.5 rounded-full', st >= 75 ? 'bg-emerald-500' : st >= 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(st, 100)}%` }} />
                            </div>
                            <span className="font-mono text-xs w-10 text-right">{st}%</span>
                            {st >= 75 ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : st >= 40 ? <Minus className="w-3 h-3 text-amber-500" /> : <ArrowDown className="w-3 h-3 text-red-500" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
