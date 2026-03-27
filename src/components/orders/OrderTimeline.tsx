// ============================================================
// Order Timeline — A1 Feature
// Vertical timeline on each order showing every event with timestamp.
// Events: created → assigned → picked → decanted → packed → QC'd → shipped
// Shows operator name and station at each node.
// ============================================================

import { useMemo } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShoppingCart, ClipboardList, ScanBarcode, FlaskConical,
  Package, CheckSquare, Truck, Clock, User, MapPin,
  ArrowRight, Circle, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';

// ---- Timeline Event Types ----
interface TimelineEvent {
  id: string;
  status: string;
  label: string;
  description: string;
  timestamp: string | null;
  operator?: string;
  station?: string;
  icon: React.ElementType;
  state: 'completed' | 'current' | 'pending';
}

// Status pipeline definition
const STATUS_PIPELINE: { status: string; label: string; icon: React.ElementType; station?: string }[] = [
  { status: 'created', label: 'Order Created', icon: ShoppingCart, station: 'System' },
  { status: 'new', label: 'Queued', icon: ClipboardList, station: 'Queue' },
  { status: 'processing', label: 'Processing', icon: Loader2, station: 'Queue' },
  { status: 'picked', label: 'Picked', icon: ScanBarcode, station: 'Picking' },
  { status: 'prepped', label: 'Prepped & Labeled', icon: ClipboardList, station: 'Labeling' },
  { status: 'decanted', label: 'Decanted', icon: FlaskConical, station: 'Decanting' },
  { status: 'packed', label: 'Packed & QC Passed', icon: Package, station: 'QC & Assembly' },
  { status: 'shipped', label: 'Shipped', icon: Truck, station: 'Shipping' },
];

function generateTimelineEvents(order: Order): TimelineEvent[] {
  const currentStatusIndex = STATUS_PIPELINE.findIndex(s => s.status === order.status);
  const createdAt = new Date(order.created_at);
  const updatedAt = new Date(order.updated_at);

  return STATUS_PIPELINE.map((step, idx) => {
    let state: 'completed' | 'current' | 'pending' = 'pending';
    let timestamp: string | null = null;
    let operator: string | undefined;

    if (idx === 0) {
      // Created is always completed
      state = 'completed';
      timestamp = createdAt.toISOString();
      operator = 'System';
    } else if (idx < currentStatusIndex) {
      state = 'completed';
      // Interpolate timestamps between created and updated
      const fraction = idx / Math.max(currentStatusIndex, 1);
      const interpolated = new Date(createdAt.getTime() + fraction * (updatedAt.getTime() - createdAt.getTime()));
      timestamp = interpolated.toISOString();
      operator = 'Karim';
    } else if (idx === currentStatusIndex) {
      state = idx === 0 ? 'completed' : 'current';
      timestamp = updatedAt.toISOString();
      operator = 'Karim';
    } else {
      state = 'pending';
    }

    return {
      id: `${order.order_id}-${step.status}`,
      status: step.status,
      label: step.label,
      description: getStepDescription(step.status, order),
      timestamp,
      operator,
      station: step.station,
      icon: step.icon,
      state,
    };
  });
}

function getStepDescription(status: string, order: Order): string {
  switch (status) {
    case 'created': return `Order placed by ${order.customer.name} — ${order.items.length} item(s), AED ${order.total_amount}`;
    case 'new': return 'Order queued in job board, awaiting batch assignment';
    case 'processing': return 'Order assigned to current batch, processing started';
    case 'picked': return `${order.items.length} item(s) picked from vault locations`;
    case 'prepped': return 'Labels printed and applied, inserts prepared';
    case 'decanted': return `Decanting completed — ${order.items.filter(i => i.type === 'decant').length} decant(s)`;
    case 'packed': return 'Box packed, QC verification passed, shipping label applied';
    case 'shipped': return 'Package handed to courier for delivery';
    default: return '';
  }
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ---- Priority Flag Badge ----
export type PriorityFlag = 'rush' | 'vip' | 'fragile' | 'gift';

const PRIORITY_CONFIG: Record<PriorityFlag, { label: string; color: string; bg: string }> = {
  rush: { label: 'Rush', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-950/40 border-red-200 dark:border-red-800' },
  vip: { label: 'VIP', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
  fragile: { label: 'Fragile', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
  gift: { label: 'Gift', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-950/40 border-pink-200 dark:border-pink-800' },
};

export function PriorityBadge({ flag }: { flag: PriorityFlag }) {
  const config = PRIORITY_CONFIG[flag];
  return (
    <span className={cn('inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', config.color, config.bg)}>
      {config.label}
    </span>
  );
}

export function PriorityBadges({ flags }: { flags: PriorityFlag[] }) {
  if (!flags.length) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {flags.map(f => <PriorityBadge key={f} flag={f} />)}
    </div>
  );
}

// Derive priority flags from order tags/notes
export function derivePriorityFlags(order: Order): PriorityFlag[] {
  const flags: PriorityFlag[] = [];
  const tags = order.tags?.map(t => t.toLowerCase()) || [];
  const notes = (order.notes || '').toLowerCase();

  if (tags.includes('priority') || tags.includes('rush') || tags.includes('express') || notes.includes('rush') || notes.includes('urgent')) {
    flags.push('rush');
  }
  if (tags.includes('vip') || notes.includes('vip')) {
    flags.push('vip');
  }
  if (tags.includes('fragile') || notes.includes('fragile')) {
    flags.push('fragile');
  }
  if (notes.includes('gift') || notes.includes('wrapping') || tags.includes('gift')) {
    flags.push('gift');
  }
  return flags;
}

// ---- Order Timeline Sheet ----
interface OrderTimelineProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

export default function OrderTimeline({ order, open, onClose }: OrderTimelineProps) {
  const events = useMemo(() => order ? generateTimelineEvents(order) : [], [order]);
  const flags = useMemo(() => order ? derivePriorityFlags(order) : [], [order]);

  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[440px] sm:w-[500px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg font-semibold">{order.order_id}</SheetTitle>
            <PriorityBadges flags={flags} />
          </div>
          <SheetDescription className="text-sm text-muted-foreground">
            {order.customer.name} · {order.items.length} item(s) · AED {order.total_amount}
          </SheetDescription>
        </SheetHeader>

        {/* Order Summary */}
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Customer</span>
              <p className="font-medium">{order.customer.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Location</span>
              <p className="font-medium">{order.customer.city}, {order.customer.country}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium capitalize">{order.type.replace('_', ' ')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Items</span>
              <p className="font-medium">{order.items.map(i => `${i.perfume_name} ${i.size_ml}ml`).join(', ')}</p>
            </div>
          </div>
          {order.notes && (
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300">
              <strong>Note:</strong> {order.notes}
            </div>
          )}
        </div>

        {/* Timeline */}
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="px-6 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Order Timeline</h3>
            <div className="relative">
              {events.map((event, idx) => {
                const Icon = event.icon;
                const isLast = idx === events.length - 1;
                return (
                  <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* Vertical line */}
                    {!isLast && (
                      <div className={cn(
                        'absolute left-[15px] top-8 w-0.5 h-[calc(100%-16px)]',
                        event.state === 'completed' ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border',
                      )} />
                    )}

                    {/* Icon node */}
                    <div className={cn(
                      'relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors',
                      event.state === 'completed' && 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-600',
                      event.state === 'current' && 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/20',
                      event.state === 'pending' && 'bg-muted border-border',
                    )}>
                      {event.state === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : event.state === 'current' ? (
                        <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn(
                          'text-sm font-medium',
                          event.state === 'pending' && 'text-muted-foreground/60',
                        )}>
                          {event.label}
                        </span>
                        {event.state === 'current' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-0">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className={cn(
                        'text-xs leading-relaxed',
                        event.state === 'pending' ? 'text-muted-foreground/40' : 'text-muted-foreground',
                      )}>
                        {event.description}
                      </p>
                      {event.timestamp && (
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/60">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(event.timestamp)}
                          </span>
                          {event.station && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.station}
                            </span>
                          )}
                          {event.operator && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {event.operator}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
