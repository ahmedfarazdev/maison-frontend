// ============================================================
// Ready Product Fulfillment — Pre-made product shipping
// Handles: Capsule drops, Gift sets, Corporate gifts, Whisper vials (on-demand)
// These are already produced → just pick, pack, ship
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package, Gem, Gift, Building, Wind, Truck, CheckCircle2,
  Search, Eye, ArrowRight, X, User, Calendar, MapPin,
  PackageCheck, ClipboardList, ScanBarcode, AlertTriangle, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---- Types ----
type ProductType = 'capsule' | 'gift_set' | 'corporate_gift' | 'whisper_vial';
type FulfillStatus = 'pending' | 'picking' | 'packing' | 'ready_to_ship' | 'shipped' | 'delivered';

interface FulfillmentOrder {
  id: string;
  orderRef: string;
  type: ProductType;
  productName: string;
  customer: string;
  email: string;
  address: string;
  quantity: number;
  status: FulfillStatus;
  createdAt: string;
  priority: 'normal' | 'rush';
  sku: string;
  notes?: string;
}

// ---- Mock Data ----
const MOCK_ORDERS: FulfillmentOrder[] = [
  { id: 'rf-001', orderRef: 'ORD-2026-1201', type: 'capsule', productName: 'Ember Capsule Drop — Feb 2026', customer: 'Layla H.', email: 'layla@email.com', address: 'Dubai Marina, UAE', quantity: 1, status: 'pending', createdAt: '2026-02-28', priority: 'normal', sku: 'CAP-EMB-FEB26' },
  { id: 'rf-002', orderRef: 'ORD-2026-1202', type: 'gift_set', productName: 'Aura Discovery Set — 5 Vials', customer: 'Omar S.', email: 'omar@email.com', address: 'JBR, Dubai, UAE', quantity: 2, status: 'picking', createdAt: '2026-02-27', priority: 'rush', sku: 'GFT-DISC-5V' },
  { id: 'rf-003', orderRef: 'ORD-2026-1203', type: 'corporate_gift', productName: 'Corporate Welcome Pack — 20 Units', customer: 'Emirates NBD', email: 'procurement@enbd.ae', address: 'DIFC, Dubai, UAE', quantity: 20, status: 'packing', createdAt: '2026-02-26', priority: 'normal', sku: 'CORP-WELC-20' },
  { id: 'rf-004', orderRef: 'ORD-2026-1204', type: 'whisper_vial', productName: 'Whisper Vial — Baccarat Rouge 540 (2ml)', customer: 'Sara K.', email: 'sara@email.com', address: 'Al Barsha, Dubai, UAE', quantity: 3, status: 'ready_to_ship', createdAt: '2026-02-26', priority: 'normal', sku: 'WSP-BR540-2ML' },
  { id: 'rf-005', orderRef: 'ORD-2026-1205', type: 'capsule', productName: 'Mystic Capsule Drop — Feb 2026', customer: 'Ahmed R.', email: 'ahmed@email.com', address: 'Palm Jumeirah, UAE', quantity: 1, status: 'shipped', createdAt: '2026-02-25', priority: 'normal', sku: 'CAP-MYS-FEB26' },
  { id: 'rf-006', orderRef: 'ORD-2026-1206', type: 'gift_set', productName: 'Layering Duo — Ember + Velvet', customer: 'Fatima A.', email: 'fatima@email.com', address: 'Abu Dhabi, UAE', quantity: 1, status: 'delivered', createdAt: '2026-02-24', priority: 'normal', sku: 'GFT-DUO-EV' },
  { id: 'rf-007', orderRef: 'ORD-2026-1207', type: 'corporate_gift', productName: 'Ramadan Gift Box — 10 Units', customer: 'Majid Al Futtaim', email: 'events@maf.ae', address: 'Mall of the Emirates, UAE', quantity: 10, status: 'pending', createdAt: '2026-02-28', priority: 'rush', sku: 'CORP-RAM-10' },
  { id: 'rf-008', orderRef: 'ORD-2026-1208', type: 'whisper_vial', productName: 'Whisper Vial — Lost Cherry (1ml)', customer: 'Nora T.', email: 'nora@email.com', address: 'Sharjah, UAE', quantity: 5, status: 'picking', createdAt: '2026-02-27', priority: 'normal', sku: 'WSP-LC-1ML' },
];

const TYPE_CONFIG: Record<ProductType, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  capsule: { label: 'Capsule Drop', icon: Gem, color: 'text-purple-600', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
  gift_set: { label: 'Gift Set', icon: Gift, color: 'text-pink-600', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/30' },
  corporate_gift: { label: 'Corporate Gift', icon: Building, color: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  whisper_vial: { label: 'Whisper Vial', icon: Wind, color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
};

const FULFILLMENT_STAGES: { id: FulfillStatus; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'pending', label: 'Pending', icon: ClipboardList, color: 'bg-slate-500' },
  { id: 'picking', label: 'Picking', icon: ScanBarcode, color: 'bg-amber-500' },
  { id: 'packing', label: 'Packing', icon: PackageCheck, color: 'bg-blue-500' },
  { id: 'ready_to_ship', label: 'Ready to Ship', icon: Package, color: 'bg-orange-500' },
  { id: 'shipped', label: 'Shipped', icon: Truck, color: 'bg-emerald-500' },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'bg-emerald-600' },
];

const STATUS_VARIANT: Record<string, 'muted' | 'info' | 'gold' | 'success' | 'warning'> = {
  pending: 'muted', picking: 'gold', packing: 'info', ready_to_ship: 'warning', shipped: 'success', delivered: 'success',
};

export default function ReadyProductFulfillment() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<FulfillmentOrder[]>(MOCK_ORDERS);
  const [selectedOrder, setSelectedOrder] = useState<FulfillmentOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let result = orders;
    if (activeTab !== 'all') result = result.filter(o => o.type === activeTab);
    if (statusFilter !== 'all') result = result.filter(o => o.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.customer.toLowerCase().includes(q) ||
        o.orderRef.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.sku.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, activeTab, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inProgress: orders.filter(o => ['picking', 'packing', 'ready_to_ship'].includes(o.status)).length,
    shipped: orders.filter(o => ['shipped', 'delivered'].includes(o.status)).length,
    rush: orders.filter(o => o.priority === 'rush').length,
    byType: {
      capsule: orders.filter(o => o.type === 'capsule').length,
      gift_set: orders.filter(o => o.type === 'gift_set').length,
      corporate_gift: orders.filter(o => o.type === 'corporate_gift').length,
      whisper_vial: orders.filter(o => o.type === 'whisper_vial').length,
    },
  }), [orders]);

  const advanceOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const currentIdx = FULFILLMENT_STAGES.findIndex(s => s.id === o.status);
      if (currentIdx < FULFILLMENT_STAGES.length - 1) {
        const nextStatus = FULFILLMENT_STAGES[currentIdx + 1].id;
        toast.success(`${o.orderRef} → ${FULFILLMENT_STAGES[currentIdx + 1].label}`);
        return { ...o, status: nextStatus };
      }
      return o;
    }));
  };

  const startFulfillment = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'picking' as FulfillStatus } : o));
    toast.success('Fulfillment started — picking');
  };

  return (
    <div>
      <PageHeader
        title="Ready Product Fulfillment"
        subtitle="Ship pre-made products — capsules, gift sets, corporate gifts, whisper vials"
        breadcrumbs={[
          { label: 'Orders & CX' },
          { label: 'Ready Products' },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-border/50 bg-card">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Total Orders</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(stats.byType).filter(([, v]) => v > 0).map(([k, v]) => (
                <Badge key={k} variant="outline" className="text-[9px]">{v} {TYPE_CONFIG[k as ProductType].label}</Badge>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03]">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground">Awaiting fulfillment start</p>
          </div>
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.03]">
            <div className="flex items-center gap-2 mb-1">
              <Play className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            <p className="text-[10px] text-muted-foreground">Picking → Packing → Ready</p>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03]">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Shipped / Delivered</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{stats.shipped}</p>
            {stats.rush > 0 && <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-600 mt-1">{stats.rush} rush</Badge>}
          </div>
        </div>

        {/* Fulfillment Pipeline */}
        <SectionCard title="Fulfillment Pipeline" subtitle="Pick → Pack → Ship (no decanting needed — products are pre-made)">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {FULFILLMENT_STAGES.map((stage, i) => {
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
                  {i < FULFILLMENT_STAGES.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-muted-foreground/40 mx-0.5 shrink-0" />
                  )}
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
              <TabsTrigger value="capsule" className="text-xs gap-1"><Gem className="w-3 h-3" /> Capsules ({stats.byType.capsule})</TabsTrigger>
              <TabsTrigger value="gift_set" className="text-xs gap-1"><Gift className="w-3 h-3" /> Gift Sets ({stats.byType.gift_set})</TabsTrigger>
              <TabsTrigger value="corporate_gift" className="text-xs gap-1"><Building className="w-3 h-3" /> Corporate ({stats.byType.corporate_gift})</TabsTrigger>
              <TabsTrigger value="whisper_vial" className="text-xs gap-1"><Wind className="w-3 h-3" /> Whisper ({stats.byType.whisper_vial})</TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search orders, SKU..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background w-48 focus:outline-none focus:ring-1 focus:ring-gold/50"
              />
            </div>
          </div>

          {['all', 'capsule', 'gift_set', 'corporate_gift', 'whisper_vial'].map(tabId => (
            <TabsContent key={tabId} value={tabId}>
              {filtered.length === 0 ? (
                <EmptyState icon={Package} title="No orders found" description="No matching orders for the current filter." />
              ) : (
                <div className="space-y-2">
                  {filtered.map(order => {
                    const typeConf = TYPE_CONFIG[order.type];
                    const TypeIcon = typeConf.icon;
                    const currentStageIdx = FULFILLMENT_STAGES.findIndex(s => s.id === order.status);
                    const canAdvance = currentStageIdx > 0 && currentStageIdx < FULFILLMENT_STAGES.length - 1;

                    return (
                      <div
                        key={order.id}
                        className={cn(
                          'flex items-center gap-4 p-3 rounded-xl border transition-all hover:bg-muted/20 cursor-pointer',
                          order.priority === 'rush' ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-border/50',
                        )}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', typeConf.bgColor)}>
                          <TypeIcon className={cn('w-5 h-5', typeConf.color)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{order.orderRef}</span>
                            <Badge variant="outline" className={cn('text-[9px]', typeConf.borderColor, typeConf.color)}>{typeConf.label}</Badge>
                            {order.priority === 'rush' && <Badge className="text-[9px] bg-red-500 text-white">RUSH</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {order.customer}</span>
                            <span className="truncate max-w-[200px]">{order.productName}</span>
                            <span className="font-mono text-[10px]">{order.sku}</span>
                          </div>
                        </div>

                        {/* Mini pipeline */}
                        <div className="hidden md:flex items-center gap-0.5">
                          {FULFILLMENT_STAGES.map((stage, i) => (
                            <div
                              key={stage.id}
                              className={cn(
                                'w-5 h-1.5 rounded-full transition-all',
                                i <= currentStageIdx ? stage.color : 'bg-muted',
                              )}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge variant={STATUS_VARIANT[order.status] || 'muted'}>
                            {FULFILLMENT_STAGES.find(s => s.id === order.status)?.label || order.status}
                          </StatusBadge>
                          {order.status === 'pending' && (
                            <Button size="sm" className="h-7 px-2 text-xs bg-gold hover:bg-gold/90 text-gold-foreground gap-1" onClick={e => { e.stopPropagation(); startFulfillment(order.id); }}>
                              <Play className="w-3 h-3" /> Start
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
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold">{selectedOrder.orderRef}</h2>
                    {selectedOrder.priority === 'rush' && <Badge className="text-[9px] bg-red-500 text-white">RUSH</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => { const tc = TYPE_CONFIG[selectedOrder.type]; const TI = tc.icon; return <Badge variant="outline" className={cn('text-xs', tc.borderColor, tc.color)}><TI className="w-3 h-3 mr-1" />{tc.label}</Badge>; })()}
                    <StatusBadge variant={STATUS_VARIANT[selectedOrder.status] || 'muted'}>
                      {FULFILLMENT_STAGES.find(s => s.id === selectedOrder.status)?.label || selectedOrder.status}
                    </StatusBadge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}><X className="w-4 h-4" /></Button>
              </div>

              {/* Pipeline Progress */}
              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground mb-2">Fulfillment Pipeline</p>
                <div className="flex items-center gap-1">
                  {FULFILLMENT_STAGES.map((stage, i) => {
                    const currentIdx = FULFILLMENT_STAGES.findIndex(s => s.id === selectedOrder.status);
                    const isPast = i < currentIdx;
                    const isActive = i === currentIdx;
                    return (
                      <div key={stage.id} className="flex-1">
                        <div className={cn(
                          'h-2 rounded-full transition-all',
                          isPast ? stage.color : isActive ? `${stage.color} animate-pulse` : 'bg-muted',
                        )} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {FULFILLMENT_STAGES.map(stage => (
                    <span key={stage.id} className="text-[8px] text-muted-foreground">{stage.label}</span>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer</p>
                    <p className="text-sm font-medium flex items-center gap-1"><User className="w-3 h-3" /> {selectedOrder.customer}</p>
                    <p className="text-xs text-muted-foreground">{selectedOrder.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Product</p>
                    <p className="text-sm font-medium">{selectedOrder.productName}</p>
                    <p className="text-xs font-mono text-muted-foreground">{selectedOrder.sku}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Shipping Address</p>
                    <p className="text-sm font-medium flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedOrder.address}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantity & Date</p>
                    <p className="text-sm font-medium">× {selectedOrder.quantity}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> {selectedOrder.createdAt}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-border">
                {selectedOrder.status === 'pending' && (
                  <Button className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => { startFulfillment(selectedOrder.id); setSelectedOrder({ ...selectedOrder, status: 'picking' }); }}>
                    <Play className="w-4 h-4" /> Start Fulfillment
                  </Button>
                )}
                {selectedOrder.status !== 'pending' && selectedOrder.status !== 'delivered' && (
                  <Button className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => { advanceOrder(selectedOrder.id); const nextIdx = FULFILLMENT_STAGES.findIndex(s => s.id === selectedOrder.status) + 1; if (nextIdx < FULFILLMENT_STAGES.length) setSelectedOrder({ ...selectedOrder, status: FULFILLMENT_STAGES[nextIdx].id }); }}>
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
