// ============================================================
// Order Grouping — Smart Order Classification & Grouping
// Step 1 of the pipeline: Incoming orders → Classify → Group → Create Jobs
// Order categories: AuraKey Refills, Single AuraKey, First-Time Sub,
// Capsules, Gift Sets, Whisperer Vials, Full Bottles, Standard Decants
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  Layers, Package, ShoppingCart, RotateCcw, Clock, Calendar,
  ChevronDown, ChevronUp, User, MapPin, CheckCircle2, AlertTriangle,
  Boxes, Box, Tag, FlaskConical, Gift, Sparkles, Zap, Target,
  ArrowRight, Plus, Minus, GripVertical, Lock, Unlock,
  BarChart3, TrendingUp, Filter, Search, SplitSquareVertical,
  PackageCheck, Briefcase, Timer, CreditCard, Gem,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { Order, SubscriptionCycle } from '@/types';

// ---- Order Category Definitions ----
export type OrderCategory =
  | 'aurakey_refill'       // Recurring AuraKey subscription refills
  | 'aurakey_single'       // One-time single AuraKey purchase
  | 'first_time_sub'       // First subscription order (needs atomiser kit)
  | 'capsule'              // Capsule drops (limited editions)
  | 'gift_set'             // Gift sets (pre-built, custom, corporate)
  | 'whisperer_vial'       // 2ml whisperer vials
  | 'full_bottle'          // Sealed full bottles
  | 'standard_decant'      // Standard one-time decant orders
  | 'corporate_gift'       // Corporate gifting orders
  | 'ready_to_ship'        // Ready-to-ship product creation orders
  | 'exchange_vial';       // Exchange/replacement vial orders

interface CategoryMeta {
  id: OrderCategory;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  priority: 'urgent' | 'high' | 'normal' | 'cycle';
  description: string;
  deliveryMode: 'asap' | 'cycle';
}

const CATEGORIES: CategoryMeta[] = [
  { id: 'aurakey_refill', label: 'AuraKey Refills', shortLabel: 'Refills', icon: RotateCcw, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', priority: 'cycle', description: 'Monthly subscription refill vials', deliveryMode: 'cycle' },
  { id: 'aurakey_single', label: 'Single AuraKey', shortLabel: 'Single', icon: Gem, color: 'text-purple-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', priority: 'high', description: 'One-time AuraKey purchase', deliveryMode: 'asap' },
  { id: 'first_time_sub', label: 'First-Time Subscription', shortLabel: '1st Sub', icon: Sparkles, color: 'text-gold', bgColor: 'bg-gold/10', borderColor: 'border-gold/30', priority: 'urgent', description: 'New subscriber — needs welcome kit + atomiser', deliveryMode: 'asap' },
  { id: 'capsule', label: 'Capsule Orders', shortLabel: 'Capsules', icon: Target, color: 'text-rose-500', bgColor: 'bg-rose-500/10', borderColor: 'border-rose-500/30', priority: 'high', description: 'Limited edition capsule drops', deliveryMode: 'asap' },
  { id: 'gift_set', label: 'Gift Sets', shortLabel: 'Gifts', icon: Gift, color: 'text-pink-500', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/30', priority: 'high', description: 'Pre-built, custom, or seasonal gift sets', deliveryMode: 'asap' },
  { id: 'whisperer_vial', label: 'Whisperer Vials', shortLabel: 'Whisperer', icon: FlaskConical, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', priority: 'cycle', description: '2ml discovery vials for subscribers', deliveryMode: 'cycle' },
  { id: 'full_bottle', label: 'Full Bottles', shortLabel: 'Bottles', icon: Package, color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', priority: 'high', description: 'Sealed full-size bottles', deliveryMode: 'asap' },
  { id: 'standard_decant', label: 'Standard Decants', shortLabel: 'Decants', icon: Boxes, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/30', priority: 'normal', description: 'One-time decant orders (à la carte)', deliveryMode: 'asap' },
  { id: 'corporate_gift', label: 'Corporate Gifting', shortLabel: 'Corporate', icon: Briefcase, color: 'text-teal-500', bgColor: 'bg-teal-500/10', borderColor: 'border-teal-500/30', priority: 'normal', description: 'Bulk corporate gift orders', deliveryMode: 'asap' },
  { id: 'ready_to_ship', label: 'Ready-to-Ship Products', shortLabel: 'RTS', icon: PackageCheck, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30', priority: 'normal', description: 'Pre-made ready-to-ship product orders', deliveryMode: 'asap' },
  { id: 'exchange_vial', label: 'Exchange Vials', shortLabel: 'Exchange', icon: SplitSquareVertical, color: 'text-orange-500', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30', priority: 'high', description: 'Replacement or exchange vial orders', deliveryMode: 'asap' },
];

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, cycle: 3 };
const PRIORITY_COLORS: Record<string, string> = { urgent: 'text-red-500 bg-red-500/10', high: 'text-amber-500 bg-amber-500/10', normal: 'text-blue-500 bg-blue-500/10', cycle: 'text-emerald-500 bg-emerald-500/10' };

// ---- Order Group ----
export interface OrderGroup {
  id: string;
  category: OrderCategory;
  orderIds: string[];
  createdAt: string;
  locked: boolean;
  notes?: string;
}

// ---- Auto-classify an order into a category ----
function classifyOrder(order: Order): OrderCategory {
  const tags = order.tags.map(t => t.toLowerCase());
  const hasFullBottle = order.items.some(i => i.type === 'sealed_bottle');
  const hasDecant = order.items.some(i => i.type === 'decant');

  // Exchange vial
  if (tags.includes('exchange') || tags.includes('replacement') || tags.includes('exchange-vial')) return 'exchange_vial';
  // Ready-to-ship
  if (tags.includes('ready-to-ship') || tags.includes('rts') || tags.includes('pre-made')) return 'ready_to_ship';
  // Corporate gift
  if (tags.includes('corporate') || tags.includes('corporate-gift')) return 'corporate_gift';
  // Gift set
  if (tags.includes('gift-set') || tags.includes('gift') || tags.includes('gift_set')) return 'gift_set';
  // Capsule
  if (tags.includes('capsule') || tags.includes('limited-edition') || tags.includes('capsule-drop')) return 'capsule';
  // Whisperer
  if (tags.includes('whisperer') || (order.items.every(i => i.size_ml <= 2))) return 'whisperer_vial';

  // Subscription orders
  if (order.type === 'subscription') {
    if (tags.includes('first-time') || tags.includes('first_time') || tags.includes('welcome')) return 'first_time_sub';
    return 'aurakey_refill';
  }

  // One-time orders
  if (hasFullBottle && !hasDecant) return 'full_bottle';
  if (hasFullBottle && hasDecant) return 'full_bottle'; // mixed → treat as full bottle (higher priority)
  if (tags.includes('aurakey') || tags.includes('single-aurakey')) return 'aurakey_single';

  return 'standard_decant';
}

export default function OrderGrouping() {
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: cyclesRes } = useApiQuery(() => api.subscriptions.cycles(), []);

  const allOrders = (ordersRes || []) as Order[];
  const cycles = (cyclesRes || []) as SubscriptionCycle[];
  const activeCycle = cycles.find(c => ['collecting', 'processing', 'active'].includes(c.status));

  // Only show actionable orders (new, processing)
  const actionableOrders = useMemo(() =>
    allOrders.filter(o => ['new', 'processing'].includes(o.status)),
    [allOrders]
  );

  // Auto-classify all orders
  const classifiedOrders = useMemo(() =>
    actionableOrders.map(o => ({ order: o, category: classifyOrder(o) })),
    [actionableOrders]
  );

  // State
  const [groups, setGroups] = useState<OrderGroup[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<OrderCategory | 'all'>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'classify' | 'groups'>('classify');

  // Orders already in a group
  const groupedOrderIds = useMemo(() => new Set(groups.flatMap(g => g.orderIds)), [groups]);

  // Ungrouped orders per category
  const ungroupedByCategory = useMemo(() => {
    const map = new Map<OrderCategory, typeof classifiedOrders>();
    for (const co of classifiedOrders) {
      if (groupedOrderIds.has(co.order.order_id)) continue;
      const existing = map.get(co.category) || [];
      existing.push(co);
      map.set(co.category, existing);
    }
    return map;
  }, [classifiedOrders, groupedOrderIds]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      counts[cat.id] = (ungroupedByCategory.get(cat.id) || []).length;
    }
    return counts;
  }, [ungroupedByCategory]);

  // Filtered ungrouped orders
  const filteredUngrouped = useMemo(() => {
    let items = selectedCategory === 'all'
      ? classifiedOrders.filter(co => !groupedOrderIds.has(co.order.order_id))
      : (ungroupedByCategory.get(selectedCategory as OrderCategory) || []);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(co =>
        co.order.order_id.toLowerCase().includes(q) ||
        co.order.customer.name.toLowerCase().includes(q) ||
        co.order.items.some(i => i.perfume_name.toLowerCase().includes(q))
      );
    }
    return items;
  }, [selectedCategory, classifiedOrders, groupedOrderIds, ungroupedByCategory, searchQuery]);

  // KPIs
  const totalUngrouped = classifiedOrders.filter(co => !groupedOrderIds.has(co.order.order_id)).length;
  const totalGrouped = groupedOrderIds.size;
  const totalGroups = groups.length;
  const lockedGroups = groups.filter(g => g.locked).length;
  const urgentCount = classifiedOrders.filter(co => {
    const cat = CATEGORIES.find(c => c.id === co.category);
    return cat?.priority === 'urgent' && !groupedOrderIds.has(co.order.order_id);
  }).length;

  // ---- Handlers ----
  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const selectAllInCategory = (category: OrderCategory) => {
    const ids = (ungroupedByCategory.get(category) || []).map(co => co.order.order_id);
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) { ids.forEach(id => next.delete(id)); } else { ids.forEach(id => next.add(id)); }
      return next;
    });
  };

  const autoGroupAll = useCallback(() => {
    const newGroups: OrderGroup[] = [];
    for (const cat of CATEGORIES) {
      const catOrders = ungroupedByCategory.get(cat.id) || [];
      if (catOrders.length === 0) continue;
      newGroups.push({
        id: `GRP-${cat.id.toUpperCase()}-${Date.now().toString(36)}`,
        category: cat.id,
        orderIds: catOrders.map(co => co.order.order_id),
        createdAt: new Date().toISOString(),
        locked: false,
      });
    }
    if (newGroups.length === 0) {
      toast.info('No ungrouped orders to auto-group');
      return;
    }
    setGroups(prev => [...prev, ...newGroups]);
    toast.success(`${newGroups.length} groups created from ${newGroups.reduce((s, g) => s + g.orderIds.length, 0)} orders`, {
      description: 'Review groups and lock them before creating jobs.',
    });
    setViewMode('groups');
  }, [ungroupedByCategory]);

  const createGroupFromSelection = useCallback(() => {
    if (selectedOrderIds.size === 0) {
      toast.warning('Select at least one order');
      return;
    }
    // Determine dominant category
    const selectedClassified = classifiedOrders.filter(co => selectedOrderIds.has(co.order.order_id));
    const catCounts: Record<string, number> = {};
    for (const co of selectedClassified) {
      catCounts[co.category] = (catCounts[co.category] || 0) + 1;
    }
    const dominantCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as OrderCategory || 'standard_decant';

    const group: OrderGroup = {
      id: `GRP-${dominantCat.toUpperCase().slice(0, 6)}-${Date.now().toString(36)}`,
      category: dominantCat,
      orderIds: Array.from(selectedOrderIds),
      createdAt: new Date().toISOString(),
      locked: false,
    };
    setGroups(prev => [...prev, group]);
    setSelectedOrderIds(new Set());
    toast.success(`Group ${group.id} created with ${group.orderIds.length} orders`);
  }, [selectedOrderIds, classifiedOrders]);

  const lockGroup = (groupId: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, locked: true } : g));
    toast.success('Group locked — ready for job creation');
  };

  const unlockGroup = (groupId: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, locked: false } : g));
    toast.info('Group unlocked');
  };

  const removeOrderFromGroup = (groupId: string, orderId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId || g.locked) return g;
      return { ...g, orderIds: g.orderIds.filter(id => id !== orderId) };
    }).filter(g => g.orderIds.length > 0));
  };

  const deleteGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    toast.info('Group dissolved — orders returned to pool');
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  // ---- Render Helpers ----
  const getCategoryMeta = (cat: OrderCategory) => CATEGORIES.find(c => c.id === cat)!;

  const renderOrderCard = (order: Order, category: OrderCategory, selectable: boolean) => {
    const cat = getCategoryMeta(category);
    const isSelected = selectedOrderIds.has(order.order_id);
    return (
      <motion.div
        key={order.order_id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={cn(
          'p-3 rounded-lg border transition-all cursor-pointer',
          isSelected ? 'border-gold bg-gold/5 ring-1 ring-gold/30' : 'border-border bg-card hover:border-muted-foreground/30',
        )}
        onClick={() => selectable && toggleOrder(order.order_id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectable && (
              <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors', isSelected ? 'border-gold bg-gold' : 'border-muted-foreground/40')}>
                {isSelected && <CheckCircle2 className="w-3 h-3 text-gold-foreground" />}
              </div>
            )}
            <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', cat.bgColor)}>
              <cat.icon className={cn('w-3.5 h-3.5', cat.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{order.customer.name}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{order.order_id}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold">AED {order.total_amount}</p>
            <p className="text-[10px] text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', cat.bgColor, cat.color)}>
            {cat.shortLabel}
          </span>
          {order.subscription_tier && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">
              {order.subscription_tier}
            </span>
          )}
          {order.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
          ))}
          <span className="text-[9px] text-muted-foreground ml-auto">
            {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </span>
        </div>
        {order.items.length <= 3 && (
          <div className="mt-2 space-y-0.5">
            {order.items.map(item => (
              <p key={item.item_id} className="text-[10px] text-muted-foreground truncate">
                {item.perfume_name} · {item.size_ml}ml × {item.qty}
              </p>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Grouping"
        subtitle="Classify and group incoming orders before creating jobs"
        breadcrumbs={[{ label: 'Job Management' }, { label: 'Order Grouping' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={autoGroupAll} className="gap-1.5 text-xs">
              <Zap className="w-3.5 h-3.5" /> Auto-Group All
            </Button>
            <Link href="/job-creation">
              <Button size="sm" className="gap-1.5 text-xs bg-gold hover:bg-gold/90 text-gold-foreground">
                <ArrowRight className="w-3.5 h-3.5" /> Create Jobs →
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Ungrouped', value: totalUngrouped, icon: ShoppingCart, color: 'text-amber-500' },
          { label: 'Grouped', value: totalGrouped, icon: Layers, color: 'text-emerald-500' },
          { label: 'Groups', value: totalGroups, icon: SplitSquareVertical, color: 'text-blue-500' },
          { label: 'Locked', value: lockedGroups, icon: Lock, color: 'text-purple-500' },
          { label: 'Urgent', value: urgentCount, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Active Cycle', value: activeCycle ? `#${activeCycle.cycle_number || '?'}` : '—', icon: Calendar, color: 'text-teal-500' },
        ].map(kpi => (
          <div key={kpi.label} className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={cn('w-3.5 h-3.5', kpi.color)} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <Tabs value={viewMode} onValueChange={v => setViewMode(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="classify" className="gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5" /> Classify & Select
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5 text-xs">
            <Layers className="w-3.5 h-3.5" /> Groups ({groups.length})
          </TabsTrigger>
        </TabsList>

        {/* ---- CLASSIFY TAB ---- */}
        <TabsContent value="classify" className="mt-4 space-y-4">
          {/* Category Filter Bar */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                selectedCategory === 'all' ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:border-muted-foreground/50'
              )}
            >
              All ({totalUngrouped})
            </button>
            {CATEGORIES.map(cat => {
              const count = categoryCounts[cat.id] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5',
                    selectedCategory === cat.id ? cn(cat.bgColor, cat.color, cat.borderColor) : 'bg-card border-border text-muted-foreground hover:border-muted-foreground/50'
                  )}
                >
                  <cat.icon className="w-3 h-3" />
                  {cat.shortLabel} ({count})
                </button>
              );
            })}
          </div>

          {/* Search + Actions */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search orders, customers, perfumes..."
                className="w-full h-9 pl-9 pr-3 text-sm bg-background border border-input rounded-md"
              />
            </div>
            {selectedOrderIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{selectedOrderIds.size} selected</Badge>
                <Button size="sm" onClick={createGroupFromSelection} className="gap-1.5 text-xs bg-gold hover:bg-gold/90 text-gold-foreground">
                  <Plus className="w-3.5 h-3.5" /> Create Group
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedOrderIds(new Set())} className="text-xs">Clear</Button>
              </div>
            )}
          </div>

          {/* Category Sections */}
          {selectedCategory === 'all' ? (
            <div className="space-y-6">
              {CATEGORIES.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]).map(cat => {
                const catOrders = ungroupedByCategory.get(cat.id) || [];
                if (catOrders.length === 0) return null;
                return (
                  <SectionCard
                    key={cat.id}
                    title={
                      <div className="flex items-center gap-2">
                        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', cat.bgColor)}>
                          <cat.icon className={cn('w-3.5 h-3.5', cat.color)} />
                        </div>
                        <span>{cat.label}</span>
                        <Badge variant="secondary" className="text-[10px]">{catOrders.length}</Badge>
                        <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', PRIORITY_COLORS[cat.priority])}>
                          {cat.priority} · {cat.deliveryMode === 'asap' ? 'ASAP' : 'Cycle'}
                        </span>
                      </div>
                    }
                    subtitle={cat.description}
                    headerActions={
                      <Button size="sm" variant="outline" onClick={() => selectAllInCategory(cat.id)} className="text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Select All
                      </Button>
                    }
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      <AnimatePresence>
                        {catOrders.map(co => renderOrderCard(co.order, co.category, true))}
                      </AnimatePresence>
                    </div>
                  </SectionCard>
                );
              })}
              {totalUngrouped === 0 && (
                <EmptyState
                  icon={CheckCircle2}
                  title="All orders grouped"
                  description="Every incoming order has been classified and grouped. Head to the Groups tab to review and lock them."
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence>
                {filteredUngrouped.map(co => renderOrderCard(co.order, co.category, true))}
              </AnimatePresence>
              {filteredUngrouped.length === 0 && (
                <div className="col-span-full">
                  <EmptyState
                    icon={Package}
                    title="No orders in this category"
                    description="All orders of this type have been grouped or none exist."
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ---- GROUPS TAB ---- */}
        <TabsContent value="groups" className="mt-4 space-y-4">
          {groups.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No groups yet"
              description="Use the Classify tab to select orders and create groups, or click Auto-Group All."
            />
          ) : (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold">{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-muted-foreground">{totalGrouped} orders</span>
                  <span className="text-xs text-emerald-500 font-medium">{lockedGroups} locked</span>
                </div>
                <div className="flex items-center gap-2">
                  {groups.some(g => !g.locked) && (
                    <Button size="sm" variant="outline" onClick={() => setGroups(prev => prev.map(g => ({ ...g, locked: true })))} className="text-xs gap-1">
                      <Lock className="w-3 h-3" /> Lock All
                    </Button>
                  )}
                  {lockedGroups > 0 && (
                    <Link href="/job-creation">
                      <Button size="sm" className="gap-1.5 text-xs bg-gold hover:bg-gold/90 text-gold-foreground">
                        <Briefcase className="w-3.5 h-3.5" /> Create Jobs from Groups →
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Group Cards */}
              {groups.sort((a, b) => {
                const aCat = getCategoryMeta(a.category);
                const bCat = getCategoryMeta(b.category);
                return PRIORITY_ORDER[aCat.priority] - PRIORITY_ORDER[bCat.priority];
              }).map(group => {
                const cat = getCategoryMeta(group.category);
                const isExpanded = expandedGroups.has(group.id);
                const groupOrders = allOrders.filter(o => group.orderIds.includes(o.order_id));
                const totalAmount = groupOrders.reduce((s, o) => s + o.total_amount, 0);
                const totalItems = groupOrders.reduce((s, o) => s + o.items.length, 0);

                return (
                  <motion.div
                    key={group.id}
                    layout
                    className={cn(
                      'rounded-xl border overflow-hidden transition-colors',
                      group.locked ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card',
                    )}
                  >
                    {/* Group Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => toggleGroupExpand(group.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', cat.bgColor)}>
                          <cat.icon className={cn('w-4.5 h-4.5', cat.color)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold">{cat.label}</p>
                            {group.locked && <Lock className="w-3 h-3 text-emerald-500" />}
                            <Badge variant="secondary" className="text-[10px]">{group.orderIds.length} orders</Badge>
                            <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', PRIORITY_COLORS[cat.priority])}>
                              {cat.priority}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">{group.id} · AED {totalAmount.toLocaleString()} · {totalItems} items</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!group.locked ? (
                          <>
                            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); lockGroup(group.id); }} className="text-xs gap-1">
                              <Lock className="w-3 h-3" /> Lock
                            </Button>
                            <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); deleteGroup(group.id); }} className="text-xs text-destructive">
                              Dissolve
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); unlockGroup(group.id); }} className="text-xs gap-1">
                            <Unlock className="w-3 h-3" /> Unlock
                          </Button>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded Orders */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border"
                        >
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {groupOrders.map(order => (
                              <div key={order.order_id} className="relative">
                                {renderOrderCard(order, group.category, false)}
                                {!group.locked && (
                                  <button
                                    onClick={() => removeOrderFromGroup(group.id, order.order_id)}
                                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
