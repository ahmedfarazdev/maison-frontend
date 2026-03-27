// ============================================================
// BulkActionToolbar — Floating toolbar for bulk PO actions
// Appears when POs are selected via checkboxes
// ============================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowRight, CreditCard, Download, X, CheckCircle2,
  Loader2, AlertTriangle,
} from 'lucide-react';

interface BulkActionToolbarProps {
  selectedIds: string[];
  selectedPOs: { po_number: string; supplier_name: string; status: string; total_amount?: number; currency?: string }[];
  onClearSelection: () => void;
  onActionComplete: () => void;
  allStatuses: { value: string; label: string }[];
}

export function BulkActionToolbar({
  selectedIds,
  selectedPOs,
  onClearSelection,
  onActionComplete,
  allStatuses,
}: BulkActionToolbarProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');

  if (selectedIds.length === 0) return null;

  const handleBulkAdvance = async (status: string) => {
    setLoading('advance');
    try {
      const result = await api.mutations.purchaseOrders.bulkUpdateStatus(selectedIds, status);
      const res = result as any;
      toast.success(`Updated ${res.successCount || selectedIds.length} PO(s) to ${status.replace(/_/g, ' ')}`);
      if (res.failCount > 0) toast.error(`${res.failCount} PO(s) failed to update`);
      setShowStatusPicker(false);
      onClearSelection();
      onActionComplete();
    } catch (e) {
      toast.error('Bulk status update failed');
    }
    setLoading(null);
  };

  const handleBulkPay = async () => {
    setLoading('pay');
    try {
      const result = await api.mutations.purchaseOrders.bulkMarkPaid(selectedIds, {
        paymentMethod,
        paymentDate: new Date().toISOString().split('T')[0],
      });
      const res = result as any;
      toast.success(`Marked ${res.successCount || selectedIds.length} PO(s) as paid`);
      if (res.failCount > 0) toast.error(`${res.failCount} PO(s) failed`);
      setShowPaymentForm(false);
      onClearSelection();
      onActionComplete();
    } catch (e) {
      toast.error('Bulk payment failed');
    }
    setLoading(null);
  };

  const handleExportCSV = () => {
    const headers = ['PO Number', 'Supplier', 'Status', 'Total Amount', 'Currency', 'Payment Status'];
    const rows = selectedPOs.map(po => [
      po.po_number,
      po.supplier_name,
      po.status,
      po.total_amount?.toString() || '',
      po.currency || 'AED',
      '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `po-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success(`Exported ${selectedIds.length} PO(s) to CSV`);
  };

  return (
    <>
      {/* Floating toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="bg-card border border-border shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3">
          {/* Selection count */}
          <div className="flex items-center gap-2 pr-3 border-r border-border">
            <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-gold" />
            </div>
            <span className="text-sm font-bold">{selectedIds.length}</span>
            <span className="text-xs text-muted-foreground">selected</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Advance Status */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => { setShowStatusPicker(!showStatusPicker); setShowPaymentForm(false); }}
                disabled={loading !== null}
              >
                {loading === 'advance' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                Advance Status
              </Button>
              {showStatusPicker && (
                <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-xl shadow-xl p-2 min-w-[180px] z-50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1 mb-1">Move to:</p>
                  {allStatuses.filter(s => !['draft'].includes(s.value)).map(s => (
                    <button
                      key={s.value}
                      onClick={() => handleBulkAdvance(s.value)}
                      className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mark as Paid */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                onClick={() => { setShowPaymentForm(!showPaymentForm); setShowStatusPicker(false); }}
                disabled={loading !== null}
              >
                {loading === 'pay' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                Mark Paid
              </Button>
              {showPaymentForm && (
                <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-xl shadow-xl p-4 min-w-[220px] z-50 space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Payment Method</p>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-xs"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="cheque">Cheque</option>
                  </select>
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    This will mark {selectedIds.length} PO(s) as fully paid
                  </div>
                  <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={handleBulkPay}>
                    Confirm Payment
                  </Button>
                </div>
              )}
            </div>

            {/* Export CSV */}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={handleExportCSV}
              disabled={loading !== null}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>

          {/* Clear */}
          <div className="pl-3 border-l border-border">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={onClearSelection}
            >
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Click-away overlay for dropdowns */}
      {(showStatusPicker || showPaymentForm) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowStatusPicker(false); setShowPaymentForm(false); }}
        />
      )}
    </>
  );
}
