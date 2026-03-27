// ============================================================
// F2 — Batch Recall Traceability
// Given a bottle ID, trace every order and customer that received
// perfume from that bottle. Enables rapid recall if a batch has
// quality issues.
// ============================================================

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Search, AlertTriangle, Droplets, Package, User, ArrowRight,
  ShieldAlert, FileText, Download, ExternalLink, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

// ---- Types ----
export interface TraceResult {
  bottle_id: string;
  master_id: string;
  perfume_name: string;
  batch_number?: string;
  supplier: string;
  purchase_order_id?: string;
  bottle_size_ml: number;
  opened_date?: string;
  affected_orders: AffectedOrder[];
  total_ml_dispensed: number;
  total_customers_affected: number;
}

export interface AffectedOrder {
  order_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  item_size_ml: number;
  decant_date: string;
  operator_name: string;
  shipped: boolean;
  tracking_number?: string;
}

// ---- Mock trace data ----
const mockTraceResults: Record<string, TraceResult> = {
  'BTL-001': {
    bottle_id: 'BTL-001',
    master_id: 'MF-BR540',
    perfume_name: 'Baccarat Rouge 540',
    batch_number: 'MFK-2024-B12',
    supplier: 'Maison Francis Kurkdjian',
    purchase_order_id: 'PO-2024-089',
    bottle_size_ml: 200,
    opened_date: '2025-01-15',
    total_ml_dispensed: 145,
    total_customers_affected: 18,
    affected_orders: [
      { order_id: 'ORD-2025-0142', customer_name: 'Ahmed Al-Rashid', customer_email: 'ahmed@example.com', item_size_ml: 5, decant_date: '2025-01-16', operator_name: 'Khalid', shipped: true, tracking_number: 'TRK-001' },
      { order_id: 'ORD-2025-0145', customer_name: 'Sara Khan', customer_email: 'sara@example.com', item_size_ml: 10, decant_date: '2025-01-17', operator_name: 'Khalid', shipped: true, tracking_number: 'TRK-002' },
      { order_id: 'ORD-2025-0148', customer_name: 'Fatima Al-Sayed', customer_email: 'fatima@example.com', item_size_ml: 5, decant_date: '2025-01-18', operator_name: 'Sara', shipped: true, tracking_number: 'TRK-003' },
      { order_id: 'ORD-2025-0155', customer_name: 'Omar Khalil', customer_email: 'omar@example.com', item_size_ml: 10, decant_date: '2025-01-20', operator_name: 'Ahmed', shipped: false },
      { order_id: 'ORD-2025-0160', customer_name: 'Layla Hassan', customer_email: 'layla@example.com', item_size_ml: 5, decant_date: '2025-01-22', operator_name: 'Khalid', shipped: true, tracking_number: 'TRK-005' },
    ],
  },
  'BTL-005': {
    bottle_id: 'BTL-005',
    master_id: 'MF-OW',
    perfume_name: 'Oud Wood',
    batch_number: 'TF-2024-A08',
    supplier: 'Tom Ford',
    purchase_order_id: 'PO-2024-092',
    bottle_size_ml: 100,
    opened_date: '2025-02-01',
    total_ml_dispensed: 65,
    total_customers_affected: 8,
    affected_orders: [
      { order_id: 'ORD-2025-0170', customer_name: 'Nadia Youssef', customer_email: 'nadia@example.com', item_size_ml: 10, decant_date: '2025-02-02', operator_name: 'Sara', shipped: true, tracking_number: 'TRK-010' },
      { order_id: 'ORD-2025-0175', customer_name: 'Reem Al-Falasi', customer_email: 'reem@example.com', item_size_ml: 5, decant_date: '2025-02-03', operator_name: 'Khalid', shipped: true, tracking_number: 'TRK-011' },
    ],
  },
};

// ---- Batch Recall Trace Component ----
export function BatchRecallTrace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showRecallDialog, setShowRecallDialog] = useState(false);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    // Simulate search delay
    setTimeout(() => {
      const result = mockTraceResults[searchQuery.trim().toUpperCase()] ?? null;
      setTraceResult(result);
      setIsSearching(false);
      if (!result) {
        toast.error(`No trace data found for "${searchQuery}"`);
      }
    }, 500);
  };

  const handleExportAffected = () => {
    if (!traceResult) return;
    const headers = ['Order ID', 'Customer', 'Email', 'Size (ml)', 'Decant Date', 'Operator', 'Shipped', 'Tracking'];
    const rows = traceResult.affected_orders.map(o => [
      o.order_id, o.customer_name, o.customer_email, o.item_size_ml,
      new Date(o.decant_date).toLocaleDateString(), o.operator_name,
      o.shipped ? 'Yes' : 'No', o.tracking_number || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recall-trace-${traceResult.bottle_id}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Affected customers exported');
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-gold" />
            Batch Recall Traceability
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <p className="text-xs text-muted-foreground mb-3">
            Enter a bottle ID to trace all orders and customers who received perfume from that bottle. Use for quality recalls or batch investigations.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter Bottle ID (e.g. BTL-001)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
              <Search className="w-4 h-4" />
              Trace
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Try: BTL-001, BTL-005
          </p>
        </CardContent>
      </Card>

      {/* Results */}
      {traceResult && (
        <>
          {/* Bottle Info */}
          <Card className="border-warning/30">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Droplets className="w-4 h-4 text-info" />
                Bottle: {traceResult.bottle_id}
                <Badge variant="outline" className="text-[10px] ml-auto border-warning/40 text-warning">
                  {traceResult.total_customers_affected} customers affected
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <p className="text-[10px] text-muted-foreground">Perfume</p>
                  <p className="text-xs font-medium">{traceResult.perfume_name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Batch Number</p>
                  <p className="text-xs font-mono">{traceResult.batch_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Supplier</p>
                  <p className="text-xs">{traceResult.supplier}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">PO Reference</p>
                  <p className="text-xs font-mono">{traceResult.purchase_order_id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Bottle Size</p>
                  <p className="text-xs">{traceResult.bottle_size_ml}ml</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Opened</p>
                  <p className="text-xs">{traceResult.opened_date ? new Date(traceResult.opened_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">ML Dispensed</p>
                  <p className="text-xs font-mono">{traceResult.total_ml_dispensed}ml</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Orders Affected</p>
                  <p className="text-xs font-semibold">{traceResult.affected_orders.length}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportAffected} className="gap-1 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  Export Affected Customers
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowRecallDialog(true)} className="gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Initiate Recall
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Affected Orders Table */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-gold" />
                Affected Orders ({traceResult.affected_orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Order</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Customer</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Email</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Size</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Decanted</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Operator</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Shipped</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traceResult.affected_orders.map(order => (
                      <tr key={order.order_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs font-medium text-info">{order.order_id}</td>
                        <td className="px-3 py-2 text-xs">{order.customer_name}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{order.customer_email}</td>
                        <td className="px-3 py-2 text-center text-xs">{order.item_size_ml}ml</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(order.decant_date).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-xs">{order.operator_name}</td>
                        <td className="px-3 py-2 text-center">
                          {order.shipped ? (
                            <Badge variant="outline" className="text-[9px] border-success/40 text-success">Shipped</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] border-warning/40 text-warning">Pending</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{order.tracking_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Recall Dialog */}
      <Dialog open={showRecallDialog} onOpenChange={setShowRecallDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Initiate Batch Recall
            </DialogTitle>
            <DialogDescription>
              This will flag all affected orders and notify the operations team. Customers who received shipped orders will need to be contacted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm">
            <p><strong>Bottle:</strong> {traceResult?.bottle_id}</p>
            <p><strong>Perfume:</strong> {traceResult?.perfume_name}</p>
            <p><strong>Batch:</strong> {traceResult?.batch_number}</p>
            <p><strong>Affected Orders:</strong> {traceResult?.affected_orders.length}</p>
            <p><strong>Customers to Contact:</strong> {traceResult?.affected_orders.filter(o => o.shipped).length} (shipped)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecallDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowRecallDialog(false);
                toast.success('Recall initiated — operations team notified', {
                  description: `${traceResult?.affected_orders.length} orders flagged for review.`,
                });
              }}
            >
              Confirm Recall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
