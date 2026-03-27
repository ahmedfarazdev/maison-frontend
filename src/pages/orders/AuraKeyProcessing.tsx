// ============================================================
// AuraKey & Refills Processing — On-demand order fulfillment
// Handles: AuraKey orders, AuraKey refills, Whisper vials (1ml/2ml)
// These require the full decanting pipeline (S1→S6)
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Droplets, Key, RefreshCw, Wind, Package, Clock, User,
  ChevronRight, Eye, Play, CheckCircle2, AlertTriangle,
  Search, Filter, ArrowRight, X, MapPin, Calendar,
  FlaskConical, Tag, Truck, PackageCheck, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---- Types ----
type OrderType = 'aura_key' | 'aura_key_refill' | 'whisper_1ml' | 'whisper_2ml';
type OrderStatus = 'new' | 'queued' | 'picking' | 'labelling' | 'decanting' | 'packing' | 'shipped' | 'completed';

interface AuraKeyOrder {
  id: string;
  orderRef: string;
  type: OrderType;
  customer: string;
  email: string;
  perfume: string;
  aura: string;
  size: string;
  quantity: number;
  status: OrderStatus;
  createdAt: string;
  priority: 'normal' | 'rush';
  notes?: string;
}

// ---- Mock Data ----
const MOCK_ORDERS: AuraKeyOrder[] = [
  { id: 'ak-001', orderRef: 'ORD-2026-0891', type: 'aura_key', customer: 'Layla H.', email: 'layla@email.com', perfume: 'Baccarat Rouge 540', aura: 'Ember', size: '7.5ml', quantity: 1, status: 'new', createdAt: '2026-02-27', priority: 'normal' },
  { id: 'ak-002', orderRef: 'ORD-2026-0892', type: 'aura_key_refill', customer: 'Omar S.', email: 'omar@email.com', perfume: 'Aventus', aura: 'Titan', size: '7.5ml', quantity: 2, status: 'queued', createdAt: '2026-02-27', priority: 'rush' },
  { id: 'ak-003', orderRef: 'ORD-2026-0893', type: 'whisper_1ml', customer: 'Sara K.', email: 'sara@email.com', perfume: 'Lost Cherry', aura: 'Velvet', size: '1ml', quantity: 3, status: 'picking', createdAt: '2026-02-26', priority: 'normal' },
  { id: 'ak-004', orderRef: 'ORD-2026-0894', type: 'whisper_2ml', customer: 'Ahmed R.', email: 'ahmed@email.com', perfume: 'Oud Wood', aura: 'Mystic', size: '2ml', quantity: 1, status: 'decanting', createdAt: '2026-02-26', priority: 'normal' },
  { id: 'ak-005', orderRef: 'ORD-2026-0895', type: 'aura_key', customer: 'Fatima A.', email: 'fatima@email.com', perfume: 'Delina', aura: 'Bloom', size: '7.5ml', quantity: 1, status: 'packing', createdAt: '2026-02-25', priority: 'rush' },
  { id: 'ak-006', orderRef: 'ORD-2026-0896', type: 'aura_key_refill', customer: 'Khalid M.', email: 'khalid@email.com', perfume: 'Layton', aura: 'Titan', size: '7.5ml', quantity: 1, status: 'shipped', createdAt: '2026-02-25', priority: 'normal' },
  { id: 'ak-007', orderRef: 'ORD-2026-0897', type: 'whisper_1ml', customer: 'Nora T.', email: 'nora@email.com', perfume: 'BR540 Extrait', aura: 'Ember', size: '1ml', quantity: 5, status: 'new', createdAt: '2026-02-28', priority: 'normal' },
  { id: 'ak-008', orderRef: 'ORD-2026-0898', type: 'aura_key', customer: 'Youssef B.', email: 'youssef@email.com', perfume: 'Tobacco Vanille', aura: 'Mystic', size: '7.5ml', quantity: 1, status: 'labelling', createdAt: '2026-02-27', priority: 'normal' },
];

const TYPE_CONFIG: Record<OrderType, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  aura_key: { label: 'AuraKey', icon: Key, color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  aura_key_refill: { label: 'AuraKey Refill', icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  whisper_1ml: { label: 'Whisper 1ml', icon: Wind, color: 'text-purple-600', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
  whisper_2ml: { label: 'Whisper 2ml', icon: Wind, color: 'text-rose-600', bgColor: 'bg-rose-500/10', borderColor: 'border-rose-500/30' },
};

const PIPELINE_STAGES: { id: OrderStatus; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'new', label: 'New', icon: ClipboardList, color: 'bg-slate-500' },
  { id: 'queued', label: 'Queued', icon: ClipboardList, color: 'bg-slate-600' },
  { id: 'picking', label: 'Picking', icon: Package, color: 'bg-amber-500' },
  { id: 'labelling', label: 'Labels', icon: Tag, color: 'bg-blue-500' },
  { id: 'decanting', label: 'Decant', icon: FlaskConical, color: 'bg-purple-500' },
  { id: 'packing', label: 'Pack', icon: PackageCheck, color: 'bg-orange-500' },
  { id: 'shipped', label: 'Ship', icon: Truck, color: 'bg-emerald-500' },
  { id: 'completed', label: 'Done', icon: CheckCircle2, color: 'bg-emerald-600' },
];

const STATUS_VARIANT: Record<string, 'muted' | 'info' | 'gold' | 'success' | 'warning'> = {
  new: 'muted', queued: 'muted', picking: 'info', labelling: 'gold', decanting: 'info', packing: 'gold', shipped: 'success', completed: 'success',
};

export default function AuraKeyProcessing() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<AuraKeyOrder[]>(MOCK_ORDERS);
  const [selectedOrder, setSelectedOrder] = useState<AuraKeyOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filtered orders
  const filtered = useMemo(() => {
    let result = orders;
    if (activeTab !== 'all') result = result.filter(o => o.type === activeTab);
    if (statusFilter !== 'all') result = result.filter(o => o.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.customer.toLowerCase().includes(q) ||
        o.orderRef.toLowerCase().includes(q) ||
        o.perfume.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, activeTab, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: orders.length,
    newOrders: orders.filter(o => o.status === 'new').length,
    inProgress: orders.filter(o => !['new', 'shipped', 'completed'].includes(o.status)).length,
    completed: orders.filter(o => ['shipped', 'completed'].includes(o.status)).length,
    rush: orders.filter(o => o.priority === 'rush').length,
    byType: {
      aura_key: orders.filter(o => o.type === 'aura_key').length,
      aura_key_refill: orders.filter(o => o.type === 'aura_key_refill').length,
      whisper_1ml: orders.filter(o => o.type === 'whisper_1ml').length,
      whisper_2ml: orders.filter(o => o.type === 'whisper_2ml').length,
    },
  }), [orders]);

  // Advance order to next stage
  const advanceOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === o.status);
      if (currentIdx < PIPELINE_STAGES.length - 1) {
        const nextStatus = PIPELINE_STAGES[currentIdx + 1].id;
        toast.success(`${o.orderRef} advanced to ${PIPELINE_STAGES[currentIdx + 1].label}`);
        return { ...o, status: nextStatus };
      }
      return o;
    }));
  };

  // Queue new order
  const queueOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'queued' as OrderStatus } : o));
    toast.success('Order queued for processing');
  };

  return (
    <div>
      <PageHeader
        title="AuraKey & Refills"
        subtitle="On-demand order processing — full decanting pipeline (S1→S6)"
        breadcrumbs={[
          { label: 'Orders & CX' },
          { label: 'AuraKey & Refills' },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-border/50 bg-card">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Total Orders</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-[9px]">{stats.byType.aura_key} AuraKey</Badge>
              <Badge variant="outline" className="text-[9px]">{stats.byType.aura_key_refill} Refills</Badge>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03]">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">New / Unqueued</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.newOrders}</p>
            <p className="text-[10px] text-muted-foreground">Awaiting queue assignment</p>
          </div>
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.03]">
            <div className="flex items-center gap-2 mb-1">
              <Play className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            <p className="text-[10px] text-muted-foreground">Across S1–S6 stations</p>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03]">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Shipped / Done</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
            {stats.rush > 0 && <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-600 mt-1">{stats.rush} rush</Badge>}
          </div>
        </div>

        {/* Pipeline Overview */}
        <SectionCard title="Processing Pipeline" subtitle="Full decanting flow — same as subscription first order">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = orders.filter(o => o.status === stage.id).length;
              const Icon = stage.icon;
              return (
                <div key={stage.id} className="flex items-center">
                  <button
                    onClick={() => setStatusFilter(statusFilter === stage.id ? 'all' : stage.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-xs whitespace-nowrap',
                      statusFilter === stage.id ? 'border-gold bg-gold/10 ring-1 ring-gold/30' : 'border-border/50 hover:bg-muted/30',
                    )}
                  >
                    <div className={cn('w-2 h-2 rounded-full', stage.color)} />
                    <Icon className="w-3 h-3" />
                    <span className="font-medium">{stage.label}</span>
                    <span className="text-muted-foreground">({count})</span>
                  </button>
                  {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 mx-0.5 shrink-0" />}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Type Tabs + Order List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="all" className="text-xs">All ({orders.length})</TabsTrigger>
              <TabsTrigger value="aura_key" className="text-xs gap-1"><Key className="w-3 h-3" /> AuraKey ({stats.byType.aura_key})</TabsTrigger>
              <TabsTrigger value="aura_key_refill" className="text-xs gap-1"><RefreshCw className="w-3 h-3" /> Refills ({stats.byType.aura_key_refill})</TabsTrigger>
              <TabsTrigger value="whisper_1ml" className="text-xs gap-1"><Wind className="w-3 h-3" /> 1ml ({stats.byType.whisper_1ml})</TabsTrigger>
              <TabsTrigger value="whisper_2ml" className="text-xs gap-1"><Wind className="w-3 h-3" /> 2ml ({stats.byType.whisper_2ml})</TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background w-48 focus:outline-none focus:ring-1 focus:ring-gold/50"
              />
            </div>
          </div>

          {/* Shared content for all tabs */}
          {['all', 'aura_key', 'aura_key_refill', 'whisper_1ml', 'whisper_2ml'].map(tabId => (
            <TabsContent key={tabId} value={tabId}>
              {filtered.length === 0 ? (
                <EmptyState icon={Droplets} title="No orders found" description="No matching orders for the current filter." />
              ) : (
                <div className="space-y-2">
                  {filtered.map(order => {
                    const typeConf = TYPE_CONFIG[order.type];
                    const TypeIcon = typeConf.icon;
                    const currentStageIdx = PIPELINE_STAGES.findIndex(s => s.id === order.status);
                    const canAdvance = currentStageIdx < PIPELINE_STAGES.length - 1 && order.status !== 'new';

                    return (
                      <div
                        key={order.id}
                        className={cn(
                          'flex items-center gap-4 p-3 rounded-xl border transition-all hover:bg-muted/20 cursor-pointer',
                          order.priority === 'rush' ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-border/50',
                        )}
                        onClick={() => setSelectedOrder(order)}
                      >
                        {/* Type Icon */}
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', typeConf.bgColor)}>
                          <TypeIcon className={cn('w-5 h-5', typeConf.color)} />
                        </div>

                        {/* Order Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{order.orderRef}</span>
                            <Badge variant="outline" className={cn('text-[9px]', typeConf.borderColor, typeConf.color)}>{typeConf.label}</Badge>
                            {order.priority === 'rush' && <Badge className="text-[9px] bg-red-500 text-white">RUSH</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {order.customer}</span>
                            <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" /> {order.perfume}</span>
                            <span>{order.size} × {order.quantity}</span>
                          </div>
                        </div>

                        {/* Pipeline Progress Mini */}
                        <div className="hidden md:flex items-center gap-0.5">
                          {PIPELINE_STAGES.slice(0, 7).map((stage, i) => (
                            <div
                              key={stage.id}
                              className={cn(
                                'w-5 h-1.5 rounded-full transition-all',
                                i <= currentStageIdx ? stage.color : 'bg-muted',
                              )}
                            />
                          ))}
                        </div>

                        {/* Status + Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge variant={STATUS_VARIANT[order.status] || 'muted'}>
                            {PIPELINE_STAGES.find(s => s.id === order.status)?.label || order.status}
                          </StatusBadge>
                          {order.status === 'new' && (
                            <Button size="sm" className="h-7 px-2 text-xs bg-gold hover:bg-gold/90 text-gold-foreground gap-1" onClick={e => { e.stopPropagation(); queueOrder(order.id); }}>
                              <Play className="w-3 h-3" /> Queue
                            </Button>
                          )}
                          {canAdvance && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={e => { e.stopPropagation(); advanceOrder(order.id); }}>
                              <ArrowRight className="w-3 h-3" /> Next
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Order Detail Dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold">{selectedOrder.orderRef}</h2>
                    {selectedOrder.priority === 'rush' && <Badge className="text-[9px] bg-red-500 text-white">RUSH</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => { const tc = TYPE_CONFIG[selectedOrder.type]; const TI = tc.icon; return <Badge variant="outline" className={cn('text-xs', tc.borderColor, tc.color)}><TI className="w-3 h-3 mr-1" />{tc.label}</Badge>; })()}
                    <StatusBadge variant={STATUS_VARIANT[selectedOrder.status] || 'muted'}>
                      {PIPELINE_STAGES.find(s => s.id === selectedOrder.status)?.label || selectedOrder.status}
                    </StatusBadge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}><X className="w-4 h-4" /></Button>
              </div>

              {/* Pipeline Progress */}
              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground mb-2">Processing Pipeline</p>
                <div className="flex items-center gap-1">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === selectedOrder.status);
                    const isActive = i === currentIdx;
                    const isPast = i < currentIdx;
                    return (
                      <div key={stage.id} className="flex items-center flex-1">
                        <div className={cn(
                          'flex-1 h-2 rounded-full transition-all',
                          isPast ? stage.color : isActive ? `${stage.color} animate-pulse` : 'bg-muted',
                        )} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {PIPELINE_STAGES.map(stage => (
                    <span key={stage.id} className="text-[8px] text-muted-foreground">{stage.label}</span>
                  ))}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer</p>
                    <p className="text-sm font-medium flex items-center gap-1"><User className="w-3 h-3" /> {selectedOrder.customer}</p>
                    <p className="text-xs text-muted-foreground">{selectedOrder.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Perfume</p>
                    <p className="text-sm font-medium">{selectedOrder.perfume}</p>
                    <Badge variant="outline" className="text-[9px] mt-0.5">{selectedOrder.aura}</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Size & Quantity</p>
                    <p className="text-sm font-medium">{selectedOrder.size} × {selectedOrder.quantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Order Date</p>
                    <p className="text-sm font-medium flex items-center gap-1"><Calendar className="w-3 h-3" /> {selectedOrder.createdAt}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-border">
                {selectedOrder.status === 'new' && (
                  <Button className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => { queueOrder(selectedOrder.id); setSelectedOrder({ ...selectedOrder, status: 'queued' }); }}>
                    <Play className="w-4 h-4" /> Queue for Processing
                  </Button>
                )}
                {selectedOrder.status !== 'new' && selectedOrder.status !== 'completed' && (
                  <Button className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => { advanceOrder(selectedOrder.id); const nextIdx = PIPELINE_STAGES.findIndex(s => s.id === selectedOrder.status) + 1; if (nextIdx < PIPELINE_STAGES.length) setSelectedOrder({ ...selectedOrder, status: PIPELINE_STAGES[nextIdx].id }); }}>
                    <ArrowRight className="w-4 h-4" /> Advance to Next Stage
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
