// ============================================================
// Auto-Batch Assignment — G1 Feature
// Auto-assign incoming orders to current open batch based on cutoff time.
// No manual batch selection needed.
// Rules configurable in settings.
// ============================================================

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Layers, Clock, ArrowRight, CheckCircle2, AlertCircle, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Order } from '@/types';

// ---- Batch Assignment Types ----
export interface BatchConfig {
  morningCutoff: string;  // e.g. "09:00"
  eveningCutoff: string;  // e.g. "21:00"
  autoAssign: boolean;
  maxBatchSize: number;
}

export interface Batch {
  id: string;
  label: string;
  cutoffTime: string;
  packDate: string;
  deliverDate: string;
  orders: Order[];
  status: 'collecting' | 'locked' | 'processing' | 'completed';
}

const DEFAULT_CONFIG: BatchConfig = {
  morningCutoff: '09:00',
  eveningCutoff: '21:00',
  autoAssign: true,
  maxBatchSize: 50,
};

// ---- Determine which batch an order belongs to ----
export function assignOrderToBatch(order: Order, config: BatchConfig = DEFAULT_CONFIG): string {
  const orderDate = new Date(order.created_at);
  const hour = orderDate.getHours();
  const minute = orderDate.getMinutes();
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const dateStr = orderDate.toISOString().split('T')[0];

  if (timeStr < config.morningCutoff) {
    // Before morning cutoff → belongs to previous day's evening batch
    const prevDate = new Date(orderDate);
    prevDate.setDate(prevDate.getDate() - 1);
    return `${prevDate.toISOString().split('T')[0]}-PM`;
  } else if (timeStr < config.eveningCutoff) {
    // Between morning and evening → morning batch
    return `${dateStr}-AM`;
  } else {
    // After evening cutoff → evening batch
    return `${dateStr}-PM`;
  }
}

// ---- Group orders into batches ----
export function groupOrdersIntoBatches(orders: Order[], config: BatchConfig = DEFAULT_CONFIG): Batch[] {
  const batchMap = new Map<string, Order[]>();

  orders.forEach(order => {
    const batchId = assignOrderToBatch(order, config);
    const existing = batchMap.get(batchId) || [];
    existing.push(order);
    batchMap.set(batchId, existing);
  });

  return Array.from(batchMap.entries())
    .map(([id, batchOrders]) => {
      const [dateStr, period] = id.split('-').length > 2
        ? [id.substring(0, 10), id.substring(11)]
        : id.split('-');

      const batchDate = new Date(id.substring(0, 10));
      const packDate = new Date(batchDate);
      packDate.setDate(packDate.getDate() + 1);
      const deliverDate = new Date(packDate);
      deliverDate.setDate(deliverDate.getDate() + 1);

      const allShipped = batchOrders.every(o => o.status === 'shipped');
      const anyProcessing = batchOrders.some(o => ['processing', 'picked', 'prepped', 'decanted', 'packed'].includes(o.status));

      return {
        id,
        label: `${batchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${period === 'PM' ? 'Evening' : 'Morning'}`,
        cutoffTime: period === 'PM' ? config.eveningCutoff : config.morningCutoff,
        packDate: packDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        deliverDate: deliverDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orders: batchOrders,
        status: allShipped ? 'completed' as const : anyProcessing ? 'processing' as const : 'collecting' as const,
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

// ---- Auto-Batch Status Badge ----
const BATCH_STATUS_STYLES = {
  collecting: { label: 'Collecting', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  locked: { label: 'Locked', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export function BatchStatusBadge({ status }: { status: Batch['status'] }) {
  const config = BATCH_STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', config.color)}>
      {config.label}
    </span>
  );
}

// ---- Auto-Batch Info Banner ----
interface AutoBatchBannerProps {
  orders: Order[];
  className?: string;
}

export function AutoBatchBanner({ orders, className }: AutoBatchBannerProps) {
  const batches = useMemo(() => groupOrdersIntoBatches(orders), [orders]);
  const activeBatch = batches.find(b => b.status === 'collecting' || b.status === 'processing');

  if (!activeBatch) return null;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg border',
      'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
      className,
    )}>
      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
        <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">
          Auto-Batch Active: <span className="text-blue-600 dark:text-blue-400">{activeBatch.label}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {activeBatch.orders.length} orders · Cutoff at {activeBatch.cutoffTime} · Pack {activeBatch.packDate} · Deliver {activeBatch.deliverDate}
        </p>
      </div>
      <BatchStatusBadge status={activeBatch.status} />
    </div>
  );
}
