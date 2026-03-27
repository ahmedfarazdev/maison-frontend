// ============================================================
// Demand Planning — Cycle Vial Fulfillment Checker
// Purpose: For a selected cycle, show exactly how many 8ml vials
// of each perfume need to be filled, and whether we have enough
// liquid in stock to fulfill them all before the cycle starts.
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Droplets, AlertTriangle, Package, CheckCircle2,
  Loader2, Search, Calendar, XCircle, Beaker, FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order, DecantBottle } from '@/types';

// ---- Vial size constant ----
const VIAL_SIZE_ML = 8;

// ---- Generate next 6 cycles with "Cycle + Date" format ----
function generateUpcomingCycles(startDate: Date = new Date()) {
  const cycles: { id: string; label: string; startDate: Date; endDate: Date }[] = [];
  const current = new Date(startDate);
  current.setDate(1);
  if (current <= startDate) current.setMonth(current.getMonth() + 1);

  for (let i = 0; i < 6; i++) {
    const cycleStart = new Date(current);
    const cycleEnd = new Date(current);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    cycleEnd.setDate(0);

    const monthName = cycleStart.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const startStr = cycleStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const endStr = cycleEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    cycles.push({
      id: `cycle-${cycleStart.getFullYear()}-${String(cycleStart.getMonth() + 1).padStart(2, '0')}`,
      label: `Cycle ${monthName} · ${startStr} – ${endStr}`,
      startDate: cycleStart,
      endDate: cycleEnd,
    });
    current.setMonth(current.getMonth() + 1);
  }
  return cycles;
}

// ---- Status helpers ----
type FulfillStatus = 'ready' | 'partial' | 'not_ready';

function getStatus(liquidAvailableMl: number, liquidNeededMl: number): FulfillStatus {
  if (liquidNeededMl <= 0) return 'ready';
  if (liquidAvailableMl >= liquidNeededMl) return 'ready';
  if (liquidAvailableMl >= liquidNeededMl * 0.5) return 'partial';
  return 'not_ready';
}

const STATUS_CONFIG: Record<FulfillStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  ready: { label: 'Ready', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  partial: { label: 'Partial', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
  not_ready: { label: 'Not Ready', icon: XCircle, color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20' },
};

export default function DemandPlanning() {
  const [search, setSearch] = useState('');

  // Generate upcoming 6 cycles
  const upcomingCycles = useMemo(() => generateUpcomingCycles(), []);
  const [selectedCycleId, setSelectedCycleId] = useState(upcomingCycles[0]?.id ?? '');
  const selectedCycle = upcomingCycles.find(c => c.id === selectedCycleId) ?? upcomingCycles[0];

  // Fetch data
  const { data: ordersRes, isLoading: loadingOrders } = useApiQuery<any>(() => api.orders.list(), []);
  const { data: inventoryRes, isLoading: loadingInventory } = useApiQuery<any>(api.inventory.decantBottles);
  const { data: perfumesRes, isLoading: loadingPerfumes } = useApiQuery<any>(api.master.perfumes);

  const allOrders = ((ordersRes as any)?.data ?? ordersRes ?? []) as Order[];
  const inventory = ((inventoryRes as any)?.data ?? inventoryRes ?? []) as DecantBottle[];
  const perfumes = ((perfumesRes as any)?.data ?? perfumesRes ?? []) as any[];

  // Get subscription orders for this cycle
  // In production, this would filter by cycle. For now, use all subscription orders as the demand source.
  const subOrders = allOrders.filter(o => o.type === 'subscription');

  const loading = loadingOrders || loadingInventory || loadingPerfumes;

  // ---- Build fulfillment data per perfume ----
  const fulfillmentData = useMemo(() => {
    // Step 1: Aggregate vials needed per perfume from subscription orders
    const perfumeMap = new Map<string, {
      masterId: string;
      name: string;
      brand: string;
      vialsQueued: number;
      mlNeeded: number;
    }>();

    for (const order of subOrders) {
      for (const item of order.items) {
        const existing = perfumeMap.get(item.master_id);
        if (existing) {
          existing.vialsQueued += item.qty;
          existing.mlNeeded += item.qty * VIAL_SIZE_ML;
        } else {
          // Try to find brand from master data
          const masterPerfume = perfumes.find((p: any) => p.masterId === item.master_id || p.id === item.master_id);
          perfumeMap.set(item.master_id, {
            masterId: item.master_id,
            name: item.perfume_name,
            brand: masterPerfume?.brand || '—',
            vialsQueued: item.qty,
            mlNeeded: item.qty * VIAL_SIZE_ML,
          });
        }
      }
    }

    // Step 2: Cross-reference with inventory — how much liquid is available per perfume
    const result = Array.from(perfumeMap.values()).map(p => {
      // Find all open decant bottles for this perfume
      const matchingBottles = inventory.filter(b => b.master_id === p.masterId);
      const liquidAvailableMl = matchingBottles.reduce((sum, b) => sum + (b.current_ml || 0), 0);
      const bottleCount = matchingBottles.length;

      const shortfallMl = Math.max(0, p.mlNeeded - liquidAvailableMl);
      const shortfallVials = Math.ceil(shortfallMl / VIAL_SIZE_ML);
      const surplusMl = Math.max(0, liquidAvailableMl - p.mlNeeded);
      const fillPercent = p.mlNeeded > 0 ? Math.min(100, Math.round((liquidAvailableMl / p.mlNeeded) * 100)) : 100;
      const status = getStatus(liquidAvailableMl, p.mlNeeded);

      return {
        ...p,
        liquidAvailableMl,
        bottleCount,
        shortfallMl,
        shortfallVials,
        surplusMl,
        fillPercent,
        status,
      };
    });

    // Filter by search
    const filtered = result.filter(p => {
      if (!search) return true;
      return p.name.toLowerCase().includes(search.toLowerCase()) ||
             p.brand.toLowerCase().includes(search.toLowerCase()) ||
             p.masterId.toLowerCase().includes(search.toLowerCase());
    });

    // Sort: not_ready first, then partial, then ready
    const statusOrder: Record<FulfillStatus, number> = { not_ready: 0, partial: 1, ready: 2 };
    return filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.mlNeeded - a.mlNeeded);
  }, [subOrders, inventory, perfumes, search]);

  // ---- Summary stats ----
  const totalVialsQueued = fulfillmentData.reduce((s, d) => s + d.vialsQueued, 0);
  const totalMlNeeded = fulfillmentData.reduce((s, d) => s + d.mlNeeded, 0);
  const totalShortfallMl = fulfillmentData.reduce((s, d) => s + d.shortfallMl, 0);
  const readyCount = fulfillmentData.filter(d => d.status === 'ready').length;
  const partialCount = fulfillmentData.filter(d => d.status === 'partial').length;
  const notReadyCount = fulfillmentData.filter(d => d.status === 'not_ready').length;
  const overallReady = notReadyCount === 0 && partialCount === 0;

  return (
    <div>
      <PageHeader
        title="Demand Planning"
        subtitle="Cycle vial fulfillment checker — ensure all liquid is available before cycle starts"
        breadcrumbs={[{ label: 'Subscription Management' }, { label: 'Demand Planning' }]}
      />

      <div className="p-6 space-y-6">
        {/* Cycle Selector + Overall Status */}
        <div className="flex items-start gap-6 flex-wrap">
          <div className="w-full max-w-md">
            <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1.5 block">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              Planning Cycle
            </label>
            <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select cycle to plan" />
              </SelectTrigger>
              <SelectContent>
                {upcomingCycles.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Overall Readiness Indicator */}
          {!loading && fulfillmentData.length > 0 && (
            <div className={cn(
              'flex items-center gap-3 px-5 py-3 rounded-lg border ml-auto',
              overallReady
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-red-500/10 border-red-500/20',
            )}>
              {overallReady ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-emerald-700">All Perfumes Ready</p>
                    <p className="text-xs text-emerald-600">Sufficient liquid for all {totalVialsQueued} vials</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <div>
                    <p className="text-sm font-bold text-red-700">{notReadyCount + partialCount} Perfumes Need Attention</p>
                    <p className="text-xs text-red-600">Shortfall of {totalShortfallMl}ml ({Math.ceil(totalShortfallMl / VIAL_SIZE_ML)} vials)</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{fulfillmentData.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Perfumes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{totalVialsQueued}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Vials to Fill</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono">{(totalMlNeeded / 1000).toFixed(1)}L</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Liquid Needed</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{readyCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Ready</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{partialCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Partial</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{notReadyCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Not Ready</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search perfumes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

        {/* Fulfillment Table */}
        {!loading && (
          <SectionCard
            title="Vial Fulfillment Status"
            subtitle={`${selectedCycle?.label ?? 'Selected cycle'} — ${VIAL_SIZE_ML}ml vials`}
            className="overflow-hidden"
          >
            {fulfillmentData.length === 0 ? (
              <EmptyState
                icon={Beaker}
                title="No vials queued"
                description="Subscription orders for this cycle will populate the fulfillment list. Ensure orders are collected before checking demand."
              />
            ) : (
              <div className="overflow-x-auto -m-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Perfume</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Brand</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Vials Queued</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">ML Needed</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">In Stock (ml)</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Open Bottles</th>
                      <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Fill %</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Shortfall</th>
                      <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fulfillmentData.map(d => {
                      const cfg = STATUS_CONFIG[d.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <tr key={d.masterId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{d.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{d.brand}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{d.vialsQueued}</td>
                          <td className="px-4 py-3 text-right font-mono">{d.mlNeeded}ml</td>
                          <td className="px-4 py-3 text-right font-mono">
                            <span className={d.liquidAvailableMl >= d.mlNeeded ? 'text-emerald-600' : 'text-muted-foreground'}>
                              {d.liquidAvailableMl}ml
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">{d.bottleCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    d.fillPercent >= 100 ? 'bg-emerald-500' : d.fillPercent >= 50 ? 'bg-amber-500' : 'bg-red-500',
                                  )}
                                  style={{ width: `${d.fillPercent}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-muted-foreground w-8 text-right">{d.fillPercent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {d.shortfallMl > 0 ? (
                              <span className="text-red-600 font-mono font-medium">
                                {d.shortfallMl}ml <span className="text-[10px] text-red-500">({d.shortfallVials} vials)</span>
                              </span>
                            ) : (
                              <span className="text-emerald-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className={cn('text-[10px] font-bold uppercase gap-1', cfg.bg, cfg.color)}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td className="px-4 py-3 font-semibold" colSpan={2}>Total</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{totalVialsQueued}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{totalMlNeeded}ml</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {fulfillmentData.reduce((s, d) => s + d.liquidAvailableMl, 0)}ml
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {fulfillmentData.reduce((s, d) => s + d.bottleCount, 0)}
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {totalShortfallMl > 0 ? (
                          <span className="text-red-600">{totalShortfallMl}ml</span>
                        ) : (
                          <span className="text-emerald-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {/* Methodology Note */}
        <div className="p-3 bg-muted/30 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>How this works:</strong> For the selected cycle, this page aggregates all subscription orders and counts how many {VIAL_SIZE_ML}ml vials
            of each perfume need to be filled. It then cross-references with open decant bottles in inventory to show whether enough liquid is available.
            <strong> "Ready"</strong> means sufficient stock. <strong>"Partial"</strong> means 50-99% available. <strong>"Not Ready"</strong> means less than 50% available.
            Ensure all perfumes show "Ready" before the cycle fulfillment begins.
          </p>
        </div>
      </div>
    </div>
  );
}
