/**
 * PaymentDialog — Record or update payment for a Purchase Order
 * Supports: unpaid / partial / paid statuses
 * Methods: bank_transfer, cash, credit_card, cheque, other
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  X, CreditCard, Banknote, Building2, FileCheck, CircleDollarSign,
  CheckCircle2, AlertCircle, Clock,
} from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { value: 'cheque', label: 'Cheque', icon: FileCheck },
  { value: 'other', label: 'Other', icon: CircleDollarSign },
] as const;

const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
  { value: 'partial', label: 'Partial', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
  { value: 'paid', label: 'Paid', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
] as const;

interface PaymentDialogProps {
  poId: string;
  poNumber: string;
  totalAmount: number;
  currency: string;
  currentPaymentStatus?: string;
  currentPaymentMethod?: string;
  currentPaymentDate?: string;
  currentAmountPaid?: number;
  currentPaymentRef?: string;
  currentPaymentNotes?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PaymentDialog({
  poId, poNumber, totalAmount, currency,
  currentPaymentStatus = 'unpaid',
  currentPaymentMethod, currentPaymentDate,
  currentAmountPaid = 0, currentPaymentRef,
  currentPaymentNotes,
  onClose, onSaved,
}: PaymentDialogProps) {
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus);
  const [paymentMethod, setPaymentMethod] = useState(currentPaymentMethod || '');
  const [paymentDate, setPaymentDate] = useState(currentPaymentDate || new Date().toISOString().split('T')[0]);
  const [amountPaid, setAmountPaid] = useState(currentAmountPaid > 0 ? String(currentAmountPaid) : '');
  const [paymentRef, setPaymentRef] = useState(currentPaymentRef || '');
  const [paymentNotes, setPaymentNotes] = useState(currentPaymentNotes || '');
  const [saving, setSaving] = useState(false);

  // Auto-set amount to total when marking as "paid"
  useEffect(() => {
    if (paymentStatus === 'paid' && (!amountPaid || Number(amountPaid) === 0)) {
      setAmountPaid(String(totalAmount));
    }
  }, [paymentStatus]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.mutations.purchaseOrders.recordPayment(poId, {
        paymentStatus: paymentStatus as 'unpaid' | 'partial' | 'paid',
        paymentMethod: paymentMethod || undefined,
        paymentDate: paymentDate || undefined,
        amountPaid: amountPaid ? Number(amountPaid) : undefined,
        paymentRef: paymentRef || undefined,
        paymentNotes: paymentNotes || undefined,
      });
      toast.success(`Payment recorded for ${poNumber}`);
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to record payment:', err);
      toast.error('Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const remaining = totalAmount - Number(amountPaid || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div>
            <h2 className="text-base font-bold">Record Payment</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{poNumber}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Total Amount Display */}
          <div className="flex items-center justify-between bg-muted/30 rounded-xl p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">PO Total</p>
              <p className="text-xl font-mono font-bold text-gold">{currency} {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            {paymentStatus === 'partial' && Number(amountPaid) > 0 && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Remaining</p>
                <p className={cn('text-lg font-mono font-bold', remaining > 0 ? 'text-amber-500' : 'text-emerald-500')}>
                  {currency} {Math.max(0, remaining).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>

          {/* Payment Status */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Payment Status</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_STATUSES.map(s => {
                const Icon = s.icon;
                const isActive = paymentStatus === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setPaymentStatus(s.value)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all',
                      isActive ? `${s.bg} ${s.color} ring-2 ring-current/20` : 'border-border hover:bg-muted/30 text-muted-foreground'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Method */}
          {paymentStatus !== 'unpaid' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => {
                  const Icon = m.icon;
                  const isActive = paymentMethod === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setPaymentMethod(m.value)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                        isActive ? 'bg-gold/10 border-gold/30 text-gold ring-1 ring-gold/20' : 'border-border hover:bg-muted/30 text-muted-foreground'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amount & Date */}
          {paymentStatus !== 'unpaid' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Amount Paid ({currency})</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Payment Date</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Reference & Notes */}
          {paymentStatus !== 'unpaid' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Reference #</label>
                <Input
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="e.g. TRX-12345"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Notes</label>
                <Input
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/10">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || (paymentStatus !== 'unpaid' && !paymentMethod)}
            className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
          >
            {saving ? 'Saving...' : 'Save Payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
