// ============================================================
// Activity Feed — Real-time operational event stream
// Shows recent system events: orders, inventory, stations, etc.
// Filterable by category. Accessible from dashboard or sheet.
// ============================================================

import { useState, useMemo } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShoppingCart, Package, FlaskConical, Truck, CheckSquare,
  AlertTriangle, Box, Droplets, Users, ClipboardList,
  RotateCcw, Sparkles, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Activity Event Types ----
export type ActivityCategory =
  | 'order'
  | 'inventory'
  | 'station'
  | 'shipping'
  | 'alert'
  | 'subscription'
  | 'system';

export interface ActivityEvent {
  id: string;
  category: ActivityCategory;
  action: string;
  description: string;
  timestamp: string;
  operator?: string;
  metadata?: Record<string, string>;
}

const CATEGORY_CONFIG: Record<ActivityCategory, { icon: React.ElementType; color: string; label: string }> = {
  order: { icon: ShoppingCart, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30', label: 'Orders' },
  inventory: { icon: Package, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', label: 'Inventory' },
  station: { icon: FlaskConical, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30', label: 'Stations' },
  shipping: { icon: Truck, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30', label: 'Shipping' },
  alert: { icon: AlertTriangle, color: 'text-red-500 bg-red-50 dark:bg-red-950/30', label: 'Alerts' },
  subscription: { icon: RotateCcw, color: 'text-pink-500 bg-pink-50 dark:bg-pink-950/30', label: 'Subscriptions' },
  system: { icon: Sparkles, color: 'text-gray-500 bg-gray-50 dark:bg-gray-950/30', label: 'System' },
};

// ---- Generate mock activity events ----
function generateMockActivities(): ActivityEvent[] {
  const now = new Date();
  const events: ActivityEvent[] = [
    { id: 'act-001', category: 'order', action: 'Order Created', description: 'ORD-2025-010 created — Rania Khoury — 2 full bottles', timestamp: new Date(now.getTime() - 5 * 60000).toISOString(), operator: 'System' },
    { id: 'act-002', category: 'station', action: 'Decanting Complete', description: 'Batch decanting completed for JOB-2025-001 — 6 perfumes processed', timestamp: new Date(now.getTime() - 12 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-003', category: 'inventory', action: 'Bottle Opened', description: 'BTL-003 (Tobacco Vanille 50ml) opened for decanting pool', timestamp: new Date(now.getTime() - 18 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-004', category: 'alert', action: 'Low Stock Warning', description: 'Tobacco Vanille (DEC-002) — only 18ml remaining, below 30ml threshold', timestamp: new Date(now.getTime() - 25 * 60000).toISOString() },
    { id: 'act-005', category: 'shipping', action: 'Order Shipped', description: 'ORD-2025-005 shipped via Aramex — tracking: ARX-2025-88901', timestamp: new Date(now.getTime() - 35 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-006', category: 'order', action: 'Status Changed', description: 'ORD-2025-004 moved from decanted → packed', timestamp: new Date(now.getTime() - 42 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-007', category: 'station', action: 'Picking Started', description: 'Picking started for JOB-2025-001 — 3 bottles to pick', timestamp: new Date(now.getTime() - 55 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-008', category: 'subscription', action: 'Cycle Updated', description: 'CYC-2025-02 status changed to active — cutoff Feb 14', timestamp: new Date(now.getTime() - 65 * 60000).toISOString(), operator: 'System' },
    { id: 'act-009', category: 'inventory', action: 'Stock Intake', description: '3 bottles received from FragranceNet — BTL-007, BTL-008, BTL-009', timestamp: new Date(now.getTime() - 80 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-010', category: 'order', action: 'Order Created', description: 'ORD-2025-009 created — Omar Farouk — Grand Master subscription', timestamp: new Date(now.getTime() - 95 * 60000).toISOString(), operator: 'System' },
    { id: 'act-011', category: 'station', action: 'QC Passed', description: 'ORD-2025-003 passed QC — all items verified, box sealed', timestamp: new Date(now.getTime() - 110 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-012', category: 'alert', action: 'PO Overdue', description: 'PO-003/Ahmed K. expected delivery date passed — 2 days overdue', timestamp: new Date(now.getTime() - 130 * 60000).toISOString() },
    { id: 'act-013', category: 'inventory', action: 'Decant Recorded', description: 'Manual decant: 2x 5ml Baccarat Rouge 540 from DEC-001', timestamp: new Date(now.getTime() - 150 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-014', category: 'shipping', action: 'Courier Pickup', description: 'Aramex pickup completed — 4 packages collected', timestamp: new Date(now.getTime() - 180 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-015', category: 'system', action: 'Day Started', description: 'Operations day started — 11 pending orders, 2 batches ready', timestamp: new Date(now.getTime() - 240 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-016', category: 'order', action: 'Priority Changed', description: 'ORD-2025-001 flagged as Rush — gift wrapping requested', timestamp: new Date(now.getTime() - 300 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-017', category: 'inventory', action: 'Reconciliation', description: 'Stock reconciliation session completed — 2 variances found', timestamp: new Date(now.getTime() - 360 * 60000).toISOString(), operator: 'Karim' },
    { id: 'act-018', category: 'subscription', action: 'POTM Selected', description: 'February POTM Slot 1: Baccarat Rouge 540 assigned to all tiers', timestamp: new Date(now.getTime() - 420 * 60000).toISOString(), operator: 'Karim' },
  ];
  return events;
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ActivityFeedProps {
  open: boolean;
  onClose: () => void;
}

export default function ActivityFeed({ open, onClose }: ActivityFeedProps) {
  const [filter, setFilter] = useState<ActivityCategory | 'all'>('all');
  const activities = useMemo(() => generateMockActivities(), []);

  const filtered = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter(a => a.category === filter);
  }, [activities, filter]);

  const categories: (ActivityCategory | 'all')[] = ['all', 'order', 'inventory', 'station', 'shipping', 'alert', 'subscription', 'system'];

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="text-lg font-semibold">Activity Feed</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Recent operational events across the system
          </SheetDescription>
        </SheetHeader>

        {/* Category filter pills */}
        <div className="px-6 py-3 border-b border-border flex gap-1.5 overflow-x-auto">
          {categories.map(cat => {
            const isAll = cat === 'all';
            const config = isAll ? null : CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap',
                  filter === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                )}
              >
                {isAll ? 'All' : config!.label}
              </button>
            );
          })}
        </div>

        {/* Events list */}
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="px-6 py-3 space-y-1">
            {filtered.map(event => {
              const config = CATEGORY_CONFIG[event.category];
              const Icon = config.icon;
              return (
                <div
                  key={event.id}
                  className="flex gap-3 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', config.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-foreground">{event.action}</span>
                      <span className="text-[10px] text-muted-foreground">{formatTimeAgo(event.timestamp)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
                    {event.operator && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1">by {event.operator}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No events in this category</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---- Inline Activity Feed for Dashboard ----
export function InlineActivityFeed({ maxItems = 8 }: { maxItems?: number }) {
  const activities = useMemo(() => generateMockActivities().slice(0, maxItems), [maxItems]);

  return (
    <div className="space-y-1">
      {activities.map(event => {
        const config = CATEGORY_CONFIG[event.category];
        const Icon = config.icon;
        return (
          <div key={event.id} className="flex items-start gap-2.5 py-2">
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5', config.color)}>
              <Icon className="w-3 h-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-relaxed">
                <span className="font-medium">{event.action}</span>
                {' — '}
                <span className="text-muted-foreground">{event.description}</span>
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatTimeAgo(event.timestamp)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
