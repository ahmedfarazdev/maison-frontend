// ============================================================
// A5 — Order Returns
// Return initiation → item selection → reason → tracking → restock/write-off
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge, EmptyState, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RotateCcw, Search, Plus, Package, AlertTriangle, CheckCircle2,
  Clock, XCircle, ArrowDownLeft, Truck, FileText, Archive,
  CornerDownLeft, Undo2, Trash2, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import type { Order } from '@/types';
import { toast } from 'sonner';

// ---- Return Types ----
type ReturnReason = 'damaged' | 'wrong_item' | 'customer_request' | 'quality_issue' | 'missing_item' | 'other';
type ReturnStatus = 'initiated' | 'label_sent' | 'in_transit' | 'received' | 'inspected' | 'processed' | 'closed';
type ReturnResolution = 'restock' | 'write_off' | 'exchange' | 'refund';

interface ReturnItem {
  item_id: string;
  perfume_name: string;
  size_ml: number;
  qty: number;
  type: 'decant' | 'sealed_bottle' | 'vial';
  reason: ReturnReason;
  resolution?: ReturnResolution;
  condition?: 'unopened' | 'opened' | 'damaged' | 'empty';
}

interface ReturnRecord {
  return_id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  items: ReturnItem[];
  status: ReturnStatus;
  tracking_number?: string;
  notes: string;
  initiated_by: string;
  initiated_at: string;
  received_at?: string;
  processed_at?: string;
  total_refund_amount: number;
}

// ---- Mock return data ----
const mockReturns: ReturnRecord[] = [
  {
    return_id: 'RTN-001',
    order_id: 'ORD-2025-0142',
    customer_name: 'Ahmed Al-Rashid',
    customer_email: 'ahmed@example.com',
    items: [
      { item_id: 'i1', perfume_name: 'Baccarat Rouge 540', size_ml: 5, qty: 1, type: 'decant', reason: 'damaged', resolution: 'refund', condition: 'damaged' },
    ],
    status: 'processed',
    tracking_number: 'TRK-98765',
    notes: 'Atomizer was cracked on arrival. Full refund issued.',
    initiated_by: 'ops_admin',
    initiated_at: '2025-02-10T09:00:00Z',
    received_at: '2025-02-12T14:30:00Z',
    processed_at: '2025-02-12T16:00:00Z',
    total_refund_amount: 85,
  },
  {
    return_id: 'RTN-002',
    order_id: 'ORD-2025-0138',
    customer_name: 'Sara Khan',
    customer_email: 'sara@example.com',
    items: [
      { item_id: 'i2', perfume_name: 'Oud Wood', size_ml: 10, qty: 1, type: 'decant', reason: 'wrong_item' },
    ],
    status: 'in_transit',
    tracking_number: 'TRK-11223',
    notes: 'Customer received Tobacco Vanille instead of Oud Wood.',
    initiated_by: 'ops_admin',
    initiated_at: '2025-02-13T11:00:00Z',
    total_refund_amount: 0,
  },
  {
    return_id: 'RTN-003',
    order_id: 'ORD-2025-0155',
    customer_name: 'Fatima Al-Sayed',
    customer_email: 'fatima@example.com',
    items: [
      { item_id: 'i3', perfume_name: 'Lost Cherry', size_ml: 50, qty: 1, type: 'sealed_bottle', reason: 'customer_request', condition: 'unopened' },
    ],
    status: 'initiated',
    notes: 'Customer changed mind. Wants exchange for Bitter Peach.',
    initiated_by: 'ops_admin',
    initiated_at: '2025-02-14T08:00:00Z',
    total_refund_amount: 0,
  },
];

const reasonLabels: Record<ReturnReason, string> = {
  damaged: 'Damaged in Transit',
  wrong_item: 'Wrong Item Sent',
  customer_request: 'Customer Request',
  quality_issue: 'Quality Issue',
  missing_item: 'Missing Item',
  other: 'Other',
};

const statusConfig: Record<ReturnStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'destructive' | 'gold' | 'muted' }> = {
  initiated: { label: 'Initiated', variant: 'info' },
  label_sent: { label: 'Label Sent', variant: 'info' },
  in_transit: { label: 'In Transit', variant: 'warning' },
  received: { label: 'Received', variant: 'gold' },
  inspected: { label: 'Inspected', variant: 'gold' },
  processed: { label: 'Processed', variant: 'success' },
  closed: { label: 'Closed', variant: 'muted' },
};

const resolutionLabels: Record<ReturnResolution, string> = {
  restock: 'Restock',
  write_off: 'Write Off',
  exchange: 'Exchange',
  refund: 'Refund',
};

export default function Returns() {
  const [returns, setReturns] = useState<ReturnRecord[]>(mockReturns);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInitiateDialog, setShowInitiateDialog] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch orders for the initiate dialog
  const { data: ordersData } = useApiQuery(() => api.orders.list());

  const filteredReturns = useMemo(() => {
    let result = returns;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.return_id.toLowerCase().includes(q) ||
        r.order_id.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.items.some(i => i.perfume_name.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }
    if (activeTab === 'open') {
      result = result.filter(r => !['processed', 'closed'].includes(r.status));
    } else if (activeTab === 'closed') {
      result = result.filter(r => ['processed', 'closed'].includes(r.status));
    }
    return result;
  }, [returns, search, statusFilter, activeTab]);

  const stats = useMemo(() => ({
    total: returns.length,
    open: returns.filter(r => !['processed', 'closed'].includes(r.status)).length,
    in_transit: returns.filter(r => r.status === 'in_transit').length,
    processed: returns.filter(r => r.status === 'processed').length,
    total_refunds: returns.reduce((sum, r) => sum + r.total_refund_amount, 0),
  }), [returns]);

  const handleStatusAdvance = (returnId: string) => {
    setReturns(prev => prev.map(r => {
      if (r.return_id !== returnId) return r;
      const statusOrder: ReturnStatus[] = ['initiated', 'label_sent', 'in_transit', 'received', 'inspected', 'processed', 'closed'];
      const currentIdx = statusOrder.indexOf(r.status);
      if (currentIdx < statusOrder.length - 1) {
        const nextStatus = statusOrder[currentIdx + 1];
        const updates: Partial<ReturnRecord> = { status: nextStatus };
        if (nextStatus === 'received') updates.received_at = new Date().toISOString();
        if (nextStatus === 'processed') updates.processed_at = new Date().toISOString();
        toast.success(`Return ${returnId} → ${statusConfig[nextStatus].label}`);
        return { ...r, ...updates };
      }
      return r;
    }));
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Returns"
        subtitle="Manage order returns, refunds, and vial returns"
        breadcrumbs={[
          { label: 'Orders & CX', href: '/orders/one-time' },
          { label: 'Returns' },
        ]}
        actions={
          <Button onClick={() => setShowInitiateDialog(true)} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
            <Plus className="w-4 h-4" />
            Initiate Return
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-l-[3px] border-l-info">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Returns</p>
              <p className="text-xl font-semibold mt-0.5">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-warning">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Open</p>
              <p className="text-xl font-semibold mt-0.5">{stats.open}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-gold">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">In Transit</p>
              <p className="text-xl font-semibold mt-0.5">{stats.in_transit}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Processed</p>
              <p className="text-xl font-semibold mt-0.5">{stats.processed}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-destructive">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Refunds</p>
              <p className="text-xl font-semibold mt-0.5">AED {stats.total_refunds.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList>
              <TabsTrigger value="all">All ({returns.length})</TabsTrigger>
              <TabsTrigger value="open">Open ({stats.open})</TabsTrigger>
              <TabsTrigger value="closed">Closed ({stats.processed})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search returns..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Returns List */}
        {filteredReturns.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="No returns found"
            description={search ? 'Try adjusting your search or filters.' : 'No returns have been initiated yet.'}
            action={
              <Button onClick={() => setShowInitiateDialog(true)} variant="outline" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Initiate Return
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredReturns.map(ret => (
              <ReturnCard
                key={ret.return_id}
                returnRecord={ret}
                onAdvance={() => handleStatusAdvance(ret.return_id)}
                onProcess={() => {
                  setSelectedReturn(ret);
                  setShowProcessDialog(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Initiate Return Dialog */}
      <InitiateReturnDialog
        open={showInitiateDialog}
        onOpenChange={setShowInitiateDialog}
        orders={(ordersData as any)?.data ?? []}
        onSubmit={(newReturn) => {
          setReturns(prev => [newReturn, ...prev]);
          toast.success(`Return ${newReturn.return_id} initiated for order ${newReturn.order_id}`);
        }}
      />

      {/* Process Return Dialog */}
      {selectedReturn && (
        <ProcessReturnDialog
          open={showProcessDialog}
          onOpenChange={setShowProcessDialog}
          returnRecord={selectedReturn}
          onProcess={(updated) => {
            setReturns(prev => prev.map(r => r.return_id === updated.return_id ? updated : r));
            toast.success(`Return ${updated.return_id} processed — ${updated.items.map(i => resolutionLabels[i.resolution!]).join(', ')}`);
          }}
        />
      )}
    </div>
  );
}

// ---- Return Card ----
function ReturnCard({ returnRecord, onAdvance, onProcess }: {
  returnRecord: ReturnRecord;
  onAdvance: () => void;
  onProcess: () => void;
}) {
  const cfg = statusConfig[returnRecord.status];
  const statusOrder: ReturnStatus[] = ['initiated', 'label_sent', 'in_transit', 'received', 'inspected', 'processed', 'closed'];
  const currentIdx = statusOrder.indexOf(returnRecord.status);

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold">{returnRecord.return_id}</span>
              <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>
              <span className="text-xs text-muted-foreground">from</span>
              <span className="font-mono text-xs text-info">{returnRecord.order_id}</span>
            </div>

            {/* Customer */}
            <p className="text-sm text-muted-foreground">{returnRecord.customer_name} · {returnRecord.customer_email}</p>

            {/* Items */}
            <div className="mt-2 space-y-1">
              {returnRecord.items.map(item => (
                <div key={item.item_id} className="flex items-center gap-2 text-xs">
                  {item.type === 'decant' ? (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">Decant</Badge>
                  ) : item.type === 'vial' ? (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-500/40 text-purple-600 dark:text-purple-400">Vial</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">Bottle</Badge>
                  )}
                  <span>{item.perfume_name}</span>
                  <span className="text-muted-foreground">{item.size_ml}ml × {item.qty}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-warning/40 text-warning">
                    {reasonLabels[item.reason]}
                  </Badge>
                  {item.resolution && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-success/40 text-success">
                      {resolutionLabels[item.resolution]}
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {/* Tracking */}
            {returnRecord.tracking_number && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <Truck className="w-3 h-3" />
                Tracking: <span className="font-mono">{returnRecord.tracking_number}</span>
              </p>
            )}

            {/* Notes */}
            {returnRecord.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">"{returnRecord.notes}"</p>
            )}

            {/* Timeline bar */}
            <div className="flex items-center gap-0.5 mt-3">
              {statusOrder.slice(0, -1).map((s, i) => (
                <div key={s} className="flex items-center gap-0.5">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    i <= currentIdx ? 'bg-success' : 'bg-muted',
                  )} />
                  {i < statusOrder.length - 2 && (
                    <div className={cn(
                      'w-6 h-0.5',
                      i < currentIdx ? 'bg-success' : 'bg-muted',
                    )} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-1 text-[9px] text-muted-foreground">
              {statusOrder.slice(0, -1).map(s => (
                <span key={s} className="w-8 text-center truncate">{statusConfig[s].label.slice(0, 5)}</span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1.5 shrink-0">
            {returnRecord.status === 'received' || returnRecord.status === 'inspected' ? (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onProcess}>
                <Archive className="w-3.5 h-3.5" />
                Process
              </Button>
            ) : null}
            {!['processed', 'closed'].includes(returnRecord.status) && (
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={onAdvance}>
                <CornerDownLeft className="w-3.5 h-3.5" />
                Advance
              </Button>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex gap-4 mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
          <span>Initiated: {new Date(returnRecord.initiated_at).toLocaleDateString()}</span>
          {returnRecord.received_at && <span>Received: {new Date(returnRecord.received_at).toLocaleDateString()}</span>}
          {returnRecord.processed_at && <span>Processed: {new Date(returnRecord.processed_at).toLocaleDateString()}</span>}
          {returnRecord.total_refund_amount > 0 && (
            <span className="text-destructive font-medium">Refund: AED {returnRecord.total_refund_amount}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Initiate Return Dialog ----
function InitiateReturnDialog({ open, onOpenChange, orders, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  onSubmit: (ret: ReturnRecord) => void;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState<ReturnReason>('damaged');
  const [notes, setNotes] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  const selectedOrder = orders.find(o => o.order_id === selectedOrderId);

  const filteredOrders = useMemo(() => {
    if (!orderSearch) return orders.slice(0, 20);
    const q = orderSearch.toLowerCase();
    return orders.filter(o =>
      o.order_id.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [orders, orderSearch]);

  const handleSubmit = () => {
    if (!selectedOrder) return;
    const items: ReturnItem[] = selectedOrder.items
      .filter(i => selectedItems[i.item_id])
      .map(i => ({
        item_id: i.item_id,
        perfume_name: i.perfume_name,
        size_ml: i.size_ml,
        qty: i.qty,
        type: i.type,
        reason,
      }));

    if (items.length === 0) {
      toast.error('Select at least one item to return');
      return;
    }

    const newReturn: ReturnRecord = {
      return_id: `RTN-${String(Date.now()).slice(-3)}`,
      order_id: selectedOrder.order_id,
      customer_name: selectedOrder.customer.name,
      customer_email: selectedOrder.customer.email,
      items,
      status: 'initiated',
      notes,
      initiated_by: 'ops_admin',
      initiated_at: new Date().toISOString(),
      total_refund_amount: 0,
    };

    onSubmit(newReturn);
    onOpenChange(false);
    setSelectedOrderId('');
    setSelectedItems({});
    setReason('damaged');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-gold" />
            Initiate Return
          </DialogTitle>
          <DialogDescription>
            Select an order and the items to be returned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Order Selection */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Order</label>
            <Input
              placeholder="Search by order ID or customer name..."
              value={orderSearch}
              onChange={e => setOrderSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-32 overflow-auto border rounded-md divide-y">
              {filteredOrders.map(o => (
                <button
                  key={o.order_id}
                  onClick={() => {
                    setSelectedOrderId(o.order_id);
                    setSelectedItems({});
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50 transition-colors',
                    selectedOrderId === o.order_id && 'bg-gold/10',
                  )}
                >
                  <span className="font-mono font-medium">{o.order_id}</span>
                  <span className="text-muted-foreground">{o.customer.name}</span>
                  <span className="text-muted-foreground">AED {o.total_amount}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Item Selection */}
          {selectedOrder && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Items to Return</label>
              <div className="space-y-1.5">
                {selectedOrder.items.map(item => (
                  <label key={item.item_id} className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer transition-all',
                    selectedItems[item.item_id] ? 'border-gold/40 bg-gold/5' : 'border-border hover:bg-muted/50',
                  )}>
                    <Checkbox
                      checked={!!selectedItems[item.item_id]}
                      onCheckedChange={(checked) => setSelectedItems(prev => ({ ...prev, [item.item_id]: !!checked }))}
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-medium">{item.perfume_name}</span>
                      <span className="text-muted-foreground ml-2">{item.size_ml}ml × {item.qty}</span>
                    </div>
                    <Badge variant="outline" className={cn('text-[9px]', item.type === 'vial' && 'border-purple-500/40 text-purple-600 dark:text-purple-400')}>{item.type === 'decant' ? 'Decant' : item.type === 'vial' ? 'Vial' : 'Bottle'}</Badge>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Return Reason</label>
            <Select value={reason} onValueChange={v => setReason(v as ReturnReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(reasonLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
            <Textarea
              placeholder="Additional details about the return..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedOrder || Object.values(selectedItems).filter(Boolean).length === 0}
            className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Initiate Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Process Return Dialog ----
function ProcessReturnDialog({ open, onOpenChange, returnRecord, onProcess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnRecord: ReturnRecord;
  onProcess: (updated: ReturnRecord) => void;
}) {
  const [resolutions, setResolutions] = useState<Record<string, ReturnResolution>>(
    Object.fromEntries(returnRecord.items.map(i => [i.item_id, i.resolution ?? 'refund']))
  );
  const [conditions, setConditions] = useState<Record<string, string>>(
    Object.fromEntries(returnRecord.items.map(i => [i.item_id, i.condition ?? 'unopened']))
  );
  const [refundAmount, setRefundAmount] = useState('0');

  const handleProcess = () => {
    const updatedItems = returnRecord.items.map(item => ({
      ...item,
      resolution: resolutions[item.item_id],
      condition: conditions[item.item_id] as ReturnItem['condition'],
    }));

    const updated: ReturnRecord = {
      ...returnRecord,
      items: updatedItems,
      status: 'processed',
      processed_at: new Date().toISOString(),
      total_refund_amount: parseFloat(refundAmount) || 0,
    };

    onProcess(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-gold" />
            Process Return {returnRecord.return_id}
          </DialogTitle>
          <DialogDescription>
            Inspect items and decide on resolution for each.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {returnRecord.items.map(item => (
            <Card key={item.item_id} className="border-border/50">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.perfume_name}</span>
                  <span className="text-xs text-muted-foreground">{item.size_ml}ml × {item.qty}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Condition</label>
                    <Select value={conditions[item.item_id]} onValueChange={v => setConditions(prev => ({ ...prev, [item.item_id]: v }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unopened">Unopened</SelectItem>
                        <SelectItem value="opened">Opened</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="empty">Empty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Resolution</label>
                    <Select value={resolutions[item.item_id]} onValueChange={v => setResolutions(prev => ({ ...prev, [item.item_id]: v as ReturnResolution }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restock">Restock</SelectItem>
                        <SelectItem value="write_off">Write Off</SelectItem>
                        <SelectItem value="exchange">Exchange</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Refund Amount (AED)</label>
            <Input
              type="number"
              value={refundAmount}
              onChange={e => setRefundAmount(e.target.value)}
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleProcess} className="bg-success hover:bg-success/90 text-white gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Process Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
