// ============================================================
// Purchase Orders — Full PO Ledger across all suppliers
// Status pipeline: draft → pending_quote → quote_approved →
//   pending_delivery → qc → delivered → confirmed
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Package, Search, Filter, ChevronDown, ChevronUp,
  Clock, CheckCircle2, Truck, ShieldCheck, FileText,
  AlertCircle, Download, Eye, Send, MessageCircle,
  Mail, ArrowRight, X, FileUp, CreditCard, Paperclip, CalendarDays,
  DollarSign, PackageOpen, Plus, Loader2, XCircle, Trash2, ShoppingCart,
} from 'lucide-react';
import type { Supplier, Perfume } from '@/types';
import { PODocumentUpload } from '@/components/PODocumentUpload';
import { PaymentDialog } from '@/components/PaymentDialog';
import { POAttachments } from '@/components/POAttachments';
import { InvoiceOCRPriceDialog, type PriceDialogItem } from '@/components/InvoiceOCRPriceDialog';
import { BulkActionToolbar } from '@/components/BulkActionToolbar';
import { Checkbox } from '@/components/ui/checkbox';

// ---- Status Config ----
const PO_STATUSES = [
  { value: 'draft', label: 'Draft', icon: FileText, color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  { value: 'pending_quote', label: 'Pending Quote', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { value: 'quote_approved', label: 'Quote Approved', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 'pending_delivery', label: 'Pending Delivery', icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  { value: 'qc', label: 'QC', icon: ShieldCheck, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  { value: 'delivered', label: 'Delivered', icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 dark:bg-green-950/30' },
] as const;

type POStatus = typeof PO_STATUSES[number]['value'];

interface POItem {
  id: number;
  perfume_name: string;
  brand?: string;
  master_id: string;
  size_ml: number;
  quantity: number;
  bottle_type: string;
  unit_price?: number;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  status: POStatus;
  notes?: string;
  quote_url?: string;
  po_type?: 'perfume' | 'packaging';
  invoice_url?: string;
  created_at: string;
  updated_at: string;
  items: POItem[];
  total_items: number;
  total_quantity: number;
  total_amount?: number;
  currency?: string;
  payment_status?: string;
  payment_method?: string;
  payment_date?: string;
  amount_paid?: number;
  payment_ref?: string;
  payment_notes?: string;
  expected_delivery?: string;
}

function getStatusConfig(status: string) {
  return PO_STATUSES.find(s => s.value === status) || PO_STATUSES[0];
}

function isActivePO(status: string) {
  return !['confirmed', 'draft'].includes(status);
}

// ---- Status Pipeline Visual ----
function StatusPipeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = PO_STATUSES.findIndex(s => s.value === currentStatus);
  return (
    <div className="flex items-center gap-1">
      {PO_STATUSES.map((s, i) => {
        const Icon = s.icon;
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={s.value} className="flex items-center gap-1">
            <div className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all',
              isCurrent ? `${s.bg} ${s.color} ring-1 ring-current` :
              isPast ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' :
              'bg-muted/30 text-muted-foreground/40')}>
              <Icon className="w-3 h-3" />
              <span className="hidden lg:inline">{s.label}</span>
            </div>
            {i < PO_STATUSES.length - 1 && (
              <ArrowRight className={cn('w-3 h-3', isPast ? 'text-emerald-400' : 'text-muted-foreground/20')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Unit Price Entry Dialog ----
function UnitPriceDialog({ po, onClose, onConfirm }: {
  po: PurchaseOrder;
  onClose: () => void;
  onConfirm: (prices: Record<number, number>) => void;
}) {
  const [prices, setPrices] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const item of po.items) {
      initial[item.id] = item.unit_price ? String(item.unit_price) : '';
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const allPricesFilled = po.items.every(item => {
    const val = parseFloat(prices[item.id] || '');
    return !isNaN(val) && val > 0;
  });

  const totalAmount = po.items.reduce((sum, item) => {
    const price = parseFloat(prices[item.id] || '0') || 0;
    return sum + price * item.quantity;
  }, 0);

  const handleConfirm = async () => {
    if (!allPricesFilled) return;
    setSaving(true);
    const priceMap: Record<number, number> = {};
    for (const item of po.items) {
      priceMap[item.id] = parseFloat(prices[item.id]);
    }
    onConfirm(priceMap);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gold" />
              Set Unit Prices Before Confirmation
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {po.po_number} — {po.supplier_name}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Unit prices are required before confirmation</p>
              <p className="text-[10px] text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                Enter the unit price (AED) for each item. This will update the PO totals and create inventory records with the correct purchase price.
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="px-6 py-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Brand</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Perfume</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Size</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Qty</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Type</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2 w-36">Unit Price (AED)</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item) => {
                  const price = parseFloat(prices[item.id] || '0') || 0;
                  const subtotal = price * item.quantity;
                  const hasPrice = prices[item.id] !== '' && price > 0;
                  return (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="px-4 py-2">
                        <p className="text-xs font-medium text-muted-foreground">{item.brand || '—'}</p>
                      </td>
                      <td className="px-4 py-2">
                        <p className="text-xs font-semibold">{item.perfume_name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{item.master_id}</p>
                      </td>
                      <td className="px-4 py-2 text-center text-xs font-mono">{item.size_ml}ml</td>
                      <td className="px-4 py-2 text-center text-xs font-mono font-bold">{item.quantity}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-muted/50">{item.bottle_type}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px] text-muted-foreground">AED</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={prices[item.id] || ''}
                            onChange={e => setPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="0.00"
                            className={cn(
                              'w-24 text-right text-xs font-mono bg-background border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold/30',
                              !hasPrice && prices[item.id] !== '' ? 'border-red-300' : 'border-input'
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-xs font-mono">
                        {hasPrice ? `AED ${subtotal.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">{po.items.length} items · {po.total_quantity} units</p>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Amount</p>
              <p className="text-lg font-mono font-bold text-gold">AED {totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex items-center justify-between rounded-b-2xl">
          <p className="text-[10px] text-muted-foreground">
            {allPricesFilled
              ? <span className="text-emerald-600 font-semibold">All prices set — ready to confirm</span>
              : <span className="text-amber-600 font-semibold">Please fill in all unit prices</span>
            }
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              disabled={!allPricesFilled || saving}
              onClick={handleConfirm}
            >
              {saving ? 'Confirming...' : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save Prices & Confirm Delivery
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- PO Row (expandable) ----
function PORow({ po, onAdvance, onUploadQuote, onUploadInvoice, onShareWhatsApp, onShareEmail, onRecordPayment, onViewAttachments, isSelected, onToggleSelect, onSetDeliveryDate }: {
  po: PurchaseOrder;
  onAdvance: (poId: string, nextStatus: string) => void;
  onUploadQuote: (poId: string) => void;
  onUploadInvoice: (poId: string) => void;
  onShareWhatsApp: (po: PurchaseOrder) => void;
  onShareEmail: (po: PurchaseOrder) => void;
  onRecordPayment: (po: PurchaseOrder) => void;
  onViewAttachments: (po: PurchaseOrder) => void;
  isSelected: boolean;
  onToggleSelect: (poNumber: string) => void;
  onSetDeliveryDate: (po: PurchaseOrder) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusConf = getStatusConfig(po.status);
  const StatusIcon = statusConf.icon;
  const currentIdx = PO_STATUSES.findIndex(s => s.value === po.status);
  const nextStatus = currentIdx < PO_STATUSES.length - 1 ? PO_STATUSES[currentIdx + 1] : null;

  return (
    <div className={cn('border rounded-xl overflow-hidden hover:shadow-md transition-all', isSelected ? 'border-gold ring-1 ring-gold/30' : 'border-border')}>
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="shrink-0" onClick={e => { e.stopPropagation(); onToggleSelect(po.po_number); }}>
          <Checkbox checked={isSelected} className="data-[state=checked]:bg-gold data-[state=checked]:border-gold" />
        </div>
        <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-mono font-bold">{po.po_number}</h3>
            {po.po_type === 'packaging' && (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400">PKG</span>
            )}
            <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', statusConf.bg, statusConf.color)}>
              <StatusIcon className="w-3 h-3" />
              {statusConf.label}
            </div>
            {/* Payment badge */}
            {po.payment_status && po.payment_status !== 'unpaid' && (
              <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                po.payment_status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600'
              )}>
                <CreditCard className="w-3 h-3" />
                {po.payment_status === 'paid' ? 'Paid' : 'Partial'}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {po.supplier_name} · {po.total_items} items · {po.total_quantity} units
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">
            {new Date(po.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
          </p>
          {po.expected_delivery && (() => {
            const today = new Date();
            const delivery = new Date(po.expected_delivery);
            const diffDays = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const isOverdue = diffDays < 0 && !['confirmed', 'delivered'].includes(po.status);
            const isDueSoon = diffDays >= 0 && diffDays <= 3 && !['confirmed', 'delivered'].includes(po.status);
            return (
              <p className={cn('text-[10px] font-medium mt-0.5 flex items-center gap-1',
                isOverdue ? 'text-red-500' : isDueSoon ? 'text-amber-500' : 'text-muted-foreground/70'
              )}>
                <CalendarDays className="w-3 h-3" />
                {isOverdue ? `${Math.abs(diffDays)}d overdue` : isDueSoon ? `Due in ${diffDays}d` : delivery.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </p>
            );
          })()}
        </div>
        <div className="shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/10">
          {/* Pipeline */}
          <div className="overflow-x-auto pb-2">
            <StatusPipeline currentStatus={po.status} />
          </div>

          {/* Items Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  {po.po_type === 'packaging' ? (
                    <>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">SKU</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">SKU ID</th>
                      <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Qty</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Unit Price</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Brand</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Perfume</th>
                      <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Size</th>
                      <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Qty</th>
                      <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Type</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Unit Price</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {po.items.map((item, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {po.po_type === 'packaging' ? (
                      <>
                        <td className="px-4 py-2">
                          <p className="text-xs font-semibold">{item.perfume_name}</p>
                        </td>
                        <td className="px-4 py-2">
                          <p className="text-[10px] font-mono text-muted-foreground">{item.master_id}</p>
                        </td>
                        <td className="px-4 py-2 text-center text-xs font-mono font-bold">{item.quantity}</td>
                        <td className="px-4 py-2 text-right text-xs font-mono">
                          {item.unit_price ? `AED ${item.unit_price.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2">
                          <p className="text-xs font-medium text-muted-foreground">{item.brand || '—'}</p>
                        </td>
                        <td className="px-4 py-2">
                          <p className="text-xs font-semibold">{item.perfume_name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{item.master_id}</p>
                        </td>
                        <td className="px-4 py-2 text-center text-xs font-mono">{item.size_ml}ml</td>
                        <td className="px-4 py-2 text-center text-xs font-mono font-bold">{item.quantity}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-muted/50">{item.bottle_type}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-mono">
                          {item.unit_price ? `AED ${item.unit_price.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payment Info */}
          {po.payment_status && po.payment_status !== 'unpaid' && (
            <div className={cn('rounded-lg p-3 border',
              po.payment_status === 'paid' ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className={cn('w-3.5 h-3.5', po.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600')} />
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: po.payment_status === 'paid' ? '#059669' : '#d97706' }}>
                  {po.payment_status === 'paid' ? 'Payment Complete' : 'Partial Payment'}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {po.amount_paid != null && po.amount_paid > 0 && (
                  <div>
                    <span className="text-muted-foreground">Paid: </span>
                    <span className="font-mono font-bold">AED {po.amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {po.payment_method && (
                  <div>
                    <span className="text-muted-foreground">Method: </span>
                    <span className="font-medium capitalize">{po.payment_method.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {po.payment_date && (
                  <div>
                    <span className="text-muted-foreground">Date: </span>
                    <span className="font-medium">{new Date(po.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                  </div>
                )}
                {po.payment_ref && (
                  <div>
                    <span className="text-muted-foreground">Ref: </span>
                    <span className="font-mono">{po.payment_ref}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {po.notes && (
            <div className="bg-muted/20 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Notes</p>
              <p className="text-xs text-muted-foreground">{po.notes}</p>
            </div>
          )}

          {/* Attachments */}
          <div className="flex flex-wrap gap-3">
            {po.quote_url && (
              <a href={po.quote_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                <FileText className="w-3.5 h-3.5" /> View Quote
              </a>
            )}
            {po.invoice_url && (
              <a href={po.invoice_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                <FileText className="w-3.5 h-3.5" /> View Invoice
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            {/* Communication */}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => onShareWhatsApp(po)}>
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => onShareEmail(po)}>
              <Mail className="w-3.5 h-3.5" /> Email
            </Button>

            {/* Export PDF */}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs text-gold border-gold/30 hover:bg-gold/10"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/api/po/${encodeURIComponent(po.po_number)}/pdf`, '_blank');
              }}>
              <Download className="w-3.5 h-3.5" /> Export PDF
            </Button>

            {/* Attachments */}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs"
              onClick={() => onViewAttachments(po)}>
              <Paperclip className="w-3.5 h-3.5" /> Attachments
            </Button>

            {/* Set Delivery Date */}
            {!['confirmed', 'delivered'].includes(po.status) && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
                onClick={() => onSetDeliveryDate(po)}>
                <CalendarDays className="w-3.5 h-3.5" />
                {po.expected_delivery ? 'Edit Delivery Date' : 'Set Delivery Date'}
              </Button>
            )}

            {/* Record Payment */}
            {po.status !== 'draft' && (po.status as string) !== 'cancelled' && (
              <Button size="sm" variant="outline" className={cn('gap-1.5 text-xs',
                po.payment_status === 'paid' ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' :
                po.payment_status === 'partial' ? 'text-amber-600 border-amber-200 hover:bg-amber-50' :
                'text-muted-foreground border-border hover:bg-muted/30'
              )}
                onClick={() => onRecordPayment(po)}>
                <CreditCard className="w-3.5 h-3.5" />
                {po.payment_status === 'paid' ? 'Paid' : po.payment_status === 'partial' ? 'Partial' : 'Record Payment'}
              </Button>
            )}

            <div className="flex-1" />

            {/* Status-specific actions */}
            {po.status === 'pending_quote' && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onUploadQuote(po.po_number)}>
                <FileUp className="w-3.5 h-3.5" /> Upload Quote
              </Button>
            )}
            {po.status === 'pending_delivery' && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onUploadInvoice(po.po_number)}>
                <FileUp className="w-3.5 h-3.5" /> Upload Invoice
              </Button>
            )}

            {/* Advance Status */}
            {nextStatus && po.status !== 'confirmed' && (
              <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5 text-xs"
                onClick={() => onAdvance(po.po_number, nextStatus.value)}>
                <ArrowRight className="w-3.5 h-3.5" />
                {nextStatus.value === 'confirmed' ? 'Confirm & Log Inventory' : `Move to ${nextStatus.label}`}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Create Perfume PO Dialog (same as SuppliersPage CreatePODialog but with supplier selection) ----
function CreatePerfumePODialog({ suppliers, perfumes, onClose, onCreated }: {
  suppliers: Supplier[];
  perfumes: Perfume[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [items, setItems] = useState<{ master_id: string; perfume_name: string; qty: number; size_ml: number; bottle_type: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [perfumeSearch, setPerfumeSearch] = useState('');
  const [showPerfumeList, setShowPerfumeList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const sortedPerfumes = useMemo(() => {
    return [...perfumes].sort((a, b) => {
      const brandCmp = (a.brand || '').localeCompare(b.brand || '');
      if (brandCmp !== 0) return brandCmp;
      return a.name.localeCompare(b.name);
    });
  }, [perfumes]);

  const filteredPerfumes = useMemo(() => {
    if (!perfumeSearch) return sortedPerfumes.slice(0, 15);
    const q = perfumeSearch.toLowerCase();
    return sortedPerfumes.filter(p =>
      p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q) || p.master_id.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [perfumeSearch, sortedPerfumes]);

  const addItem = (p: Perfume) => {
    if (items.find(i => i.master_id === p.master_id)) { toast.error('Already added'); return; }
    setItems(prev => [...prev, {
      master_id: p.master_id,
      perfume_name: `${p.brand} ${p.name}`,
      qty: 1,
      size_ml: p.reference_size_ml || 100,
      bottle_type: 'sealed',
    }]);
    setPerfumeSearch('');
    setShowPerfumeList(false);
  };

  const updateItem = (idx: number, field: string, value: number | string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const selectedSupplier = suppliers.find(s => s.supplier_id === selectedSupplierId);

  const handleSubmit = async () => {
    if (!selectedSupplierId) { toast.error('Select a supplier'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    setCreating(true);
    try {
      const nextNum = await api.purchaseOrders.nextNumber();
      const poNum = String(nextNum).padStart(3, '0');
      const supplierSlug = (selectedSupplier?.name || 'Unknown').replace(/\s+/g, '-');
      const poId = `PO-${poNum}/${supplierSlug}`;
      await api.mutations.purchaseOrders.create({
        poId,
        supplierId: selectedSupplierId,
        supplierName: selectedSupplier?.name || 'Unknown',
        currency: selectedSupplier?.currency || 'AED',
        notes,
        items: items.map(i => ({
          masterId: i.master_id,
          perfumeName: i.perfume_name,
          qty: i.qty,
          sizeMl: i.size_ml,
          bottleType: i.bottle_type,
        })),
      });
      toast.success(`Purchase Order created: ${poId}`);
      onCreated();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create PO');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
              <ShoppingCart className="w-4.5 h-4.5 text-gold" />
            </div>
            <div>
              <h3 className="text-base font-bold">Create Perfume Purchase Order</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Select supplier and add perfumes — prices added after quote</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Supplier Selection */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Supplier</label>
            <select
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select a supplier...</option>
              {suppliers.map(s => (
                <option key={s.supplier_id} value={s.supplier_id}>{s.name} ({s.country || 'N/A'})</option>
              ))}
            </select>
          </div>

          {/* Add Perfume Search */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Add Items (sorted alphabetically by brand)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={perfumeSearch}
                onChange={e => { setPerfumeSearch(e.target.value); setShowPerfumeList(true); }}
                onFocus={() => setShowPerfumeList(true)}
                placeholder="Search perfume by name, brand, or Master ID..."
                className="pl-9" />
              {showPerfumeList && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredPerfumes.map(p => (
                    <button key={p.master_id} onClick={() => addItem(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-left">
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground mr-2">{p.brand}</span>
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground ml-2">{p.master_id}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{p.reference_size_ml}ml</span>
                    </button>
                  ))}
                  {filteredPerfumes.length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted-foreground text-center">No perfumes found</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Items Table — NO PRICES */}
          {items.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Perfume</th>
                    <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-2.5 w-20">Qty</th>
                    <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-2.5 w-24">Size (ml)</th>
                    <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-2.5 w-28">Type</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium">{item.perfume_name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{item.master_id}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <input type="number" min={1} value={item.qty}
                          onChange={e => updateItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-center bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                      </td>
                      <td className="px-2 py-2.5">
                        <input type="number" min={1} value={item.size_ml}
                          onChange={e => updateItem(idx, 'size_ml', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-center bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                      </td>
                      <td className="px-2 py-2.5">
                        <select value={item.bottle_type}
                          onChange={e => updateItem(idx, 'bottle_type', e.target.value)}
                          className="w-full bg-background border border-input rounded px-2 py-1 text-xs font-medium">
                          <option value="sealed">Sealed</option>
                          <option value="open">Open</option>
                          <option value="tester">Tester</option>
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items.length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Search and add perfumes above</p>
              <p className="text-[10px] text-muted-foreground mt-1">Prices will be added after receiving quote from supplier</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" placeholder="Special instructions..." />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleSubmit} disabled={items.length === 0 || !selectedSupplierId || creating}>
            {creating ? 'Creating...' : <><ShoppingCart className="w-3.5 h-3.5" /> Create PO (Pending Quote)</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Packaging PO Create Dialog ----
function PackagingPOCreateDialog({ suppliers, skus, onClose, onCreated }: {
  suppliers: Supplier[];
  skus: any[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierList, setShowSupplierList] = useState(false);
  const [items, setItems] = useState<{ skuId: string; skuName: string; sizeSpec: string; qty: number; unitPrice: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const filteredSuppliers = suppliers.filter(s =>
    s.active && (s.supplier_type === 'packaging' || s.supplier_type === 'both') &&
    (s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
  );

  const addItem = (sku: any) => {
    if (items.some(i => i.skuId === (sku.skuId || sku.sku_id))) return;
    setItems(prev => [...prev, {
      skuId: sku.skuId || sku.sku_id,
      skuName: sku.name,
      sizeSpec: sku.sizeSpec || sku.size_spec || '',
      qty: 1,
      unitPrice: '',
    }]);
  };

  const removeItem = (skuId: string) => setItems(prev => prev.filter(i => i.skuId !== skuId));
  const updateItem = (skuId: string, field: string, value: any) => {
    setItems(prev => prev.map(i => i.skuId === skuId ? { ...i, [field]: value } : i));
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) { toast.error('Select a supplier'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    setCreating(true);
    try {
      await api.mutations.packagingPOs.create({
        supplierId: selectedSupplier.supplier_id,
        items: items.map(i => ({ skuId: i.skuId, qty: i.qty, unitPrice: i.unitPrice || undefined })),
        notes: notes || undefined,
      });
      toast.success('Packaging PO created');
      onCreated();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create PO');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <PackageOpen className="w-4 h-4 text-teal-600" />
              New Packaging Purchase Order
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Order packaging materials from a supplier</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Supplier Selection */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Supplier</label>
            {selectedSupplier ? (
              <div className="flex items-center gap-2 p-2 border border-teal-300 rounded-lg bg-teal-50 dark:bg-teal-950/20">
                <span className="text-sm font-medium flex-1">{selectedSupplier.name}</span>
                <button onClick={() => setSelectedSupplier(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="relative">
                <Input value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setShowSupplierList(true); }}
                  onFocus={() => setShowSupplierList(true)} placeholder="Search packaging suppliers..." />
                {showSupplierList && filteredSuppliers.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredSuppliers.map(s => (
                      <button key={s.supplier_id} onClick={() => { setSelectedSupplier(s); setShowSupplierList(false); setSupplierSearch(''); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors">{s.name}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SKU Selection */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Add Items</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {skus.filter((s: any) => !items.some(i => i.skuId === (s.skuId || s.sku_id))).map((sku: any) => (
                <button key={sku.skuId || sku.sku_id} onClick={() => addItem(sku)}
                  className="text-[10px] px-2 py-1 rounded border border-border hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition-colors truncate max-w-[200px]">
                  + {sku.name}
                </button>
              ))}
            </div>
          </div>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="text-left px-3 py-2">SKU</th>
                    <th className="text-center px-3 py-2 w-20">Qty</th>
                    <th className="text-right px-3 py-2 w-28">Unit Price</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.skuId} className="border-t border-border/30">
                      <td className="px-3 py-2">
                        <p className="text-xs font-medium">{item.skuName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{item.skuId}</p>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Input type="number" min={1} value={item.qty} onChange={e => updateItem(item.skuId, 'qty', parseInt(e.target.value) || 1)}
                          className="w-16 text-center mx-auto text-xs" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input type="number" min={0} step="0.01" value={item.unitPrice} onChange={e => updateItem(item.skuId, 'unitPrice', e.target.value)}
                          placeholder="AED" className="w-24 text-right ml-auto text-xs" />
                      </td>
                      <td className="px-1">
                        <button onClick={() => removeItem(item.skuId)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" placeholder="Internal notes..." />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5" onClick={handleSubmit} disabled={creating}>
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create PO
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Packaging Confirm Delivery Dialog ----
function PackagingConfirmDeliveryDialog({ po, onClose, onConfirm }: {
  po: PurchaseOrder;
  onClose: () => void;
  onConfirm: (items: { skuId: string; qty: number; unitPrice: string }[]) => void;
}) {
  const [itemPrices, setItemPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of po.items) {
      initial[item.master_id] = item.unit_price ? String(item.unit_price) : '';
    }
    return initial;
  });

  const allPricesFilled = po.items.every(item => {
    const val = parseFloat(itemPrices[item.master_id] || '');
    return !isNaN(val) && val > 0;
  });

  const totalAmount = po.items.reduce((sum, item) => {
    const price = parseFloat(itemPrices[item.master_id] || '0') || 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Confirm Delivery & Set Prices
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{po.po_number} — {po.supplier_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Confirming delivery will update packaging inventory</p>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">
                Enter the unit price (AED) for each item. Stock levels will be increased and ledger events created.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <th className="text-left pb-2">SKU</th>
                <th className="text-center pb-2">Qty</th>
                <th className="text-right pb-2 w-36">Unit Price (AED)</th>
                <th className="text-right pb-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => {
                const price = parseFloat(itemPrices[item.master_id] || '0') || 0;
                return (
                  <tr key={item.master_id} className="border-t border-border/30">
                    <td className="py-2">
                      <p className="text-sm font-medium">{item.perfume_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{item.master_id}</p>
                    </td>
                    <td className="py-2 text-center text-sm font-mono">{item.quantity}</td>
                    <td className="py-2 text-right">
                      <Input type="number" min={0} step="0.01"
                        value={itemPrices[item.master_id]}
                        onChange={e => setItemPrices(prev => ({ ...prev, [item.master_id]: e.target.value }))}
                        className="w-28 text-right ml-auto" />
                    </td>
                    <td className="py-2 text-right text-sm font-mono">
                      {price > 0 ? (price * item.quantity).toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totalAmount > 0 && (
              <tfoot>
                <tr className="border-t border-border font-bold">
                  <td colSpan={3} className="py-2 text-right text-xs">Total:</td>
                  <td className="py-2 text-right text-sm font-mono">{totalAmount.toFixed(2)} AED</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" disabled={!allPricesFilled}
            onClick={() => onConfirm(po.items.map(item => ({
              skuId: item.master_id,
              qty: item.quantity,
              unitPrice: itemPrices[item.master_id],
            })))}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Delivery
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----
type POTypeFilter = 'all' | 'perfume' | 'packaging';

export default function PurchaseOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [poTypeFilter, setPOTypeFilter] = useState<POTypeFilter>('all');

  // Load POs from API
  const { data: posData, refetch } = useApiQuery(() => api.purchaseOrders.list());
  const { data: suppliersData } = useApiQuery(() => api.master.suppliers());

  // Load perfumes for New Perfume PO dialog
  const { data: perfumesData } = useApiQuery(() => api.master.perfumes());
  const perfumes: Perfume[] = useMemo(() => {
    const raw = (perfumesData as any)?.data || [];
    return Array.isArray(raw) ? raw : [];
  }, [perfumesData]);

  const [showCreatePerfumePO, setShowCreatePerfumePO] = useState(false);
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState<Supplier | null>(null);

  // Load Packaging POs
  const { data: pkgPosRaw, refetch: refetchPkg } = useApiQuery<any[]>(() => api.mutations.packagingPOs.list());
  const skusQuery = useApiQuery(() => api.master.packagingSKUs());
  const skusRaw = skusQuery.data;

  const [showCreatePkgPO, setShowCreatePkgPO] = useState(false);
  const [confirmingPkgPO, setConfirmingPkgPO] = useState<any>(null);
  const [pkgActionLoading, setPkgActionLoading] = useState<string | null>(null);

  // Enrich packaging POs with items
  const [enrichedPkgPOs, setEnrichedPkgPOs] = useState<any[]>([]);
  useEffect(() => {
    if (!pkgPosRaw) { setEnrichedPkgPOs([]); return; }
    const enrichAll = async () => {
      const enriched = await Promise.all((pkgPosRaw as any[]).map(async (po) => {
        try {
          const detail = await api.mutations.packagingPOs.get(po.poId);
          return detail || po;
        } catch { return po; }
      }));
      setEnrichedPkgPOs(enriched);
    };
    enrichAll();
  }, [pkgPosRaw]);

  const pkgSuppliers: Supplier[] = useMemo(() => {
    if (!suppliersData) return [];
    const rawList = (suppliersData as any).data || suppliersData;
    if (!Array.isArray(rawList)) return [];
    return rawList.map((s: any) => ({
      supplier_id: s.supplierId || s.supplier_id,
      type: s.type || 'wholesaler',
      supplier_type: s.supplierType || 'perfume',
      name: s.name,
      contact_name: s.contactName,
      contact_email: s.contactEmail || '',
      contact_phone: s.contactPhone,
      country: s.country || '',
      city: s.city,
      payment_terms: s.paymentTerms,
      currency: s.currency,
      website: s.website,
      notes: s.notes || '',
      risk_flag: s.riskFlag || false,
      active: s.active !== false,
      purchases: [],
      total_spent: 0,
      total_items: 0,
      created_at: s.createdAt || '',
    }));
  }, [suppliersData]);

  const pkgSkus = useMemo(() => {
    if (!skusRaw) return [];
    const rawList = (skusRaw as any).data || skusRaw;
    return Array.isArray(rawList) ? rawList : [];
  }, [skusRaw]);

  const refetchAll = useCallback(() => { refetch(); refetchPkg(); }, [refetch, refetchPkg]);

  const allPOs: PurchaseOrder[] = useMemo(() => {
    const perfumeRaw = (posData as any)?.data || [];
    const perfumePOs = perfumeRaw.map((po: any) => {
      // DB returns camelCase fields via tRPC/superjson
      const items = (po.items || []).map((item: any) => ({
        id: item.id,
        perfume_name: item.perfumeName || item.perfume_name || 'Unknown',
        brand: item.brand || '',
        master_id: item.masterId || item.master_id || '',
        size_ml: item.sizeMl || item.size_ml || 0,
        quantity: item.qty || item.quantity || 0,
        bottle_type: item.bottleType || item.bottle_type || 'sealed',
        unit_price: item.unitPrice != null ? Number(item.unitPrice) : (item.unit_price != null ? Number(item.unit_price) : null),
      }));
      return {
        id: po.id,
        po_number: po.poId || po.po_number || `PO-${po.id}`,
        supplier_id: po.supplierId || po.supplier_id,
        supplier_name: po.supplierName || po.supplier_name || 'Unknown',
        status: po.status || 'draft',
        notes: po.notes,
        quote_url: po.quoteFileUrl || po.quote_url,
        invoice_url: po.invoiceFileUrl || po.invoice_url,
        created_at: po.createdAt || po.created_at,
        updated_at: po.updatedAt || po.updated_at,
        items,
        total_items: items.length,
        total_quantity: items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0),
        total_amount: Number(po.totalAmount ?? po.total_amount ?? 0),
        currency: 'AED',
        expected_delivery: po.expectedDelivery || po.expected_delivery,
        payment_status: po.paymentStatus || po.payment_status || 'unpaid',
        payment_method: po.paymentMethod || po.payment_method,
        payment_date: po.paymentDate || po.payment_date,
        amount_paid: Number(po.amountPaid ?? po.amount_paid ?? 0),
        payment_ref: po.paymentRef || po.payment_ref,
        payment_notes: po.paymentNotes || po.payment_notes,
        po_type: 'perfume' as const,
      };
    });

    // Map packaging POs into the same shape
    const pkgPOs = enrichedPkgPOs.map((po: any) => {
      const items = (po.items || []).map((item: any) => ({
        id: item.id || 0,
        perfume_name: item.perfumeName || item.skuName || 'Unknown',
        brand: '',
        master_id: item.masterId || item.skuId || '',
        size_ml: 0,
        quantity: item.qty || 0,
        bottle_type: 'packaging',
        unit_price: item.unitPrice != null ? Number(item.unitPrice) : null,
      }));
      return {
        id: po.id || 0,
        po_number: po.poId || `PKG-${po.id}`,
        supplier_id: po.supplierId || 0,
        supplier_name: po.supplierName || 'Unknown',
        status: po.status || 'pending_quote',
        notes: po.notes,
        quote_url: undefined,
        invoice_url: undefined,
        created_at: po.createdAt || new Date().toISOString(),
        updated_at: po.updatedAt || new Date().toISOString(),
        items,
        total_items: items.length,
        total_quantity: items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0),
        total_amount: Number(po.totalAmount || 0),
        currency: 'AED',
        expected_delivery: undefined,
        payment_status: po.paymentStatus || 'unpaid',
        payment_method: po.paymentMethod,
        payment_date: po.paymentDate,
        amount_paid: Number(po.amountPaid || 0),
        payment_ref: po.paymentRef,
        payment_notes: po.paymentNotes,
        po_type: 'packaging' as const,
      } as PurchaseOrder;
    });

    return [...perfumePOs, ...pkgPOs];
  }, [posData, enrichedPkgPOs]);

  const suppliers = useMemo(() => {
    const raw = (suppliersData as any)?.data || [];
    return raw.map((s: any) => ({ id: s.id, name: s.name }));
  }, [suppliersData]);

  // Unique supplier names from POs
  const poSupplierNames = useMemo(() => {
    const names = new Set(allPOs.map(po => po.supplier_name));
    return Array.from(names).sort();
  }, [allPOs]);

  // Filter
  const filtered = useMemo(() => {
    return allPOs.filter(po => {
      // PO type filter
      if (poTypeFilter !== 'all' && (po.po_type || 'perfume') !== poTypeFilter) return false;
      if (filterStatus !== 'all' && filterStatus !== 'active' && po.status !== filterStatus) return false;
      if (filterStatus === 'active' && !isActivePO(po.status)) return false;
      if (filterSupplier !== 'all' && po.supplier_name !== filterSupplier) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return po.po_number.toLowerCase().includes(q) ||
          po.supplier_name.toLowerCase().includes(q) ||
          po.items.some(it => it.perfume_name.toLowerCase().includes(q));
      }
      return true;
    }).sort((a, b) => {
      // Active POs first, then by date
      const aActive = isActivePO(a.status) ? 0 : 1;
      const bActive = isActivePO(b.status) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [allPOs, filterStatus, filterSupplier, searchTerm, poTypeFilter]);

  // Stats
  const activePOs = allPOs.filter(po => isActivePO(po.status)).length;
  const pendingQuote = allPOs.filter(po => po.status === 'pending_quote').length;
  const pendingDelivery = allPOs.filter(po => po.status === 'pending_delivery').length;
  const inQC = allPOs.filter(po => po.status === 'qc').length;

  // ---- Unit Price Dialog for Confirmation ----
  const [priceDialogPO, setPriceDialogPO] = useState<PurchaseOrder | null>(null);

  // Actions
  const handleAdvance = async (poId: string, nextStatus: string) => {
    const po = allPOs.find(p => p.po_number === poId);
    if (!po) return;

    // Packaging POs use a different API
    if (po.po_type === 'packaging') {
      if (nextStatus === 'confirmed') {
        // For packaging POs, open the confirm delivery dialog
        setConfirmingPkgPO(po);
        return;
      }
      try {
        await api.mutations.packagingPOs.updateStatus(poId, nextStatus);
        toast.success(`PO status updated to ${nextStatus.replace(/_/g, ' ')}`);
        refetchAll();
      } catch (e) {
        toast.error('Failed to update packaging PO status');
      }
      return;
    }

    // Perfume POs
    // If moving to "confirmed", intercept and check for unit prices
    if (nextStatus === 'confirmed') {
      // Open the price dialog — it handles both price entry and confirmation
      setPriceDialogPO(po);
      return;
    }

    try {
      await api.mutations.purchaseOrders.updateStatus(poId, nextStatus);
      toast.success(`PO status updated to ${nextStatus.replace(/_/g, ' ')}`);
      refetch();
    } catch (e) {
      toast.error('Failed to update PO status');
    }
  };

  // handleConfirmWithPrices is now handled internally by InvoiceOCRPriceDialog

  const [uploadDialog, setUploadDialog] = useState<{ poId: string; poNumber: string; type: 'quote' | 'invoice'; existingUrl?: string } | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<PurchaseOrder | null>(null);
  const [attachmentsDialog, setAttachmentsDialog] = useState<PurchaseOrder | null>(null);

  // ---- Multi-select for bulk actions ----
  const [selectedPOIds, setSelectedPOIds] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((poNumber: string) => {
    setSelectedPOIds(prev => {
      const next = new Set(prev);
      if (next.has(poNumber)) next.delete(poNumber);
      else next.add(poNumber);
      return next;
    });
  }, []);
  const toggleSelectAll = useCallback(() => {
    if (selectedPOIds.size === filtered.length) {
      setSelectedPOIds(new Set());
    } else {
      setSelectedPOIds(new Set(filtered.map(po => po.po_number)));
    }
  }, [filtered, selectedPOIds.size]);
  const selectedPOs = useMemo(() => filtered.filter(po => selectedPOIds.has(po.po_number)), [filtered, selectedPOIds]);

  // ---- Delivery Date Dialog ----
  const [deliveryDatePO, setDeliveryDatePO] = useState<PurchaseOrder | null>(null);
  const [deliveryDateValue, setDeliveryDateValue] = useState('');
  const handleSetDeliveryDate = async () => {
    if (!deliveryDatePO || !deliveryDateValue) return;
    try {
      await api.mutations.purchaseOrders.setDeliveryDate(deliveryDatePO.po_number, deliveryDateValue);
      toast.success(`Delivery date set for ${deliveryDatePO.po_number}`);
      setDeliveryDatePO(null);
      setDeliveryDateValue('');
      refetch();
    } catch (e) {
      toast.error('Failed to set delivery date');
    }
  };

  const handleUploadQuote = (poId: string) => {
    const po = allPOs.find(p => p.po_number === poId);
    if (po) setUploadDialog({ poId: po.po_number, poNumber: po.po_number, type: 'quote', existingUrl: po.quote_url || undefined });
  };

  const handleUploadInvoice = (poId: string) => {
    const po = allPOs.find(p => p.po_number === poId);
    if (po) setUploadDialog({ poId: po.po_number, poNumber: po.po_number, type: 'invoice', existingUrl: po.invoice_url || undefined });
  };

  const handleShareWhatsApp = (po: PurchaseOrder) => {
    const itemsList = po.items.map(it => `• ${it.perfume_name} (${it.size_ml}ml × ${it.quantity})`).join('\n');
    const message = `📋 *Purchase Order: ${po.po_number}*\n\nItems:\n${itemsList}\n\nPlease provide a quote at your earliest convenience.\n\n— Maison Em`;
    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
    toast.success('Opening WhatsApp...');
  };

  const handleShareEmail = (po: PurchaseOrder) => {
    const itemsList = po.items.map(it => `- ${it.perfume_name} (${it.size_ml}ml × ${it.quantity})`).join('\n');
    const subject = encodeURIComponent(`Purchase Order: ${po.po_number}`);
    const body = encodeURIComponent(`Dear Supplier,\n\nPlease find our purchase order below:\n\nPO Number: ${po.po_number}\n\nItems:\n${itemsList}\n\nPlease provide a quote at your earliest convenience.\n\nBest regards,\nMaison Em`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    toast.success('Opening email client...');
  };

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle={`${allPOs.length} total · ${activePOs} active · ${pendingQuote} pending quote`}
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Purchase Orders' }]}
        actions={
          <div className="flex items-center gap-2">
          {(poTypeFilter === 'all' || poTypeFilter === 'perfume') && (
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5 text-xs" onClick={() => setShowCreatePerfumePO(true)}>
              <Plus className="w-3.5 h-3.5" /> New Perfume PO
            </Button>
          )}
          {(poTypeFilter === 'all' || poTypeFilter === 'packaging') && (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs" onClick={() => setShowCreatePkgPO(true)}>
              <Plus className="w-3.5 h-3.5" /> New Packaging PO
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
            const csv = ['PO Number,Supplier,Status,Items,Quantity,Created'].concat(
              allPOs.map(po => `"${po.po_number}","${po.supplier_name}","${po.status}",${po.total_items},${po.total_quantity},"${po.created_at}"`)
            ).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `purchase-orders-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            toast.success('POs exported');
          }}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* PO Type Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
          {(['all', 'perfume', 'packaging'] as const).map(t => (
            <button key={t} onClick={() => setPOTypeFilter(t)}
              className={cn('px-4 py-2 rounded-md text-xs font-semibold transition-all capitalize',
                poTypeFilter === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'all' ? `All (${allPOs.length})` : t === 'perfume' ? `Perfume (${allPOs.filter(p => (p.po_type || 'perfume') === 'perfume').length})` : `Packaging (${allPOs.filter(p => p.po_type === 'packaging').length})`}
            </button>
          ))}
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-gold">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active POs</p>
            <p className="text-2xl font-mono font-bold mt-1">{activePOs}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-amber-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pending Quote</p>
            <p className="text-2xl font-mono font-bold mt-1">{pendingQuote}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-purple-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pending Delivery</p>
            <p className="text-2xl font-mono font-bold mt-1">{pendingDelivery}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-orange-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">In QC</p>
            <p className="text-2xl font-mono font-bold mt-1">{inQC}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search PO number, supplier, perfume..." className="pl-9" />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status:</span>
            <button onClick={() => setFilterStatus('all')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filterStatus === 'all' ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
              All
            </button>
            <button onClick={() => setFilterStatus('active')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filterStatus === 'active' ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
              Active
            </button>
            {PO_STATUSES.map(s => (
              <button key={s.value} onClick={() => setFilterStatus(s.value)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                  filterStatus === s.value ? `${s.bg} ${s.color} border border-current/30` : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Supplier filter */}
          {poSupplierNames.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Supplier:</span>
              <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
                className="bg-background border border-input rounded-md px-3 py-1.5 text-xs">
                <option value="all">All Suppliers</option>
                {poSupplierNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Select All + PO List */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-3 px-1">
            <div onClick={toggleSelectAll} className="cursor-pointer">
              <Checkbox
                checked={selectedPOIds.size === filtered.length && filtered.length > 0}
                className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {selectedPOIds.size > 0 ? `${selectedPOIds.size} of ${filtered.length} selected` : `Select all ${filtered.length} POs`}
            </span>
          </div>
        )}
        <div className="space-y-3">
          {filtered.map(po => (
            <PORow key={po.id} po={po}
              onAdvance={handleAdvance}
              onUploadQuote={handleUploadQuote}
              onUploadInvoice={handleUploadInvoice}
              onShareWhatsApp={handleShareWhatsApp}
              onShareEmail={handleShareEmail}
              onRecordPayment={(po) => setPaymentDialog(po)}
              onViewAttachments={(po) => setAttachmentsDialog(po)}
              isSelected={selectedPOIds.has(po.po_number)}
              onToggleSelect={toggleSelect}
              onSetDeliveryDate={(po) => { setDeliveryDatePO(po); setDeliveryDateValue(po.expected_delivery || ''); }}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {allPOs.length === 0 ? 'No purchase orders yet. Create one from a Supplier detail page.' : 'No POs match your filters.'}
            </p>
          </div>
        )}
      </div>

      {/* Unit Price Dialog with Invoice OCR */}
      {priceDialogPO && (
        <InvoiceOCRPriceDialog
          items={priceDialogPO.items.map(i => ({
            id: String(i.id),
            perfume_name: i.perfume_name,
            size_ml: i.size_ml,
            qty: i.quantity,
            bottle_type: i.bottle_type,
            master_id: i.master_id,
            unit_price: i.unit_price,
          }))}
          poSerial={priceDialogPO.po_number}
          supplierId={String(priceDialogPO.supplier_id)}
          onClose={() => setPriceDialogPO(null)}
          onConfirmed={() => {
            setPriceDialogPO(null);
            refetch();
          }}
        />
      )}

      {/* Document Upload Dialog */}
      {uploadDialog && (
        <PODocumentUpload
          poId={String(uploadDialog.poId)}
          poNumber={uploadDialog.poNumber}
          type={uploadDialog.type}
          existingUrl={uploadDialog.existingUrl}
          onClose={() => setUploadDialog(null)}
          onUploaded={() => {
            setUploadDialog(null);
            refetch();
          }}
        />
      )}

      {/* Attachments Dialog */}
      {attachmentsDialog && (
        <POAttachments
          poId={attachmentsDialog.po_number}
          poNumber={attachmentsDialog.po_number}
          onClose={() => setAttachmentsDialog(null)}
          onChanged={() => refetch()}
        />
      )}

      {/* Payment Dialog */}
      {paymentDialog && (
        <PaymentDialog
          poId={paymentDialog.po_number}
          poNumber={paymentDialog.po_number}
          totalAmount={paymentDialog.total_amount || 0}
          currency="AED"
          currentPaymentStatus={paymentDialog.payment_status}
          currentPaymentMethod={paymentDialog.payment_method}
          currentPaymentDate={paymentDialog.payment_date}
          currentAmountPaid={paymentDialog.amount_paid}
          currentPaymentRef={paymentDialog.payment_ref}
          currentPaymentNotes={paymentDialog.payment_notes}
          onClose={() => setPaymentDialog(null)}
          onSaved={() => refetch()}
        />
      )}

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedIds={Array.from(selectedPOIds)}
        selectedPOs={selectedPOs}
        onClearSelection={() => setSelectedPOIds(new Set())}
        onActionComplete={() => refetch()}
        allStatuses={PO_STATUSES.map(s => ({ value: s.value, label: s.label }))}
      />

      {/* Create Perfume PO Dialog */}
      {showCreatePerfumePO && (
        <CreatePerfumePODialog
          suppliers={pkgSuppliers.filter(s => s.supplier_type === 'perfume' || s.supplier_type === 'both')}
          perfumes={perfumes}
          onClose={() => setShowCreatePerfumePO(false)}
          onCreated={() => { refetchAll(); setShowCreatePerfumePO(false); }}
        />
      )}

      {/* Packaging PO Create Dialog */}
      {showCreatePkgPO && (
        <PackagingPOCreateDialog
          suppliers={pkgSuppliers}
          skus={pkgSkus}
          onClose={() => setShowCreatePkgPO(false)}
          onCreated={() => { refetchAll(); setShowCreatePkgPO(false); }}
        />
      )}

      {/* Packaging PO Confirm Delivery Dialog */}
      {confirmingPkgPO && (
        <PackagingConfirmDeliveryDialog
          po={confirmingPkgPO}
          onClose={() => setConfirmingPkgPO(null)}
          onConfirm={async (items) => {
            setPkgActionLoading(confirmingPkgPO.po_number);
            try {
              await api.mutations.packagingPOs.confirmDelivery(confirmingPkgPO.po_number, items);
              toast.success('Delivery confirmed! Packaging inventory updated.');
              setConfirmingPkgPO(null);
              refetchAll();
            } catch (e: any) {
              toast.error(e.message || 'Failed to confirm delivery');
            } finally {
              setPkgActionLoading(null);
            }
          }}
        />
      )}

      {/* Delivery Date Dialog */}
      {deliveryDatePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeliveryDatePO(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Set Expected Delivery</h3>
              <button onClick={() => setDeliveryDatePO(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{deliveryDatePO.po_number} — {deliveryDatePO.supplier_name}</p>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Expected Delivery Date</label>
              <input
                type="date"
                value={deliveryDateValue}
                onChange={e => setDeliveryDateValue(e.target.value)}
                className="w-full mt-1 bg-background border border-input rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDeliveryDatePO(null)}>Cancel</Button>
              <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground" onClick={handleSetDeliveryDate} disabled={!deliveryDateValue}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
