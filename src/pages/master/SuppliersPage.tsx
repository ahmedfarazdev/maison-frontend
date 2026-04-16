// ============================================================
// Suppliers — Full Supplier Management + PO Lifecycle
// DB-backed via tRPC. Brand tagging, grid/row toggle,
// Full PO pipeline: draft → pending_quote → quote_approved →
// pending_delivery → qc → delivered → confirmed
// ============================================================

import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { PageHeader, StatusBadge, SectionCard } from '@/components/shared';
import GenericBulkImport, { type ImportColumn } from '@/components/shared/GenericBulkImport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { Supplier, Perfume } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Users, Plus, Search, ArrowLeft, LayoutGrid, List,
  Edit2, Check, X, Download, Building2, Globe, Mail, Phone,
  Package, Calendar, AlertTriangle, ShieldAlert,
  FileText, MapPin, CreditCard, Tag,
  Truck, Clock, CheckCircle2, XCircle, ShoppingCart, Trash2,
  PackageCheck, ChevronRight, Upload, Eye, Droplets, FlaskConical, Layers,
  MessageCircle, Send, Paperclip,
} from 'lucide-react';
const PODocumentUpload = lazy(() => import('@/components/PODocumentUpload').then(m => ({ default: m.PODocumentUpload })));
const PaymentDialog = lazy(() => import('@/components/PaymentDialog').then(m => ({ default: m.PaymentDialog })));
const POAttachments = lazy(() => import('@/components/POAttachments').then(m => ({ default: m.POAttachments })));
const InvoiceOCRPriceDialog = lazy(() => import('@/components/InvoiceOCRPriceDialog').then(m => ({ default: m.InvoiceOCRPriceDialog })));

// ---- Types ----
type POStatus = 'draft' | 'pending_quote' | 'quote_approved' | 'pending_delivery' | 'qc' | 'delivered' | 'confirmed' | 'cancelled';
type SupplierType = 'wholesaler' | 'retailer' | 'private_collector' | 'direct';

interface POItem {
  id: string;
  perfume_id: string;
  perfume_name: string;
  master_id: string;
  qty: number;
  size_ml: number;
  bottle_type: string;
  unit_price: number | null;
  received_qty: number;
}

interface PurchaseOrder {
  id: string;
  po_serial: string;
  supplier_id: string;
  status: POStatus;
  currency: string;
  notes: string;
  quote_url: string | null;
  invoice_url: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items: POItem[];
  payment_status: string;
  payment_method: string | null;
  payment_date: string | null;
  amount_paid: number;
  payment_ref: string | null;
  payment_notes: string | null;
}

// ---- Constants ----
const COUNTRY_FLAGS: Record<string, string> = {
  US: '\u{1F1FA}\u{1F1F8}', UK: '\u{1F1EC}\u{1F1E7}', UAE: '\u{1F1E6}\u{1F1EA}', FR: '\u{1F1EB}\u{1F1F7}', DE: '\u{1F1E9}\u{1F1EA}', OM: '\u{1F1F4}\u{1F1F2}',
  IT: '\u{1F1EE}\u{1F1F9}', ES: '\u{1F1EA}\u{1F1F8}', JP: '\u{1F1EF}\u{1F1F5}', SA: '\u{1F1F8}\u{1F1E6}', QA: '\u{1F1F6}\u{1F1E6}', KW: '\u{1F1F0}\u{1F1FC}',
};

const TYPE_LABELS: Record<SupplierType, { label: string; color: string }> = {
  wholesaler: { label: 'Wholesaler', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' },
  retailer: { label: 'Retailer', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
  private_collector: { label: 'Private Collector', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  direct: { label: 'Brand Direct', color: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300' },
};

const PO_STATUS_CONFIG: Record<POStatus, { label: string; color: string; icon: React.ElementType; step: number }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: FileText, step: 0 },
  pending_quote: { label: 'Pending Quote', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock, step: 1 },
  quote_approved: { label: 'Quote Approved', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: CheckCircle2, step: 2 },
  pending_delivery: { label: 'Pending Delivery', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: Truck, step: 3 },
  qc: { label: 'Quality Check', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: Eye, step: 4 },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: PackageCheck, step: 5 },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2, step: 6 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: XCircle, step: -1 },
};

const PO_PIPELINE_STEPS: POStatus[] = ['draft', 'pending_quote', 'quote_approved', 'pending_delivery', 'qc', 'delivered', 'confirmed'];

// ---- CSV Export ----
function exportSuppliersCsv(suppliers: Supplier[]) {
  const headers = ['Supplier ID', 'Name', 'Type', 'Contact', 'Email', 'Phone', 'Country', 'City', 'Payment Terms', 'Currency', 'Active'];
  const rows = suppliers.map(s => [
    s.supplier_id, s.name, s.type, s.contact_name || '', s.contact_email, s.contact_phone || '',
    s.country, s.city || '', s.payment_terms || '', s.currency || '', s.active ? 'Yes' : 'No',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `suppliers-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('Suppliers exported');
}

// ---- Supplier Form Dialog ----
function SupplierFormDialog({ supplier, brands, supplierBrandIds, onSave, onClose }: {
  supplier?: Supplier;
  brands: { brand_id: string; name: string; logo_url?: string }[];
  supplierBrandIds: string[];
  onSave: (data: Record<string, unknown>, brandIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!supplier;
  const [form, setForm] = useState<Record<string, any>>(supplier ? {
    type: supplier.type, supplier_type: supplier.supplier_type || 'perfume', name: supplier.name, contact_name: supplier.contact_name,
    contact_email: supplier.contact_email, contact_phone: supplier.contact_phone,
    country: supplier.country, city: supplier.city, payment_terms: supplier.payment_terms,
    currency: 'AED', website: supplier.website, notes: supplier.notes,
    risk_flag: supplier.risk_flag, active: supplier.active,
  } : {
    type: 'wholesaler', supplier_type: 'perfume', name: '', contact_name: '', contact_email: '', contact_phone: '',
    country: '', city: '', payment_terms: 'Net 30', currency: 'AED', website: '', notes: '',
    risk_flag: false, active: true,
  });
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set(supplierBrandIds));
  const [saving, setSaving] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');

  const filteredBrands = useMemo(() => {
    if (!brandSearch) return brands;
    const q = brandSearch.toLowerCase();
    return brands.filter(b => b.name.toLowerCase().includes(q));
  }, [brands, brandSearch]);

  const toggleBrand = (brandId: string) => {
    setSelectedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) { toast.error('Supplier name is required'); return; }
    if (!form.contact_email?.trim()) { toast.error('Contact email is required'); return; }
    setSaving(true);
    try {
      await onSave(form, Array.from(selectedBrands));
      onClose();
      toast.success(isEdit ? 'Supplier updated' : 'Supplier created');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h3 className="text-base font-bold">{isEdit ? 'Edit Supplier' : 'Add Supplier'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{isEdit ? supplier.supplier_id : 'New supplier record'}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Type */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Supplier Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.entries(TYPE_LABELS) as [SupplierType, { label: string; color: string }][]).map(([val, meta]) => (
                <button key={val} onClick={() => setForm(prev => ({ ...prev, type: val }))}
                  className={cn('px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center',
                    form.type === val ? `${meta.color} border-current` : 'border-border hover:bg-muted/50')}>
                  {meta.label}
                </button>
              ))}
            </div>
          </div>
          {/* Procurement Type */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Procurement Category</label>
            <div className="grid grid-cols-3 gap-2">
              {([['perfume', 'Perfume', 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'], ['packaging', 'Packaging', 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300'], ['both', 'Both', 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300']] as const).map(([val, label, color]) => (
                <button key={val} onClick={() => setForm(prev => ({ ...prev, supplier_type: val }))}
                  className={cn('px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center',
                    form.supplier_type === val ? `${color} border-current` : 'border-border hover:bg-muted/50')}>
                  {val === 'perfume' && <FlaskConical className="w-3 h-3 inline mr-1" />}
                  {val === 'packaging' && <Package className="w-3 h-3 inline mr-1" />}
                  {val === 'both' && <Layers className="w-3 h-3 inline mr-1" />}
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Name + Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Company Name *</label>
              <Input value={form.name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="FragranceNet Wholesale" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Contact Person</label>
              <Input value={form.contact_name || ''} onChange={e => setForm(prev => ({ ...prev, contact_name: e.target.value }))} placeholder="James Miller" />
            </div>
          </div>
          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Email *</label>
              <Input value={form.contact_email || ''} onChange={e => setForm(prev => ({ ...prev, contact_email: e.target.value }))} placeholder="orders@supplier.com" type="email" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Phone</label>
              <Input value={form.contact_phone || ''} onChange={e => setForm(prev => ({ ...prev, contact_phone: e.target.value }))} placeholder="+1-800-555-0101" />
            </div>
          </div>
          {/* Country + City + Website */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Country Code</label>
              <Input value={form.country || ''} onChange={e => setForm(prev => ({ ...prev, country: e.target.value.toUpperCase() }))} placeholder="US" maxLength={3} className="font-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">City</label>
              <Input value={form.city || ''} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} placeholder="New York" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Website</label>
              <Input value={form.website || ''} onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          {/* Payment + Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Payment Terms</label>
              <select value={form.payment_terms || ''} onChange={e => setForm(prev => ({ ...prev, payment_terms: e.target.value }))}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm">
                <option value="Net 30">Net 30</option><option value="Net 45">Net 45</option>
                <option value="Net 60">Net 60</option><option value="Prepaid">Prepaid</option><option value="COD">COD</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Currency</label>
              <div className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-mono text-muted-foreground">AED (United Arab Emirates Dirham)</div>
              <input type="hidden" value="AED" />
            </div>
          </div>
          {/* Brand Tags */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">
              <Tag className="w-3 h-3 inline mr-1" />Brand Specializations ({selectedBrands.size} selected)
            </label>
            <Input value={brandSearch} onChange={e => setBrandSearch(e.target.value)} placeholder="Search brands..." className="mb-2" />
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-border rounded-lg p-2">
              {filteredBrands.map(b => (
                <button key={b.brand_id} onClick={() => toggleBrand(b.brand_id)}
                  className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5',
                    selectedBrands.has(b.brand_id)
                      ? 'bg-gold/10 text-gold border-gold/30'
                      : 'border-border text-muted-foreground hover:bg-muted/50')}>
                  {b.logo_url && <img src={b.logo_url} alt="" className="w-4 h-4 rounded-full object-cover" />}
                  {b.name}
                  {selectedBrands.has(b.brand_id) && <Check className="w-3 h-3" />}
                </button>
              ))}
              {filteredBrands.length === 0 && <p className="text-xs text-muted-foreground p-2">No brands found</p>}
            </div>
          </div>
          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Notes</label>
            <textarea value={form.notes || ''} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={2}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" placeholder="Internal notes..." />
          </div>
          {/* Flags */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.risk_flag || false} onChange={e => setForm(prev => ({ ...prev, risk_flag: e.target.checked }))}
                className="w-4 h-4 rounded border-border accent-destructive" />
              <ShieldAlert className="w-4 h-4 text-destructive" /><span>Risk Flag</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.active !== false} onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                className="w-4 h-4 rounded border-border accent-success" /><span>Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : <><Check className="w-3.5 h-3.5" /> {isEdit ? 'Save Changes' : 'Create Supplier'}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Create PO Dialog (No Prices) ----
function CreatePODialog({ supplier, perfumes, onClose, onCreated }: {
  supplier: Supplier;
  perfumes: Perfume[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [items, setItems] = useState<{ master_id: string; perfume_name: string; qty: number; size_ml: number; bottle_type: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [perfumeSearch, setPerfumeSearch] = useState('');
  const [showPerfumeList, setShowPerfumeList] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const handleSubmit = async () => {
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    setCreating(true);
    try {
      // Generate PO serial: PO-001/SupplierName (sequential)
      const nextNum = await api.purchaseOrders.nextNumber();
      const poNum = String(nextNum).padStart(3, '0');
      const supplierSlug = supplier.name.replace(/\s+/g, '-');
      const poId = `PO-${poNum}/${supplierSlug}`;
      await api.mutations.purchaseOrders.create({
        poId,
        supplierId: supplier.supplier_id,
        supplierName: supplier.name,
        currency: supplier.currency || 'AED',
        notes,
        items: items.map(i => ({
          masterId: i.master_id,
          perfumeName: i.perfume_name,
          qty: i.qty,
          sizeMl: i.size_ml,
          bottleType: i.bottle_type,
        })),
      });
      toast.success(`Purchase Order created for ${supplier.name}`);
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
            <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
              <ShoppingCart className="w-4.5 h-4.5 text-gold" />
            </div>
            <div>
              <h3 className="text-base font-bold">Create Purchase Order</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{supplier.name} — No prices (waiting for quote)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
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
          <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleSubmit} disabled={items.length === 0 || creating}>
            {creating ? 'Creating...' : <><ShoppingCart className="w-3.5 h-3.5" /> Create PO (Pending Quote)</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- PO Status Pipeline Visual ----
function POStatusPipeline({ status }: { status: POStatus }) {
  const currentStep = PO_STATUS_CONFIG[status]?.step ?? -1;
  if (status === 'cancelled') {
    return <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', PO_STATUS_CONFIG.cancelled.color)}>Cancelled</span>;
  }
  return (
    <div className="flex items-center gap-0.5">
      {PO_PIPELINE_STEPS.map((step, idx) => {
        const cfg = PO_STATUS_CONFIG[step];
        const isActive = idx <= currentStep;
        const isCurrent = idx === currentStep;
        return (
          <div key={step} className="flex items-center gap-0.5">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all',
              isCurrent ? 'bg-gold text-gold-foreground ring-2 ring-gold/30' :
              isActive ? 'bg-gold/20 text-gold' : 'bg-muted text-muted-foreground'
            )}>
              {isActive ? <Check className="w-3 h-3" /> : idx + 1}
            </div>
            {idx < PO_PIPELINE_STEPS.length - 1 && (
              <div className={cn('w-4 h-0.5 rounded', isActive ? 'bg-gold/40' : 'bg-muted')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- PO Detail Card ----
function PODetailCard({ po, onAction, onRefresh }: {
  po: PurchaseOrder;
  onAction: (action: string, po: PurchaseOrder) => void;
  onRefresh: () => void;
}) {
  const cfg = PO_STATUS_CONFIG[po.status] || PO_STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const totalQty = po.items.reduce((s, i) => s + i.qty, 0);
  const hasPrices = po.items.some(i => i.unit_price != null && i.unit_price > 0);

  const getNextAction = (): { label: string; action: string; color: string } | null => {
    switch (po.status) {
      case 'draft': return { label: 'Send to Supplier', action: 'pending_quote', color: 'bg-amber-600 hover:bg-amber-700 text-white' };
      case 'pending_quote': return { label: 'Approve Quote', action: 'quote_approved', color: 'bg-blue-600 hover:bg-blue-700 text-white' };
      case 'quote_approved': return { label: 'Mark Pending Delivery', action: 'pending_delivery', color: 'bg-orange-600 hover:bg-orange-700 text-white' };
      case 'pending_delivery': return { label: 'Start QC', action: 'qc', color: 'bg-purple-600 hover:bg-purple-700 text-white' };
      case 'qc': return { label: 'Mark Delivered', action: 'delivered', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' };
      case 'delivered': return { label: 'Confirm & Log Inventory', action: 'confirm', color: 'bg-green-600 hover:bg-green-700 text-white' };
      default: return null;
    }
  };

  const nextAction = getNextAction();

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded">{po.po_serial}</span>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1', cfg.color)}>
              <StatusIcon className="w-3 h-3" />{cfg.label}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(po.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Pipeline */}
        <div className="mb-3">
          <POStatusPipeline status={po.status} />
        </div>

        {/* Items */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {po.items.map((item, idx) => (
            <span key={idx} className="text-[10px] bg-muted px-2 py-0.5 rounded font-medium">
              {item.perfume_name} x{item.qty} ({item.size_ml}ml)
            </span>
          ))}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{totalQty} bottles</span>
          {hasPrices && po.total_amount > 0 ? (
            <span className="font-mono font-bold text-gold text-sm">{po.currency} {po.total_amount.toLocaleString()}</span>
          ) : (
            <span className="italic">Awaiting pricing</span>
          )}
        </div>

        {/* Payment Info */}
        {po.payment_status && po.payment_status !== 'unpaid' && (
          <div className={cn('rounded-lg p-2.5 mt-2 border text-xs',
            po.payment_status === 'paid' ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
          )}>
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className={cn('w-3 h-3', po.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600')} />
              <span className={cn('text-[10px] font-bold uppercase', po.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600')}>
                {po.payment_status === 'paid' ? 'Paid' : 'Partial'}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
              {po.amount_paid > 0 && <span>Amt: <strong className="text-foreground font-mono">{po.currency} {po.amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>}
              {po.payment_method && <span>Via: <strong className="text-foreground capitalize">{po.payment_method.replace(/_/g, ' ')}</strong></span>}
              {po.payment_date && <span>Date: <strong className="text-foreground">{new Date(po.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</strong></span>}
            </div>
          </div>
        )}

        {/* Quote/Invoice attachments */}
        <div className="flex items-center gap-2 mt-2">
          {po.quote_url && (
            <a href={po.quote_url} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
              <FileText className="w-3 h-3" /> Quote
            </a>
          )}
          {po.invoice_url && (
            <a href={po.invoice_url} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-emerald-500 hover:underline flex items-center gap-1">
              <FileText className="w-3 h-3" /> Invoice
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          {/* Export PDF — always available */}
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-gold border-gold/30 hover:bg-gold/10"
            onClick={() => window.open(`/api/po/${encodeURIComponent(po.po_serial)}/pdf`, '_blank')}>
            <Download className="w-3 h-3" /> PDF
          </Button>
          {/* Attachments */}
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
            onClick={() => onAction('view_attachments', po)}>
            <Paperclip className="w-3 h-3" /> Files
          </Button>
          {/* Record Payment */}
          {po.status !== 'draft' && po.status !== 'cancelled' && (
            <Button size="sm" variant="outline" className={cn('gap-1 text-xs h-7',
              po.payment_status === 'paid' ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' :
              po.payment_status === 'partial' ? 'text-amber-600 border-amber-200 hover:bg-amber-50' :
              'text-muted-foreground')}
              onClick={() => onAction('record_payment', po)}>
              <CreditCard className="w-3 h-3" />
              {po.payment_status === 'paid' ? 'Paid' : po.payment_status === 'partial' ? 'Partial' : 'Payment'}
            </Button>
          )}
          {po.status !== 'confirmed' && po.status !== 'cancelled' && (
            <>
              {(po.status === 'pending_quote' || po.status === 'quote_approved') && (
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
                  onClick={() => onAction('upload_quote', po)}>
                  <Upload className="w-3 h-3" /> Upload Quote/Invoice
                </Button>
              )}
              {po.status !== 'draft' && (
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => onAction('cancel', po)}>
                  <XCircle className="w-3 h-3" /> Cancel
                </Button>
              )}
              {nextAction && (
                <Button size="sm" className={cn('gap-1 text-xs h-7 ml-auto', nextAction.color)}
                  onClick={() => onAction(nextAction.action, po)}>
                  <ChevronRight className="w-3 h-3" /> {nextAction.label}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Supplier Detail View ----
function SupplierDetail({ supplier, brands, onBack, onEdit, onCreatePO, onRefresh }: {
  supplier: Supplier;
  brands: { brand_id: string; name: string; logo_url?: string }[];
  onBack: () => void;
  onEdit: () => void;
  onCreatePO: () => void;
  onRefresh: () => void;
}) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [supplierBrandIds, setSupplierBrandIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPO, setUploadingPO] = useState<{ po: PurchaseOrder; type: 'quote' | 'invoice' } | null>(null);
  const [paymentPO, setPaymentPO] = useState<PurchaseOrder | null>(null);
  const [attachmentsPO, setAttachmentsPO] = useState<PurchaseOrder | null>(null);
  const [pricePO, setPricePO] = useState<PurchaseOrder | null>(null);
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [posRes, brandsRes] = await Promise.all([
        api.purchaseOrders.list(),
        api.supplierBrands.list(supplier.supplier_id),
      ]);
      const supplierPOs = (posRes.data || []).filter((po: any) => po.supplier_id === supplier.supplier_id || po.supplier_id === supplier.supplier_id);
      setPurchaseOrders(supplierPOs.map((po: any) => ({
        id: po.id || po.id,
        po_serial: po.id || po.po_serial || po.po_serial || `PO-${po.id}`,
        supplier_id: po.supplier_id || po.supplier_id,
        status: po.status,
        currency: po.currency || 'AED',
        notes: po.notes || '',
        quote_url: po.quote_url || po.quote_url || po.quote_url || null,
        invoice_url: po.invoice_url || po.invoice_url || po.invoice_url || null,
        total_amount: Number(po.total_amount || po.total_amount || 0),
        created_at: po.created_at || po.created_at,
        updated_at: po.updated_at || po.updated_at,
        items: (po.items || []).map((i: any) => ({
          id: i.id || i.id,
          perfume_id: i.master_id || i.perfume_id || i.perfume_id,
          perfume_name: i.perfume_name || i.perfume_name || 'Unknown',
          master_id: i.master_id || i.perfume_id || i.perfume_id || i.master_id || '',
          qty: i.qty || 0,
          size_ml: i.size_ml || i.size_ml || 0,
          bottle_type: i.bottle_type || i.bottle_type || 'sealed',
          unit_price: i.unit_price != null ? Number(i.unit_price) : (i.unit_price != null ? Number(i.unit_price) : null),
          received_qty: i.received_qty || i.received_qty || 0,
        })),
        payment_status: po.payment_status || po.payment_status || 'unpaid',
        payment_method: po.payment_method || po.payment_method || null,
        payment_date: po.payment_date || po.payment_date || null,
        amount_paid: Number(po.amount_paid || po.amount_paid || 0),
        payment_ref: po.payment_ref || po.payment_ref || null,
        payment_notes: po.payment_notes || po.payment_notes || null,
      })));
      setSupplierBrandIds((brandsRes.data || []).map((b: any) => b.brandId || b.brand_id));
    } catch (e) {
      console.warn('Failed to load supplier detail data', e);
    } finally {
      setLoading(false);
    }
  }, [supplier.supplier_id]);

  useEffect(() => { loadData(); }, [loadData]);

  const typeMeta = TYPE_LABELS[supplier.type as SupplierType] || TYPE_LABELS.wholesaler;
  const flag = COUNTRY_FLAGS[supplier.country] || '';

  const activePOs = purchaseOrders.filter(po => po.status !== 'confirmed' && po.status !== 'cancelled');
  const completedPOs = purchaseOrders.filter(po => po.status === 'confirmed');
  const cancelledPOs = purchaseOrders.filter(po => po.status === 'cancelled');

  const supplierBrands = brands.filter(b => supplierBrandIds.includes(b.brand_id));

  const handlePOAction = async (action: string, po: PurchaseOrder) => {
    try {
      // Use po.po_serial which maps to the DB poId string (e.g. "PO-001/Ahmed-K")
      const poId = po.po_serial;
      if (action === 'cancel') {
        if (!confirm('Cancel this PO? This cannot be undone.')) return;
        await api.mutations.purchaseOrders.cancel(poId, 'Cancelled by user');
        toast.success(`PO ${po.po_serial} cancelled`);
      } else if (action === 'confirm') {
        // Check if all items have unit prices
        const missingPrices = po.items.some(i => !i.unit_price || i.unit_price <= 0);
        if (missingPrices) {
          // Open price dialog instead of just showing toast
          const priceMap: Record<string, string> = {};
          po.items.forEach(i => { priceMap[i.id] = i.unit_price && i.unit_price > 0 ? String(i.unit_price) : ''; });
          setItemPrices(priceMap);
          setPricePO(po);
          return;
        }
        // Confirm delivery — auto-adjust inventory
        const receivedItems = po.items.map(i => ({
          itemId: Number(i.id),
          receivedQty: i.qty - i.received_qty,
          masterId: i.master_id || i.perfume_id || '',
          perfumeName: i.perfume_name,
          sizeMl: i.size_ml,
          bottleType: i.bottle_type,
          unitPrice: i.unit_price || 0,
          supplierId: supplier.supplier_id,
        }));
        await api.mutations.purchaseOrders.confirmDelivery(poId, receivedItems);
        toast.success(`PO ${po.po_serial} confirmed! Inventory updated.`);
      } else if (action === 'upload_quote') {
        setUploadingPO({ po, type: 'quote' });
        return;
      } else if (action === 'upload_invoice') {
        setUploadingPO({ po, type: 'invoice' });
        return;
      } else if (action === 'record_payment') {
        setPaymentPO(po);
        return;
      } else if (action === 'view_attachments') {
        setAttachmentsPO(po);
        return;
      } else {
        await api.mutations.purchaseOrders.updateStatus(poId, action);
        toast.success(`PO ${po.po_serial} → ${PO_STATUS_CONFIG[action as POStatus]?.label || action}`);
      }
      loadData();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    }
  };

  return (
    <div>
      <PageHeader
        title={supplier.name}
        subtitle={`${typeMeta.label} · ${flag} ${supplier.country}${supplier.city ? ` · ${supplier.city}` : ''}`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Suppliers' }, { label: supplier.name }]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onBack}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onEdit}>
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={onCreatePO}>
              <ShoppingCart className="w-3.5 h-3.5" /> Create PO
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-gold">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total POs</p>
            <p className="text-xl font-mono font-bold mt-1">{purchaseOrders.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-amber-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active POs</p>
            <p className="text-xl font-mono font-bold mt-1">{activePOs.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-emerald-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Completed</p>
            <p className="text-xl font-mono font-bold mt-1">{completedPOs.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-violet-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Brands</p>
            <p className="text-xl font-mono font-bold mt-1">{supplierBrands.length}</p>
          </div>
        </div>

        {/* Contact + Brand Tags */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold mb-4">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {supplier.contact_name && (
                <div className="flex items-start gap-2"><Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Contact</p><p className="mt-0.5">{supplier.contact_name}</p></div></div>
              )}
              <div className="flex items-start gap-2"><Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Email</p><p className="mt-0.5">{supplier.contact_email}</p></div></div>
              {supplier.contact_phone && (
                <div className="flex items-start gap-2"><Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Phone</p><p className="mt-0.5">{supplier.contact_phone}</p></div></div>
              )}
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Location</p><p className="mt-0.5">{flag} {supplier.city ? `${supplier.city}, ` : ''}{supplier.country}</p></div></div>
              {supplier.payment_terms && (
                <div className="flex items-start gap-2"><CreditCard className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Payment</p><p className="mt-0.5">{supplier.payment_terms} ({supplier.currency})</p></div></div>
              )}
              {supplier.website && (
                <div className="flex items-start gap-2"><Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-[10px] uppercase text-muted-foreground font-semibold">Website</p><p className="mt-0.5 text-gold">{supplier.website}</p></div></div>
              )}
            </div>
            {/* Quick Communication Buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
              {supplier.contact_phone && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/30"
                  onClick={() => {
                    const phone = supplier.contact_phone!.replace(/[^0-9+]/g, '');
                    window.open(`https://wa.me/${phone}`, '_blank');
                    toast.success('Opening WhatsApp...');
                  }}>
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                onClick={() => {
                  window.open(`mailto:${supplier.contact_email}`, '_blank');
                  toast.success('Opening email client...');
                }}>
                <Mail className="w-3.5 h-3.5" /> Email
              </Button>
              {supplier.contact_phone && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                  onClick={() => {
                    window.open(`tel:${supplier.contact_phone}`, '_blank');
                  }}>
                  <Phone className="w-3.5 h-3.5" /> Call
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <StatusBadge variant={supplier.active ? 'success' : 'muted'}>{supplier.active ? 'Active' : 'Inactive'}</StatusBadge>
              {supplier.risk_flag && <StatusBadge variant="destructive">Risk Flag</StatusBadge>}
              <StatusBadge variant="info">{typeMeta.label}</StatusBadge>
            </div>
          </div>

          {/* Brand Specializations */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-gold" /> Brand Specializations</h3>
            {supplierBrands.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {supplierBrands.map(b => (
                  <div key={b.brand_id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/5 border border-gold/20 text-sm">
                    {b.logo_url && <img src={b.logo_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
                    <span className="font-medium">{b.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No brand specializations set. Edit supplier to add brands.</p>
            )}
            {supplier.notes && (
              <div className="mt-4 pt-3 border-t border-border/50">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{supplier.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Active POs */}
        {loading ? (
          <div className="text-center py-10"><p className="text-sm text-muted-foreground animate-pulse">Loading purchase orders...</p></div>
        ) : (
          <>
            {activePOs.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" /> Active Purchase Orders ({activePOs.length})
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {activePOs.map(po => (
                    <PODetailCard key={po.id} po={po} onAction={handlePOAction} onRefresh={loadData} />
                  ))}
                </div>
              </div>
            )}

            {completedPOs.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Completed ({completedPOs.length})
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {completedPOs.map(po => (
                    <PODetailCard key={po.id} po={po} onAction={handlePOAction} onRefresh={loadData} />
                  ))}
                </div>
              </div>
            )}

            {cancelledPOs.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" /> Cancelled ({cancelledPOs.length})
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-60">
                  {cancelledPOs.map(po => (
                    <PODetailCard key={po.id} po={po} onAction={handlePOAction} onRefresh={loadData} />
                  ))}
                </div>
              </div>
            )}

            {purchaseOrders.length === 0 && (
              <div className="text-center py-10 bg-card border border-border rounded-xl">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No purchase orders yet</p>
                <Button size="sm" className="mt-3 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={onCreatePO}>
                  <ShoppingCart className="w-3.5 h-3.5" /> Create First PO
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Document Upload Dialog */}
      {uploadingPO && (
        <Suspense fallback={null}>
          <PODocumentUpload
            poId={uploadingPO.po.po_serial}
            poNumber={uploadingPO.po.po_serial}
            type={uploadingPO.type}
            existingUrl={uploadingPO.type === 'quote' ? uploadingPO.po.quote_url : uploadingPO.po.invoice_url}
            onClose={() => setUploadingPO(null)}
            onUploaded={() => {
              setUploadingPO(null);
              loadData();
              onRefresh();
            }}
          />
        </Suspense>
      )}

      {/* Payment Dialog */}
      {paymentPO && (
        <Suspense fallback={null}>
          <PaymentDialog
            poId={paymentPO.po_serial}
            poNumber={paymentPO.po_serial}
            totalAmount={paymentPO.total_amount || 0}
            currency={paymentPO.currency || 'AED'}
            currentPaymentStatus={paymentPO.payment_status}
            currentPaymentMethod={paymentPO.payment_method ?? undefined}
            currentPaymentDate={paymentPO.payment_date ?? undefined}
            currentAmountPaid={paymentPO.amount_paid}
            currentPaymentRef={paymentPO.payment_ref ?? undefined}
            currentPaymentNotes={paymentPO.payment_notes ?? undefined}
            onClose={() => setPaymentPO(null)}
            onSaved={() => { loadData(); onRefresh(); }}
          />
        </Suspense>
      )}

      {/* Unit Price Dialog with Invoice OCR */}
      {pricePO && (
        <Suspense fallback={null}>
          <InvoiceOCRPriceDialog
            items={pricePO.items.map(i => ({
              id: String(i.id),
              perfume_name: i.perfume_name,
              size_ml: i.size_ml,
              qty: i.qty,
              bottle_type: i.bottle_type,
              master_id: i.master_id || i.perfume_id,
              unit_price: i.unit_price,
              received_qty: i.received_qty,
            }))}
            poSerial={pricePO.po_serial}
            supplierId={supplier.supplier_id}
            onClose={() => setPricePO(null)}
            onConfirmed={() => {
              setPricePO(null);
              loadData();
              onRefresh();
            }}
          />
        </Suspense>
      )}

      {/* Attachments Dialog */}
      {attachmentsPO && (
        <Suspense fallback={null}>
          <POAttachments
            poId={attachmentsPO.po_serial}
            poNumber={attachmentsPO.po_serial}
            onClose={() => setAttachmentsPO(null)}
            onChanged={() => { loadData(); onRefresh(); }}
          />
        </Suspense>
      )}
    </div>
  );
}

// ---- Main Suppliers Page ----
export default function SuppliersPage() {
  const { data: suppliersData, isLoading: suppliersLoading, refetch: refetchSuppliers } = useApiQuery(api.suppliers.list);
  const { data: brandsData } = useApiQuery(api.brands.list);
  const { data: perfumesData } = useApiQuery(api.master.perfumes);
  const { data: posData, refetch: refetchPOs } = useApiQuery(api.purchaseOrders.list);

  const suppliers = useMemo(() => suppliersData || [], [suppliersData]);
  const brands = useMemo(() => (brandsData || []).map((b: any) => ({
    brand_id: b.brand_id || b.brandId,
    name: b.name,
    logo_url: b.logo_url || b.logoUrl,
  })), [brandsData]);
  const perfumes = useMemo(() => perfumesData || [], [perfumesData]);
  const allPOs = useMemo(() => posData || [], [posData]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterActive, setFilterActive] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'total_spent' | 'total_items' | 'created_at'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'row'>('grid');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);
  const [editingBrandIds, setEditingBrandIds] = useState<string[]>([]);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const filtered = useMemo(() => {
    let result = suppliers.filter((s: Supplier) => {
      if (filterType !== 'all' && s.type !== filterType) return false;
      if (filterActive === 'active' && !s.active) return false;
      if (filterActive === 'inactive' && s.active) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.contact_email.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q) || (s.contact_name || '').toLowerCase().includes(q);
      }
      return true;
    });
    result.sort((a: Supplier, b: Supplier) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'total_spent') return (b.total_spent || 0) - (a.total_spent || 0);
      if (sortBy === 'total_items') return (b.total_items || 0) - (a.total_items || 0);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    return result;
  }, [suppliers, filterType, filterActive, searchTerm, sortBy]);

  // Pending PO count
  const pendingPOCount = allPOs.filter((po: any) => {
    const s = po.status;
    return s !== 'confirmed' && s !== 'cancelled';
  }).length;

  const activeCount = suppliers.filter((s: Supplier) => s.active).length;

  const handleSaveSupplier = async (data: Record<string, unknown>, brandIds: string[]) => {
    // Map snake_case form keys to camelCase API keys, including supplierType
    const mapped: Record<string, unknown> = { ...data };
    if (mapped.supplier_type !== undefined) {
      mapped.supplierType = mapped.supplier_type;
      delete mapped.supplier_type;
    }
    if (editingSupplier) {
      await api.mutations.suppliers.update(editingSupplier.id || editingSupplier.supplier_id, mapped);
      await api.mutations.supplierBrands.set(editingSupplier.supplier_id, brandIds);
    } else {
      const result: any = await api.mutations.suppliers.create(mapped);
      const newId = result?.supplierId || result?.supplier_id || result?.data?.supplierId || result?.data?.supplier_id;
      if (newId && brandIds.length > 0) {
        await api.mutations.supplierBrands.set(newId, brandIds);
      }
    }
    refetchSuppliers();
  };

  const handleEditSupplier = async (s: Supplier) => {
    setEditingSupplier(s);
    try {
      const res = await api.supplierBrands.list(s.supplier_id);
      setEditingBrandIds((res.data || []).map((b: any) => b.brandId || b.brand_id));
    } catch {
      setEditingBrandIds([]);
    }
    setShowForm(true);
  };

  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = () => {
    refetchSuppliers();
    refetchPOs();
    setRefreshKey(k => k + 1);
  };

  // Detail view
  if (selectedSupplier) {
    const latest = suppliers.find((s: Supplier) => s.supplier_id === selectedSupplier.supplier_id) || selectedSupplier;
    return (
      <>
        <SupplierDetail
          key={refreshKey}
          supplier={latest}
          brands={brands}
          onBack={() => setSelectedSupplier(null)}
          onEdit={() => handleEditSupplier(latest)}
          onCreatePO={() => setShowCreatePO(true)}
          onRefresh={handleRefresh}
        />
        {showForm && (
          <SupplierFormDialog
            supplier={editingSupplier}
            brands={brands}
            supplierBrandIds={editingBrandIds}
            onSave={handleSaveSupplier}
            onClose={() => { setShowForm(false); setEditingSupplier(undefined); setEditingBrandIds([]); }}
          />
        )}
        {showCreatePO && (
          <CreatePODialog
            supplier={latest}
            perfumes={perfumes}
            onClose={() => setShowCreatePO(false)}
            onCreated={handleRefresh}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} suppliers · ${activeCount} active`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Suppliers' }]}
        actions={
          <div className="flex items-center gap-2">
            {pendingPOCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Clock className="w-3.5 h-3.5" /> {pendingPOCount} Active PO{pendingPOCount > 1 ? 's' : ''}
              </div>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowBulkImport(true)}>
              <Upload className="w-3.5 h-3.5" /> Bulk Import
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => exportSuppliersCsv(suppliers)}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <div className="flex border border-border rounded-md overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={cn('p-1.5 transition-colors', viewMode === 'grid' ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:bg-muted/50')}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('row')} className={cn('p-1.5 transition-colors', viewMode === 'row' ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:bg-muted/50')}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              onClick={() => { setEditingSupplier(undefined); setEditingBrandIds([]); setShowForm(true); }}>
              <Plus className="w-3.5 h-3.5" /> Add Supplier
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search supplier, contact, country..." className="pl-9" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type:</span>
            {[{ value: 'all', label: 'All' }, ...Object.entries(TYPE_LABELS).map(([v, m]) => ({ value: v, label: m.label }))].map(t => (
              <button key={t.value} onClick={() => setFilterType(t.value)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  filterType === t.value ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                {t.label}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="ml-auto bg-background border border-input rounded-md px-3 py-1.5 text-xs">
            <option value="name">Sort: Name</option>
            <option value="total_spent">Sort: Total Spent</option>
            <option value="total_items">Sort: Items</option>
            <option value="created_at">Sort: Newest</option>
          </select>
        </div>

        {suppliersLoading ? (
          <div className="text-center py-16"><p className="text-sm text-muted-foreground animate-pulse">Loading suppliers...</p></div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s: Supplier) => {
              const typeMeta = TYPE_LABELS[s.type as SupplierType] || TYPE_LABELS.wholesaler;
              const flag = COUNTRY_FLAGS[s.country] || '';
              const activeCount = s.active_po_count || 0;
              return (
                <div key={s.supplier_id}
                  onClick={() => setSelectedSupplier(s)}
                  className="bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:border-gold/30 transition-all cursor-pointer group relative">
                  {activeCount > 0 && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                      {activeCount}
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold group-hover:text-gold transition-colors">{s.name}</h3>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{s.supplier_id}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {s.risk_flag && <AlertTriangle className="w-4 h-4 text-destructive" />}
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', typeMeta.color)}>
                        {typeMeta.label}
                      </span>
                      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                        s.supplier_type === 'packaging' ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300' :
                        s.supplier_type === 'both' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' :
                        'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                      )}>
                        {s.supplier_type === 'both' ? 'P+PKG' : s.supplier_type === 'packaging' ? 'PKG' : 'PERF'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {s.contact_name && <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 shrink-0" /><span>{s.contact_name}</span></div>}
                    <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{s.contact_email}</span></div>
                    <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 shrink-0" /><span>{flag} {s.city ? `${s.city}, ` : ''}{s.country}</span></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                    <StatusBadge variant={s.active ? 'success' : 'muted'}>{s.active ? 'Active' : 'Inactive'}</StatusBadge>
                    {s.payment_terms && <span className="text-[10px] text-muted-foreground">{s.payment_terms}</span>}
                    {activeCount > 0 && (
                      <StatusBadge variant="warning"><Clock className="w-3 h-3 mr-1" />{activeCount} PO</StatusBadge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Row View */
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Supplier</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Type</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Contact</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Location</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Active POs</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: Supplier) => {
                  const typeMeta = TYPE_LABELS[s.type as SupplierType] || TYPE_LABELS.wholesaler;
                  const flag = COUNTRY_FLAGS[s.country] || '';
                  const activePOCount = s.active_po_count || 0;
                  return (
                    <tr key={s.supplier_id} onClick={() => setSelectedSupplier(s)}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{s.supplier_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', typeMeta.color)}>{typeMeta.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">{s.contact_name || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">{s.contact_email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">{flag} {s.city ? `${s.city}, ` : ''}{s.country}</td>
                      <td className="px-4 py-3 text-center">
                        {activePOCount > 0 ? (
                          <span className="text-xs font-mono font-bold text-amber-600">{activePOCount}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge variant={s.active ? 'success' : 'muted'}>{s.active ? 'Active' : 'Inactive'}</StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && !suppliersLoading && (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No suppliers match your filters</p>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      {showForm && (
        <SupplierFormDialog
          supplier={editingSupplier}
          brands={brands}
          supplierBrandIds={editingBrandIds}
          onSave={handleSaveSupplier}
          onClose={() => { setShowForm(false); setEditingSupplier(undefined); setEditingBrandIds([]); }}
        />
      )}
      {/* Create PO (from list — need to select supplier first) */}
      {showCreatePO && selectedSupplier && (
        <CreatePODialog
          supplier={selectedSupplier}
          perfumes={perfumes}
          onClose={() => setShowCreatePO(false)}
          onCreated={handleRefresh}
        />
      )}
      {showBulkImport && (
        <GenericBulkImport<Supplier>
          title="Bulk Import Suppliers"
          subtitle="Upload a CSV file to add multiple suppliers at once."
          columns={[
            { key: 'supplier_id', label: 'Supplier ID', required: true, description: 'Unique identifier' },
            { key: 'name', label: 'Company Name', required: true },
            { key: 'type', label: 'Type', description: 'wholesaler, retailer, private_collector, direct' },
            { key: 'contact_name', label: 'Contact Person' },
            { key: 'contact_email', label: 'Email', required: true },
            { key: 'contact_phone', label: 'Phone' },
            { key: 'country', label: 'Country (ISO)' },
            { key: 'city', label: 'City' },
            { key: 'payment_terms', label: 'Payment Terms' },
            { key: 'website', label: 'Website' },
            { key: 'notes', label: 'Notes' },
          ]}
          onImport={async (data) => {
            await api.suppliers.bulkImport(data);
            refetchSuppliers();
          }}
          onClose={() => setShowBulkImport(false)}
          templateFilename="maison_suppliers_template.csv"
          templateExample={{
            supplier_id: 'SUP-CHANEL',
            name: 'Chanel S.A.',
            type: 'direct',
            contact_name: 'Alain Wertheimer',
            contact_email: 'orders@chanel.com',
            country: 'FR',
            payment_terms: 'Net 30'
          }}
        />
      )}
    </div>
  );
}
