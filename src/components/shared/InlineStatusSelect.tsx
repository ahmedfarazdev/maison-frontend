// ============================================================
// InlineStatusSelect — Reusable inline status dropdown
// Used across Orders, Subscriptions, and other list views
// ============================================================

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gold/15 text-gold border-gold/30',
  processing: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  picked: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  prepped: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  decanted: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  packed: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  shipped: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
  active: 'bg-gold/15 text-gold border-gold/30',
  completed: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  paused: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  draft: 'bg-muted text-muted-foreground border-border',
};

interface InlineStatusSelectProps {
  entityId: string;
  entityType: 'order' | 'cycle';
  currentStatus: string;
  statuses: readonly string[] | string[];
  onUpdate?: (newStatus: string) => void;
}

export function InlineStatusSelect({
  entityId,
  entityType,
  currentStatus,
  statuses,
  onUpdate,
}: InlineStatusSelectProps) {
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState(currentStatus);

  const handleChange = async (newStatus: string) => {
    if (newStatus === status) return;
    setUpdating(true);
    try {
      if (entityType === 'order') {
        await api.mutations.orders.update(entityId, { status: newStatus });
      } else if (entityType === 'cycle') {
        await api.mutations.subscriptionCycles.update(entityId, { status: newStatus });
      }
      setStatus(newStatus);
      toast.success(`${entityType === 'order' ? 'Order' : 'Cycle'} ${entityId} → ${newStatus}`);
      onUpdate?.(newStatus);
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      <select
        value={status}
        onChange={e => handleChange(e.target.value)}
        disabled={updating}
        className={cn(
          'text-xs font-medium capitalize rounded-md px-2 py-1 border cursor-pointer appearance-none pr-6 transition-colors',
          STATUS_COLORS[status] || 'bg-muted text-muted-foreground border-border',
          updating && 'opacity-50',
        )}
      >
        {statuses.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {updating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground absolute right-1" />}
    </div>
  );
}
