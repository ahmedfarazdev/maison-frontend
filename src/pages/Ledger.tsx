// ============================================================
// Ledger — Bottle, Decant & Purchase audit trail
// Design: "Maison Ops" — Luxury Operations
// Now includes a unified timeline view combining all event types
// Purchase data pulled from DB-backed API (not mock data)
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge } from '@/components/shared';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  BookOpen, Search, Download, Filter, ArrowUpDown, ShoppingCart, Package,
  Droplets, Clock, ArrowDown, ArrowUp, LayoutList, History,
  FlaskConical, Box, Truck, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBottleLedger } from '@/lib/inventory-store';
import type { BottleLedgerEvent, DecantLedgerEvent } from '@/types';
import { toast } from 'sonner';

type LedgerTab = 'timeline' | 'bottle' | 'decant' | 'purchase';
type EventCategory = 'all' | 'intake' | 'decant' | 'conversion' | 'purchase' | 'packaging' | 'adjustment';

// ---- Unified Timeline Event ----
interface TimelineEvent {
  id: string;
  timestamp: string;
  category: EventCategory;
  type: string;
  title: string;
  subtitle: string;
  detail: string;
  quantity: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  raw: BottleLedgerEvent | DecantLedgerEvent | PurchaseLedgerEvent;
}

// ---- Purchase Ledger Event (derived from DB POs) ----
interface PurchaseLedgerEvent {
  event_id: string;
  purchase_id: string;
  supplier_id: string;
  supplier_name: string;
  date: string;
  master_id: string;
  perfume_name: string;
  qty: number;
  size_ml: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  invoice_ref?: string;
  type: 'PURCHASE_INTAKE';
}

// ---- Generate purchase ledger from DB PO data ----
function generatePurchaseLedgerFromPOs(posData: any[]): PurchaseLedgerEvent[] {
  const events: PurchaseLedgerEvent[] = [];
  let counter = 1;
  for (const po of posData) {
    // Only include confirmed POs in the purchase ledger
    if (po.status !== 'confirmed') continue;
    const poId = po.poId || po.po_number || `PO-${po.id}`;
    const supplierName = po.supplierName || po.supplier_name || 'Unknown';
    const supplierId = String(po.supplierId || po.supplier_id || '');
    const poDate = po.confirmedAt || po.updatedAt || po.createdAt || po.created_at || '';
    const invoiceRef = po.invoiceRef || po.invoice_ref || '';

    for (const item of (po.items || [])) {
      const perfumeName = item.perfumeName || item.perfume_name || 'Unknown';
      const masterId = item.masterId || item.master_id || '';
      const qty = item.qty || item.quantity || 0;
      const sizeMl = item.sizeMl || item.size_ml || 0;
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
      events.push({
        event_id: `ple_${String(counter++).padStart(3, '0')}`,
        purchase_id: poId,
        supplier_id: supplierId,
        supplier_name: supplierName,
        date: poDate,
        master_id: masterId,
        perfume_name: perfumeName,
        qty,
        size_ml: sizeMl,
        unit_price: unitPrice,
        total_amount: qty * unitPrice,
        currency: 'AED',
        invoice_ref: invoiceRef || undefined,
        type: 'PURCHASE_INTAKE',
      });
    }
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  return events;
}

// ---- Packaging Ledger Event (derived from DB packaging POs) ----
interface PackagingLedgerEvent {
  event_id: string;
  purchase_id: string;
  supplier_name: string;
  date: string;
  sku_id: string;
  sku_name: string;
  qty: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  type: 'PACKAGING_INTAKE';
}

// ---- Generate packaging ledger from DB packaging PO data ----
function generatePackagingLedgerFromPOs(posData: any[]): PackagingLedgerEvent[] {
  const events: PackagingLedgerEvent[] = [];
  let counter = 1;
  for (const po of posData) {
    if (po.status !== 'confirmed') continue;
    const poId = po.poId || `PKG-${po.id}`;
    const supplierName = po.supplierName || 'Unknown';
    const poDate = po.confirmedAt || po.updatedAt || po.createdAt || '';
    for (const item of (po.items || [])) {
      const skuName = item.perfumeName || item.skuName || 'Unknown';
      const skuId = item.masterId || item.skuId || '';
      const qty = item.qty || 0;
      const unitPrice = Number(item.unitPrice ?? 0);
      events.push({
        event_id: `pkg_${String(counter++).padStart(3, '0')}`,
        purchase_id: poId,
        supplier_name: supplierName,
        date: poDate,
        sku_id: skuId,
        sku_name: skuName,
        qty,
        unit_price: unitPrice,
        total_amount: qty * unitPrice,
        currency: 'AED',
        type: 'PACKAGING_INTAKE',
      });
    }
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  return events;
}

// ---- Map event type to category ----
function getEventCategory(type: string): EventCategory {
  if (['INTAKE', 'STOCK_IN', 'SEALED_INTAKE', 'DECANTING_INTAKE'].includes(type)) return 'intake';
  if (['DECANT', 'BATCH_DECANT', 'MANUAL_DECANT'].includes(type)) return 'decant';
  if (['CONVERT_TO_DECANTING', 'OPEN_SEALED', 'TRANSFER'].includes(type)) return 'conversion';
  if (['PURCHASE_INTAKE'].includes(type)) return 'purchase';
  if (['PACKAGING_INTAKE'].includes(type)) return 'packaging';
  return 'adjustment';
}

// ---- Map event to icon/color ----
function getEventVisuals(category: EventCategory): { icon: React.ElementType; color: string; bgColor: string; borderColor: string } {
  switch (category) {
    case 'intake': return { icon: ArrowDown, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' };
    case 'decant': return { icon: FlaskConical, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' };
    case 'conversion': return { icon: RefreshCw, color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' };
    case 'purchase': return { icon: ShoppingCart, color: 'text-violet-500', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/30' };
    case 'packaging': return { icon: Package, color: 'text-teal-500', bgColor: 'bg-teal-500/10', borderColor: 'border-teal-500/30' };
    default: return { icon: Box, color: 'text-muted-foreground', bgColor: 'bg-muted/30', borderColor: 'border-border' };
  }
}

// ---- Build unified timeline ----
function buildTimeline(
  bottleEvents: BottleLedgerEvent[],
  decantEvents: DecantLedgerEvent[],
  purchaseEvents: PurchaseLedgerEvent[],
  packagingEvents: PackagingLedgerEvent[] = [],
): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];

  for (const e of bottleEvents) {
    const category = getEventCategory(e.type);
    const visuals = getEventVisuals(category);
    timeline.push({
      id: e.event_id,
      timestamp: e.created_at,
      category,
      type: e.type,
      title: e.bottle_id,
      subtitle: e.type.replace(/_/g, ' '),
      detail: e.reason || '—',
      quantity: e.qty_ml ? `${e.qty_ml}ml` : '—',
      ...visuals,
      raw: e,
    });
  }

  for (const e of decantEvents) {
    const visuals = getEventVisuals('decant');
    timeline.push({
      id: e.event_id,
      timestamp: e.created_at,
      category: 'decant',
      type: e.type,
      title: e.bottle_id,
      subtitle: `Decant · ${e.type.replace(/_/g, ' ')}`,
      detail: e.notes || (e.job_id ? `Job ${e.job_id}` : '—'),
      quantity: `${e.qty_ml}ml → ${e.units_produced || '?'} units`,
      ...visuals,
      raw: e,
    });
  }

  for (const e of purchaseEvents) {
    const visuals = getEventVisuals('purchase');
    timeline.push({
      id: e.event_id,
      timestamp: e.date,
      category: 'purchase',
      type: 'PURCHASE_INTAKE',
      title: e.perfume_name,
      subtitle: `PO ${e.purchase_id} · ${e.supplier_name}`,
      detail: e.invoice_ref ? `Invoice: ${e.invoice_ref}` : '—',
      quantity: `${e.qty}× ${e.size_ml}ml · AED ${e.total_amount.toLocaleString()}`,
      ...visuals,
      raw: e,
    });
  }

  for (const e of packagingEvents) {
    const visuals = getEventVisuals('packaging');
    timeline.push({
      id: e.event_id,
      timestamp: e.date,
      category: 'packaging',
      type: 'PACKAGING_INTAKE',
      title: e.sku_name,
      subtitle: `PO ${e.purchase_id} · ${e.supplier_name}`,
      detail: `${e.qty}× @ AED ${e.unit_price.toFixed(2)}`,
      quantity: `AED ${e.total_amount.toLocaleString()}`,
      ...visuals,
      raw: e as any,
    });
  }

  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return timeline;
}

// ---- CSV Export ----
function exportLedgerCsv(tab: LedgerTab, data: unknown[]) {
  let csv = '';
  if (tab === 'bottle' || tab === 'timeline') {
    const events = data as BottleLedgerEvent[];
    const headers = ['Timestamp', 'Bottle ID', 'Event Type', 'Qty ML', 'Reason', 'Job ID', 'Operator'];
    const rows = events.map(e => [
      e.created_at, e.bottle_id, e.type, e.qty_ml?.toString() || '', e.reason, e.job_id || '', e.user_id,
    ]);
    csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  } else if (tab === 'decant') {
    const events = data as DecantLedgerEvent[];
    const headers = ['Timestamp', 'Bottle ID', 'Event Type', 'Qty ML', 'Units Produced', 'Job ID', 'Operator', 'Notes'];
    const rows = events.map(e => [
      e.created_at, e.bottle_id, e.type, String(e.qty_ml), String(e.units_produced || ''), e.job_id || '', e.user_id, e.notes,
    ]);
    csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  } else {
    const events = data as PurchaseLedgerEvent[];
    const headers = ['Date', 'PO ID', 'Invoice', 'Supplier', 'Perfume', 'Master ID', 'Qty', 'Size ML', 'Unit Price', 'Total', 'Currency'];
    const rows = events.map(e => [
      e.date, e.purchase_id, e.invoice_ref || '', e.supplier_name, e.perfume_name, e.master_id,
      String(e.qty), String(e.size_ml), String(e.unit_price), String(e.total_amount), 'AED',
    ]);
    csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ledger-${tab}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success(`${tab} ledger exported`);
}

// ---- Category Filter Chips ----
const CATEGORY_FILTERS: { key: EventCategory; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'all', label: 'All Events', icon: LayoutList, color: 'text-foreground' },
  { key: 'intake', label: 'Intake', icon: ArrowDown, color: 'text-emerald-500' },
  { key: 'decant', label: 'Decant', icon: FlaskConical, color: 'text-blue-500' },
  { key: 'conversion', label: 'Conversion', icon: RefreshCw, color: 'text-amber-500' },
  { key: 'purchase', label: 'Purchase', icon: ShoppingCart, color: 'text-violet-500' },
  { key: 'packaging', label: 'Packaging', icon: Package, color: 'text-teal-500' },
  { key: 'adjustment', label: 'Adjustment', icon: Box, color: 'text-muted-foreground' },
];

// Tab-specific titles and subtitles for standalone page views
const TAB_META: Record<LedgerTab, { title: string; subtitle: string }> = {
  timeline: { title: 'Ledger Timeline', subtitle: 'Unified audit trail combining all event types' },
  bottle: { title: 'Bottle Ledger', subtitle: 'Complete audit trail for bottle movements and status changes' },
  decant: { title: 'Decant Ledger', subtitle: 'All decanting operations, volumes, and operator records' },
  purchase: { title: 'Purchase Ledger', subtitle: 'Supplier purchase intake events from confirmed purchase orders' },
};

export default function Ledger({ defaultTab }: { defaultTab?: LedgerTab } = {}) {
  // When defaultTab is provided (navigated from sidebar), lock to that tab and hide tab bar
  const isStandalone = !!defaultTab;
  const [tab, setTab] = useState<LedgerTab>(defaultTab || 'timeline');
  const { data: decantRes } = useApiQuery(() => api.ledger.decant(), []);
  const decantEvents = (decantRes || []) as DecantLedgerEvent[];
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory>('all');

  // Live bottle ledger from shared store
  const bottleEvents = useBottleLedger();

  // Purchase data from DB API
  const { data: posData } = useApiQuery(() => api.purchaseOrders.list(), []);
  const purchaseEvents = useMemo(() => {
    const raw = (posData as any)?.data || [];
    return generatePurchaseLedgerFromPOs(raw);
  }, [posData]);

  // Packaging purchase data from DB API
  const { data: pkgPosData } = useApiQuery<any[]>(() => api.mutations.packagingPOs.list(), []);
  const packagingEvents = useMemo(() => {
    if (!pkgPosData || !Array.isArray(pkgPosData)) return [];
    return generatePackagingLedgerFromPOs(pkgPosData);
  }, [pkgPosData]);

  // Build unified timeline
  const timeline = useMemo(
    () => buildTimeline(bottleEvents, decantEvents, purchaseEvents, packagingEvents),
    [bottleEvents, decantEvents, purchaseEvents, packagingEvents],
  );

  // Filtered timeline
  const filteredTimeline = useMemo(() => {
    let result = timeline;
    if (categoryFilter !== 'all') {
      result = result.filter(e => e.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.subtitle.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q)
      );
    }
    if (sortOrder === 'oldest') {
      result = [...result].reverse();
    }
    return result;
  }, [timeline, categoryFilter, search, sortOrder]);

  // Category counts for chips
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: timeline.length };
    for (const e of timeline) {
      counts[e.category] = (counts[e.category] || 0) + 1;
    }
    return counts;
  }, [timeline]);

  // Purchase ledger stats
  const purchaseStats = useMemo(() => {
    const totalAmount = purchaseEvents.reduce((s, e) => s + e.total_amount, 0);
    const totalItems = purchaseEvents.reduce((s, e) => s + e.qty, 0);
    const uniqueSuppliers = new Set(purchaseEvents.map(e => e.supplier_id)).size;
    const uniquePOs = new Set(purchaseEvents.map(e => e.purchase_id)).size;
    return { totalAmount, totalItems, uniqueSuppliers, uniquePOs };
  }, [purchaseEvents]);

  // Filtered + sorted bottle events
  const filteredBottleEvents = useMemo(() => {
    let result = bottleEvents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        `${e.bottle_id} ${e.type} ${e.reason}`.toLowerCase().includes(q)
      );
    }
    if (sortOrder === 'oldest') result = [...result].reverse();
    return result;
  }, [bottleEvents, search, sortOrder]);

  // Filtered + sorted purchase events
  const filteredPurchaseEvents = useMemo(() => {
    let result = purchaseEvents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.perfume_name.toLowerCase().includes(q) ||
        e.supplier_name.toLowerCase().includes(q) ||
        e.master_id.toLowerCase().includes(q) ||
        e.purchase_id.toLowerCase().includes(q) ||
        (e.invoice_ref || '').toLowerCase().includes(q)
      );
    }
    if (sortOrder === 'oldest') result = [...result].reverse();
    return result;
  }, [purchaseEvents, search, sortOrder]);

  const tabConfig: { key: LedgerTab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'timeline', label: 'Timeline', icon: History, count: timeline.length },
    { key: 'bottle', label: 'Bottle Ledger', icon: Package, count: bottleEvents.length },
    { key: 'decant', label: 'Decant Ledger', icon: Droplets, count: decantEvents.length },
    { key: 'purchase', label: 'Purchase Ledger', icon: ShoppingCart, count: purchaseEvents.length },

  ];

  // Group timeline events by date for the timeline view
  const groupedTimeline = useMemo(() => {
    const groups: { date: string; events: TimelineEvent[] }[] = [];
    let currentDate = '';
    for (const event of filteredTimeline) {
      const dateStr = new Date(event.timestamp).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ date: dateStr, events: [] });
      }
      groups[groups.length - 1].events.push(event);
    }
    return groups;
  }, [filteredTimeline]);

  return (
    <div>
      <PageHeader
        title={isStandalone ? TAB_META[tab].title : 'Ledger'}
        subtitle={isStandalone ? TAB_META[tab].subtitle : 'Complete audit trail for bottles, decants, and supplier purchases'}
        breadcrumbs={isStandalone ? [{ label: 'Ledger' }, { label: TAB_META[tab].title }] : [{ label: 'Ledger' }]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border transition-all">
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </button>
            <button onClick={() => {
              const data = tab === 'bottle' ? bottleEvents : tab === 'decant' ? decantEvents : purchaseEvents;
              exportLedgerCsv(tab, data);
            }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border transition-all">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        {/* Tab Bar + Search — only show tab bar when NOT in standalone mode */}
        <div className="flex items-center gap-3 flex-wrap">
          {!isStandalone && (
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {tabConfig.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={cn('flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-colors',
                      tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                    <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full',
                      tab === t.key ? 'bg-gold/10 text-gold' : 'bg-muted-foreground/10')}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className={cn('relative', isStandalone ? 'flex-1 max-w-md' : 'flex-1 max-w-sm')}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isStandalone ? `Search ${TAB_META[tab].title.toLowerCase()}...` : 'Search events...'}
              className="w-full h-9 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
          </div>
        </div>

        {/* ====== TIMELINE VIEW ====== */}
        {tab === 'timeline' && (
          <>
            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORY_FILTERS.map(f => {
                const Icon = f.icon;
                const count = categoryCounts[f.key] || 0;
                const isActive = categoryFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setCategoryFilter(f.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      isActive
                        ? 'bg-card border-gold/30 text-foreground shadow-sm'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    <Icon className={cn('w-3 h-3', isActive ? f.color : '')} />
                    {f.label}
                    <span className={cn(
                      'text-[10px] font-mono px-1 py-0.5 rounded-full',
                      isActive ? 'bg-gold/10 text-gold' : 'bg-muted-foreground/10',
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Timeline Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-card border border-border rounded-lg p-3 border-l-[3px] border-l-emerald-500">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Intakes</p>
                <p className="text-lg font-mono font-bold mt-0.5">{categoryCounts['intake'] || 0}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 border-l-[3px] border-l-blue-500">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Decants</p>
                <p className="text-lg font-mono font-bold mt-0.5">{categoryCounts['decant'] || 0}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 border-l-[3px] border-l-amber-500">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Conversions</p>
                <p className="text-lg font-mono font-bold mt-0.5">{categoryCounts['conversion'] || 0}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 border-l-[3px] border-l-violet-500">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Purchases</p>
                <p className="text-lg font-mono font-bold mt-0.5">{categoryCounts['purchase'] || 0}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 border-l-[3px] border-l-muted-foreground">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Adjustments</p>
                <p className="text-lg font-mono font-bold mt-0.5">{categoryCounts['adjustment'] || 0}</p>
              </div>
            </div>

            {/* Grouped Timeline */}
            <div className="space-y-6">
              {groupedTimeline.map(group => (
                <div key={group.date}>
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">{group.date}</span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-mono text-muted-foreground">{group.events.length} events</span>
                  </div>

                  {/* Events */}
                  <div className="relative pl-8 space-y-1">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[13px] top-0 bottom-0 w-px bg-border" />

                    {group.events.map(event => {
                      const Icon = event.icon;
                      return (
                        <div key={event.id} className="relative group">
                          {/* Timeline dot */}
                          <div className={cn(
                            'absolute -left-8 top-3 w-[26px] h-[26px] rounded-full flex items-center justify-center z-10 border-2 border-background',
                            event.bgColor,
                          )}>
                            <Icon className={cn('w-3 h-3', event.color)} />
                          </div>

                          {/* Event Card */}
                          <div className={cn(
                            'ml-2 p-3 rounded-lg border transition-all hover:shadow-sm',
                            event.borderColor,
                            'bg-card hover:bg-muted/20',
                          )}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-mono font-semibold">{event.title}</span>
                                  <StatusBadge variant={
                                    event.category === 'intake' ? 'success' :
                                    event.category === 'decant' ? 'info' :
                                    event.category === 'conversion' ? 'warning' :
                                    event.category === 'purchase' ? 'gold' : 'muted'
                                  }>
                                    {event.subtitle}
                                  </StatusBadge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{event.detail}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-mono font-semibold">{event.quantity}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {new Date(event.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {filteredTimeline.length === 0 && (
                <div className="text-center py-16">
                  <History className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No events match your filters</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting the category filter or search term</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ====== BOTTLE LEDGER ====== */}
        {tab === 'bottle' && (
          <SectionCard title="Bottle Events" subtitle={`${filteredBottleEvents.length} events (live)`}>
            <div className="overflow-x-auto -m-4">
              <table className="w-full ops-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Timestamp</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Bottle ID</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Event</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Qty</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Operator</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBottleEvents.map((e, i) => (
                    <tr key={`${e.event_id}-${i}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                        {new Date(e.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono font-medium">{e.bottle_id}</td>
                      <td className="px-4 py-2">
                        <StatusBadge variant={e.type === 'ALLOCATED' ? 'success' : e.type === 'DECANTED_OUT' ? 'info' : 'muted'}>
                          {e.type}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-2 text-sm font-mono">{e.qty_ml ? `${e.qty_ml}ml` : '—'}</td>
                      <td className="px-4 py-2 text-sm">{e.user_id}</td>
                      <td className="px-4 py-2 text-sm text-muted-foreground max-w-xs truncate">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredBottleEvents.length === 0 && (
              <div className="text-center py-10">
                <Package className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No bottle events match your search</p>
              </div>
            )}
          </SectionCard>
        )}

        {/* ====== DECANT LEDGER ====== */}
        {tab === 'decant' && (
          <SectionCard title="Decant Events" subtitle={`${decantEvents.length} events`}>
            <div className="overflow-x-auto -m-4">
              <table className="w-full ops-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Timestamp</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Bottle ID</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Job ID</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">ML</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {decantEvents.filter(e => !search || `${e.bottle_id} ${e.job_id}`.toLowerCase().includes(search.toLowerCase())).map((e, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                        {new Date(e.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono">{e.bottle_id}</td>
                      <td className="px-4 py-2 text-sm font-mono">{e.job_id || '—'}</td>
                      <td className="px-4 py-2 text-sm font-mono font-semibold text-gold">{e.qty_ml}ml</td>
                      <td className="px-4 py-2 text-sm">{e.user_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* ====== PURCHASE LEDGER ====== */}
        {tab === 'purchase' && (
          <>
            {/* Purchase KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-gold">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Spent</p>
                <p className="text-xl font-mono font-bold mt-1">AED {purchaseStats.totalAmount.toLocaleString()}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-blue-500">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Items Purchased</p>
                <p className="text-xl font-mono font-bold mt-1">{purchaseStats.totalItems}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-emerald-500">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Purchase Orders</p>
                <p className="text-xl font-mono font-bold mt-1">{purchaseStats.uniquePOs}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-violet-500">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Suppliers</p>
                <p className="text-xl font-mono font-bold mt-1">{purchaseStats.uniqueSuppliers}</p>
              </div>
            </div>

            {/* Purchase Events Table */}
            <SectionCard title="Purchase Intake Events" subtitle={`${filteredPurchaseEvents.length} transactions from ${purchaseStats.uniquePOs} purchase orders`}>
              <div className="overflow-x-auto -m-4">
                <table className="w-full ops-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Date</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">PO / Invoice</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Supplier</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Perfume</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Master ID</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Qty</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Size</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Unit Price</th>
                      <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Total</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchaseEvents.map((e) => (
                      <tr key={e.event_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                          {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-2.5">
                          <div>
                            <span className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded">{e.purchase_id}</span>
                            {e.invoice_ref && (
                              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Inv: {e.invoice_ref}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm">{e.supplier_name}</td>
                        <td className="px-4 py-2.5 text-sm font-medium">{e.perfume_name}</td>
                        <td className="px-4 py-2.5 text-[11px] font-mono text-muted-foreground">{e.master_id}</td>
                        <td className="px-4 py-2.5 text-sm font-mono text-right">{e.qty}</td>
                        <td className="px-4 py-2.5 text-sm font-mono text-right">{e.size_ml}ml</td>
                        <td className="px-4 py-2.5 text-sm font-mono text-right">AED {e.unit_price}</td>
                        <td className="px-4 py-2.5 text-sm font-mono font-bold text-gold text-right">AED {e.total_amount.toLocaleString()}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge variant="gold">PURCHASE INTAKE</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredPurchaseEvents.length === 0 && (
                <div className="text-center py-10">
                  <ShoppingCart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No purchase events yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Confirmed purchase orders will appear here</p>
                </div>
              )}
            </SectionCard>
            </>)
        }

      </div>
    </div>
  );
}

// NOTE: RTS Finance Ledger has been extracted to its own page at /ready-to-ship/rts-finance
// See: client/src/pages/inventory/RTSFinance.tsx
