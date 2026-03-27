// ============================================================
// Orders — Unified orders page with three sub-tabs:
// 1) One-Time Orders (with cut-off batches)
// 2) Full Bottles Requested (batch PO creation)
// 3) Subscription First Order (first-time subscriber orders)
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  ShoppingCart, Search, Eye, User, MapPin, Calendar,
  Package, X, Loader2, Clock, ChevronDown, ChevronRight,
  Layers, Filter, CalendarDays, Wine, ShoppingBag, Plus,
  Check, AlertCircle, ExternalLink, Users, Crown, Sparkles, Star, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Order, Supplier, Perfume } from '@/types';

const ORDER_STATUSES = ['new', 'processing', 'picked', 'prepped', 'decanted', 'packed', 'shipped', 'cancelled'] as const;

// ---- Inline Status Select ----
function InlineStatusSelect({
  orderId, currentStatus, statuses,
}: {
  orderId: string; currentStatus: string; statuses: string[];
}) {
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState(currentStatus);

  const handleChange = async (newStatus: string) => {
    if (newStatus === status) return;
    setUpdating(true);
    try {
      await api.mutations.orders.update(orderId, { status: newStatus });
      setStatus(newStatus);
      toast.success(`Order ${orderId} → ${newStatus}`);
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
          status === 'new' && 'bg-gold/15 text-gold border-gold/30',
          status === 'processing' && 'bg-blue-500/15 text-blue-500 border-blue-500/30',
          status === 'picked' && 'bg-blue-500/15 text-blue-500 border-blue-500/30',
          status === 'prepped' && 'bg-blue-500/15 text-blue-500 border-blue-500/30',
          status === 'decanted' && 'bg-blue-500/15 text-blue-500 border-blue-500/30',
          status === 'packed' && 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
          status === 'shipped' && 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
          status === 'cancelled' && 'bg-destructive/15 text-destructive border-destructive/30',
          updating && 'opacity-50',
        )}
      >
        {statuses.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {updating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
    </div>
  );
}

// ---- Cut-off Batch Grouping Helper ----
interface CutoffBatch {
  label: string;
  dateKey: string;
  cutoffStart: string;
  cutoffEnd: string;
  packDate: string;
  deliveryDate: string;
  orders: Order[];
}

function groupOrdersIntoBatches(
  orders: Order[],
  cutoffStart: string,
  cutoffEnd: string,
  packLeadDays: number,
  deliveryLeadDays: number,
): CutoffBatch[] {
  const batchMap = new Map<string, CutoffBatch>();

  for (const order of orders) {
    const created = new Date(order.created_at);
    const hours = created.getHours();
    const minutes = created.getMinutes();
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    let batchDate: Date;
    if (timeStr >= cutoffStart && timeStr < cutoffEnd) {
      batchDate = new Date(created);
    } else if (timeStr >= cutoffEnd) {
      batchDate = new Date(created);
      batchDate.setDate(batchDate.getDate() + 1);
    } else {
      batchDate = new Date(created);
    }

    const dateKey = batchDate.toISOString().slice(0, 10);

    if (!batchMap.has(dateKey)) {
      const packD = new Date(batchDate);
      packD.setDate(packD.getDate() + packLeadDays);
      const delivD = new Date(batchDate);
      delivD.setDate(delivD.getDate() + deliveryLeadDays);

      batchMap.set(dateKey, {
        label: batchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
        dateKey,
        cutoffStart,
        cutoffEnd,
        packDate: packD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        deliveryDate: delivD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        orders: [],
      });
    }
    batchMap.get(dateKey)!.orders.push(order);
  }

  return Array.from(batchMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

// ---- Full Bottle Item (extracted from orders) ----
interface FullBottleItem {
  orderId: string;
  customerName: string;
  itemId: string;
  masterId: string;
  perfumeName: string;
  sizeMl: number;
  qty: number;
  unitPrice: number;
  orderCreatedAt: string;
}

interface FullBottleBatch {
  label: string;
  dateKey: string;
  items: FullBottleItem[];
  totalBottles: number;
  poCreated?: boolean;
  poId?: string;
}

function extractFullBottleBatches(
  orders: Order[],
  cutoffStart: string,
  cutoffEnd: string,
): FullBottleBatch[] {
  const batchMap = new Map<string, FullBottleBatch>();

  for (const order of orders) {
    const fullBottleItems = order.items.filter(i => i.type === 'sealed_bottle');
    if (fullBottleItems.length === 0) continue;

    const created = new Date(order.created_at);
    const hours = created.getHours();
    const minutes = created.getMinutes();
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    let batchDate: Date;
    if (timeStr >= cutoffStart && timeStr < cutoffEnd) {
      batchDate = new Date(created);
    } else if (timeStr >= cutoffEnd) {
      batchDate = new Date(created);
      batchDate.setDate(batchDate.getDate() + 1);
    } else {
      batchDate = new Date(created);
    }

    const dateKey = batchDate.toISOString().slice(0, 10);

    if (!batchMap.has(dateKey)) {
      batchMap.set(dateKey, {
        label: batchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
        dateKey,
        items: [],
        totalBottles: 0,
      });
    }

    const batch = batchMap.get(dateKey)!;
    for (const item of fullBottleItems) {
      batch.items.push({
        orderId: order.order_id,
        customerName: order.customer.name,
        itemId: item.item_id,
        masterId: item.master_id,
        perfumeName: item.perfume_name,
        sizeMl: item.size_ml,
        qty: item.qty,
        unitPrice: item.unit_price,
        orderCreatedAt: order.created_at,
      });
      batch.totalBottles += item.qty;
    }
  }

  return Array.from(batchMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

// ---- Main Component ----
export default function OneTimeOrders() {
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const allOneTimeOrders = ((ordersRes?.data || []) as Order[]).filter(o => o.type === 'one_time');
  const allSubOrders = ((ordersRes?.data || []) as Order[]).filter(o => o.type === 'subscription');
  // First-time subscriber orders
  const firstTimeSubOrders = useMemo(() => {
    const ft = allSubOrders.filter((o: any) => o.isFirstSubscriber || o.is_first_subscriber);
    return ft.length > 0 ? ft : allSubOrders; // fallback: show all sub orders if none flagged
  }, [allSubOrders]);
  // Backward compat alias
  const allOrders = allOneTimeOrders;

  // Settings
  const [cutoffStart, setCutoffStart] = useState('09:00');
  const [cutoffEnd, setCutoffEnd] = useState('21:00');
  const [packLeadDays, setPackLeadDays] = useState(1);
  const [deliveryLeadDays, setDeliveryLeadDays] = useState(2);

  useEffect(() => {
    (async () => {
      try {
        const settings = await api.settings.list();
        const map = new Map((settings as any[]).map((s: any) => [s.key, s.value]));
        if (map.has('cutoff_start')) setCutoffStart(map.get('cutoff_start')!);
        if (map.has('cutoff_end')) setCutoffEnd(map.get('cutoff_end')!);
        if (map.has('pack_lead_days')) setPackLeadDays(parseInt(map.get('pack_lead_days')!) || 1);
        if (map.has('delivery_lead_days')) setDeliveryLeadDays(parseInt(map.get('delivery_lead_days')!) || 2);
      } catch (e) { /* use defaults */ }
    })();
  }, []);

  // Tab: "orders" | "sub_first_order" | "sub_recurring"
  const [activeTab, setActiveTab] = useState<'orders' | 'sub_first_order' | 'sub_recurring'>('orders');

  // Recurring subscription orders (non-first-time)
  const recurringSubOrders = useMemo(() => {
    return allSubOrders.filter((o: any) => !o.isFirstSubscriber && !o.is_first_subscriber);
  }, [allSubOrders]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'batches'>('list');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    return allOrders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!`${o.order_id} ${o.customer.name} ${o.customer.email} ${o.shopify_id || ''}`.toLowerCase().includes(q)) return false;
      }
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(o.created_at) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(o.created_at) > to) return false;
      }
      return true;
    });
  }, [allOrders, statusFilter, searchQuery, dateFrom, dateTo]);

  const batches = useMemo(() => {
    return groupOrdersIntoBatches(filtered, cutoffStart, cutoffEnd, packLeadDays, deliveryLeadDays);
  }, [filtered, cutoffStart, cutoffEnd, packLeadDays, deliveryLeadDays]);

  // Full bottle batches
  const fullBottleBatches = useMemo(() => {
    return extractFullBottleBatches(allOrders, cutoffStart, cutoffEnd);
  }, [allOrders, cutoffStart, cutoffEnd]);

  const totalFullBottles = fullBottleBatches.reduce((s, b) => s + b.totalBottles, 0);

  const statuses = ['all', 'new', 'processing', 'picked', 'prepped', 'decanted', 'packed', 'shipped', 'cancelled'];

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allOrders.length };
    for (const o of allOrders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [allOrders]);

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={`${allOneTimeOrders.length} one-time · ${firstTimeSubOrders.length} first-time sub · ${recurringSubOrders.length} recurring sub`}
        breadcrumbs={[{ label: 'Orders & CX' }, { label: 'Orders' }]}
        actions={
          activeTab === 'orders' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted rounded-md p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  List View
                </button>
                <button
                  onClick={() => setViewMode('batches')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    viewMode === 'batches' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  <Layers className="w-3 h-3 inline mr-1" />
                  Batch View
                </button>
              </div>
            </div>
          ) : undefined
        }
      />

      <div className="p-6 space-y-4">
        {/* Sub-tab Toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('orders')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'orders'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            All Orders
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{allOrders.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('sub_first_order')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'sub_first_order'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Users className="w-4 h-4" />
            Sub First Order
            {firstTimeSubOrders.length > 0 && (
              <span className="text-xs font-mono bg-purple-500/20 text-purple-600 px-1.5 py-0.5 rounded">{firstTimeSubOrders.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sub_recurring')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === 'sub_recurring'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <RotateCcw className="w-4 h-4" />
            Sub Recurring
            {recurringSubOrders.length > 0 && (
              <span className="text-xs font-mono bg-violet-500/20 text-violet-600 px-1.5 py-0.5 rounded">{recurringSubOrders.length}</span>
            )}
          </button>
        </div>

        {activeTab === 'orders' ? (
          <>
            {/* Cut-off Info Bar */}
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border border-border">
              <Clock className="w-4 h-4 text-gold shrink-0" />
              <div className="text-sm">
                <span className="text-muted-foreground">Daily cut-off window:</span>{' '}
                <span className="font-mono font-semibold text-gold">{cutoffStart}</span>
                <span className="text-muted-foreground"> – </span>
                <span className="font-mono font-semibold text-gold">{cutoffEnd}</span>
                <span className="text-muted-foreground ml-3">Pack: +{packLeadDays}d</span>
                <span className="text-muted-foreground ml-2">Deliver: +{deliveryLeadDays}d</span>
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by order ID, customer name, email, Shopify ID..."
                    className="w-full h-9 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
                  />
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="w-3.5 h-3.5" />
                  {showFilters ? 'Hide Filters' : 'More Filters'}
                </Button>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 flex-wrap">
                {statuses.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                      statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {s}
                    {statusCounts[s] ? <span className="ml-1 opacity-70">({statusCounts[s]})</span> : null}
                  </button>
                ))}
              </div>

              {/* Extended Filters */}
              {showFilters && (
                <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/20 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    <label className="text-xs text-muted-foreground">From:</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="h-8 px-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">To:</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="h-8 px-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                  </div>
                  {(dateFrom || dateTo) && (
                    <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                      Clear Dates
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Content: List or Batch View */}
            {viewMode === 'list' ? (
              <OrderTable orders={filtered} onSelect={setSelectedOrder} />
            ) : (
              <BatchView batches={batches} onSelectOrder={setSelectedOrder} />
            )}
          </>
        ) : activeTab === 'sub_first_order' ? (
          <SubscriptionFirstOrderTab orders={firstTimeSubOrders} onSelect={setSelectedOrder} />
        ) : (
          /* Sub Recurring Tab */
          <SubscriptionRecurringTab orders={recurringSubOrders} onSelect={setSelectedOrder} />
        )}

        {/* Order Detail Drawer */}
        {selectedOrder && (
          <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
        )}
      </div>
    </div>
  );
}

// ---- Order Table ----
function OrderTable({ orders, onSelect }: { orders: Order[]; onSelect: (o: Order) => void }) {
  if (orders.length === 0) {
    return (
      <SectionCard title="">
        <EmptyState
          icon={ShoppingCart}
          title="No orders found"
          description="Adjust your filters or wait for new orders to arrive."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="" className="overflow-hidden">
      <div className="overflow-x-auto -m-4">
        <table className="w-full ops-table">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Order ID</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Customer</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Items</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Total</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Date</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.order_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-sm font-mono font-medium">{o.order_id}</td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{o.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{o.customer.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono">{o.items.length}</td>
                <td className="px-4 py-3 text-sm font-mono font-semibold">AED {o.total_amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <InlineStatusSelect
                    orderId={o.order_id}
                    currentStatus={o.status}
                    statuses={ORDER_STATUSES as unknown as string[]}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  <span className="ml-1 font-mono">{new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" onClick={() => onSelect(o)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ---- Batch View ----
function BatchView({ batches, onSelectOrder }: { batches: CutoffBatch[]; onSelectOrder: (o: Order) => void }) {
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set(batches.slice(0, 2).map(b => b.dateKey)));

  const toggleBatch = (key: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (batches.length === 0) {
    return (
      <SectionCard title="">
        <EmptyState
          icon={Layers}
          title="No batches"
          description="No orders match the current filters."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map(batch => {
        const isExpanded = expandedBatches.has(batch.dateKey);
        const totalAmount = batch.orders.reduce((sum, o) => sum + o.total_amount, 0);
        const statusCounts: Record<string, number> = {};
        batch.orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

        return (
          <div key={batch.dateKey} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleBatch(batch.dateKey)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gold" />
                    <span className="text-sm font-semibold">{batch.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">({batch.cutoffStart}–{batch.cutoffEnd})</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span><Package className="w-3 h-3 inline mr-0.5" /> Pack: {batch.packDate}</span>
                    <span>🚚 Deliver: {batch.deliveryDate}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {Object.entries(statusCounts).map(([s, c]) => (
                    <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted capitalize">
                      {s}: {c}
                    </span>
                  ))}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{batch.orders.length} orders</p>
                  <p className="text-xs font-mono text-muted-foreground">AED {totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="overflow-x-auto">
                <table className="w-full ops-table">
                  <thead>
                    <tr className="border-t border-b border-border bg-background">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Order ID</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Customer</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Items</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Total</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Status</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Time</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.orders.map(o => (
                      <tr key={o.order_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-sm font-mono font-medium">{o.order_id}</td>
                        <td className="px-4 py-2.5">
                          <p className="text-sm font-medium">{o.customer.name}</p>
                          <p className="text-xs text-muted-foreground">{o.customer.email}</p>
                        </td>
                        <td className="px-4 py-2.5 text-sm font-mono">{o.items.length}</td>
                        <td className="px-4 py-2.5 text-sm font-mono font-semibold">AED {o.total_amount.toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          <InlineStatusSelect
                            orderId={o.order_id}
                            currentStatus={o.status}
                            statuses={ORDER_STATUSES as unknown as string[]}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                          {new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2.5">
                          <Button size="sm" variant="ghost" onClick={() => onSelectOrder(o)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Full Bottles Tab ----
function FullBottlesTab({ batches }: { batches: FullBottleBatch[] }) {
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set(batches.slice(0, 2).map(b => b.dateKey)));
  const [showCreatePO, setShowCreatePO] = useState<string | null>(null);

  const toggleBatch = (key: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (batches.length === 0) {
    return (
      <SectionCard title="">
        <EmptyState
          icon={Wine}
          title="No full bottle requests"
          description="No orders contain full bottle (sealed_bottle) items yet."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 p-3 bg-gold/5 rounded-lg border border-gold/20">
        <Wine className="w-4 h-4 text-gold shrink-0" />
        <div className="text-sm">
          <span className="font-semibold text-gold">{batches.reduce((s, b) => s + b.totalBottles, 0)}</span>
          <span className="text-muted-foreground"> full bottles requested across </span>
          <span className="font-semibold">{batches.length}</span>
          <span className="text-muted-foreground"> batch(es)</span>
        </div>
      </div>

      {/* Batch Cards */}
      {batches.map(batch => {
        const isExpanded = expandedBatches.has(batch.dateKey);

        // Aggregate items by perfume+size for the summary
        const aggregated = new Map<string, { perfumeName: string; sizeMl: number; totalQty: number; masterId: string }>();
        for (const item of batch.items) {
          const key = `${item.masterId}-${item.sizeMl}`;
          if (!aggregated.has(key)) {
            aggregated.set(key, { perfumeName: item.perfumeName, sizeMl: item.sizeMl, totalQty: 0, masterId: item.masterId });
          }
          aggregated.get(key)!.totalQty += item.qty;
        }

        return (
          <div key={batch.dateKey} className="border border-border rounded-lg overflow-hidden">
            {/* Batch Header */}
            <button
              onClick={() => toggleBatch(batch.dateKey)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gold" />
                    <span className="text-sm font-semibold">{batch.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {Array.from(aggregated.values()).map(a => (
                      <span key={`${a.masterId}-${a.sizeMl}`} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">
                        {a.perfumeName} {a.sizeMl}ml ×{a.totalQty}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold">{batch.totalBottles} bottles</p>
                  <p className="text-xs text-muted-foreground">{batch.items.length} line items</p>
                </div>
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-border">
                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full ops-table">
                    <thead>
                      <tr className="bg-background border-b border-border">
                        <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Perfume</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Size</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Qty</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Customer</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Order</th>
                        <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2">Unit Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.items.map((item, idx) => (
                        <tr key={`${item.itemId}-${idx}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Wine className="w-3.5 h-3.5 text-gold" />
                              <span className="text-sm font-medium">{item.perfumeName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-sm font-mono">{item.sizeMl}ml</td>
                          <td className="px-4 py-2.5 text-sm font-mono font-semibold">{item.qty}</td>
                          <td className="px-4 py-2.5 text-sm">{item.customerName}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{item.orderId}</td>
                          <td className="px-4 py-2.5 text-sm font-mono">AED {item.unitPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Aggregated Summary + Create PO */}
                <div className="p-4 bg-muted/20 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Purchase Summary</h4>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(aggregated.values()).map(a => (
                          <div key={`${a.masterId}-${a.sizeMl}`} className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border border-border">
                            <Wine className="w-3 h-3 text-gold" />
                            <span className="text-sm font-medium">{a.perfumeName}</span>
                            <span className="text-xs font-mono text-muted-foreground">{a.sizeMl}ml</span>
                            <span className="text-sm font-mono font-semibold">×{a.totalQty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                      onClick={(e) => { e.stopPropagation(); setShowCreatePO(batch.dateKey); }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create PO
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Create PO Dialog */}
      {showCreatePO && (
        <CreateFullBottlePODialog
          batch={batches.find(b => b.dateKey === showCreatePO)!}
          onClose={() => setShowCreatePO(null)}
        />
      )}
    </div>
  );
}

// ---- Create Full Bottle PO Dialog ----
function CreateFullBottlePODialog({ batch, onClose }: { batch: FullBottleBatch; onClose: () => void }) {
  const { data: suppliersRes } = useApiQuery(() => api.master.suppliers(), []);
  const suppliers = (suppliersRes?.data || []) as Supplier[];

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [notes, setNotes] = useState(`Full bottle PO for batch ${batch.label}`);

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()),
  );

  // Aggregate items by perfume+size
  const aggregated = useMemo(() => {
    const map = new Map<string, { perfumeName: string; sizeMl: number; totalQty: number; masterId: string }>();
    for (const item of batch.items) {
      const key = `${item.masterId}-${item.sizeMl}`;
      if (!map.has(key)) {
        map.set(key, { perfumeName: item.perfumeName, sizeMl: item.sizeMl, totalQty: 0, masterId: item.masterId });
      }
      map.get(key)!.totalQty += item.qty;
    }
    return Array.from(map.values());
  }, [batch.items]);

  const handleCreate = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    setCreating(true);
    try {
      const nextNum = await api.purchaseOrders.nextNumber();
      const poId = `PO-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

      await api.mutations.purchaseOrders.create({
        poId,
        supplierId: selectedSupplier.supplier_id,
        supplierName: selectedSupplier.name,
        status: 'pending_quote',
        currency: 'AED',
        notes,
        items: aggregated.map(a => ({
          masterId: a.masterId,
          perfumeName: a.perfumeName,
          brand: '',
          sizeMl: a.sizeMl,
          qty: a.totalQty,
          bottleType: 'sealed',
        })),
      });

      toast.success(`Purchase order ${poId} created for ${aggregated.length} perfume(s)`);
      onClose();
    } catch (err: any) {
      toast.error(`Failed to create PO: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Create Full Bottle PO</h2>
                <p className="text-sm text-muted-foreground">Batch: {batch.label}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Items Summary */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Items to Order</h3>
              <div className="space-y-2">
                {aggregated.map(a => (
                  <div key={`${a.masterId}-${a.sizeMl}`} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border">
                    <div className="flex items-center gap-3">
                      <Wine className="w-4 h-4 text-gold" />
                      <div>
                        <p className="text-sm font-medium">{a.perfumeName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{a.masterId} · {a.sizeMl}ml · Sealed</p>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-semibold">×{a.totalQty}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier Selection */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Select Supplier</h3>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                  placeholder="Search suppliers..."
                  className="w-full h-9 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-md p-1">
                {filteredSuppliers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No suppliers found</p>
                ) : (
                  filteredSuppliers.map(s => (
                    <button
                      key={s.supplier_id}
                      onClick={() => setSelectedSupplier(s)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        selectedSupplier?.supplier_id === s.supplier_id
                          ? 'bg-gold/15 text-gold border border-gold/30'
                          : 'hover:bg-muted',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.contact_name || s.contact_email || 'No contact'}</p>
                        </div>
                        {selectedSupplier?.supplier_id === s.supplier_id && (
                          <Check className="w-4 h-4 text-gold" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Notes</h3>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !selectedSupplier}
                className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                Create Purchase Order
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---- Subscription First Order Tab ----
const SUBSCRIPTION_TIERS = ['Grand Master 1', 'Grand Master 2', 'Grand Master 3', 'Grand Master 4'] as const;
const TIER_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  'Grand Master 1': { color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20', icon: Crown },
  'Grand Master 2': { color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/20', icon: Crown },
  'Grand Master 3': { color: 'text-gold', bg: 'bg-gold/10 border-gold/20', icon: Crown },
  'Grand Master 4': { color: 'text-rose-600', bg: 'bg-rose-500/10 border-rose-500/20', icon: Crown },
};

function SubscriptionFirstOrderTab({ orders, onSelect }: { orders: Order[]; onSelect: (o: Order) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (tierFilter !== 'all') {
        const tier = (o as any).subscriptionTier || (o as any).subscription_tier || 'Grand Master 1';
        if (tier !== tierFilter) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!`${o.order_id} ${o.customer.name} ${o.customer.email}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [orders, tierFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
        <div className="flex items-start gap-2">
          <Users className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-400">Subscription First Orders</p>
            <p className="text-xs text-purple-600 dark:text-purple-500 mt-0.5">
              Initial orders from new subscribers. These follow the same fulfillment flow as one-time orders.
              Once fulfilled, the subscriber enters the regular subscription cycle.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SUBSCRIPTION_TIERS.map(tier => {
          const count = orders.filter((o: any) => (o.subscriptionTier || o.subscription_tier || 'Grand Master 1') === tier).length;
          const style = TIER_STYLES[tier];
          const Icon = style.icon;
          return (
            <div key={tier} className={cn('p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all', style.bg, tierFilter === tier && 'ring-2 ring-current')}
              onClick={() => setTierFilter(tierFilter === tier ? 'all' : tier)}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('w-4 h-4', style.color)} />
                <span className={cn('text-sm font-semibold', style.color)}>{tier}</span>
              </div>
              <p className="text-2xl font-semibold">{count}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">subscribers</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by order ID, name, or email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm"
        />
      </div>

      {/* Orders Table */}
      <SectionCard title={`First-Time Subscription Orders (${filtered.length})`} className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No first-time subscription orders"
            description="New subscription orders will appear here when customers subscribe for the first time."
          />
        ) : (
          <div className="overflow-x-auto -m-4">
            <table className="w-full ops-table">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Order ID</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Customer</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Tier</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Items</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Date</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const tier = (order as any).subscriptionTier || (order as any).subscription_tier || 'Grand Master 1';
                  const style = TIER_STYLES[tier] || TIER_STYLES['Grand Master 1'];
                  const Icon = style.icon;
                  return (
                    <tr key={order.order_id} className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onSelect(order)}>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-medium">{order.order_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{order.customer.name}</div>
                        <div className="text-[10px] text-muted-foreground">{order.customer.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md', style.bg, style.color)}>
                          <Icon className="w-3 h-3" /> {tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{order.items.length} items</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge>{order.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ---- Subscription Recurring Tab ----
function SubscriptionRecurringTab({ orders, onSelect }: { orders: Order[]; onSelect: (o: Order) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!`${o.order_id} ${o.customer.name} ${o.customer.email}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const o of orders) counts[o.status] = (counts[o.status] || 0) + 1;
    return counts;
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
        <div className="flex items-start gap-2">
          <RotateCcw className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Subscription Recurring Orders</p>
            <p className="text-xs text-violet-600 dark:text-violet-500 mt-0.5">
              Recurring subscription orders from active subscribers. These are generated each cycle and follow the subscription fulfillment pipeline.
            </p>
          </div>
        </div>
      </div>

      {/* Status Filters + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', 'new', 'processing', 'packed', 'shipped'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors capitalize',
                statusFilter === s
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/30',
              )}
            >
              {s === 'all' ? 'All' : s} {statusCounts[s] ? `(${statusCounts[s]})` : ''}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order ID, name, or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {/* Orders Table */}
      <SectionCard title={`Recurring Subscription Orders (${filtered.length})`} className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="No recurring subscription orders"
            description="Recurring orders from active subscribers will appear here each cycle."
          />
        ) : (
          <div className="overflow-x-auto -m-4">
            <table className="w-full ops-table">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Order ID</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Customer</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Cycle</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Items</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Date</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr key={order.order_id} className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onSelect(order)}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-medium">{order.order_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{order.customer.name}</div>
                      <div className="text-[10px] text-muted-foreground">{order.customer.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-violet-600 dark:text-violet-400">
                        {(order as any).cycle_id || 'Current'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{order.items.length} items</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge>{order.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ---- Order Detail Drawer ----
function OrderDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-card border-l border-border z-50 overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-mono">{order.order_id}</h2>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <InlineStatusSelect
            orderId={order.order_id}
            currentStatus={order.status}
            statuses={ORDER_STATUSES as unknown as string[]}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{order.customer.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{order.customer.address}, {order.customer.city}, {order.customer.country}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="font-mono">{new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Items</h3>
            <div className="space-y-2">
              {order.items.map(item => (
                <div key={item.item_id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded flex items-center justify-center text-xs font-mono font-bold',
                      item.type === 'sealed_bottle' ? 'bg-gold/20 text-gold' : 'bg-muted',
                    )}>
                      {item.size_ml}ml
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.perfume_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {item.type === 'sealed_bottle' ? '🍾 Full Bottle' : 'Decant'} · ×{item.qty}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-mono">AED {item.unit_price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold font-mono text-lg">AED {order.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="border-t border-border pt-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Notes</h3>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
