// ============================================================
// Fulfillment Center — Order Fulfillment
// This is NOT an operating station — it's the fulfillment center
// where completed production items are assembled, QC'd, and packed
// Flow: Receive from Production → Assemble Order → QC Check → Pack → Ready for Shipping
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  PackageCheck, Package, CheckCircle2, AlertTriangle, Search,
  ArrowRight, Eye, User, MapPin, Clock, ShieldCheck,
  Box, Tag, Layers, Timer, ClipboardCheck, Boxes,
  BarChart3, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
type FulfillmentStatus = 'pending' | 'assembling' | 'qc_check' | 'packed' | 'ready_for_shipping';
type OrderSource = 'subscription' | 'one_time' | 'aurakey' | 'capsule' | 'gift_set' | 'corporate';

interface FulfillmentOrder {
  id: string;
  orderId: string;
  customerName: string;
  source: OrderSource;
  status: FulfillmentStatus;
  items: { name: string; qty: number; size?: string }[];
  address: string;
  priority: 'rush' | 'normal';
  receivedAt: string;
  qcPassed?: boolean;
  qcNotes?: string;
  packedAt?: string;
}

// ---- Config ----
const STATUS_CONFIG: Record<FulfillmentStatus, { label: string; color: string; step: number }> = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700', step: 0 },
  assembling: { label: 'Assembling', color: 'bg-blue-100 text-blue-700', step: 1 },
  qc_check: { label: 'QC Check', color: 'bg-amber-100 text-amber-700', step: 2 },
  packed: { label: 'Packed', color: 'bg-emerald-100 text-emerald-700', step: 3 },
  ready_for_shipping: { label: 'Ready for Shipping', color: 'bg-green-100 text-green-800', step: 4 },
};

const SOURCE_CONFIG: Record<OrderSource, { label: string; color: string }> = {
  subscription: { label: 'Subscription', color: 'bg-blue-100 text-blue-700' },
  one_time: { label: 'One-Time', color: 'bg-purple-100 text-purple-700' },
  aurakey: { label: 'AuraKey', color: 'bg-amber-100 text-amber-700' },
  capsule: { label: 'Capsule', color: 'bg-pink-100 text-pink-700' },
  gift_set: { label: 'Gift Set', color: 'bg-teal-100 text-teal-700' },
  corporate: { label: 'Corporate', color: 'bg-indigo-100 text-indigo-700' },
};

const PIPELINE: FulfillmentStatus[] = ['pending', 'assembling', 'qc_check', 'packed', 'ready_for_shipping'];

// ---- Mock Data ----
const mockOrders: FulfillmentOrder[] = [
  { id: 'FUL-001', orderId: 'ORD-1847', customerName: 'Sarah Al Maktoum', source: 'subscription', status: 'assembling', items: [{ name: 'Baccarat Rouge 540', qty: 1, size: '8ml' }, { name: 'Aventus', qty: 1, size: '8ml' }, { name: 'Oud Wood', qty: 1, size: '8ml' }], address: 'Dubai Marina, Tower 5', priority: 'normal', receivedAt: '2026-02-28T08:00:00' },
  { id: 'FUL-002', orderId: 'ORD-1848', customerName: 'Ahmed Khalifa', source: 'aurakey', status: 'qc_check', items: [{ name: 'AuraKey Starter Kit', qty: 1 }, { name: 'Layton', qty: 1, size: '8ml' }, { name: 'Sauvage Elixir', qty: 1, size: '8ml' }, { name: 'Lost Cherry', qty: 1, size: '8ml' }], address: 'JBR, Amwaj 2', priority: 'rush', receivedAt: '2026-02-28T07:30:00', qcPassed: true },
  { id: 'FUL-003', orderId: 'ORD-1849', customerName: 'Fatima Noor', source: 'one_time', status: 'packed', items: [{ name: 'Tobacco Vanille', qty: 1, size: '5ml' }, { name: 'Rehab', qty: 1, size: '10ml' }], address: 'Business Bay, Executive Tower', priority: 'normal', receivedAt: '2026-02-28T06:00:00', qcPassed: true, packedAt: '2026-02-28T11:00:00' },
  { id: 'FUL-004', orderId: 'ORD-1850', customerName: 'Khalid Saeed', source: 'capsule', status: 'ready_for_shipping', items: [{ name: 'House of Oud Chapter Set', qty: 1 }], address: 'Downtown, Burj Vista', priority: 'normal', receivedAt: '2026-02-27T14:00:00', qcPassed: true, packedAt: '2026-02-28T09:00:00' },
  { id: 'FUL-005', orderId: 'ORD-1851', customerName: 'Noura Mansour', source: 'gift_set', status: 'pending', items: [{ name: 'Discovery Collection', qty: 1 }, { name: 'Gift Wrap', qty: 1 }], address: 'Palm Jumeirah, Shoreline', priority: 'rush', receivedAt: '2026-02-28T09:00:00' },
  { id: 'FUL-006', orderId: 'ORD-1852', customerName: 'Omar Al Falasi', source: 'subscription', status: 'pending', items: [{ name: 'Interlude Man', qty: 1, size: '8ml' }, { name: 'Delina', qty: 1, size: '8ml' }, { name: 'Grand Soir', qty: 1, size: '8ml' }, { name: 'Oud Satin Mood', qty: 1, size: '8ml' }, { name: 'Viking', qty: 1, size: '8ml' }], address: 'Al Barsha, Villa 12', priority: 'normal', receivedAt: '2026-02-28T08:30:00' },
  { id: 'FUL-007', orderId: 'ORD-1853', customerName: 'Reem Hassan', source: 'corporate', status: 'assembling', items: [{ name: 'Corporate Gift Box × 25', qty: 25 }], address: 'DIFC, Gate Village', priority: 'rush', receivedAt: '2026-02-28T07:00:00' },
  { id: 'FUL-008', orderId: 'ORD-1854', customerName: 'Layla Noor', source: 'one_time', status: 'qc_check', items: [{ name: 'Green Irish Tweed', qty: 1, size: '20ml' }], address: 'Jumeirah Village Circle', priority: 'normal', receivedAt: '2026-02-28T06:30:00', qcPassed: false, qcNotes: 'Label misaligned on vial' },
];

// ---- Component ----
export default function Fulfillment() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FulfillmentStatus | 'all'>('all');
  const [detailOrder, setDetailOrder] = useState<FulfillmentOrder | null>(null);

  const filtered = useMemo(() => {
    let orders = mockOrders;
    if (filterStatus !== 'all') orders = orders.filter(o => o.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        o.orderId.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    }
    return orders;
  }, [search, filterStatus]);

  // Stats
  const stats = useMemo(() => ({
    total: mockOrders.length,
    pending: mockOrders.filter(o => o.status === 'pending').length,
    assembling: mockOrders.filter(o => o.status === 'assembling').length,
    qcCheck: mockOrders.filter(o => o.status === 'qc_check').length,
    packed: mockOrders.filter(o => o.status === 'packed').length,
    readyShip: mockOrders.filter(o => o.status === 'ready_for_shipping').length,
    qcFailed: mockOrders.filter(o => o.qcPassed === false).length,
    rush: mockOrders.filter(o => o.priority === 'rush').length,
  }), []);

  const handleAdvance = (order: FulfillmentOrder) => {
    const idx = PIPELINE.indexOf(order.status);
    if (idx < PIPELINE.length - 1) {
      const next = STATUS_CONFIG[PIPELINE[idx + 1]].label;
      toast.success(`${order.orderId} advanced to ${next}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fulfillment Center"
        subtitle="Order assembly, quality check, and packing — ready for shipping"
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50"><Package className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50"><Clock className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.pending + stats.assembling}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50"><PackageCheck className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.readyShip}</p>
                <p className="text-xs text-muted-foreground">Ready to Ship</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-50"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.qcFailed}</p>
                <p className="text-xs text-muted-foreground">QC Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Tabs value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs h-7">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs h-7">Pending ({stats.pending})</TabsTrigger>
            <TabsTrigger value="assembling" className="text-xs h-7">Assembling ({stats.assembling})</TabsTrigger>
            <TabsTrigger value="qc_check" className="text-xs h-7">QC ({stats.qcCheck})</TabsTrigger>
            <TabsTrigger value="packed" className="text-xs h-7">Packed ({stats.packed})</TabsTrigger>
            <TabsTrigger value="ready_for_shipping" className="text-xs h-7">Ready ({stats.readyShip})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Order Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(order => {
          const statusCfg = STATUS_CONFIG[order.status];
          const sourceCfg = SOURCE_CONFIG[order.source];
          const stepIdx = PIPELINE.indexOf(order.status);

          return (
            <Card key={order.id} className={cn(
              'border shadow-sm hover:shadow-md transition-shadow',
              order.priority === 'rush' && 'border-l-4 border-l-red-400',
              order.qcPassed === false && 'border-l-4 border-l-amber-400',
            )}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{order.orderId}</span>
                      {order.priority === 'rush' && (
                        <Badge className="text-[9px] bg-red-100 text-red-700">RUSH</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{order.customerName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={cn('text-[10px]', statusCfg.color)}>{statusCfg.label}</Badge>
                    <Badge className={cn('text-[10px]', sourceCfg.color)}>{sourceCfg.label}</Badge>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {order.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium">{item.qty}× {item.size || ''}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-[10px] text-muted-foreground">+{order.items.length - 3} more items</p>
                  )}
                </div>

                {/* Mini Pipeline */}
                <div className="flex gap-0.5">
                  {PIPELINE.map((s, i) => (
                    <div
                      key={s}
                      className={cn(
                        'h-1.5 flex-1 rounded-sm',
                        i < stepIdx ? 'bg-emerald-400' : i === stepIdx ? 'bg-blue-500' : 'bg-muted',
                      )}
                    />
                  ))}
                </div>

                {/* QC Warning */}
                {order.qcPassed === false && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>QC Failed: {order.qcNotes}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => setDetailOrder(order)}>
                    <Eye className="w-3 h-3" /> Details
                  </Button>
                  {order.status !== 'ready_for_shipping' && (
                    <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => handleAdvance(order)}>
                      Advance <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={PackageCheck}
          title="No orders found"
          description="No fulfillment orders match your current filters"
        />
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-blue-600" />
              {detailOrder?.orderId} — Fulfillment
            </DialogTitle>
            <DialogDescription>
              Order {detailOrder?.id} fulfillment details
            </DialogDescription>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{detailOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <Badge className={cn('text-xs', SOURCE_CONFIG[detailOrder.source].color)}>{SOURCE_CONFIG[detailOrder.source].label}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium text-xs">{detailOrder.address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={cn('text-xs', STATUS_CONFIG[detailOrder.status].color)}>{STATUS_CONFIG[detailOrder.status].label}</Badge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Items ({detailOrder.items.length})</p>
                <div className="space-y-1.5">
                  {detailOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/50">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">{item.qty}× {item.size || ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* QC Status */}
              {detailOrder.qcPassed !== undefined && (
                <div className={cn(
                  'flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                  detailOrder.qcPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
                )}>
                  {detailOrder.qcPassed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>{detailOrder.qcPassed ? 'QC Passed' : `QC Failed: ${detailOrder.qcNotes}`}</span>
                </div>
              )}

              {/* Pipeline */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Pipeline</p>
                <div className="flex gap-0.5">
                  {PIPELINE.map((s, i) => {
                    const stepIdx = PIPELINE.indexOf(detailOrder.status);
                    return (
                      <div key={s} className="flex-1 text-center">
                        <div className={cn(
                          'h-2 rounded-sm mb-1',
                          i < stepIdx ? 'bg-emerald-400' : i === stepIdx ? 'bg-blue-500' : 'bg-muted',
                        )} />
                        <span className="text-[9px] text-muted-foreground">{STATUS_CONFIG[s].label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOrder(null)}>Close</Button>
            {detailOrder && detailOrder.status !== 'ready_for_shipping' && (
              <Button onClick={() => { handleAdvance(detailOrder); setDetailOrder(null); }}>
                Advance <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
