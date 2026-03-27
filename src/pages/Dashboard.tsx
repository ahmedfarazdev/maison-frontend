// ============================================================
// Dashboard — AuraKey-First Operations Overview
// V2: Re-centered around subscription, capsules, vault, gifting
// Features: Customizable KPI layout + Global time-range filter
// ============================================================

import { useMemo } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { PageHeader, KPICard, PipelineProgress, AlertItem, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { DashboardCustomizer } from '@/components/dashboard/DashboardCustomizer';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useTimeRange } from '@/hooks/useTimeRange';
import { computeTrends, generateKPIsForRange, getPreviousPeriodRange } from '@/lib/mock-data-timerange';
import { Link } from 'wouter';
import {
  ShoppingCart, RotateCcw, FlaskConical, Truck, Play, Beaker, Warehouse,
  Droplets, Settings2, Sparkles, Package, ArrowRight, Clock, CheckCircle2,
  ShieldCheck, FileText, AlertTriangle, CalendarDays, PackageOpen, AlertCircle,
  DollarSign, Users, Wine, Box, Tag, SplitSquareVertical, Boxes, ClipboardList,
  Shield, BarChart3, Gem, Lock, Gift, Timer, Heart, Printer, TrendingUp,
  Percent, CreditCard, Crown, UserPlus,
} from 'lucide-react';
import { RevenueChart, OrdersChart, RevenueBreakdown, TopPerfumesChart } from '@/components/dashboard/DashboardCharts';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DashboardKPIs, PipelineStage, InventoryAlert, CriticalPerfume, Job } from '@/types';

// ─── V2 AuraKey KPI Card Renderers ──────────────────────────
const CARD_RENDERERS: Record<string, {
  icon: React.ElementType;
  variant: 'default' | 'gold' | 'success' | 'warning' | 'destructive';
  render: (kpis: DashboardKPIs, formatDate: (d: string) => string) => { value: string | number; sublabel: string };
}> = {
  active_subscribers: {
    icon: Users,
    variant: 'gold',
    render: (kpis) => {
      const subs = kpis.subscription || { active_subscribers: 0, new_this_month: 0, churn_rate: 0 };
      const active = (subs as any).active_subscribers || (subs as any).orders_count || 0;
      const newSubs = (subs as any).new_this_month || 0;
      const churn = (subs as any).churn_rate || 0;
      return {
        value: active,
        sublabel: `+${newSubs} new · ${churn}% churn`,
      };
    },
  },
  subscription_cycle: {
    icon: CalendarDays,
    variant: 'default',
    render: (kpis, formatDate) => {
      const sub = kpis.subscription || { active_cycle_cutoff: '', days_left: 0, readiness_pct: 0 };
      const readiness = (sub as any).readiness_pct || 85;
      return {
        value: `${sub.days_left}d left`,
        sublabel: `Cutoff ${formatDate(sub.active_cycle_cutoff)} · ${readiness}% ready`,
      };
    },
  },
  vials_required: {
    icon: Droplets,
    variant: 'success',
    render: (kpis) => {
      const vials = (kpis as any).vials_required || { ten_ml: 0, two_ml: 0 };
      const tenMl = vials.ten_ml || 240;
      const twoMl = vials.two_ml || 480;
      return {
        value: `${tenMl + twoMl}`,
        sublabel: `${tenMl} × 10ml · ${twoMl} × 2ml`,
      };
    },
  },
  inventory_coverage: {
    icon: Package,
    variant: 'warning',
    render: (kpis) => {
      const inv = kpis.inventory || { total_bottles: 0, total_ml: 0, low_stock_count: 0 };
      const coverageDays = Math.round((inv.total_ml || 0) / Math.max(1, 150)); // rough estimate
      return {
        value: `${coverageDays}d`,
        sublabel: `${inv.total_bottles} btl · ${inv.low_stock_count} low stock`,
      };
    },
  },
  capsule_sellthrough: {
    icon: Gem,
    variant: 'success',
    render: (kpis) => {
      const cap = (kpis as any).capsules || { sellThrough: 0, totalSold: 0, remainingAllocation: 0, liveDrops: 0 };
      return {
        value: `${cap.sellThrough}%`,
        sublabel: `${cap.totalSold} sold · ${cap.remainingAllocation} remaining · ${cap.liveDrops} live`,
      };
    },
  },
  vault_status: {
    icon: Lock,
    variant: 'gold',
    render: (kpis) => {
      const vault = (kpis as any).emVault || { totalReleases: 0, pendingRequests: 0, liveRelease: null, totalSold: 0 };
      const timerLabel = vault.liveRelease?.endDate
        ? (() => { const diff = new Date(vault.liveRelease.endDate).getTime() - Date.now(); if (diff <= 0) return 'Ended'; const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000); return `${d}d ${h}h left`; })()
        : 'No live release';
      return {
        value: `${vault.totalReleases} releases`,
        sublabel: `${vault.pendingRequests} requests · ${timerLabel}`,
      };
    },
  },
  ops_today: {
    icon: CheckCircle2,
    variant: 'default',
    render: (kpis) => {
      const ot = kpis.one_time_orders || { new: 0, in_progress: 0, packed: 0, shipped: 0 };
      const completed = ot.packed + ot.shipped;
      const total = ot.new + ot.in_progress + completed;
      return {
        value: `${completed}/${total}`,
        sublabel: `${ot.new} queued · avg 18min/station`,
      };
    },
  },
  revenue: {
    icon: DollarSign,
    variant: 'gold',
    render: (kpis) => {
      const rev = kpis.revenue || { total_aed: 0, subscription_aed: 0, one_time_aed: 0, full_bottle_aed: 0 };
      return {
        value: `${(rev.total_aed / 1000).toFixed(1)}K`,
        sublabel: `Sub ${(rev.subscription_aed / 1000).toFixed(1)}K · OT ${(rev.one_time_aed / 1000).toFixed(1)}K`,
      };
    },
  },
  daily_orders: {
    icon: ShoppingCart,
    variant: 'default',
    render: (kpis) => {
      const ot = kpis.one_time_orders || { new: 0, in_progress: 0, packed: 0, shipped: 0 };
      const total = ot.new + ot.in_progress + ot.packed + ot.shipped;
      return {
        value: total,
        sublabel: `${ot.new} new · ${ot.in_progress} processing · ${ot.shipped} shipped`,
      };
    },
  },
  new_subscribers: {
    icon: UserPlus,
    variant: 'success',
    render: (kpis) => {
      const cust = kpis.customers || { total: 0, new_this_period: 0, returning: 0 };
      return {
        value: cust.new_this_period,
        sublabel: `${cust.total} total · ${cust.returning} returning`,
      };
    },
  },
  daily_revenue: {
    icon: TrendingUp,
    variant: 'gold',
    render: (kpis) => {
      const rev = kpis.revenue || { total_aed: 0, subscription_aed: 0, one_time_aed: 0, full_bottle_aed: 0 };
      const avgDaily = Math.round(rev.total_aed / 7); // weekly average
      return {
        value: `${(avgDaily / 1000).toFixed(1)}K`,
        sublabel: `AED ${avgDaily.toLocaleString()}/day avg`,
      };
    },
  },
};

export default function Dashboard() {
  const { hasPermission } = useAuth();
  const timeRange = useTimeRange();
  const layout = useDashboardLayout();

  // Stabilize API params
  const apiFrom = timeRange.apiParams.from;
  const apiTo = timeRange.apiParams.to;

  const { data: kpisRes } = useApiQuery(
    () => api.dashboard.kpis({ from: apiFrom, to: apiTo }),
    [apiFrom, apiTo]
  );
  const { data: pipelineRes } = useApiQuery(
    () => api.dashboard.pipeline({ from: apiFrom, to: apiTo }),
    [apiFrom, apiTo]
  );
  const { data: alertsRes } = useApiQuery(
    () => api.dashboard.alerts({ from: apiFrom, to: apiTo }),
    [apiFrom, apiTo]
  );
  const { data: criticalRes } = useApiQuery(
    () => api.dashboard.criticalPerfumes({ from: apiFrom, to: apiTo }),
    [apiFrom, apiTo]
  );

  // PO Stats
  const { data: poStatsRes } = useApiQuery(() => api.purchaseOrders.stats(), []);
  const poStats = poStatsRes as any;

  // Overdue POs
  const { data: overdueRes } = useApiQuery(() => api.purchaseOrders.overduePOs(), []);
  const overduePOs = (overdueRes as any) || [];

  // Jobs for compact Kanban
  const { data: jobsRes } = useApiQuery(() => api.jobs.list(), []);
  const allJobs = (jobsRes || []) as Job[];

  // Subscription cycles
  const { data: cyclesRes } = useApiQuery(() => api.subscriptions.cycles(), []);
  const cycles = (cyclesRes || []) as any[];

  // Orders
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const allOrders = (ordersRes || []) as any[];

  const kpis = kpisRes as DashboardKPIs | undefined;
  const pipeline = pipelineRes as PipelineStage[] | undefined;
  const alerts = alertsRes as InventoryAlert[] | undefined;
  const critical = criticalRes as CriticalPerfume[] | undefined;

  // Compute trends
  const trends = useMemo(() => {
    if (!kpis) return {};
    const prev = getPreviousPeriodRange(apiFrom, apiTo);
    const prevKPIs = generateKPIsForRange(prev.from, prev.to);
    return computeTrends(kpis, prevKPIs);
  }, [kpis, apiFrom, apiTo]);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
    catch { return d; }
  };

  const subtitle = timeRange.preset === 'today'
    ? 'Today at a glance — AuraKey operations'
    : timeRange.preset === 'yesterday'
    ? 'Yesterday\'s performance — AuraKey operations'
    : `${timeRange.displayLabel} — AuraKey operations`;

  // ─── Section Renderers ────────────────────────────────────
  const sectionRenderers: Record<string, () => React.ReactNode> = {
    pipeline: () => {
      const kanbanCols = [
        { id: 'queued', label: 'Queued', icon: ClipboardList, color: 'bg-slate-500', statusMatch: ['pending'] },
        { id: 'picking', label: 'Pick', icon: Package, color: 'bg-amber-500', statusMatch: ['picked'] },
        { id: 'labels', label: 'Label', icon: Tag, color: 'bg-blue-500', statusMatch: ['prepped'] },
        { id: 'decant', label: 'Decant', icon: FlaskConical, color: 'bg-purple-500', statusMatch: ['decanted'] },
        { id: 'pack', label: 'Pack', icon: SplitSquareVertical, color: 'bg-orange-500', statusMatch: ['packed'] },
        { id: 'shipped', label: 'Ship', icon: Truck, color: 'bg-emerald-500', statusMatch: ['shipped'] },
      ];

      const otJobs = allJobs.filter(j => j.source === 'one_time' || j.source === 'manual');
      const subJobs = allJobs.filter(j => j.source === 'subscription');
      const otPendingOrders = allOrders.filter((o: any) => o.type === 'one_time' && ['new', 'processing'].includes(o.status)).length;
      const subPendingOrders = allOrders.filter((o: any) => o.type === 'subscription' && ['new', 'processing'].includes(o.status)).length;
      const activeCycle = cycles.find((c: any) => ['processing', 'delivering', 'collecting', 'active'].includes(c.status));

      const buildKanban = (jobs: Job[]) => kanbanCols.map(col => ({
        ...col,
        count: jobs.filter(j => col.statusMatch.includes(j.status)).length,
      }));

      const otKanban = buildKanban(otJobs);
      const subKanban = buildKanban(subJobs);

      const renderCompactKanban = (label: string, data: typeof otKanban, link: string, isBatch?: boolean, pendingOrders?: number, cycleInfo?: any) => (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold">{label}</h4>
              {isBatch && (
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  <Boxes className="w-2.5 h-2.5 inline mr-0.5" />Batch S1-S4
                </span>
              )}
            </div>
            {pendingOrders !== undefined && pendingOrders > 0 && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {pendingOrders} pending
              </span>
            )}
            <Link href={link}>
              <button className="text-[10px] text-gold hover:underline flex items-center gap-0.5">
                Open Board <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </Link>
          </div>
          {cycleInfo && (
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
              <CalendarDays className="w-2.5 h-2.5" />
              <span>Cycle {cycleInfo.cycle_id} - Cutoff {formatDate(cycleInfo.cutoff_date)}</span>
            </div>
          )}
          <div className="flex gap-1.5">
            {data.map(col => {
              const ColIcon = col.icon;
              return (
                <div
                  key={col.id}
                  className={cn(
                    'flex-1 rounded-lg border p-2 text-center transition-all',
                    col.count > 0 ? `${col.color}/5 border-current/20` : 'border-border',
                  )}
                >
                  <div className={cn('w-5 h-5 rounded-md flex items-center justify-center mx-auto mb-1', col.color)}>
                    <ColIcon className="w-3 h-3 text-white" />
                  </div>
                  <p className={cn(
                    'text-base font-bold',
                    col.count > 0 ? 'text-foreground' : 'text-muted-foreground/50',
                  )}>
                    {col.count}
                  </p>
                  <p className="text-[8px] uppercase tracking-wider text-muted-foreground mt-0.5 truncate">{col.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      );

      return (
        <SectionCard
          title="Order Kanban"
          subtitle={`${timeRange.displayLabel} — ${otJobs.length + subJobs.length} total jobs`}
          className="lg:col-span-2"
        >
          <div className="space-y-5">
            {renderCompactKanban(
              `One-Time Orders (${otJobs.length} jobs)`,
              otKanban,
              '/stations/1-job-board',
              false,
              otPendingOrders,
            )}
            <div className="border-t border-border" />
            {renderCompactKanban(
              `Subscription Cycle (${subJobs.length} jobs)`,
              subKanban,
              '/stations/1-job-board',
              true,
              subPendingOrders,
              activeCycle,
            )}
            {pipeline && (
              <div className="border-t border-border pt-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Pipeline Progress</p>
                <PipelineProgress stages={pipeline} />
              </div>
            )}
          </div>
        </SectionCard>
      );
    },

    // V2: Capsules & Em Vault combined section
    capsule_vault: () => {
      // Real data from kpis
      const capStats = (kpis as any)?.capsules || { totalDrops: 0, liveDrops: 0, totalSold: 0, totalRevenue: 0, sellThrough: 0, remainingAllocation: 0 };
      const vaultStats = (kpis as any)?.emVault || { totalReleases: 0, liveRelease: null, pendingRequests: 0, totalSold: 0, totalRevenue: 0 };

      const capsuleDrop = {
        name: capStats.liveDrops > 0 ? `${capStats.liveDrops} Live Drop${capStats.liveDrops > 1 ? 's' : ''}` : 'No Active Drop',
        type: 'Capsule',
        allocated: capStats.totalSold + capStats.remainingAllocation,
        sold: capStats.totalSold,
        remaining: capStats.remainingAllocation,
      };

      const vaultRelease = {
        theme: vaultStats.liveRelease?.theme || 'No Live Release',
        skuCount: vaultStats.totalReleases,
        accessRequests: vaultStats.pendingRequests,
        timerEnd: vaultStats.liveRelease?.endDate ? new Date(vaultStats.liveRelease.endDate) : new Date(),
        allocated: vaultStats.totalSold + vaultStats.pendingRequests,
        claimed: vaultStats.totalSold,
      };

      const vaultTimeLeft = () => {
        const diff = vaultRelease.timerEnd.getTime() - Date.now();
        if (diff <= 0) return 'Ended';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d ${hours}h`;
      };

      const sellThrough = capsuleDrop.allocated > 0 ? Math.round((capsuleDrop.sold / capsuleDrop.allocated) * 100) : 0;

      return (
        <SectionCard
          title="Capsules & Em Vault"
          subtitle="Active drops & vault status"
          headerActions={
            <div className="flex gap-1">
              <Link href="/capsules">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Capsules <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
              <Link href="/em-vault">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Vault <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Active Capsule Drop */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gem className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-semibold">Active Capsule</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20 font-medium">
                  {capsuleDrop.type}
                </span>
              </div>
              <p className="text-sm font-medium">{capsuleDrop.name}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${sellThrough}%` }} />
                </div>
                <span className="text-xs font-mono font-bold text-purple-600">{sellThrough}%</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{capsuleDrop.sold}/{capsuleDrop.allocated} sold</span>
                <span>{capsuleDrop.remaining} remaining</span>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Em Vault Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-gold" />
                <span className="text-xs font-semibold">Em Vault</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 font-mono font-bold">
                  <Timer className="w-2.5 h-2.5 inline mr-0.5" />{vaultTimeLeft()}
                </span>
              </div>
              <p className="text-sm font-medium">{vaultRelease.theme}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-lg font-bold text-gold">{vaultRelease.skuCount}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">SKUs</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-lg font-bold text-amber-600">{vaultRelease.accessRequests}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">Requests</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-lg font-bold text-emerald-600">{vaultRelease.claimed}/{vaultRelease.allocated}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">Claimed</p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      );
    },

    inventory_health: () => (
      <SectionCard title="Inventory Health" subtitle="Critical levels & top movers">
        {critical && critical.length > 0 ? (
          <div className="space-y-2">
            {critical.map(p => (
              <div key={p.master_id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Droplets className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <span className="text-sm truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold text-destructive">{p.current_ml}ml</span>
                  <span className="text-[10px] text-muted-foreground">/ {p.threshold_ml}ml</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">All levels healthy</p>
        )}
      </SectionCard>
    ),

    po_tracker: () => {
      const statusConfig = [
        { key: 'draft', label: 'Draft', icon: FileText, color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800' },
        { key: 'pending_quote', label: 'Pending Quote', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
        { key: 'quote_approved', label: 'Quote Approved', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
        { key: 'pending_delivery', label: 'Pending Delivery', icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
        { key: 'qc', label: 'QC', icon: ShieldCheck, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
        { key: 'delivered', label: 'Delivered', icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
        { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 dark:bg-green-950/30' },
      ];
      const byStatus = poStats?.byStatus || {};
      const activeStatuses = statusConfig.filter(s => !['draft', 'confirmed', 'cancelled'].includes(s.key));
      const activeCount = activeStatuses.reduce((sum, s) => sum + (byStatus[s.key] || 0), 0);

      return (
        <SectionCard
          title="Purchase Orders"
          subtitle={`${activeCount} active · ${poStats?.total || 0} total`}
          headerActions={
            <Link href="/procurement/purchase-orders">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          }
        >
          {poStats ? (
            <div className="space-y-2">
              {statusConfig.map(s => {
                const count = byStatus[s.key] || 0;
                if (count === 0 && ['draft', 'confirmed'].includes(s.key)) return null;
                const Icon = s.icon;
                return (
                  <Link key={s.key} href="/procurement/purchase-orders">
                    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', s.bg)}>
                          <Icon className={cn('w-3.5 h-3.5', s.color)} />
                        </div>
                        <span className="text-sm">{s.label}</span>
                      </div>
                      <span className={cn('text-sm font-mono font-bold', count > 0 ? s.color : 'text-muted-foreground')}>
                        {count}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="h-16 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
          )}

          {overduePOs && overduePOs.length > 0 && (
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-600">Delivery Alerts ({overduePOs.length} overdue)</span>
              </div>
              <div className="space-y-1.5">
                {overduePOs.slice(0, 4).map((po: any) => {
                  const delivery = new Date(po.expectedDelivery || po.expected_delivery);
                  const diffDays = Math.ceil((delivery.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <Link key={po.id} href="/procurement/purchase-orders">
                      <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors cursor-pointer">
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-semibold truncate">{po.poNumber || po.po_number}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{po.supplierName || po.supplier_name}</p>
                        </div>
                        <span className="text-[10px] font-bold text-red-500 whitespace-nowrap">{Math.abs(diffDays)}d overdue</span>
                      </div>
                    </Link>
                  );
                })}
                {overduePOs.length > 4 && (
                  <Link href="/procurement/purchase-orders">
                    <p className="text-[10px] text-center text-red-500 hover:underline cursor-pointer pt-0.5">+{overduePOs.length - 4} more overdue</p>
                  </Link>
                )}
              </div>
            </div>
          )}
        </SectionCard>
      );
    },

    alerts: () => (
      <SectionCard
        title="Alerts"
        subtitle={alerts ? `${alerts.length} active` : ''}
        headerActions={
          <Button variant="ghost" size="sm" className="text-xs">View All</Button>
        }
      >
        {alerts && alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map(a => (
              <AlertItem
                key={a.id}
                severity={a.severity}
                message={a.message}
                time={formatDate(a.created_at)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">No alerts</p>
        )}
      </SectionCard>
    ),

    revenue_analytics: () => (
      <div className="lg:col-span-3 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <RevenueBreakdown />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OrdersChart />
          <TopPerfumesChart />
        </div>
      </div>
    ),

    operator_progress: () => {
      const operators = [
        { id: 'op-1', name: 'Ahmed K.', avatar: 'AK', station: 'Picking', jobCode: 'JOB-OT-A3F2', ordersCompleted: 5, ordersTotal: 8, startedAt: '09:15', status: 'active' as const },
        { id: 'op-2', name: 'Sara M.', avatar: 'SM', station: 'Decanting', jobCode: 'JOB-SUB-B1C4', ordersCompleted: 12, ordersTotal: 15, startedAt: '09:00', status: 'active' as const },
        { id: 'op-3', name: 'Khalid R.', avatar: 'KR', station: 'Labelling', jobCode: 'JOB-OT-D7E9', ordersCompleted: 3, ordersTotal: 6, startedAt: '10:30', status: 'active' as const },
        { id: 'op-4', name: 'Fatima A.', avatar: 'FA', station: 'QC & Pack', jobCode: 'JOB-SUB-F2G8', ordersCompleted: 20, ordersTotal: 20, startedAt: '08:45', status: 'completed' as const },
        { id: 'op-5', name: 'Omar H.', avatar: 'OH', station: '—', jobCode: '—', ordersCompleted: 0, ordersTotal: 0, startedAt: '—', status: 'idle' as const },
      ];

      const activeOps = operators.filter(o => o.status === 'active');
      const completedOps = operators.filter(o => o.status === 'completed');
      const idleOps = operators.filter(o => o.status === 'idle');

      const statusColor = (s: 'active' | 'completed' | 'idle') =>
        s === 'active' ? 'bg-emerald-500' : s === 'completed' ? 'bg-blue-500' : 'bg-zinc-400';

      const statusLabel = (s: 'active' | 'completed' | 'idle') =>
        s === 'active' ? 'Working' : s === 'completed' ? 'Done' : 'Idle';

      if (!hasPermission('dashboard')) return null;

      return (
        <SectionCard
          title="Operator Progress"
          subtitle={`${activeOps.length} active · ${completedOps.length} done · ${idleOps.length} idle`}
          headerActions={
            <Link href="/work-allocation">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                Work Allocation <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          }
        >
          <div className="space-y-2">
            {operators.map(op => {
              const progress = op.ordersTotal > 0 ? (op.ordersCompleted / op.ordersTotal) * 100 : 0;
              return (
                <div key={op.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-[10px] font-bold text-gold">
                      {op.avatar}
                    </div>
                    <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card', statusColor(op.status))} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{op.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">{op.station}</span>
                    </div>
                    {op.status === 'active' && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground">{op.ordersCompleted}/{op.ordersTotal}</span>
                      </div>
                    )}
                    {op.status === 'completed' && (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> {op.ordersCompleted} orders completed
                      </p>
                    )}
                    {op.status === 'idle' && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Not assigned to any job</p>
                    )}
                  </div>
                  <span className={cn(
                    'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                    op.status === 'active' && 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
                    op.status === 'completed' && 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
                    op.status === 'idle' && 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20',
                  )}>
                    {statusLabel(op.status)}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      );
    },
  };

  const gridCols = layout.visibleCards.length <= 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : layout.visibleCards.length === 3
    ? 'grid-cols-1 sm:grid-cols-3'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <TimeRangeSelector
              preset={timeRange.preset}
              displayLabel={timeRange.displayLabel}
              customRange={timeRange.customRange}
              onPresetChange={timeRange.setPreset}
              onCustomRangeChange={timeRange.setCustomRange}
            />
            <div className="w-px h-6 bg-border" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => layout.setIsCustomizing(true)}
              className={cn(
                'gap-1.5 transition-all',
                layout.hasCustomizations && 'border-gold/30 text-gold hover:bg-gold/5',
              )}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Customize
              {layout.hasCustomizations && (
                <Sparkles className="w-3 h-3 text-gold" />
              )}
            </Button>
            <div className="w-px h-6 bg-border" />
            {/* V2 Quick Actions */}
            <Link href="/subscriptions/cycles">
              <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Create Cycle
              </Button>
            </Link>
            <Link href="/capsules">
              <Button size="sm" variant="outline" className="gap-1.5 border-purple-500/30 text-purple-600 hover:bg-purple-500/5">
                <Gem className="w-3.5 h-3.5" /> Capsule
              </Button>
            </Link>
            <Link href="/em-vault">
              <Button size="sm" variant="outline" className="gap-1.5 border-gold/30 text-gold hover:bg-gold/5">
                <Lock className="w-3.5 h-3.5" /> Vault
              </Button>
            </Link>
            <Link href="/print-queue">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Labels
              </Button>
            </Link>
            <Link href="/stations/0-stock-register">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Warehouse className="w-3.5 h-3.5" /> Intake
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        {layout.visibleCards.length > 0 ? (
          <div className={cn('grid gap-4', gridCols)}>
            <AnimatePresence mode="popLayout">
              {layout.visibleCards.map((card) => {
                const renderer = CARD_RENDERERS[card.id];
                if (!renderer) return null;
                const data = kpis ? renderer.render(kpis, formatDate) : null;
                const trend = trends[card.id];

                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  >
                    <KPICard
                      label={card.label}
                      value={data ? data.value : '—'}
                      sublabel={data ? data.sublabel : ''}
                      icon={renderer.icon}
                      variant={renderer.variant}
                      trend={trend}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <Settings2 className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">All KPI cards are hidden</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => layout.setIsCustomizing(true)}
              className="mt-3 gap-1.5 text-xs"
            >
              <Settings2 className="w-3.5 h-3.5" /> Customize Dashboard
            </Button>
          </div>
        )}

        {/* Dashboard Sections */}
        {layout.visibleSections.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {layout.visibleSections.map((section) => {
                const renderer = sectionRenderers[section.id];
                if (!renderer) return null;
                return (
                  <motion.div
                    key={section.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={cn(
                      section.id === 'revenue_analytics' && 'lg:col-span-3',
                      section.id === 'pipeline' && 'lg:col-span-2',
                      section.id === 'capsule_vault' && 'lg:col-span-1',
                      section.id === 'po_tracker' && 'lg:col-span-1',
                      section.id === 'alerts' && 'lg:col-span-1',
                      section.id === 'operator_progress' && 'lg:col-span-2',
                    )}
                  >
                    {renderer()}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      {/* Customizer Panel */}
      <DashboardCustomizer
        open={layout.isCustomizing}
        onClose={() => layout.setIsCustomizing(false)}
        cards={layout.cards}
        sections={layout.sections}
        onToggleCard={layout.toggleCardVisibility}
        onToggleSection={layout.toggleSectionVisibility}
        onReorderCards={layout.reorderCards}
        onReorderSections={layout.reorderSections}
        onReset={layout.resetToDefaults}
        hasCustomizations={layout.hasCustomizations}
      />
    </div>
  );
}
