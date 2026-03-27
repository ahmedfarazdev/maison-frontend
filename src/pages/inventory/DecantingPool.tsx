// ============================================================
// Inventory — Decanting Pool (opened bottles)
// Per-bottle gauges, per-perfume aggregation, inline deductions,
// and automatic low-stock threshold alerts.
// ============================================================

import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Droplets, Search, MapPin, AlertTriangle, Minus, History,
  FlaskConical, ChevronDown, ChevronUp, Loader2,
  TrendingDown, Beaker, Layers, List, Settings2,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { DecantBottle, Perfume } from '@/types';

// ---- Low-stock threshold (persisted in localStorage) ----
const LS_THRESHOLD_KEY = 'decanting_pool_low_stock_pct';
function getThreshold(): number {
  try {
    const v = localStorage.getItem(LS_THRESHOLD_KEY);
    return v ? parseInt(v, 10) : 20;
  } catch { return 20; }
}
function setThresholdStorage(pct: number) {
  try { localStorage.setItem(LS_THRESHOLD_KEY, String(pct)); } catch {}
}

// ---- Per-perfume aggregation type ----
interface PerfumeAgg {
  master_id: string;
  perfume: Perfume | undefined;
  bottles: DecantBottle[];
  totalCurrent: number;
  totalCapacity: number;
  pct: number;
  isLow: boolean;
}

export default function DecantingPool() {
  const { data: bottlesRes, refetch: refetchBottles } = useApiQuery(() => api.inventory.decantBottles(), []);
  const { data: perfumesRes } = useApiQuery(() => api.master.perfumes(), []);
  const { data: ledgerRes, refetch: refetchLedger } = useApiQuery(() => api.ledger.decant(), []);
  const bottles = (bottlesRes?.data || []) as DecantBottle[];
  const perfumes = (perfumesRes?.data || []) as Perfume[];
  const ledgerEvents = ((ledgerRes as any)?.data || []) as any[];

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deductBottle, setDeductBottle] = useState<DecantBottle | null>(null);
  const [viewMode, setViewMode] = useState<'bottles' | 'perfumes'>('perfumes');
  const [threshold, setThreshold] = useState(getThreshold);
  const [showThresholdDialog, setShowThresholdDialog] = useState(false);

  const getPerfume = useCallback(
    (id: string) => perfumes.find(p => p.master_id === id),
    [perfumes]
  );

  // ---- Filtered bottles ----
  const filtered = useMemo(() => {
    return bottles.filter(b => {
      if (!search) return true;
      const p = getPerfume(b.master_id);
      return `${b.bottle_id} ${p?.brand || ''} ${p?.name || ''} ${b.master_id}`
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  }, [bottles, search, getPerfume]);

  // ---- Per-perfume aggregation ----
  const perfumeAggs = useMemo((): PerfumeAgg[] => {
    const map = new Map<string, DecantBottle[]>();
    for (const b of filtered) {
      const arr = map.get(b.master_id) || [];
      arr.push(b);
      map.set(b.master_id, arr);
    }
    return Array.from(map.entries()).map(([master_id, btls]) => {
      const totalCurrent = btls.reduce((s, b) => s + b.current_ml, 0);
      const totalCapacity = btls.reduce((s, b) => s + b.size_ml, 0);
      const pct = totalCapacity > 0 ? Math.round((totalCurrent / totalCapacity) * 100) : 0;
      return {
        master_id,
        perfume: getPerfume(master_id),
        bottles: btls,
        totalCurrent,
        totalCapacity,
        pct,
        isLow: pct < threshold,
      };
    }).sort((a, b) => a.pct - b.pct); // lowest first
  }, [filtered, getPerfume, threshold]);

  // Summary stats
  const totalMl = bottles.reduce((s, b) => s + b.current_ml, 0);
  const totalCapacity = bottles.reduce((s, b) => s + b.size_ml, 0);
  const lowBottles = bottles.filter(b => b.size_ml > 0 && (b.current_ml / b.size_ml) < (threshold / 100));
  const uniquePerfumes = new Set(bottles.map(b => b.master_id)).size;
  const lowPerfumes = perfumeAggs.filter(a => a.isLow).length;

  const getBottleLedger = useCallback(
    (bottleId: string) => ledgerEvents.filter((e: any) => e.bottle_id === bottleId),
    [ledgerEvents]
  );

  const handleDeductSuccess = () => {
    refetchBottles();
    refetchLedger();
    setDeductBottle(null);
  };

  const handleThresholdChange = (newPct: number) => {
    setThreshold(newPct);
    setThresholdStorage(newPct);
    setShowThresholdDialog(false);
    toast.success(`Low-stock threshold set to ${newPct}%`);
  };

  return (
    <div>
      <PageHeader
        title="Decanting Pool"
        subtitle={`${bottles.length} open bottles · ${totalMl.toFixed(1)}ml available`}
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Decanting Pool' }]}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowThresholdDialog(true)}
            className="gap-1.5 text-xs"
          >
            <Settings2 className="w-3.5 h-3.5" /> Low-Stock: {threshold}%
          </Button>
        }
      />
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard
            icon={FlaskConical}
            label="Open Bottles"
            value={bottles.length}
            color="text-blue-500"
            bgColor="bg-blue-500/10"
          />
          <SummaryCard
            icon={Droplets}
            label="Total Available"
            value={`${totalMl.toFixed(1)}ml`}
            sub={totalCapacity > 0 ? `of ${totalCapacity.toFixed(0)}ml capacity` : undefined}
            color="text-gold"
            bgColor="bg-gold/10"
          />
          <SummaryCard
            icon={Beaker}
            label="Unique Perfumes"
            value={uniquePerfumes}
            color="text-emerald-500"
            bgColor="bg-emerald-500/10"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Low Bottles"
            value={lowBottles.length}
            sub={lowBottles.length > 0 ? `below ${threshold}%` : 'all healthy'}
            color={lowBottles.length > 0 ? 'text-destructive' : 'text-emerald-500'}
            bgColor={lowBottles.length > 0 ? 'bg-destructive/10' : 'bg-emerald-500/10'}
          />
          <SummaryCard
            icon={Layers}
            label="Low Perfumes"
            value={lowPerfumes}
            sub={lowPerfumes > 0 ? `below ${threshold}% combined` : 'all healthy'}
            color={lowPerfumes > 0 ? 'text-orange-500' : 'text-emerald-500'}
            bgColor={lowPerfumes > 0 ? 'bg-orange-500/10' : 'bg-emerald-500/10'}
          />
        </div>

        {/* View Toggle + Search */}
        <div className="flex items-center gap-4 flex-wrap">
          <Tabs value={viewMode} onValueChange={v => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="perfumes" className="gap-1.5 text-xs">
                <Layers className="w-3.5 h-3.5" /> By Perfume
              </TabsTrigger>
              <TabsTrigger value="bottles" className="gap-1.5 text-xs">
                <List className="w-3.5 h-3.5" /> By Bottle
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by brand, name, bottle ID..."
              className="w-full h-9 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
        </div>

        {/* ====== Per-Perfume Aggregation View ====== */}
        {viewMode === 'perfumes' && (
          perfumeAggs.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No bottles in decanting pool"
              description="Add bottles via Station 0 with 'Decanting Pool' allocation."
            />
          ) : (
            <div className="space-y-3">
              {perfumeAggs.map(agg => {
                const isExpanded = expandedId === agg.master_id;
                const p = agg.perfume;
                return (
                  <div
                    key={agg.master_id}
                    className={cn(
                      'bg-card border rounded-lg transition-all overflow-hidden',
                      agg.isLow ? 'border-destructive/30' : 'border-border',
                    )}
                  >
                    {/* Aggregation Row */}
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Perfume Image */}
                        {p?.bottle_image_url ? (
                          <img src={p.bottle_image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                            <FlaskConical className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold truncate">{p?.brand} — {p?.name}</p>
                            {agg.isLow && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/15 text-destructive shrink-0">
                                Low Stock
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-muted-foreground">{agg.master_id}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {agg.bottles.length} bottle{agg.bottles.length !== 1 ? 's' : ''} open
                          </p>
                        </div>

                        {/* Combined Gauge */}
                        <div className="w-44 shrink-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className={cn(
                              'text-lg font-bold font-mono',
                              agg.isLow ? 'text-destructive' : 'text-gold'
                            )}>
                              {agg.totalCurrent.toFixed(1)}ml
                            </span>
                            <span className="text-xs text-muted-foreground">/ {agg.totalCapacity.toFixed(0)}ml total</span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                agg.isLow ? 'bg-gradient-to-r from-destructive to-destructive/70' : 'bg-gradient-to-r from-gold to-gold/70'
                              )}
                              style={{ width: `${Math.max(agg.pct, 2)}%` }}
                            />
                            <div className="absolute inset-0 flex justify-between px-[25%]">
                              <div className="w-px h-full bg-background/30" />
                              <div className="w-px h-full bg-background/30" />
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{agg.pct}% combined</p>
                        </div>

                        {/* Expand */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(isExpanded ? null : agg.master_id)}
                          className="px-2"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded: Individual Bottles */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Individual Bottles
                        </h4>
                        {agg.bottles.map(b => {
                          const bPct = b.size_ml > 0 ? Math.round((b.current_ml / b.size_ml) * 100) : 0;
                          const bLow = bPct < threshold;
                          const bEmpty = b.current_ml <= 0;
                          return (
                            <div key={b.bottle_id} className="flex items-center gap-3 bg-background rounded-md p-3 border border-border">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-mono font-medium">{b.bottle_id}</p>
                                  {bLow && !bEmpty && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-destructive/15 text-destructive">Low</span>
                                  )}
                                  {bEmpty && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-muted text-muted-foreground">Empty</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{b.location_code || 'N/A'}</span>
                                  {b.opened_at && <span>Opened {new Date(b.opened_at).toLocaleDateString()}</span>}
                                </div>
                              </div>
                              {/* Mini gauge */}
                              <div className="w-24 shrink-0">
                                <div className="flex items-baseline justify-between text-xs mb-0.5">
                                  <span className={cn('font-mono font-bold', bLow ? 'text-destructive' : 'text-gold')}>
                                    {b.current_ml}ml
                                  </span>
                                  <span className="text-muted-foreground text-[10px]">/ {b.size_ml}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full', bEmpty ? 'bg-muted-foreground/30' : bLow ? 'bg-destructive' : 'bg-gold')}
                                    style={{ width: `${Math.max(bPct, 2)}%` }}
                                  />
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeductBottle(b)}
                                disabled={bEmpty}
                                className="gap-1 text-[10px] h-7 px-2"
                              >
                                <Minus className="w-3 h-3" /> Deduct
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ====== Per-Bottle View (original) ====== */}
        {viewMode === 'bottles' && (
          filtered.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No bottles in decanting pool"
              description="Add bottles via Station 0 with 'Decanting Pool' allocation, or convert sealed bottles from the Sealed Vault."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map(b => {
                const p = getPerfume(b.master_id);
                const pct = b.size_ml > 0 ? Math.round((b.current_ml / b.size_ml) * 100) : 0;
                const isLow = pct < threshold;
                const isEmpty = b.current_ml <= 0;
                const isExpanded = expandedId === b.bottle_id;
                const events = getBottleLedger(b.bottle_id);

                return (
                  <div
                    key={b.bottle_id}
                    className={cn(
                      'bg-card border rounded-lg transition-all overflow-hidden',
                      isEmpty ? 'border-muted opacity-60' : isLow ? 'border-destructive/30' : 'border-border',
                    )}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        {p?.bottle_image_url ? (
                          <img src={p.bottle_image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                            <FlaskConical className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold truncate">{p?.brand} — {p?.name}</p>
                            {isLow && !isEmpty && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/15 text-destructive shrink-0">Low</span>
                            )}
                            {isEmpty && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">Empty</span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-muted-foreground">{b.bottle_id}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.location_code || 'No location'}</span>
                            {b.opened_at && <span>Opened {new Date(b.opened_at).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <div className="w-32 shrink-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className={cn('text-lg font-bold font-mono', isEmpty ? 'text-muted-foreground' : isLow ? 'text-destructive' : 'text-gold')}>
                              {b.current_ml}
                            </span>
                            <span className="text-xs text-muted-foreground">/ {b.size_ml}ml</span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                            <div
                              className={cn('h-full rounded-full transition-all duration-500', isEmpty ? 'bg-muted-foreground/30' : isLow ? 'bg-gradient-to-r from-destructive to-destructive/70' : 'bg-gradient-to-r from-gold to-gold/70')}
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                            <div className="absolute inset-0 flex justify-between px-[25%]">
                              <div className="w-px h-full bg-background/30" />
                              <div className="w-px h-full bg-background/30" />
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{pct}% remaining</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => setDeductBottle(b)} disabled={isEmpty} className="gap-1 text-xs">
                            <Minus className="w-3.5 h-3.5" /> Deduct
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : b.bottle_id)} className="px-2">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-muted/20 px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Liquid Level</h4>
                            <LiquidGauge currentMl={b.current_ml} sizeMl={b.size_ml} />
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                              <div className="bg-background rounded-md p-2">
                                <p className="text-xs text-muted-foreground">Original</p>
                                <p className="text-sm font-bold font-mono">{b.size_ml}ml</p>
                              </div>
                              <div className="bg-background rounded-md p-2">
                                <p className="text-xs text-muted-foreground">Used</p>
                                <p className="text-sm font-bold font-mono text-destructive">{(b.size_ml - b.current_ml).toFixed(1)}ml</p>
                              </div>
                              <div className="bg-background rounded-md p-2">
                                <p className="text-xs text-muted-foreground">Remaining</p>
                                <p className={cn('text-sm font-bold font-mono', isLow ? 'text-destructive' : 'text-gold')}>{b.current_ml}ml</p>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5" /> Deduction History
                            </h4>
                            {events.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">No deduction events recorded yet.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {events.slice(0, 20).map((evt: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-xs bg-background rounded-md px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <TrendingDown className="w-3 h-3 text-destructive" />
                                      <span className="text-muted-foreground">{evt.notes || evt.type || 'Deduction'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="font-mono font-medium text-destructive">-{evt.qty_ml || '?'}ml</span>
                                      <span className="text-muted-foreground">{evt.created_at ? new Date(evt.created_at).toLocaleDateString() : ''}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Deduction Dialog */}
      {deductBottle && (
        <DeductionDialog
          bottle={deductBottle}
          perfumeName={(() => {
            const p = getPerfume(deductBottle.master_id);
            return p ? `${p.brand} — ${p.name}` : deductBottle.master_id;
          })()}
          threshold={threshold}
          onClose={() => setDeductBottle(null)}
          onSuccess={handleDeductSuccess}
        />
      )}

      {/* Threshold Settings Dialog */}
      {showThresholdDialog && (
        <ThresholdDialog
          current={threshold}
          onClose={() => setShowThresholdDialog(false)}
          onSave={handleThresholdChange}
        />
      )}
    </div>
  );
}

// ---- Summary Card ----
function SummaryCard({
  icon: Icon, label, value, sub, color, bgColor,
}: {
  icon: any; label: string; value: string | number; sub?: string; color: string; bgColor: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', bgColor)}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ---- Liquid Gauge (visual bottle-shaped gauge) ----
function LiquidGauge({ currentMl, sizeMl }: { currentMl: number; sizeMl: number }) {
  const pct = sizeMl > 0 ? Math.min(100, Math.max(0, (currentMl / sizeMl) * 100)) : 0;
  const isLow = pct < 20;
  const isEmpty = currentMl <= 0;
  const fillColor = isEmpty ? '#666' : isLow ? '#ef4444' : pct < 50 ? '#f59e0b' : '#c5a44e';
  const clipId = `bottleClip_${currentMl}_${sizeMl}`;

  return (
    <div className="flex items-center justify-center">
      <svg width="120" height="140" viewBox="0 0 120 140" className="drop-shadow-sm">
        <rect x="42" y="4" width="36" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-border" />
        <path d="M 30 30 L 42 24 L 78 24 L 90 30 L 90 125 Q 90 135 80 135 L 40 135 Q 30 135 30 125 Z" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-border" />
        <defs>
          <clipPath id={clipId}>
            <path d="M 31 30 L 42 25 L 78 25 L 89 30 L 89 125 Q 89 134 80 134 L 40 134 Q 31 134 31 125 Z" />
          </clipPath>
        </defs>
        <rect x="31" y={30 + (104 * (1 - pct / 100))} width="58" height={104 * (pct / 100)} fill={fillColor} opacity="0.3" clipPath={`url(#${clipId})`} />
        <rect x="31" y={30 + (104 * (1 - pct / 100))} width="58" height={Math.min(4, 104 * (pct / 100))} fill={fillColor} opacity="0.6" clipPath={`url(#${clipId})`} rx="1" />
        <text x="60" y="85" textAnchor="middle" className="text-foreground" fill="currentColor" fontSize="20" fontWeight="bold" fontFamily="monospace">{Math.round(pct)}%</text>
        <text x="60" y="105" textAnchor="middle" fill="currentColor" className="text-muted-foreground" fontSize="10">{currentMl}ml left</text>
      </svg>
    </div>
  );
}

// ---- Deduction Dialog (with auto low-stock alert) ----
function DeductionDialog({
  bottle, perfumeName, threshold, onClose, onSuccess,
}: {
  bottle: DecantBottle; perfumeName: string; threshold: number;
  onClose: () => void; onSuccess: () => void;
}) {
  const [mlToDeduct, setMlToDeduct] = useState('');
  const [reason, setReason] = useState('');
  const [jobId, setJobId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const deductValue = parseFloat(mlToDeduct) || 0;
  const remaining = bottle.current_ml - deductValue;
  const isValid = deductValue > 0 && deductValue <= bottle.current_ml;
  const willTriggerAlert = isValid && bottle.size_ml > 0 && (remaining / bottle.size_ml) * 100 < threshold && (bottle.current_ml / bottle.size_ml) * 100 >= threshold;

  const presets = [2, 5, 7.5, 10, 15, 20];

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const newMl = (bottle.current_ml - deductValue).toFixed(1);
      await api.mutations.decantBottles.update(bottle.bottle_id, { currentMl: newMl });

      const eventId = `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await api.mutations.ledger.createDecantEvent({
        eventId,
        type: 'MANUAL_DEDUCT',
        bottleId: bottle.bottle_id,
        qtyMl: String(deductValue),
        unitsProduced: 0,
        jobId: jobId || undefined,
        notes: reason || `Manual deduction of ${deductValue}ml from ${perfumeName}`,
      });

      // Auto-create low-stock alert if threshold crossed
      const newPct = bottle.size_ml > 0 ? (parseFloat(newMl) / bottle.size_ml) * 100 : 100;
      const wasBelowBefore = (bottle.current_ml / bottle.size_ml) * 100 < threshold;
      if (newPct < threshold && !wasBelowBefore) {
        try {
          const alertId = `ALERT-LOW-${bottle.bottle_id}-${Date.now()}`;
          await api.mutations.alerts.create({
            alertId,
            type: 'low_stock',
            severity: newPct < 10 ? 'critical' : 'warning',
            message: `${perfumeName} (${bottle.bottle_id}) dropped to ${Math.round(newPct)}% — ${newMl}ml remaining of ${bottle.size_ml}ml`,
          });
          toast.info('Low-stock alert created on Dashboard', {
            description: `${perfumeName} is now below ${threshold}%`,
          });
        } catch (alertErr) {
          console.warn('Failed to create low-stock alert:', alertErr);
        }
      }

      toast.success(`Deducted ${deductValue}ml from ${perfumeName}`, {
        description: `Remaining: ${newMl}ml`,
      });
      onSuccess();
    } catch (err: any) {
      console.error('Deduction failed:', err);
      toast.error('Failed to record deduction', { description: err.message || 'Please try again' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="w-5 h-5 text-destructive" /> Record Deduction
          </DialogTitle>
          <DialogDescription>
            Deduct liquid from <strong>{perfumeName}</strong> ({bottle.bottle_id})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Current Level</span>
            <span className="text-lg font-bold font-mono text-gold">
              {bottle.current_ml}ml <span className="text-xs text-muted-foreground font-normal">/ {bottle.size_ml}ml</span>
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Deduct</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {presets.filter(v => v <= bottle.current_ml).map(v => (
                <button
                  key={v}
                  onClick={() => setMlToDeduct(String(v))}
                  className={cn(
                    'px-3 py-1.5 text-xs font-mono rounded-md border transition-all',
                    parseFloat(mlToDeduct) === v ? 'border-gold bg-gold/10 text-gold' : 'border-border hover:border-gold/50'
                  )}
                >{v}ml</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount (ml)</label>
            <input type="number" value={mlToDeduct} onChange={e => setMlToDeduct(e.target.value)} placeholder="0.0" step="0.5" min="0" max={bottle.current_ml}
              className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1 font-mono" />
            {deductValue > bottle.current_ml && (
              <p className="text-xs text-destructive mt-1">Cannot deduct more than available ({bottle.current_ml}ml)</p>
            )}
          </div>

          {deductValue > 0 && deductValue <= bottle.current_ml && (
            <div className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              willTriggerAlert ? 'bg-orange-500/5 border-orange-500/30' : 'bg-destructive/5 border-destructive/20'
            )}>
              <div>
                <span className="text-sm text-muted-foreground">After Deduction</span>
                {willTriggerAlert && (
                  <p className="text-[10px] text-orange-500 flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="w-3 h-3" /> Will trigger low-stock alert
                  </p>
                )}
              </div>
              <span className={cn('text-lg font-bold font-mono', remaining < bottle.size_ml * (threshold / 100) ? 'text-destructive' : 'text-gold')}>
                {remaining.toFixed(1)}ml
              </span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason (optional)</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Manual decant for walk-in customer"
              className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Job ID (optional)</label>
            <input type="text" value={jobId} onChange={e => setJobId(e.target.value)} placeholder="e.g. JOB-2025-001"
              className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1 font-mono" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}
            className="gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
            {submitting ? 'Recording...' : `Deduct ${deductValue || 0}ml`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Threshold Settings Dialog ----
function ThresholdDialog({
  current, onClose, onSave,
}: {
  current: number; onClose: () => void; onSave: (pct: number) => void;
}) {
  const [value, setValue] = useState(String(current));
  const pct = parseInt(value, 10);
  const isValid = !isNaN(pct) && pct >= 5 && pct <= 50;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Low-Stock Threshold
          </DialogTitle>
          <DialogDescription>
            Set the percentage below which a bottle is flagged as low stock and triggers a dashboard alert on deduction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Threshold (%)</label>
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              min="5"
              max="50"
              step="5"
              className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1 font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Range: 5% – 50%. Default is 20%.</p>
          </div>

          {/* Preview */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-2">Preview: A 100ml bottle would be flagged at</p>
            <p className="text-lg font-bold font-mono text-destructive">{isValid ? pct : '?'}ml remaining</p>
          </div>

          {/* Preset buttons */}
          <div className="flex gap-2">
            {[10, 15, 20, 25, 30].map(p => (
              <button
                key={p}
                onClick={() => setValue(String(p))}
                className={cn(
                  'flex-1 py-2 text-xs font-mono rounded-md border transition-all',
                  parseInt(value) === p ? 'border-gold bg-gold/10 text-gold' : 'border-border hover:border-gold/50'
                )}
              >{p}%</button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => isValid && onSave(pct)} disabled={!isValid}
            className="gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground">
            Save Threshold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
