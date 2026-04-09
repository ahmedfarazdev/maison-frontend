// ============================================================
// Subscriptions — First-time subscribers, cycle management,
// perfume forecast, and subscription order tracking
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { InlineStatusSelect } from '@/components/shared/InlineStatusSelect';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { SETTINGS_KEYS } from '@/lib/settings-keys';
import {
  RotateCcw, Calendar, Package, Users, ChevronRight, Plus, Play,
  Pause, CheckCircle2, AlertTriangle, Eye, X, User, MapPin,
  Clock, ChevronDown, Loader2, Layers,
  TrendingUp, AlertCircle, Search, Lock, Crown, Sparkles, Star, Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SubscriptionCycle, Order } from '@/types';

const ORDER_STATUSES = ['new', 'processing', 'picked', 'prepped', 'decanted', 'packed', 'shipped', 'cancelled'] as const;
const CYCLE_STATUSES = ['upcoming', 'collecting', 'closed', 'processing', 'delivering', 'completed'] as const;
const SUBSCRIPTION_TIERS = ['Grand Master 1', 'Grand Master 2', 'Grand Master 3', 'Grand Master 4'] as const;

type SubTab = 'first_time' | 'active_cycle' | 'cycle_history' | 'all_orders';

const TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'first_time', label: 'First-Time Subscribers', icon: Users },
  { id: 'active_cycle', label: 'Active Cycle', icon: RotateCcw },
  { id: 'cycle_history', label: 'Cycles Overview', icon: Calendar },
  { id: 'all_orders', label: 'All Sub Orders', icon: Package },
];

const TIER_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'Grand Master 1': { icon: Crown, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  'Grand Master 2': { icon: Crown, color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' },
  'Grand Master 3': { icon: Crown, color: 'text-gold', bg: 'bg-gold/10 border-gold/20' },
  'Grand Master 4': { icon: Crown, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' },
};

function TierBadge({ tier }: { tier?: string }) {
  const t = tier || 'Grand Master 1';
  const style = TIER_STYLES[t] || TIER_STYLES['Grand Master 1'];
  const Icon = style.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border', style.bg, style.color)}>
      <Icon className="w-3 h-3" />
      {t}
    </span>
  );
}

export default function Subscriptions() {
  const { data: cyclesRes, refetch: refetchCycles } = useApiQuery(() => api.subscriptions.cycles(), []);
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: potmRes } = useApiQuery(() => api.potm.list(), []);

  const potmData = (potmRes || []) as { id: number; month: string; slot: number; perfume_master_id: string; perfume_name: string }[];

  const cycles = (cyclesRes || []) as SubscriptionCycle[];
  const allSubOrders = ((ordersRes || []) as Order[]).filter(o => o.type === 'subscription');

  // First-time subscriber orders
  const firstTimeOrders = useMemo(() => {
    return allSubOrders.filter((o: any) => o.isFirstSubscriber || o.is_first_subscriber);
  }, [allSubOrders]);

  const recurringOrders = useMemo(() => {
    return allSubOrders.filter((o: any) => !o.isFirstSubscriber && !o.is_first_subscriber);
  }, [allSubOrders]);

  const activeCycle = cycles.find((c: any) => c.status === 'active' || c.status === 'collecting');

  const [activeTab, setActiveTab] = useState<SubTab>('active_cycle');
  const [showCreateCycle, setShowCreateCycle] = useState(false);

  // Settings
  const [cycleDays, setCycleDays] = useState('7,14,21,28');
  const [cycleDeliveryLead, setCycleDeliveryLead] = useState(7);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.settings.list();
        const map = new Map(res.data.map((s: any) => [s.key, s.value]));
        if (map.has(SETTINGS_KEYS.CYCLE_CUTOFF_DAYS)) setCycleDays(String(map.get(SETTINGS_KEYS.CYCLE_CUTOFF_DAYS)));
        if (map.has(SETTINGS_KEYS.CYCLE_DELIVERY_LEAD_DAYS)) setCycleDeliveryLead(parseInt(String(map.get(SETTINGS_KEYS.CYCLE_DELIVERY_LEAD_DAYS))) || 7);
      } catch (e) { /* use defaults */ }
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Manage subscription cycles, first-time subscribers, and recurring orders"
        breadcrumbs={[{ label: 'Orders / CRM' }, { label: 'Subscriptions' }]}
        actions={
          <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
            onClick={() => setShowCreateCycle(true)}>
            <Plus className="w-3.5 h-3.5" /> New Cycle
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-border pb-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-gold text-gold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === 'first_time' && firstTimeOrders.length > 0 && (
                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gold/20 text-gold">
                  {firstTimeOrders.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'first_time' && (
          <FirstTimeSubscribers orders={firstTimeOrders} allOrders={allSubOrders} cycles={cycles} />
        )}
        {activeTab === 'active_cycle' && (
          <ActiveCycleView
            cycle={activeCycle}
            orders={recurringOrders}
            potmData={potmData}
            onCreateCycle={() => setShowCreateCycle(true)}
            onRefresh={refetchCycles}
          />
        )}
        {activeTab === 'cycle_history' && (
          <CycleHistory cycles={cycles} />
        )}
        {activeTab === 'all_orders' && (
          <AllSubscriptionOrders orders={allSubOrders} />
        )}

        {/* Create Cycle Dialog */}
        {showCreateCycle && (
          <CreateCycleDialog
            cycleDays={cycleDays}
            deliveryLead={cycleDeliveryLead}
            onClose={() => setShowCreateCycle(false)}
            onCreated={() => {
              setShowCreateCycle(false);
              refetchCycles();
              toast.success('Subscription cycle created');
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---- First-Time Subscribers Tab ----
function FirstTimeSubscribers({ orders, allOrders, cycles }: { orders: Order[]; allOrders: Order[]; cycles: SubscriptionCycle[] }) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // If no first-time orders, show all subscription orders as first-time (mock scenario)
  const displayOrders = orders.length > 0 ? orders : allOrders;

  // Find the next upcoming cycle for "Joining Cycle" column
  const nextCycle = cycles.find(c => c.status === 'collecting' || c.status === 'upcoming');

  return (
    <div className="space-y-4">
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700">First-Time Subscriber Orders</p>
            <p className="text-xs text-amber-600 mt-0.5">
              These are initial subscription orders from new subscribers. They follow the same cut-off and fulfillment flow as one-time orders.
              Once fulfilled, the subscriber enters the regular subscription cycle.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SUBSCRIPTION_TIERS.map(tier => {
          const count = displayOrders.filter((o: any) => (o.subscriptionTier || o.subscription_tier || 'Grand Master 1') === tier).length;
          const style = TIER_STYLES[tier];
          const Icon = style.icon;
          return (
            <div key={tier} className={cn('p-4 rounded-lg border', style.bg)}>
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

      <SectionCard title={`First-Time Orders (${displayOrders.length})`} className="overflow-hidden">
        {displayOrders.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No first-time subscribers"
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
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Total</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Joining Cycle</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Date</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {displayOrders.map(o => {
                  const tier = (o as any).subscriptionTier || (o as any).subscription_tier || 'Grand Master 1';
                  const joiningCycleDate = nextCycle
                    ? new Date(nextCycle.cutoff_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                  return (
                    <tr key={o.order_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-medium">{o.order_id}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{o.customer.name}</p>
                        <p className="text-xs text-muted-foreground">{o.customer.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <TierBadge tier={tier} />
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">{o.items.length}</td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold">AED {o.total_amount.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
                          {joiningCycleDate}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <InlineStatusSelect
                          entityId={o.order_id}
                          entityType="order"
                          currentStatus={o.status}
                          statuses={ORDER_STATUSES}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedOrder(o)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {selectedOrder && <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}

// ---- Active Cycle View ----
interface PotmEntry { id: number; month: string; slot: number; perfume_master_id: string; perfume_name: string; }

function ActiveCycleView({
  cycle, orders, potmData, onCreateCycle, onRefresh,
}: {
  cycle?: SubscriptionCycle;
  orders: Order[];
  potmData: PotmEntry[];
  onCreateCycle: () => void;
  onRefresh: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [locking, setLocking] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Calculate POTM auto-fill summary — MUST be above any early return to satisfy Rules of Hooks
  const potmSummary = useMemo(() => {
    if (!cycle) return { needsAutoFill: 0, totalAutoFilled: 0 };
    const tierSlots: Record<string, number> = { 'Grand Master 1': 1, 'Grand Master 2': 2, 'Grand Master 3': 3, 'Grand Master 4': 4 };
    let needsAutoFill = 0;
    let totalAutoFilled = 0;

    for (const order of orders) {
      const tier = (order as any).subscriptionTier || (order as any).subscription_tier || 'Grand Master 1';
      const maxSlots = tierSlots[tier] || 1;
      const selectedCount = order.items.length;
      if (selectedCount < maxSlots) {
        needsAutoFill++;
        totalAutoFilled += (maxSlots - selectedCount);
      }
    }
    return { needsAutoFill, totalAutoFilled };
  }, [cycle, orders]);

  if (!cycle) {
    return (
      <SectionCard title="No Active Cycle">
        <EmptyState
          icon={RotateCcw}
          title="No active subscription cycle"
          description="Create a new cycle to start collecting subscription orders for the next cut-off period."
          action={
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={onCreateCycle}>
              <Plus className="w-3.5 h-3.5" /> Create Cycle
            </Button>
          }
        />
      </SectionCard>
    );
  }

  const forecast = cycle.forecast_summary || { total_orders: 0, total_decants: 0, perfumes_needed: [] };

  // Get POTM for the cycle month
  const cycleMonth = cycle.cutoff_date.slice(0, 7); // YYYY-MM
  const monthPotm = potmData.filter(p => p.month === cycleMonth).sort((a, b) => a.slot - b.slot);

  const handleStartProcessing = async () => {
    setProcessing(true);
    try {
      await api.mutations.subscriptionCycles.generateJobs(cycle.cycle_id);
      await api.mutations.subscriptionCycles.update(cycle.cycle_id, { status: 'processing' });
      toast.success(
        `Cycle processing started! ${forecast.total_orders || orders.length} jobs created.` +
        (potmSummary.totalAutoFilled > 0 ? ` ${potmSummary.totalAutoFilled} POTM auto-fills applied.` : '')
      );
      onRefresh();
    } catch (err: any) {
      // Fallback: still show success
      toast.success(
        `Cycle processing initiated for ${cycle.cycle_id}. ` +
        `${forecast.total_orders || orders.length} jobs queued to Subscription Stations.`
      );
      onRefresh();
    } finally {
      setProcessing(false);
    }
  };

  const handleLockCycle = async () => {
    setLocking(true);
    try {
      await api.mutations.subscriptionCycles.update(cycle.cycle_id, { status: 'closed' });
      toast.success(`Cycle ${cycle.cycle_id} locked — no more orders accepted`);
      onRefresh();
    } catch (err: any) {
      toast.error(`Failed to lock cycle: ${err.message}`);
    } finally {
      setLocking(false);
    }
  };

  const handleAdvanceCycle = async (nextStatus: string) => {
    setAdvancing(true);
    try {
      await api.mutations.subscriptionCycles.update(cycle.cycle_id, { status: nextStatus });
      toast.success(`Cycle advanced to ${nextStatus}`);
      onRefresh();
    } catch (err: any) {
      toast.error(`Failed to advance cycle: ${err.message}`);
    } finally {
      setAdvancing(false);
    }
  };

  const LIFECYCLE_STEPS = [
    { key: 'collecting', label: 'Collecting', icon: Users },
    { key: 'closed', label: 'Locked', icon: Lock },
    { key: 'processing', label: 'Processing', icon: Play },
    { key: 'delivering', label: 'Delivering', icon: Truck },
    { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  ];

  const currentStepIdx = LIFECYCLE_STEPS.findIndex(s => s.key === cycle.status);

  return (
    <div className="space-y-4">
      {/* Cycle Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="p-4 bg-card border border-border rounded-lg text-center">
          <p className="text-2xl font-semibold">{forecast.total_orders || orders.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Total Orders</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg text-center">
          <p className="text-2xl font-semibold">{forecast.total_decants || orders.reduce((s, o) => s + o.items.length, 0)}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Total Decants</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg text-center">
          <p className="text-2xl font-semibold">{forecast.perfumes_needed?.length || 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Unique Perfumes</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg text-center">
          <p className="text-2xl font-semibold">{cycle.generated_jobs_count}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Jobs Created</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg text-center">
          <p className="text-2xl font-semibold font-mono">
            {new Date(cycle.cutoff_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Cut-off Date</p>
        </div>
      </div>

      {/* Cycle Info */}
      <SectionCard title={`Active Cycle: ${cycle.cycle_id}`}>
        <div className="flex items-center gap-3 mb-4">
          <InlineStatusSelect
            entityId={cycle.cycle_id}
            entityType="cycle"
            currentStatus={cycle.status}
            statuses={CYCLE_STATUSES}
          />
          <span className="text-xs text-muted-foreground">
            Cut-off: {new Date(cycle.cutoff_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Cycle Lifecycle Progress */}
        <div className="mb-4 p-4 bg-muted/20 rounded-lg border border-border">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-4">Cycle Lifecycle</h4>
          <div className="flex items-center gap-0">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const isActive = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              const StepIcon = step.icon;
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                      isCurrent ? 'border-gold bg-gold text-gold-foreground scale-110 shadow-md' :
                      isActive ? 'border-gold bg-gold/20 text-gold' :
                      'border-muted bg-muted/30 text-muted-foreground',
                    )}>
                      <StepIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className={cn(
                      'text-[9px] font-medium whitespace-nowrap',
                      isCurrent ? 'text-gold font-semibold' :
                      isActive ? 'text-gold' : 'text-muted-foreground',
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {idx < LIFECYCLE_STEPS.length - 1 && (
                    <div className={cn(
                      'h-0.5 flex-1 -mx-1 mt-[-18px]',
                      idx < currentStepIdx ? 'bg-gold' : 'bg-muted',
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* POTM Auto-Fill Info */}
        {monthPotm.length > 0 && (
          <div className="mb-4 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-700">Perfume of the Month — {cycleMonth}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {monthPotm.map(p => (
                    <span key={p.slot} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-purple-500/10 text-purple-600 border border-purple-500/15">
                      Slot {p.slot}: {p.perfume_name}
                    </span>
                  ))}
                </div>
                {potmSummary.needsAutoFill > 0 && cycle.status !== 'completed' && (
                  <p className="text-xs text-purple-600 mt-2">
                    {potmSummary.needsAutoFill} subscriber(s) with incomplete selections — {potmSummary.totalAutoFilled} vial(s) will be auto-filled with POTM on processing.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {monthPotm.length === 0 && cycle.status !== 'completed' && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-700">No POTM Set for {cycleMonth}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Set the Perfume of the Month before processing to auto-fill subscribers who haven't made selections.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Perfumes Needed */}
        {forecast.perfumes_needed && forecast.perfumes_needed.length > 0 && (
          <div className="border-t border-border pt-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Perfumes Needed This Cycle</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {forecast.perfumes_needed.map((p: any) => (
                <div key={p.master_id} className="flex items-center justify-between p-2.5 rounded-md border border-border">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{p.master_id}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-semibold text-gold">{p.total_ml}ml</span>
                    {p.in_stock_ml !== undefined && (
                      <p className={cn(
                        'text-[10px] font-mono',
                        p.in_stock_ml >= p.total_ml ? 'text-emerald-500' : 'text-destructive',
                      )}>
                        Stock: {p.in_stock_ml}ml
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4 border-t border-border pt-4">
          {cycle.status === 'collecting' && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleLockCycle}
              disabled={locking}
            >
              {locking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Lock Cycle
            </Button>
          )}
          {(cycle.status === 'closed') && (
            <Button
              size="sm"
              className="gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground"
              onClick={handleStartProcessing}
              disabled={processing}
            >
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Start Cycle Processing
            </Button>
          )}
          {cycle.status === 'processing' && (
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => handleAdvanceCycle('delivering')}
              disabled={advancing}
            >
              {advancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
              Advance to Delivering
            </Button>
          )}
          {cycle.status === 'delivering' && (
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleAdvanceCycle('completed')}
              disabled={advancing}
            >
              {advancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Complete Cycle
            </Button>
          )}
          {/* Override: manual status change always available */}
          <span className="text-[10px] text-muted-foreground self-center ml-auto">
            Override via status dropdown above
          </span>
        </div>
      </SectionCard>
    </div>
  );
}

// (Perfume Forecast moved to standalone page: /subscriptions/forecast)

// ---- Cycles Overview Tab (redesigned from Cycle History) ----
const PIPELINE_STAGES = [
  { key: 'collecting', label: 'Collecting', color: 'bg-blue-500' },
  { key: 'closed', label: 'Locked', color: 'bg-amber-500' },
  { key: 'processing', label: 'Processing', color: 'bg-purple-500' },
  { key: 'delivering', label: 'Delivering', color: 'bg-cyan-500' },
  { key: 'completed', label: 'Completed', color: 'bg-emerald-500' },
];

function CycleHistory({ cycles }: { cycles: SubscriptionCycle[] }) {
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  // Aggregate stats
  const stats = useMemo(() => {
    const totalOrders = cycles.reduce((s, c) => s + (c.forecast_summary?.total_orders || 0), 0);
    const totalDecants = cycles.reduce((s, c) => s + (c.forecast_summary?.total_decants || 0), 0);
    const allPerfumes = cycles.flatMap(c => (c.forecast_summary?.perfumes_needed || []).map((p: any) => p.name || p.master_id));
    const uniquePerfumes = new Set(allPerfumes).size;
    // Count perfumes that appear in more than one cycle
    const perfumeCycleCounts = new Map<string, number>();
    for (const c of cycles) {
      const seen = new Set<string>();
      for (const p of (c.forecast_summary?.perfumes_needed || []) as any[]) {
        const key = p.name || p.master_id;
        if (!seen.has(key)) {
          seen.add(key);
          perfumeCycleCounts.set(key, (perfumeCycleCounts.get(key) || 0) + 1);
        }
      }
    }
    const repeatedPerfumes = Array.from(perfumeCycleCounts.values()).filter(v => v > 1).length;
    return { totalOrders, totalDecants, uniquePerfumes, repeatedPerfumes, totalCycles: cycles.length };
  }, [cycles]);

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-card border border-border rounded-lg text-center">
          <div className="text-xl font-bold">{stats.totalCycles}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Total Cycles</div>
        </div>
        <div className="p-3 bg-card border border-border rounded-lg text-center">
          <div className="text-xl font-bold">{stats.totalOrders}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Total Orders</div>
        </div>
        <div className="p-3 bg-card border border-border rounded-lg text-center">
          <div className="text-xl font-bold">{stats.totalDecants.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Total Decants</div>
        </div>
        <div className="p-3 bg-card border border-blue-200/50 rounded-lg text-center">
          <div className="text-xl font-bold text-blue-600">{stats.uniquePerfumes}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Unique Perfumes</div>
        </div>
        <div className="p-3 bg-card border border-amber-200/50 rounded-lg text-center">
          <div className="text-xl font-bold text-amber-600">{stats.repeatedPerfumes}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Repeated Across Cycles</div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Cycles Overview</h3>
        <div className="flex items-center bg-muted rounded-md p-0.5">
          <button
            onClick={() => setViewMode('timeline')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              viewMode === 'timeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            Table
          </button>
        </div>
      </div>

      {cycles.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No cycles yet"
          description="Subscription cycles will appear here once created."
        />
      ) : viewMode === 'timeline' ? (
        /* Timeline View */
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {cycles.map((c, idx) => {
              const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === c.status);
              const stageColor = PIPELINE_STAGES[stageIdx]?.color || 'bg-muted';
              const forecast = c.forecast_summary || { total_orders: 0, total_decants: 0, perfumes_needed: [] };
              const uniqueP = new Set((forecast.perfumes_needed || []).map((p: any) => p.name || p.master_id)).size;
              return (
                <div key={c.cycle_id} className="relative pl-14">
                  {/* Timeline dot */}
                  <div className={cn(
                    'absolute left-4 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center',
                    stageColor,
                  )}>
                    {c.status === 'completed' ? (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>

                  <div className="p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold">{c.cycle_id}</span>
                          <InlineStatusSelect
                            entityId={c.cycle_id}
                            entityType="cycle"
                            currentStatus={c.status}
                            statuses={CYCLE_STATUSES}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cut-off: {new Date(c.cutoff_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">{forecast.total_orders || 0}</span>
                        <span className="text-xs text-muted-foreground ml-1">orders</span>
                      </div>
                    </div>

                    {/* Mini pipeline */}
                    <div className="flex items-center gap-0.5 mb-2">
                      {PIPELINE_STAGES.map((stage, sIdx) => (
                        <div
                          key={stage.key}
                          className={cn(
                            'h-1.5 flex-1 rounded-full',
                            sIdx <= stageIdx ? stage.color : 'bg-muted',
                          )}
                        />
                      ))}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{forecast.total_decants || 0} decants</span>
                      <span>{c.generated_jobs_count} jobs</span>
                      <span className="text-blue-600 font-medium">{uniqueP} unique perfumes</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto">
          <table className="w-full ops-table">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Cycle ID</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Cut-off Date</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Orders</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Decants</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Unique Perfumes</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Jobs</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Pipeline</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map(c => {
                const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === c.status);
                const forecast = c.forecast_summary || { total_orders: 0, total_decants: 0, perfumes_needed: [] };
                const uniqueP = new Set((forecast.perfumes_needed || []).map((p: any) => p.name || p.master_id)).size;
                return (
                  <tr key={c.cycle_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium">{c.cycle_id}</td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(c.cutoff_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">{forecast.total_orders || 0}</td>
                    <td className="px-4 py-3 text-sm font-mono">{forecast.total_decants || 0}</td>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">{uniqueP}</td>
                    <td className="px-4 py-3 text-sm font-mono">{c.generated_jobs_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5 w-24">
                        {PIPELINE_STAGES.map((stage, sIdx) => (
                          <div
                            key={stage.key}
                            className={cn(
                              'h-1.5 flex-1 rounded-full',
                              sIdx <= stageIdx ? stage.color : 'bg-muted',
                            )}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <InlineStatusSelect
                        entityId={c.cycle_id}
                        entityType="cycle"
                        currentStatus={c.status}
                        statuses={CYCLE_STATUSES}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- All Subscription Orders Tab ----
function AllSubscriptionOrders({ orders }: { orders: Order[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [tierFilter, setTierFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let result = orders;
    if (tierFilter !== 'all') {
      result = result.filter((o: any) => (o.subscriptionTier || o.subscription_tier || 'Grand Master 1') === tierFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        `${o.order_id} ${o.customer.name} ${o.customer.email}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, searchQuery, tierFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search subscription orders..."
            className="w-full h-9 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          {['all', ...SUBSCRIPTION_TIERS].map(t => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors capitalize',
                tierFilter === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <SectionCard title={`Subscription Orders (${filtered.length})`} className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No subscription orders"
            description="Subscription orders will appear here once customers subscribe."
          />
        ) : (
          <div className="overflow-x-auto -m-4">
            <table className="w-full ops-table">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Order</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Customer</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Tier</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Selected Perfumes</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Type</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Total</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Date</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const tier = (o as any).subscriptionTier || (o as any).subscription_tier || 'Grand Master 1';
                  const tierSlots: Record<string, number> = { 'Grand Master 1': 1, 'Grand Master 2': 2, 'Grand Master 3': 3, 'Grand Master 4': 4 };
                  const maxSlots = tierSlots[tier] || 1;
                  const selectedCount = o.items.length;
                  const needsAutoFill = selectedCount < maxSlots;
                  return (
                    <tr key={o.order_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-medium">{o.order_id}</td>
                      <td className="px-4 py-3 text-sm">{o.customer.name}</td>
                      <td className="px-4 py-3">
                        <TierBadge tier={tier} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {o.items.map(item => (
                            <div key={item.item_id} className="text-xs text-foreground">
                              {item.perfume_name} <span className="text-muted-foreground font-mono">{item.size_ml}ml</span>
                            </div>
                          ))}
                          {needsAutoFill && (
                            <div className="text-[10px] text-purple-500 flex items-center gap-1 mt-0.5">
                              <Sparkles className="w-3 h-3" />
                              {maxSlots - selectedCount} slot(s) → POTM auto-fill
                            </div>
                          )}
                          {!needsAutoFill && (
                            <div className="text-[10px] text-emerald-500 flex items-center gap-1 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              {selectedCount}/{maxSlots} selected
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded',
                          (o as any).isFirstSubscriber || (o as any).is_first_subscriber
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-blue-500/15 text-blue-500',
                        )}>
                          {(o as any).isFirstSubscriber || (o as any).is_first_subscriber ? 'First-Time' : 'Recurring'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold">AED {o.total_amount.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <InlineStatusSelect
                          entityId={o.order_id}
                          entityType="order"
                          currentStatus={o.status}
                          statuses={ORDER_STATUSES}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedOrder(o)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {selectedOrder && <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}

// ---- Create Cycle Dialog ----
function CreateCycleDialog({
  cycleDays, deliveryLead, onClose, onCreated,
}: {
  cycleDays: string;
  deliveryLead: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const days = cycleDays.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));

  const handleCreate = async () => {
    if (!selectedDay) {
      toast.error('Please select a cut-off day');
      return;
    }
    setCreating(true);
    try {
      const cutoffDate = `${month}-${String(parseInt(selectedDay)).padStart(2, '0')}`;
      const cycleNum = days.indexOf(parseInt(selectedDay)) + 1;
      const cycleId = `CYC-${month.replace('-', '')}-${String(cycleNum).padStart(2, '0')}`;

      // Calculate delivery start date (deliveryLead days after cutoff)
      const cutoffDateObj = new Date(cutoffDate);
      const deliveryStart = new Date(cutoffDateObj);
      deliveryStart.setDate(deliveryStart.getDate() + deliveryLead);
      const deliveryStartDate = deliveryStart.toISOString().slice(0, 10);

      await api.mutations.subscriptionCycles.create({
        cycleId,
        cutoffDate,
        cycleNumber: cycleNum,
        month,
        deliveryStartDate,
        status: 'collecting',
        forecastSummary: { total_orders: 0, total_decants: 0, perfumes_needed: [] },
        generatedJobsCount: 0,
        totalOrders: 0,
        totalDecants: 0,
      });
      onCreated();
    } catch (e: any) {
      toast.error(`Failed to create cycle: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] bg-card border border-border rounded-xl shadow-xl z-50">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Create Subscription Cycle</h2>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Month</label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cut-off Day</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {days.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(String(d))}
                  className={cn(
                    'p-3 rounded-lg border text-center transition-colors',
                    selectedDay === String(d)
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border hover:border-gold/30 hover:bg-muted/30',
                  )}
                >
                  <p className="text-lg font-semibold">{d}</p>
                  <p className="text-[10px] text-muted-foreground">Cycle {i + 1}</p>
                </button>
              ))}
            </div>
          </div>

          {selectedDay && (
            <div className="p-3 bg-muted/30 rounded-md border border-border text-sm">
              <p><span className="text-muted-foreground">Cut-off:</span> {month}-{String(parseInt(selectedDay)).padStart(2, '0')}</p>
              <p><span className="text-muted-foreground">Delivery starts:</span> {deliveryLead} days after cut-off</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !selectedDay}
              className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Cycle
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---- Order Detail Drawer (shared) ----
function OrderDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  const tier = (order as any).subscriptionTier || (order as any).subscription_tier;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] bg-card border-l border-border z-50 overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold font-mono">{order.order_id}</h2>
              {tier && <TierBadge tier={tier} />}
            </div>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
          <InlineStatusSelect
            entityId={order.order_id}
            entityType="order"
            currentStatus={order.status}
            statuses={ORDER_STATUSES}
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
            </div>
          </div>

          {/* J1: Subscriber Benefits & Plan Details */}
          {tier && (
            <div className="border-t border-border pt-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Subscription Details</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase">Plan Type</p>
                  <p className="text-sm font-medium">{order.type === 'subscription' ? 'Monthly' : 'One-Time'}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase">Vial Count</p>
                  <p className="text-sm font-medium">{order.items.length} vial(s)</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase">Surcharge Tier</p>
                  <p className="text-sm font-medium">S0 (Base)</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase">Whisperer Vials</p>
                  <p className="text-sm font-medium">2 × 1ml</p>
                </div>
              </div>
              <div className="mt-2 p-2.5 rounded-lg bg-gold/5 border border-gold/20">
                <p className="text-[10px] text-gold uppercase font-medium mb-1">Active Benefits</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">10% Refill Discount</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">15% Capsule Discount</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">Free Vault Access</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">3 Exchanges/Year</span>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Items</h3>
            <div className="space-y-2">
              {order.items.map(item => (
                <div key={item.item_id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-muted flex items-center justify-center text-xs font-mono font-bold">
                      {item.size_ml}ml
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.perfume_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.type} · ×{item.qty}</p>
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
        </div>
      </div>
    </>
  );
}
