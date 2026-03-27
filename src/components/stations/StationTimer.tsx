// ============================================================
// Station Timer & SLA Tracking — C1 Feature
// Track time spent at each station per job.
// SLA targets with red/yellow/green indicators.
// Timer visible in station headers.
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Timer, Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// ---- SLA Configuration ----
export interface SLAConfig {
  stationId: number;
  stationName: string;
  targetMinutes: number;   // Green zone
  warningMinutes: number;  // Yellow zone (above this = yellow)
  criticalMinutes: number; // Red zone (above this = red)
}

export const DEFAULT_SLA_CONFIGS: SLAConfig[] = [
  { stationId: 1, stationName: 'Pod Dashboard', targetMinutes: 15, warningMinutes: 30, criticalMinutes: 60 },
  { stationId: 2, stationName: 'Picking', targetMinutes: 20, warningMinutes: 40, criticalMinutes: 60 },
  { stationId: 3, stationName: 'Prep & Label', targetMinutes: 30, warningMinutes: 45, criticalMinutes: 75 },
  { stationId: 4, stationName: 'Batch Decanting', targetMinutes: 45, warningMinutes: 60, criticalMinutes: 90 },
  { stationId: 5, stationName: 'Fulfillment', targetMinutes: 20, warningMinutes: 35, criticalMinutes: 60 },
  { stationId: 6, stationName: 'Shipping', targetMinutes: 15, warningMinutes: 30, criticalMinutes: 45 },
];

export type SLAStatus = 'on_track' | 'warning' | 'critical';

export function getSLAStatus(elapsedMinutes: number, config: SLAConfig): SLAStatus {
  if (elapsedMinutes >= config.criticalMinutes) return 'critical';
  if (elapsedMinutes >= config.warningMinutes) return 'warning';
  return 'on_track';
}

const SLA_STYLES: Record<SLAStatus, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  on_track: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2, label: 'On Track' },
  warning: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: AlertTriangle, label: 'Warning' },
  critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', icon: AlertTriangle, label: 'Overdue' },
};

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// ---- Station Timer Component ----
interface StationTimerProps {
  stationId: number;
  jobId?: string;
  startedAt?: string; // ISO timestamp when job entered this station
  className?: string;
  compact?: boolean;
}

export function StationTimer({ stationId, jobId, startedAt, className, compact = false }: StationTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(!!startedAt);

  const config = useMemo(
    () => DEFAULT_SLA_CONFIGS.find(c => c.stationId === stationId) || DEFAULT_SLA_CONFIGS[0],
    [stationId]
  );

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      setRunning(false);
      return;
    }
    setRunning(true);
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const elapsedMinutes = elapsed / 60;
  const slaStatus = getSLAStatus(elapsedMinutes, config);
  const style = SLA_STYLES[slaStatus];
  const Icon = style.icon;
  const progress = Math.min((elapsedMinutes / config.targetMinutes) * 100, 100);

  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <div className={cn('w-2 h-2 rounded-full', slaStatus === 'on_track' ? 'bg-emerald-500' : slaStatus === 'warning' ? 'bg-amber-500' : 'bg-red-500')} />
        <span className={cn('text-xs font-mono tabular-nums', style.color)}>
          {formatDuration(elapsed)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 px-3 py-2 rounded-lg border', style.bg, 'border-current/10', className)}>
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', style.bg)}>
        <Timer className={cn('w-4 h-4', style.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-mono font-semibold tabular-nums', style.color)}>
            {formatDuration(elapsed)}
          </span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 border-0', style.bg, style.color)}>
            {style.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                slaStatus === 'on_track' && 'bg-emerald-500',
                slaStatus === 'warning' && 'bg-amber-500',
                slaStatus === 'critical' && 'bg-red-500',
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            Target: {config.targetMinutes}m
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- SLA Summary Badge (for station headers) ----
interface SLASummaryProps {
  stationId: number;
  activeJobCount: number;
  oldestJobStartedAt?: string;
  className?: string;
}

export function SLASummary({ stationId, activeJobCount, oldestJobStartedAt, className }: SLASummaryProps) {
  const [elapsed, setElapsed] = useState(0);

  const config = useMemo(
    () => DEFAULT_SLA_CONFIGS.find(c => c.stationId === stationId) || DEFAULT_SLA_CONFIGS[0],
    [stationId]
  );

  useEffect(() => {
    if (!oldestJobStartedAt) return;
    const start = new Date(oldestJobStartedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [oldestJobStartedAt]);

  const elapsedMinutes = elapsed / 60;
  const slaStatus = oldestJobStartedAt ? getSLAStatus(elapsedMinutes, config) : 'on_track';
  const style = SLA_STYLES[slaStatus];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium', style.bg, style.color)}>
        <Timer className="w-3 h-3" />
        {oldestJobStartedAt ? formatDuration(elapsed) : '—'}
      </div>
      {activeJobCount > 0 && (
        <span className="text-xs text-muted-foreground">
          {activeJobCount} active
        </span>
      )}
    </div>
  );
}
