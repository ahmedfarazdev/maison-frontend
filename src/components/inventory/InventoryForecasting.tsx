// ============================================================
// Inventory Forecasting Engine — B1 + B2 + G3 Features
// B1: Calculate average daily usage, show "Days of Stock Remaining"
// B2: Auto-generate draft PO suggestions when below threshold
// G3: Low stock auto-alert with configurable thresholds
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import {
  TrendingDown, AlertTriangle, ShoppingCart, Clock, ArrowRight,
  Droplets, BarChart3, ChevronDown, ChevronRight, Package,
  Plus, Bell, Settings2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { DecantBottle, Perfume } from '@/types';

// ---- Forecast Data Types ----
export interface PerfumeForecast {
  masterId: string;
  name: string;
  brand: string;
  currentMl: number;
  avgDailyUsageMl: number;
  daysOfStockRemaining: number;
  minThresholdMl: number;
  status: 'healthy' | 'warning' | 'critical' | 'out_of_stock';
  suggestedReorderMl: number;
  suggestedReorderBottles: number;
  lastDecantDate: string | null;
}

export interface ReorderSuggestion {
  masterId: string;
  perfumeName: string;
  brand: string;
  currentMl: number;
  suggestedQty: number;
  suggestedSizeMl: number;
  estimatedCost: number;
  urgency: 'immediate' | 'soon' | 'planned';
  reason: string;
}

// ---- Generate forecast from decant data ----
export function generateForecasts(
  decantBottles: DecantBottle[],
  perfumes: Perfume[],
  lookbackDays: number = 30,
  alertThresholdDays: number = 14,
): PerfumeForecast[] {
  // Group decant bottles by master perfume
  const grouped = new Map<string, { totalMl: number; bottles: DecantBottle[] }>();

  decantBottles.forEach(b => {
    const existing = grouped.get(b.master_id) || { totalMl: 0, bottles: [] };
    existing.totalMl += b.current_ml;
    existing.bottles.push(b);
    grouped.set(b.master_id, existing);
  });

  const forecasts: PerfumeForecast[] = [];

  grouped.forEach((data, masterId) => {
    const perfume = perfumes.find(p => p.master_id === masterId);
    if (!perfume) return;

    // Estimate average daily usage from bottle size vs current ml
    // (In production, this would come from the decant ledger)
    const totalOriginalMl = data.bottles.reduce((sum, b) => sum + b.size_ml, 0);
    const totalUsedMl = totalOriginalMl - data.totalMl;
    const avgDailyUsage = Math.max(totalUsedMl / lookbackDays, 0.5); // minimum 0.5ml/day

    const daysRemaining = data.totalMl > 0 ? Math.floor(data.totalMl / avgDailyUsage) : 0;
    const minThreshold = avgDailyUsage * alertThresholdDays;

    let status: PerfumeForecast['status'] = 'healthy';
    if (data.totalMl <= 0) status = 'out_of_stock';
    else if (daysRemaining <= 7) status = 'critical';
    else if (daysRemaining <= alertThresholdDays) status = 'warning';

    // Suggest reorder: 30-day supply
    const suggestedMl = Math.max(avgDailyUsage * 30 - data.totalMl, 0);
    const suggestedBottles = Math.ceil(suggestedMl / (perfume.reference_size_ml || 100));

    const lastDecant = data.bottles
      .filter(b => b.opened_at)
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())[0];

    forecasts.push({
      masterId,
      name: perfume.name,
      brand: perfume.brand,
      currentMl: Math.round(data.totalMl * 10) / 10,
      avgDailyUsageMl: Math.round(avgDailyUsage * 10) / 10,
      daysOfStockRemaining: daysRemaining,
      minThresholdMl: Math.round(minThreshold),
      status,
      suggestedReorderMl: Math.round(suggestedMl),
      suggestedReorderBottles: suggestedBottles,
      lastDecantDate: lastDecant?.opened_at || null,
    });
  });

  // Sort: critical first, then warning, then healthy
  const statusOrder = { out_of_stock: 0, critical: 1, warning: 2, healthy: 3 };
  return forecasts.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}

// ---- Generate reorder suggestions ----
export function generateReorderSuggestions(forecasts: PerfumeForecast[]): ReorderSuggestion[] {
  return forecasts
    .filter(f => f.status !== 'healthy')
    .map(f => ({
      masterId: f.masterId,
      perfumeName: f.name,
      brand: f.brand,
      currentMl: f.currentMl,
      suggestedQty: f.suggestedReorderBottles,
      suggestedSizeMl: 100, // Default suggestion
      estimatedCost: f.suggestedReorderBottles * 200, // Rough estimate
      urgency: f.status === 'out_of_stock' || f.status === 'critical' ? 'immediate' as const : f.status === 'warning' ? 'soon' as const : 'planned' as const,
      reason: f.status === 'out_of_stock'
        ? 'Out of stock — immediate reorder needed'
        : f.daysOfStockRemaining <= 7
        ? `Only ${f.daysOfStockRemaining} days of stock remaining`
        : `Below ${Math.round(f.minThresholdMl)}ml threshold — ${f.daysOfStockRemaining} days remaining`,
    }));
}

// ---- Status Badge ----
const STATUS_CONFIG = {
  healthy: { label: 'Healthy', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  warning: { label: 'Low', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  out_of_stock: { label: 'Out', color: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
};

function ForecastStatusBadge({ status }: { status: PerfumeForecast['status'] }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', config.color)}>
      {config.label}
    </span>
  );
}

// ---- Forecasting Dashboard Widget ----
interface ForecastingWidgetProps {
  decantBottles: DecantBottle[];
  perfumes: Perfume[];
  className?: string;
}

export function ForecastingWidget({ decantBottles, perfumes, className }: ForecastingWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  const forecasts = useMemo(
    () => generateForecasts(decantBottles, perfumes),
    [decantBottles, perfumes]
  );

  const criticalCount = forecasts.filter(f => f.status === 'critical' || f.status === 'out_of_stock').length;
  const warningCount = forecasts.filter(f => f.status === 'warning').length;

  const displayForecasts = expanded ? forecasts : forecasts.slice(0, 5);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Summary strip */}
      <div className="flex items-center gap-3 text-xs">
        {criticalCount > 0 && (
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-semibold">{criticalCount} critical</span>
          </div>
        )}
        {warningCount > 0 && (
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-semibold">{warningCount} low</span>
          </div>
        )}
        {criticalCount === 0 && warningCount === 0 && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Droplets className="w-3.5 h-3.5" />
            <span className="font-medium">All stock levels healthy</span>
          </div>
        )}
      </div>

      {/* Forecast rows */}
      <div className="space-y-1.5">
        {displayForecasts.map(f => (
          <div key={f.masterId} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium truncate">{f.brand} — {f.name}</span>
                <ForecastStatusBadge status={f.status} />
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                <span>{f.currentMl}ml remaining</span>
                <span>~{f.avgDailyUsageMl}ml/day</span>
                <span className={cn(
                  'font-semibold',
                  f.daysOfStockRemaining <= 7 ? 'text-red-500' : f.daysOfStockRemaining <= 14 ? 'text-amber-500' : '',
                )}>
                  {f.daysOfStockRemaining}d left
                </span>
              </div>
            </div>
            {/* Mini progress bar */}
            <div className="w-16 shrink-0">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    f.status === 'healthy' && 'bg-emerald-500',
                    f.status === 'warning' && 'bg-amber-500',
                    (f.status === 'critical' || f.status === 'out_of_stock') && 'bg-red-500',
                  )}
                  style={{ width: `${Math.min((f.currentMl / (f.minThresholdMl * 3)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {forecasts.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          {expanded ? 'Show less' : `Show all ${forecasts.length} perfumes`}
          <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </div>
  );
}

// ---- Auto-Reorder Suggestions Panel ----
interface ReorderPanelProps {
  decantBottles: DecantBottle[];
  perfumes: Perfume[];
  onCreatePO?: (suggestion: ReorderSuggestion) => void;
  className?: string;
}

export function ReorderSuggestionsPanel({ decantBottles, perfumes, onCreatePO, className }: ReorderPanelProps) {
  const forecasts = useMemo(
    () => generateForecasts(decantBottles, perfumes),
    [decantBottles, perfumes]
  );

  const suggestions = useMemo(
    () => generateReorderSuggestions(forecasts),
    [forecasts]
  );

  const handleCreatePO = useCallback((suggestion: ReorderSuggestion) => {
    if (onCreatePO) {
      onCreatePO(suggestion);
    } else {
      toast.info('Draft PO created', {
        description: `${suggestion.suggestedQty}x ${suggestion.suggestedSizeMl}ml ${suggestion.perfumeName}`,
      });
    }
  }, [onCreatePO]);

  if (suggestions.length === 0) {
    return (
      <div className={cn('text-center py-6 text-muted-foreground', className)}>
        <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No reorder suggestions — all stock levels are healthy</p>
      </div>
    );
  }

  const URGENCY_STYLES = {
    immediate: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20',
    soon: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20',
    planned: 'border-border bg-muted/30',
  };

  const URGENCY_BADGE = {
    immediate: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    planned: 'bg-muted text-muted-foreground',
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
          Reorder Suggestions
        </h3>
        <Badge variant="secondary" className="text-[10px]">{suggestions.length} items</Badge>
      </div>

      <div className="space-y-2">
        {suggestions.map(s => (
          <div key={s.masterId} className={cn('p-3 rounded-lg border', URGENCY_STYLES[s.urgency])}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{s.brand} — {s.perfumeName}</span>
                  <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded', URGENCY_BADGE[s.urgency])}>
                    {s.urgency}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{s.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Suggest: {s.suggestedQty}x {s.suggestedSizeMl}ml · ~AED {s.estimatedCost}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs h-7"
                onClick={() => handleCreatePO(s)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Draft PO
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
