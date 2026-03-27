// ============================================================
// E5 — Tax & Invoice Generation
// Generate VAT-compliant invoices per order. Includes line items,
// VAT breakdown (5% UAE), totals, and PDF export.
// ============================================================

import { useState, useMemo, useRef } from 'react';
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
import {
  FileText, Download, Search, Printer, Eye, DollarSign,
  Building2, Calendar, Hash, Receipt, Filter, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import type { Order } from '@/types';
import { toast } from 'sonner';

// ---- Constants ----
const VAT_RATE = 0.05; // UAE 5% VAT
const COMPANY_INFO = {
  name: 'Maison Em Trading LLC',
  trn: 'TRN-100-XXX-XXX-XXX', // Tax Registration Number
  address: 'Dubai, United Arab Emirates',
  email: 'ops@maisonem.com',
  phone: '+971 XX XXX XXXX',
};

// ---- Types ----
interface InvoiceLineItem {
  description: string;
  qty: number;
  unit_price: number;
  vat_amount: number;
  total: number;
}

interface Invoice {
  invoice_id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  customer_address: string;
  date: string;
  due_date: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  vat_amount: number;
  total: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue';
  notes?: string;
}

// ---- Generate invoice from order ----
function generateInvoice(order: Order): Invoice {
  const lineItems: InvoiceLineItem[] = order.items.map(item => {
    const lineTotal = item.unit_price * item.qty;
    const vat = lineTotal * VAT_RATE;
    return {
      description: `${item.perfume_name} — ${item.size_ml}ml ${item.type === 'decant' ? 'Decant' : 'Sealed Bottle'}`,
      qty: item.qty,
      unit_price: item.unit_price,
      vat_amount: vat,
      total: lineTotal + vat,
    };
  });

  const subtotal = lineItems.reduce((s, i) => s + (i.unit_price * i.qty), 0);
  const vatAmount = subtotal * VAT_RATE;
  const total = subtotal + vatAmount;

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 30);

  return {
    invoice_id: `INV-${order.order_id.replace('ORD-', '')}`,
    order_id: order.order_id,
    customer_name: order.customer.name,
    customer_email: order.customer.email,
    customer_address: order.customer.city ? `${order.customer.city}, UAE` : 'UAE',
    date: now.toISOString(),
    due_date: dueDate.toISOString(),
    line_items: lineItems,
    subtotal,
    vat_amount: vatAmount,
    total,
    status: order.status === 'shipped' || order.status === 'delivered' ? 'paid' : 'issued',
  };
}

export default function InvoiceGenerator() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: ordersData } = useApiQuery(() => api.orders.list());
  const orders: Order[] = (ordersData as any)?.data ?? [];

  const invoices = useMemo(() => orders.map(generateInvoice), [orders]);

  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.invoice_id.toLowerCase().includes(q) ||
        i.order_id.toLowerCase().includes(q) ||
        i.customer_name.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(i => i.status === statusFilter);
    }
    return result;
  }, [invoices, search, statusFilter]);

  const totals = useMemo(() => ({
    count: invoices.length,
    subtotal: invoices.reduce((s, i) => s + i.subtotal, 0),
    vat: invoices.reduce((s, i) => s + i.vat_amount, 0),
    total: invoices.reduce((s, i) => s + i.total, 0),
    paid: invoices.filter(i => i.status === 'paid').length,
  }), [invoices]);

  const handlePrintInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPreview(true);
  };

  const handleExportCSV = () => {
    const headers = ['Invoice ID', 'Order ID', 'Customer', 'Date', 'Subtotal', 'VAT (5%)', 'Total', 'Status'];
    const rows = filteredInvoices.map(i => [
      i.invoice_id, i.order_id, i.customer_name,
      new Date(i.date).toLocaleDateString(),
      i.subtotal.toFixed(2), i.vat_amount.toFixed(2), i.total.toFixed(2), i.status,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusConfig: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'muted' }> = {
    draft: { label: 'Draft', variant: 'muted' },
    issued: { label: 'Issued', variant: 'info' },
    paid: { label: 'Paid', variant: 'success' },
    overdue: { label: 'Overdue', variant: 'warning' },
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Tax & Invoices"
        subtitle="Generate VAT-compliant invoices for orders — UAE 5% VAT"
        breadcrumbs={[
          { label: 'Reports', href: '/reports/cost' },
          { label: 'Tax & Invoices' },
        ]}
        actions={
          <Button variant="outline" onClick={handleExportCSV} className="gap-1.5">
            <Download className="w-4 h-4" />
            Export All
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-l-[3px] border-l-info">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Invoices</p>
              <p className="text-xl font-semibold mt-0.5">{totals.count}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-gold">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Subtotal</p>
              <p className="text-xl font-semibold mt-0.5 font-mono">AED {totals.subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-warning">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">VAT Collected (5%)</p>
              <p className="text-xl font-semibold mt-0.5 font-mono text-warning">AED {totals.vat.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total (incl. VAT)</p>
              <p className="text-xl font-semibold mt-0.5 font-mono">AED {totals.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Paid</p>
              <p className="text-xl font-semibold mt-0.5 text-success">{totals.paid}/{totals.count}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoice Table */}
        {filteredInvoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices"
            description="Invoices are auto-generated from orders."
          />
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Invoice</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Order</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Subtotal</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">VAT</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Total</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, idx) => {
                    const cfg = statusConfig[inv.status];
                    return (
                      <tr key={inv.invoice_id} className={cn(
                        'border-b border-border/50 hover:bg-muted/30 transition-colors',
                        idx % 2 === 0 && 'bg-muted/10',
                      )}>
                        <td className="px-4 py-2.5 font-mono text-xs font-medium">{inv.invoice_id}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-info">{inv.order_id}</td>
                        <td className="px-3 py-2.5 text-xs">{inv.customer_name}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">AED {inv.subtotal.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-warning">AED {inv.vat_amount.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-medium">AED {inv.total.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handlePrintInvoice(inv)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Preview Dialog */}
      {selectedInvoice && (
        <InvoicePreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          invoice={selectedInvoice}
        />
      )}
    </div>
  );
}

// ---- Invoice Preview Dialog ----
function InvoicePreviewDialog({ open, onOpenChange, invoice }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${invoice.invoice_id}</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1a1a1a; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
            th { background: #f5f5f5; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
            .text-right { text-align: right; }
            .font-mono { font-family: 'JetBrains Mono', monospace; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .company { font-size: 12px; color: #666; }
            .total-row { font-weight: 700; background: #f9f9f9; }
            .vat-note { font-size: 11px; color: #888; margin-top: 20px; }
            h1 { font-size: 24px; margin: 0 0 4px; }
            h2 { font-size: 14px; font-weight: 400; color: #888; margin: 0; }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold" />
            Invoice Preview
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="p-6 bg-white text-black rounded-md border">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold text-black">INVOICE</h1>
              <h2 className="text-sm text-gray-500">{invoice.invoice_id}</h2>
            </div>
            <div className="text-right text-xs text-gray-600">
              <p className="font-semibold text-sm text-black">{COMPANY_INFO.name}</p>
              <p>{COMPANY_INFO.address}</p>
              <p>TRN: {COMPANY_INFO.trn}</p>
              <p>{COMPANY_INFO.email}</p>
            </div>
          </div>

          {/* Bill To / Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Bill To</p>
              <p className="text-sm font-medium text-black">{invoice.customer_name}</p>
              <p className="text-xs text-gray-600">{invoice.customer_email}</p>
              <p className="text-xs text-gray-600">{invoice.customer_address}</p>
            </div>
            <div className="text-right">
              <div className="space-y-1 text-xs">
                <p><span className="text-gray-400">Invoice Date:</span> <span className="font-medium text-black">{new Date(invoice.date).toLocaleDateString()}</span></p>
                <p><span className="text-gray-400">Due Date:</span> <span className="font-medium text-black">{new Date(invoice.due_date).toLocaleDateString()}</span></p>
                <p><span className="text-gray-400">Order Ref:</span> <span className="font-mono font-medium text-black">{invoice.order_id}</span></p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Description</th>
                <th className="text-center py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Qty</th>
                <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Unit Price</th>
                <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">VAT (5%)</th>
                <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 text-black">{item.description}</td>
                  <td className="py-2 text-center text-gray-600">{item.qty}</td>
                  <td className="py-2 text-right font-mono text-gray-600">AED {item.unit_price.toFixed(2)}</td>
                  <td className="py-2 text-right font-mono text-gray-500">AED {item.vat_amount.toFixed(2)}</td>
                  <td className="py-2 text-right font-mono font-medium text-black">AED {item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono text-black">AED {invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">VAT (5%)</span>
                <span className="font-mono text-black">AED {invoice.vat_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-gray-200 font-semibold text-sm">
                <span className="text-black">Total</span>
                <span className="font-mono text-black">AED {invoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400">
            <p>This is a tax invoice issued in accordance with UAE Federal Tax Authority regulations.</p>
            <p>All amounts are in UAE Dirhams (AED). VAT Registration: {COMPANY_INFO.trn}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handlePrint} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
