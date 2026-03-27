// ============================================================
// InvoiceOCRPriceDialog — Set unit prices with optional invoice OCR
// Reusable dialog for both PurchaseOrders and SuppliersPage
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { useFileUpload } from '@/hooks/useFileUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  Sparkles, X, Eye,
} from 'lucide-react';

export interface PriceDialogItem {
  id: string;
  perfume_name: string;
  size_ml: number;
  qty: number;
  bottle_type: string;
  master_id?: string;
  perfume_id?: string;
  unit_price?: number | null;
  received_qty?: number;
}

interface ExtractedPrice {
  itemId: string;
  perfumeName: string;
  unitPrice: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

interface InvoiceOCRPriceDialogProps {
  items: PriceDialogItem[];
  poSerial: string;
  supplierId: string;
  onClose: () => void;
  onConfirmed: () => void;
}

const CONFIDENCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'High' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Medium' },
  low: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Low' },
};

export function InvoiceOCRPriceDialog({
  items, poSerial, supplierId, onClose, onConfirmed,
}: InvoiceOCRPriceDialogProps) {
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    items.forEach(i => {
      map[i.id] = i.unit_price && i.unit_price > 0 ? String(i.unit_price) : '';
    });
    return map;
  });
  const [ocrResults, setOcrResults] = useState<Record<string, ExtractedPrice>>({});
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading, progress } = useFileUpload({
    folder: 'po-invoices/ocr',
    maxSizeMB: 10,
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  });

  const allPricesSet = items.every(i => {
    const val = Number(prices[i.id] || 0);
    return val > 0;
  });

  const totalAmount = items.reduce((sum, i) => {
    const price = Number(prices[i.id] || 0);
    return sum + price * i.qty;
  }, 0);

  const handleFileSelect = useCallback(async (file: File) => {
    const result = await upload(file);
    if (!result) return;

    setInvoicePreview(result.url);
    setExtracting(true);

    try {
      const ocrRes: any = await api.mutations.purchaseOrders.extractInvoicePrices(
        result.url,
        items.map(i => ({
          itemId: i.id,
          perfumeName: i.perfume_name,
          sizeMl: i.size_ml,
          qty: i.qty,
        }))
      );

      if (ocrRes?.success && ocrRes.extractedItems?.length > 0) {
        const extracted: Record<string, ExtractedPrice> = {};
        const newPrices = { ...prices };

        for (const ex of ocrRes.extractedItems) {
          extracted[ex.itemId] = ex;
          if (ex.unitPrice > 0) {
            newPrices[ex.itemId] = String(ex.unitPrice);
          }
        }

        setOcrResults(extracted);
        setPrices(newPrices);

        const found = ocrRes.extractedItems.filter((e: ExtractedPrice) => e.unitPrice > 0).length;
        toast.success(`Extracted ${found}/${items.length} prices from invoice`);
      } else {
        toast.error('Could not extract prices from invoice. Please enter manually.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Invoice OCR failed');
    } finally {
      setExtracting(false);
    }
  }, [upload, items, prices]);

  const handleSaveAndConfirm = async () => {
    setSaving(true);
    try {
      // Save prices first
      await api.mutations.purchaseOrders.updateItemPrices(
        poSerial,
        items.map(i => ({ itemId: Number(i.id), unitPrice: Number(prices[i.id] || 0) }))
      );
      // Then confirm delivery
      const receivedItems = items.map(i => ({
        itemId: Number(i.id),
        receivedQty: i.qty - (i.received_qty || 0),
        masterId: i.master_id || i.perfume_id || '',
        perfumeName: i.perfume_name,
        sizeMl: i.size_ml,
        bottleType: i.bottle_type,
        unitPrice: Number(prices[i.id] || 0),
        supplierId,
      }));
      await api.mutations.purchaseOrders.confirmDelivery(poSerial, receivedItems);
      toast.success(`PO ${poSerial} confirmed! Inventory updated.`);
      onConfirmed();
    } catch (e: any) {
      toast.error(e.message || 'Failed to confirm delivery');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold">Set Unit Prices — {poSerial}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Enter prices manually or upload a supplier invoice for automatic extraction.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Upload Section */}
        <div className="px-6 py-3 border-b border-border/50 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-gold" />
                Auto-Extract from Invoice
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Upload a supplier invoice (PDF or image) to auto-fill prices using AI.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs shrink-0"
              disabled={uploading || extracting}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading {progress}%</>
              ) : extracting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting...</>
              ) : (
                <><Upload className="w-3.5 h-3.5" /> Upload Invoice</>
              )}
            </Button>
            {invoicePreview && (
              <a href={invoicePreview} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline flex items-center gap-1 shrink-0">
                <Eye className="w-3 h-3" /> View
              </a>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {items.map(item => {
            const ocr = ocrResults[item.id];
            const conf = ocr ? CONFIDENCE_COLORS[ocr.confidence] : null;
            return (
              <div key={item.id} className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-all',
                ocr && ocr.unitPrice > 0
                  ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-800/30'
                  : 'bg-muted/30 border-border/50'
              )}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.perfume_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-muted-foreground">
                      {item.size_ml}ml · {item.bottle_type} · Qty: {item.qty}
                    </p>
                    {ocr && conf && (
                      <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', conf.bg, conf.text)}>
                        {ocr.confidence === 'high' ? <CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5" /> :
                         ocr.confidence === 'medium' ? <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" /> : null}
                        AI: {conf.label}
                      </span>
                    )}
                  </div>
                  {ocr?.notes && (
                    <p className="text-[9px] text-muted-foreground/70 mt-0.5 italic">{ocr.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground font-medium">AED</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prices[item.id] || ''}
                    onChange={e => setPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className={cn(
                      'w-28 h-9 px-3 text-sm font-mono border rounded-md bg-background text-right',
                      'focus:outline-none focus:ring-2 focus:ring-gold/30',
                      ocr && ocr.unitPrice > 0 ? 'border-emerald-300 dark:border-emerald-700' : 'border-input'
                    )}
                    placeholder="0.00"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <div className="text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-mono font-bold text-gold">AED {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
              disabled={saving || !allPricesSet}
              onClick={handleSaveAndConfirm}
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
              ) : (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Save Prices & Confirm Delivery</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
