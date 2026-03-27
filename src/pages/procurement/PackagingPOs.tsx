// ============================================================
// Packaging Purchase Orders — Full PO lifecycle for packaging SKUs
// Status pipeline: pending_quote → quote_approved →
//   pending_delivery → delivered → confirmed
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
  PackageOpen, Search, Plus, ChevronDown, ChevronUp,
  Clock, CheckCircle2, Truck, FileText, X,
  AlertCircle, ArrowRight, DollarSign, Loader2,
  Package, Users, CreditCard, XCircle, Eye,
} from 'lucide-react';
import type { Supplier } from '@/types';

// ---- Status Config ----
const PKG_PO_STATUSES = [
  { value: 'pending_quote', label: 'Pending Quote', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { value: 'quote_approved', label: 'Quote Approved', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 'pending_delivery', label: 'Pending Delivery', icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  { value: 'delivered', label: 'Delivered', icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 dark:bg-green-950/30' },
] as const;

function getStatusConfig(status: string) {
  return PKG_PO_STATUSES.find(s => s.value === status) || PKG_PO_STATUSES[0];
}

function getNextStatus(current: string): string | null {
  const idx = PKG_PO_STATUSES.findIndex(s => s.value === current);
  if (idx < 0 || idx >= PKG_PO_STATUSES.length - 1) return null;
  return PKG_PO_STATUSES[idx + 1].value;
}

// ---- Status Pipeline Visual ----
function StatusPipeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = PKG_PO_STATUSES.findIndex(s => s.value === currentStatus);
  return (
    <div className="flex items-center gap-1">
      {PKG_PO_STATUSES.map((s, i) => {
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
            {i < PKG_PO_STATUSES.length - 1 && (
              <ArrowRight className={cn('w-3 h-3', isPast ? 'text-emerald-400' : 'text-muted-foreground/20')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Create Packaging PO Dialog ----
function CreatePackagingPODialog({ suppliers, skus, onClose, onCreated }: {
  suppliers: Supplier[];
  skus: any[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierList, setShowSupplierList] = useState(false);
  const [items, setItems] = useState<{ skuId: string; skuName: string; sizeSpec: string; qty: number; unitPrice: string }[]>([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [showSkuList, setShowSkuList] = useState(false);
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Filter suppliers to packaging or both type
  const packagingSuppliers = useMemo(() => {
    return suppliers.filter(s => s.supplier_type === 'packaging' || s.supplier_type === 'both');
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return packagingSuppliers.slice(0, 10);
    const q = supplierSearch.toLowerCase();
    return packagingSuppliers.filter(s => s.name.toLowerCase().includes(q)).slice(0, 10);
  }, [supplierSearch, packagingSuppliers]);

  const filteredSkus = useMemo(() => {
    const active = skus.filter((s: any) => s.active !== false);
    if (!skuSearch) return active.slice(0, 15);
    const q = skuSearch.toLowerCase();
    return active.filter((s: any) =>
      s.name?.toLowerCase().includes(q) || s.skuId?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [skuSearch, skus]);

  const addItem = (sku: any) => {
    if (items.find(i => i.skuId === sku.skuId)) { toast.error('Already added'); return; }
    setItems(prev => [...prev, {
      skuId: sku.skuId,
      skuName: sku.name,
      sizeSpec: sku.sizeSpec || '',
      qty: 1,
      unitPrice: '',
    }]);
    setSkuSearch('');
    setShowSkuList(false);
  };

  const updateItem = (idx: number, field: string, value: number | string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totalAmount = items.reduce((sum, item) => {
    const price = parseFloat(item.unitPrice || '0') || 0;
    return sum + price * item.qty;
  }, 0);

  const handleSubmit = async () => {
    if (!selectedSupplier) { toast.error('Select a supplier'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    setCreating(true);
    try {
      const ts = Date.now().toString(36).toUpperCase();
      const supplierSlug = selectedSupplier.name.replace(/\s+/g, '-').substring(0, 20);
      const poId = `PKG-PO-${ts}/${supplierSlug}`;
      await api.mutations.packagingPOs.create({
        poId,
        supplierId: selectedSupplier.supplier_id,
        supplierName: selectedSupplier.name,
        notes,
        items: items.map(i => ({
          skuId: i.skuId,
          skuName: i.skuName,
          sizeSpec: i.sizeSpec,
          qty: i.qty,
          unitPrice: i.unitPrice || undefined,
        })),
      });
      toast.success(`Packaging PO created for ${selectedSupplier.name}`);
      onCreated();
      onClose();
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
            <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-950/30 flex items-center justify-center">
              <PackageOpen className="w-4.5 h-4.5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-bold">Create Packaging PO</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Order packaging materials from a supplier</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Supplier Selection */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Supplier (packaging/both only)</label>
            {selectedSupplier ? (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                <Users className="w-4 h-4 text-teal-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedSupplier.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedSupplier.supplier_id}</p>
                </div>
                <button onClick={() => setSelectedSupplier(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={supplierSearch}
                  onChange={e => { setSupplierSearch(e.target.value); setShowSupplierList(true); }}
                  onFocus={() => setShowSupplierList(true)}
                  placeholder="Search packaging suppliers..."
                  className="pl-9" />
                {showSupplierList && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredSuppliers.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 text-center">
                        No packaging suppliers found. Set supplier procurement type to "Packaging" or "Both" first.
                      </p>
                    ) : filteredSuppliers.map(s => (
                      <button key={s.supplier_id} onClick={() => { setSelectedSupplier(s); setShowSupplierList(false); setSupplierSearch(''); }}
                        className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0">
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.supplier_id} · {s.country}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add SKU Search */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Add Packaging SKUs</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={skuSearch}
                onChange={e => { setSkuSearch(e.target.value); setShowSkuList(true); }}
                onFocus={() => setShowSkuList(true)}
                placeholder="Search SKU by name, ID, or category..."
                className="pl-9" />
              {showSkuList && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredSkus.map((s: any) => (
                    <button key={s.skuId} onClick={() => addItem(s)}
                      className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium">{s.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{s.category}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{s.skuId}</span>
                      </div>
                    </button>
                  ))}
                  {filteredSkus.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">No SKUs found</p>}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">SKU</th>
                    <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Qty</th>
                    <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Unit Price (AED)</th>
                    <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const price = parseFloat(item.unitPrice || '0') || 0;
                    return (
                      <tr key={item.skuId} className="border-b border-border/30">
                        <td className="px-4 py-2">
                          <p className="text-sm font-medium">{item.skuName}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{item.skuId}</p>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Input type="number" min={1} value={item.qty}
                            onChange={e => updateItem(idx, 'qty', parseInt(e.target.value) || 1)}
                            className="w-20 text-center mx-auto" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Input type="number" min={0} step="0.01" value={item.unitPrice}
                            onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                            placeholder="Optional"
                            className="w-28 text-right ml-auto" />
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-mono">
                          {price > 0 ? `${(price * item.qty).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {totalAmount > 0 && (
                  <tfoot>
                    <tr className="bg-muted/20">
                      <td colSpan={3} className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Total</td>
                      <td className="px-4 py-2 text-right text-sm font-bold font-mono">{totalAmount.toFixed(2)} AED</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
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

// ---- Confirm Delivery Dialog ----
function ConfirmDeliveryDialog({ po, onClose, onConfirm }: {
  po: any;
  onClose: () => void;
  onConfirm: (items: { skuId: string; qty: number; unitPrice: string }[]) => void;
}) {
  const [itemPrices, setItemPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of (po.items || [])) {
      initial[item.masterId || item.skuId] = item.unitPrice || '';
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const items = po.items || [];
  const allPricesFilled = items.every((item: any) => {
    const val = parseFloat(itemPrices[item.masterId || item.skuId] || '');
    return !isNaN(val) && val > 0;
  });

  const totalAmount = items.reduce((sum: number, item: any) => {
    const price = parseFloat(itemPrices[item.masterId || item.skuId] || '0') || 0;
    return sum + price * (item.qty || 0);
  }, 0);

  const handleConfirm = () => {
    if (!allPricesFilled) { toast.error('All prices must be filled'); return; }
    setSaving(true);
    const mapped = items.map((item: any) => ({
      skuId: item.masterId || item.skuId,
      qty: item.qty || 0,
      unitPrice: itemPrices[item.masterId || item.skuId],
    }));
    onConfirm(mapped);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Confirm Delivery & Set Prices
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{po.poId} — {po.supplierName}</p>
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
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">SKU</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Qty</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2 w-36">Unit Price (AED)</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => {
                  const key = item.masterId || item.skuId;
                  const price = parseFloat(itemPrices[key] || '0') || 0;
                  const subtotal = price * (item.qty || 0);
                  return (
                    <tr key={key} className="border-b border-border/30">
                      <td className="px-4 py-2">
                        <p className="text-sm font-medium">{item.perfumeName || item.skuName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{key}</p>
                      </td>
                      <td className="px-4 py-2 text-center text-sm font-mono">{item.qty}</td>
                      <td className="px-4 py-2 text-right">
                        <Input type="number" min={0} step="0.01"
                          value={itemPrices[key]}
                          onChange={e => setItemPrices(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-28 text-right ml-auto" />
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-mono">
                        {price > 0 ? subtotal.toFixed(2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/20">
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Total</td>
                  <td className="px-4 py-2 text-right text-sm font-bold font-mono">{totalAmount.toFixed(2)} AED</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={handleConfirm} disabled={!allPricesFilled || saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Confirm Delivery
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function PackagingPOs() {
  const { data: posRaw, isLoading: posLoading, refetch: refetchPOs } = useApiQuery<any[]>(() => api.mutations.packagingPOs.list());
  const suppliersQuery = useApiQuery(() => api.master.suppliers());
  const suppliersRaw = suppliersQuery.data;
  const skusQuery = useApiQuery(() => api.master.packagingSKUs());
  const skusRaw = skusQuery.data;

  const [showCreate, setShowCreate] = useState(false);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmingPO, setConfirmingPO] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Map suppliers
  const suppliers: Supplier[] = useMemo(() => {
    if (!suppliersRaw) return [];
    const rawList = (suppliersRaw as any).data || suppliersRaw;
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
  }, [suppliersRaw]);

  const skus = useMemo(() => {
    if (!skusRaw) return [];
    const rawList = (skusRaw as any).data || skusRaw;
    return Array.isArray(rawList) ? rawList : [];
  }, [skusRaw]);

  // Enrich POs with items
  const [enrichedPOs, setEnrichedPOs] = useState<any[]>([]);
  useEffect(() => {
    if (!posRaw) { setEnrichedPOs([]); return; }
    const enrichAll = async () => {
      const enriched = await Promise.all((posRaw as any[]).map(async (po) => {
        try {
          const detail = await api.mutations.packagingPOs.get(po.poId);
          return detail || po;
        } catch {
          return po;
        }
      }));
      setEnrichedPOs(enriched);
    };
    enrichAll();
  }, [posRaw]);

  const filtered = useMemo(() => {
    let result = [...enrichedPOs];
    if (filterStatus !== 'all') {
      result = result.filter(po => po.status === filterStatus);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(po =>
        po.poId?.toLowerCase().includes(q) ||
        po.supplierName?.toLowerCase().includes(q)
      );
    }
    // Sort: active first, then by date desc
    result.sort((a, b) => {
      const aActive = a.status !== 'confirmed' && a.status !== 'cancelled';
      const bActive = b.status !== 'confirmed' && b.status !== 'cancelled';
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return result;
  }, [enrichedPOs, filterStatus, searchTerm]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const po of enrichedPOs) {
      counts[po.status] = (counts[po.status] || 0) + 1;
    }
    return counts;
  }, [enrichedPOs]);

  const handleAdvanceStatus = useCallback(async (po: any) => {
    const nextStatus = getNextStatus(po.status);
    if (!nextStatus) return;

    // If advancing to confirmed, show the confirm delivery dialog
    if (nextStatus === 'confirmed') {
      setConfirmingPO(po);
      return;
    }

    setActionLoading(po.poId);
    try {
      await api.mutations.packagingPOs.updateStatus(po.poId, nextStatus);
      toast.success(`PO advanced to ${getStatusConfig(nextStatus).label}`);
      refetchPOs();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  }, [refetchPOs]);

  const handleConfirmDelivery = useCallback(async (items: { skuId: string; qty: number; unitPrice: string }[]) => {
    if (!confirmingPO) return;
    setActionLoading(confirmingPO.poId);
    try {
      await api.mutations.packagingPOs.confirmDelivery(confirmingPO.poId, items);
      toast.success('Delivery confirmed! Packaging inventory updated.');
      setConfirmingPO(null);
      refetchPOs();
    } catch (e: any) {
      toast.error(e.message || 'Failed to confirm delivery');
    } finally {
      setActionLoading(null);
    }
  }, [confirmingPO, refetchPOs]);

  const handleCancel = useCallback(async (po: any) => {
    if (!confirm(`Cancel PO ${po.poId}?`)) return;
    setActionLoading(po.poId);
    try {
      await api.mutations.packagingPOs.cancel(po.poId, 'Cancelled by user');
      toast.success('PO cancelled');
      refetchPOs();
    } catch (e: any) {
      toast.error(e.message || 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  }, [refetchPOs]);

  const toggleExpand = (poId: string) => {
    setExpandedPO(prev => prev === poId ? null : poId);
  };

  return (
    <div>
      <PageHeader
        title="Packaging Purchase Orders"
        subtitle={`${enrichedPOs.length} total · ${enrichedPOs.filter(p => p.status !== 'confirmed' && p.status !== 'cancelled').length} active`}

        actions={
          <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> New Packaging PO
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {PKG_PO_STATUSES.map(s => {
            const Icon = s.icon;
            const count = statusCounts[s.value] || 0;
            return (
              <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? 'all' : s.value)}
                className={cn('p-3 rounded-lg border transition-all text-left',
                  filterStatus === s.value ? `${s.bg} border-current ${s.color}` : 'border-border hover:bg-muted/30')}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn('w-4 h-4', filterStatus === s.value ? '' : s.color)} />
                  <span className="text-lg font-bold">{count}</span>
                </div>
                <p className="text-[10px] font-medium">{s.label}</p>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search PO ID or supplier..." className="pl-9" />
          </div>
          {filterStatus !== 'all' && (
            <Button variant="outline" size="sm" onClick={() => setFilterStatus('all')} className="gap-1.5 text-xs">
              <X className="w-3 h-3" /> Clear filter
            </Button>
          )}
        </div>

        {/* PO List */}
        {posLoading ? (
          <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <PackageOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No packaging purchase orders yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Create one to start ordering packaging materials</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((po: any) => {
              const statusConf = getStatusConfig(po.status);
              const StatusIcon = statusConf.icon;
              const isExpanded = expandedPO === po.poId;
              const isCancelled = po.status === 'cancelled';
              const isConfirmed = po.status === 'confirmed';
              const nextStatus = getNextStatus(po.status);
              const items = po.items || [];
              const totalAmt = parseFloat(po.totalAmount || '0');
              const supplierInfo = suppliers.find(s => s.supplier_id === po.supplierId);

              return (
                <div key={po.poId} className={cn('border rounded-xl overflow-hidden transition-all',
                  isCancelled ? 'border-red-200 dark:border-red-900/30 opacity-60' :
                  isConfirmed ? 'border-green-200 dark:border-green-900/30' :
                  'border-border hover:border-teal-300 dark:hover:border-teal-700')}>
                  {/* PO Header Row */}
                  <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => toggleExpand(po.poId)}>
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', statusConf.bg)}>
                      <StatusIcon className={cn('w-4 h-4', statusConf.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold truncate">{po.poId}</h3>
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusConf.bg, statusConf.color)}>
                          {statusConf.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {po.supplierName} · {items.length} item{items.length !== 1 ? 's' : ''} · Created {new Date(po.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {totalAmt > 0 && (
                        <p className="text-sm font-bold font-mono">{totalAmt.toFixed(2)} AED</p>
                      )}
                      {totalAmt === 0 && <p className="text-xs text-muted-foreground italic">No prices yet</p>}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/10">
                      {/* Status Pipeline */}
                      <div className="px-5 py-3 border-b border-border/50">
                        <StatusPipeline currentStatus={po.status} />
                      </div>

                      {/* Items Table */}
                      <div className="px-5 py-3">
                        <table className="w-full">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              <th className="text-left pb-2">SKU</th>
                              <th className="text-center pb-2">Qty</th>
                              <th className="text-right pb-2">Unit Price</th>
                              <th className="text-right pb-2">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item: any, idx: number) => {
                              const price = parseFloat(item.unitPrice || '0') || 0;
                              return (
                                <tr key={idx} className="border-t border-border/30">
                                  <td className="py-2">
                                    <p className="text-sm font-medium">{item.perfumeName || item.skuName}</p>
                                    <p className="text-[10px] font-mono text-muted-foreground">{item.masterId || item.skuId}</p>
                                  </td>
                                  <td className="py-2 text-center text-sm font-mono">{item.qty}</td>
                                  <td className="py-2 text-right text-sm font-mono">
                                    {price > 0 ? `${price.toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}
                                  </td>
                                  <td className="py-2 text-right text-sm font-mono">
                                    {price > 0 ? `${(price * item.qty).toFixed(2)}` : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Notes */}
                      {po.notes && (
                        <div className="px-5 py-2 border-t border-border/30">
                          <p className="text-xs text-muted-foreground"><span className="font-semibold">Notes:</span> {po.notes}</p>
                        </div>
                      )}

                      {/* Payment Info */}
                      {po.paymentStatus === 'paid' && (
                        <div className="px-5 py-2 border-t border-border/30">
                          <div className="flex items-center gap-2 text-xs text-emerald-600">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span className="font-semibold">Paid</span>
                            {po.paymentMethod && <span>via {po.paymentMethod}</span>}
                            {po.amountPaid && <span className="font-mono">{parseFloat(po.amountPaid).toFixed(2)} AED</span>}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {!isCancelled && !isConfirmed && (
                        <div className="px-5 py-3 border-t border-border/50 flex items-center gap-2">
                          {nextStatus && (
                            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs"
                              onClick={(e) => { e.stopPropagation(); handleAdvanceStatus(po); }}
                              disabled={actionLoading === po.poId}>
                              {actionLoading === po.poId ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                              Advance to {getStatusConfig(nextStatus).label}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleCancel(po); }}
                            disabled={actionLoading === po.poId}>
                            <XCircle className="w-3 h-3" /> Cancel
                          </Button>
                        </div>
                      )}

                      {/* Confirmed: Payment */}
                      {isConfirmed && po.paymentStatus !== 'paid' && (
                        <div className="px-5 py-3 border-t border-border/50 flex items-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActionLoading(po.poId);
                              try {
                                await api.mutations.packagingPOs.recordPayment(po.poId, {
                                  paymentMethod: 'bank_transfer',
                                  amountPaid: po.totalAmount || '0',
                                });
                                toast.success('Payment recorded');
                                refetchPOs();
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to record payment');
                              } finally {
                                setActionLoading(null);
                              }
                            }}
                            disabled={actionLoading === po.poId}>
                            <CreditCard className="w-3 h-3" /> Record Payment
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showCreate && (
        <CreatePackagingPODialog
          suppliers={suppliers}
          skus={skus}
          onClose={() => setShowCreate(false)}
          onCreated={() => refetchPOs()}
        />
      )}
      {confirmingPO && (
        <ConfirmDeliveryDialog
          po={confirmingPO}
          onClose={() => setConfirmingPO(null)}
          onConfirm={handleConfirmDelivery}
        />
      )}
    </div>
  );
}
