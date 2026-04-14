// ============================================================
// Packaging & Materials Components — Non-Liquid Inventory Master (DB-backed)
// Design: "Maison Ops" — Luxury Operations
// Auto-generated SKU IDs: EM/{CAT_CODE}/{ITEM_ABBREV}-{SPEC}-{COLOR}
// Category-based grouping, stock levels, reorder alerts,
// full CRUD, supplier linking, zone tracking
// ============================================================

import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, StatusBadge, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api-client';
import type { PackagingSKU, PackagingCategory, Supplier } from '@/types';
import { PACKAGING_CATEGORY_CODES } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Package, Plus, Search, Edit2, Check, X, Download, Upload,
  AlertTriangle, Layers, Tag, Palette,
  Box, Ruler, Hash, Archive, Trash2, Link2, Unlink,
  Loader2, RefreshCw, FileSpreadsheet, ChevronDown, ChevronRight,
} from 'lucide-react';
import GenericBulkImport, { ImportColumn } from '@/components/shared/GenericBulkImport';


// ---- Constants ----
const CATEGORIES: PackagingCategory[] = [
  'Atomiser & Vials', 'Decant Bottles', 'Packaging Material',
  'Packaging Accessories', 'Shipping Material', 'Labels', 'Others',
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Atomiser & Vials': Package,
  'Decant Bottles': Box,
  'Packaging Material': Layers,
  'Packaging Accessories': Tag,
  'Shipping Material': Archive,
  'Labels': Tag,
  'Others': Package,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Atomiser & Vials': 'border-l-blue-500',
  'Decant Bottles': 'border-l-amber-500',
  'Packaging Material': 'border-l-emerald-500',
  'Packaging Accessories': 'border-l-violet-500',
  'Shipping Material': 'border-l-rose-500',
  'Labels': 'border-l-orange-500',
  'Others': 'border-l-zinc-400',
};

const PACKAGING_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'sku_id', label: 'SKU ID', description: 'Auto-generated if empty' },
  { key: 'name', label: 'Item Name', required: true },
  { key: 'category', label: 'Category', required: true, description: 'Must be a valid packaging category' },
  { key: 'size_spec', label: 'Size/Spec' },
  { key: 'color_variant', label: 'Color' },
  { key: 'type', label: 'Type', description: 'atomizer, box, label, etc.' },
  { key: 'unit', label: 'Unit', description: 'pc, set, kg, etc.' },
  { key: 'min_stock_level', label: 'Min Stock' },
  { key: 'active', label: 'Active', description: 'Yes/No' },
];

// ---- SKU ID Generator ----
function generateSkuId(category: PackagingCategory, name: string, sizeSpec: string, colorVariant: string): string {
  const catCode = PACKAGING_CATEGORY_CODES[category] || 'OTH';
  const abbrev = name.split(/\s+/).map(w => w.substring(0, 3).toUpperCase()).join('').substring(0, 10);
  const cleanSize = sizeSpec.replace(/\s+/g, '').toUpperCase();
  const colorCode = colorVariant.substring(0, 3).toUpperCase();
  return `EM/${catCode}/${abbrev}-${cleanSize}-${colorCode}`;
}

// ---- CSV Export ----
const CSV_HEADERS = ['SKU ID', 'Name', 'Category', 'Size/Spec', 'Color', 'Type', 'Unit', 'Min Stock', 'Active'];

function exportPackagingCsv(skus: PackagingSKU[]) {
  const rows = skus.map(s => [
    s.sku_id, s.name, s.category, s.size_spec, s.color_variant, s.type,
    s.unit, String(s.min_stock_level), s.active ? 'Yes' : 'No',
  ]);
  const csv = [CSV_HEADERS.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `packaging-skus-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('Packaging components exported');
}

function downloadCsvTemplate() {
  const csv = CSV_HEADERS.join(',') + '\n' +
    '"EM/ATM/EXAMPLE-8ML-BLK","Diamond Atomiser","Atomiser & Vials","8ml","Black","atomizer","pc","50","Yes"';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'packaging-skus-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('Template downloaded — fill in rows and re-upload');
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvImport(text: string): Partial<PackagingSKU>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  // Skip header row
  return lines.slice(1).map(line => {
    const cols = parseCsvRow(line);
    return {
      sku_id: cols[0] || '',
      name: cols[1] || '',
      category: (cols[2] || 'Others') as PackagingCategory,
      size_spec: cols[3] || '',
      color_variant: cols[4] || '',
      type: (cols[5] || 'other') as PackagingSKU['type'],
      unit: cols[6] || 'pc',
      min_stock_level: parseInt(cols[7]) || 50,
      active: (cols[8] || 'Yes').toLowerCase() !== 'no',
    };
  }).filter(s => s.sku_id && s.name);
}

// ---- Add/Edit SKU Dialog ----
function SkuFormDialog({ sku, suppliers, onSave, onClose }: {
  sku?: PackagingSKU;
  suppliers: Supplier[];
  onSave: (s: Partial<PackagingSKU>, isEdit: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!sku;
  const [form, setForm] = useState<Partial<PackagingSKU>>(sku || {
    category: 'Atomiser & Vials',
    name: '',
    size_spec: '',
    color_variant: '',
    type: 'atomizer',
    requires_print: false,
    requires_inlay: false,
    requires_qc: false,
    unit: 'pc',
    min_stock_level: 50,
    active: true,
  });
  const [saving, setSaving] = useState(false);

  const previewId = useMemo(() => {
    if (isEdit) return sku.sku_id;
    if (form.category && form.name && form.size_spec && form.color_variant) {
      return generateSkuId(form.category as PackagingCategory, form.name, form.size_spec, form.color_variant);
    }
    return 'EM/???/???-???-???';
  }, [form.category, form.name, form.size_spec, form.color_variant, isEdit, sku]);

  const updateField = (field: keyof PackagingSKU, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) { toast.error('Item name is required'); return; }
    if (!form.size_spec?.trim()) { toast.error('Size/Spec is required'); return; }
    if (!form.color_variant?.trim()) { toast.error('Color variant is required'); return; }

    const skuId = isEdit ? sku.sku_id : generateSkuId(
      form.category as PackagingCategory, form.name!, form.size_spec!, form.color_variant!
    );

    setSaving(true);
    try {
      await onSave({ ...form, sku_id: skuId }, isEdit);
      onClose();
      toast.success(isEdit ? `SKU ${skuId} updated` : `SKU ${skuId} created`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save SKU');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h3 className="text-base font-bold">{isEdit ? 'Edit Component' : 'Add Component'}</h3>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{previewId}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* SKU ID Preview */}
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Auto-Generated SKU ID</p>
            <p className="text-lg font-mono font-bold text-gold mt-1 break-all">{previewId}</p>
            <p className="text-[10px] text-muted-foreground mt-1">EM / {'{CATEGORY}'} / {'{ITEM}'} - {'{SPEC}'} - {'{COLOR}'}</p>
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Category</label>
            <select value={form.category || ''} onChange={e => updateField('category', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" disabled={isEdit}>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c} ({PACKAGING_CATEGORY_CODES[c]})</option>
              ))}
            </select>
          </div>

          {/* Name + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Item Name *</label>
              <Input value={form.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="Diamond Atomiser" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Type</label>
              <select value={form.type || 'other'} onChange={e => updateField('type', e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm">
                {['atomizer', 'vial', 'cap', 'box', 'inlay', 'insert', 'label', 'pouch', 'cloth', 'bottle', 'other'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Size + Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Size / Spec *</label>
              <Input value={form.size_spec || ''} onChange={e => updateField('size_spec', e.target.value)} placeholder="8ml or Straight7*7*20cm" className="font-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Color Variant *</label>
              <Input value={form.color_variant || ''} onChange={e => updateField('color_variant', e.target.value)} placeholder="Pink, Black, Gold..." />
            </div>
          </div>

          {/* Unit + Min Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Unit</label>
              <select value={form.unit || 'pc'} onChange={e => updateField('unit', e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-mono">
                <option value="pc">pc</option>
                <option value="sheet">sheet</option>
                <option value="roll">roll</option>
                <option value="set">set</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Min Stock Level</label>
              <Input type="number" min={0} value={form.min_stock_level || ''} onChange={e => updateField('min_stock_level', Number(e.target.value))} className="font-mono" />
            </div>
          </div>

          {/* Flags */}
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.requires_qc || false} onChange={e => updateField('requires_qc', e.target.checked)}
                className="w-4 h-4 rounded border-border accent-gold" />
              <span>Requires QC</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.requires_print || false} onChange={e => updateField('requires_print', e.target.checked)}
                className="w-4 h-4 rounded border-border accent-gold" />
              <span>Requires Print</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.requires_inlay || false} onChange={e => updateField('requires_inlay', e.target.checked)}
                className="w-4 h-4 rounded border-border accent-gold" />
              <span>Requires Inlay</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.active !== false} onChange={e => updateField('active', e.target.checked)}
                className="w-4 h-4 rounded border-border accent-success" />
              <span>Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEdit ? 'Save Changes' : 'Create SKU'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Supplier Link Dialog ----
function SupplierLinkDialog({ sku, suppliers, linkedSupplierIds, onLink, onUnlink, onClose }: {
  sku: PackagingSKU;
  suppliers: Supplier[];
  linkedSupplierIds: string[];
  onLink: (supplierId: string) => Promise<void>;
  onUnlink: (supplierId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = suppliers.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.contact_email.toLowerCase().includes(q);
    }
    return true;
  });

  const handleToggle = async (supplierId: string, isLinked: boolean) => {
    setLoading(supplierId);
    try {
      if (isLinked) {
        await onUnlink(supplierId);
      } else {
        await onLink(supplierId);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold">Link Suppliers</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{sku.name} — {sku.sku_id}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." className="pl-9" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.map(s => {
            const isLinked = linkedSupplierIds.includes(s.supplier_id);
            const isLoading = loading === s.supplier_id;
            return (
              <div key={s.supplier_id} className={cn(
                'flex items-center justify-between p-3 rounded-lg border transition-colors',
                isLinked ? 'border-gold/30 bg-gold/5' : 'border-border hover:bg-muted/20'
              )}>
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">{s.country} · {s.type}</p>
                </div>
                <Button
                  size="sm"
                  variant={isLinked ? 'outline' : 'default'}
                  className={cn('gap-1.5 text-xs', isLinked ? 'border-destructive/30 text-destructive hover:bg-destructive/10' : 'bg-gold hover:bg-gold/90 text-gold-foreground')}
                  onClick={() => handleToggle(s.supplier_id, isLinked)}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : isLinked ? <Unlink className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                  {isLinked ? 'Unlink' : 'Link'}
                </Button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No suppliers found</p>
          )}
        </div>
      </div>
    </div>
  );
}



// ---- Main Page ----
export default function PackagingSKUsPage() {
  const queryClient = useQueryClient();

  const { data: skusData, isLoading: skusLoading } = useQuery({
    queryKey: ['packagingSKUs'],
    queryFn: () => api.master.packagingSKUs().then(res => res.data),
  });

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.master.suppliers().then(res => res.data),
  });

  const skus: PackagingSKU[] = skusData || [];
  const suppliers: Supplier[] = suppliersData || [];
  const loading = skusLoading || suppliersLoading;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingSku, setEditingSku] = useState<PackagingSKU | undefined>(undefined);
  const [linkingSku, setLinkingSku] = useState<PackagingSKU | null>(null);
  const [linkedSupplierIds, setLinkedSupplierIds] = useState<string[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [deleteConfirmSku, setDeleteConfirmSku] = useState<string | null>(null);
  const [isDeletingSku, setIsDeletingSku] = useState(false);

  const filtered = useMemo(() => {
    return skus.filter(s => {
      if (filterCategory !== 'all' && s.category !== filterCategory) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return s.sku_id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.color_variant.toLowerCase().includes(q) ||
          s.size_spec.toLowerCase().includes(q);
      }
      return true;
    });
  }, [skus, filterCategory, searchTerm]);

  const totalSKUs = useMemo(() => skus.length, [skus]);
  const activeSKUs = useMemo(() => skus.filter(s => s.active).length, [skus]);
  const categoryCount = useMemo(() => new Set(skus.map(s => s.category).filter(Boolean)).size, [skus]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, PackagingSKU[]>();
    for (const s of filtered) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleBulkImport = async (data: any[]) => {
    await api.mutations.packagingSkus.bulkCreate(data);
    queryClient.invalidateQueries({ queryKey: ['packagingSKUs'] });
  };

  const handleSaveSku = useCallback(async (formData: Partial<PackagingSKU>, isEdit: boolean) => {
    const payload: Record<string, unknown> = {
      skuId: formData.sku_id,
      name: formData.name,
      category: formData.category,
      sizeSpec: formData.size_spec,
      colorVariant: formData.color_variant,
      type: formData.type,
      requiresPrint: formData.requires_print || false,
      requiresInlay: formData.requires_inlay || false,
      requiresQc: formData.requires_qc || false,
      unit: formData.unit || 'pc',
      minStockLevel: Number(formData.min_stock_level) || 50,
      active: formData.active !== false,
    };

    try {
      if (isEdit) {
        await api.mutations.packagingSkus.update(formData.sku_id!, payload);
      } else {
        await api.mutations.packagingSkus.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['packagingSKUs'] });
      toast.success(isEdit ? 'SKU updated' : 'SKU created');
      setShowForm(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save SKU');
    }
  }, [queryClient]);

  const handleOpenLinkDialog = useCallback(async (sku: PackagingSKU) => {
    setLinkingSku(sku);
    try {
      const suppliers = await api.mutations.packagingSkus.getSuppliers(sku.sku_id);
      setLinkedSupplierIds((suppliers || []).map((s: any) => String(s.supplierId)));
    } catch {
      setLinkedSupplierIds([]);
    }
  }, []);

  const handleLinkSupplier = useCallback(async (supplierId: string) => {
    if (!linkingSku) return;
    await api.mutations.packagingSkus.linkSupplier({
      skuId: linkingSku.sku_id,
      supplierId,
      isPreferred: false
    });
    setLinkedSupplierIds(prev => [...prev, supplierId]);
    toast.success('Supplier linked');
  }, [linkingSku]);

  const handleUnlinkSupplier = useCallback(async (supplierId: string) => {
    if (!linkingSku) return;
    await api.mutations.packagingSkus.unlinkSupplier(linkingSku.sku_id, supplierId);
    setLinkedSupplierIds(prev => prev.filter(id => id !== supplierId));
    toast.success('Supplier unlinked');
  }, [linkingSku]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const confirmDelete = async () => {
    if (!deleteConfirmSku || isDeletingSku) return;

    setIsDeletingSku(true);
    try {
      await api.mutations.packagingSkus.delete(deleteConfirmSku);
      queryClient.invalidateQueries({ queryKey: ['packagingSKUs'] });
      toast.success(`SKU ${deleteConfirmSku} deleted`);
      setDeleteConfirmSku(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete SKU');
    } finally {
      setIsDeletingSku(false);
    }
  };

  return (
    <div>
      <AlertDialog
        open={!!deleteConfirmSku}
        onOpenChange={(open) => {
          if (!open && !isDeletingSku) {
            setDeleteConfirmSku(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete SKU</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete SKU {deleteConfirmSku}? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel disabled={isDeletingSku} onClick={() => setDeleteConfirmSku(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeletingSku}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSku ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              {isDeletingSku ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <PageHeader
        title="Packaging & Materials"
        subtitle={`${skus.length} SKUs across ${categoryCount} categories — Non-liquid inventory master`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Packaging & Materials' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => queryClient.invalidateQueries({ queryKey: ['packagingSKUs'] })}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => exportPackagingCsv(skus)}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowBulkUpload(true)}>
              <Upload className="w-3.5 h-3.5" /> Bulk CSV
            </Button>
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              onClick={() => { setEditingSku(undefined); setShowForm(true); }}>
              <Plus className="w-3.5 h-3.5" /> Add Component
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-gold">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total SKUs</p>
            <p className="text-xl font-mono font-bold mt-1">{totalSKUs}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-emerald-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active SKUs</p>
            <p className="text-xl font-mono font-bold mt-1">{activeSKUs}<span className="text-sm text-muted-foreground font-normal">/{totalSKUs}</span></p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-blue-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Categories</p>
            <p className="text-xl font-mono font-bold mt-1">{categoryCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search SKU, name, color, size..."
              className="pl-9 scan-input" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Category:</span>
            <button onClick={() => setFilterCategory('all')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filterCategory === 'all' ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
              All
            </button>
            {CATEGORIES.filter(c => skus.some(s => s.category === c)).map(c => (
              <button key={c} onClick={() => setFilterCategory(c)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  filterCategory === c ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grouped Table View */}
        {grouped.map(([category, items]) => {
          const CatIcon = CATEGORY_ICONS[category] || Package;
          const borderColor = CATEGORY_COLORS[category] || 'border-l-zinc-400';
          return (
            <div key={category} className={cn('bg-card border border-border rounded-xl overflow-hidden border-l-[3px]', borderColor)}>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <CatIcon className="w-4.5 h-4.5 text-muted-foreground" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold">{category}</h3>
                  <p className="text-[10px] text-muted-foreground">{items.length} SKUs · {PACKAGING_CATEGORY_CODES[category as PackagingCategory]} code</p>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {items.length} items
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/10">
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">SKU ID</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Name</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Size</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Color</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Type</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Unit</th>
                      <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Flags</th>
                      <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Status</th>
                      <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(s => {
                      return (
                        <tr key={s.sku_id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 text-[11px] font-mono font-bold text-gold max-w-[220px] truncate" title={s.sku_id}>{s.sku_id}</td>
                          <td className="px-4 py-2.5 text-sm font-medium">{s.name}</td>
                          <td className="px-4 py-2.5 text-xs font-mono">{s.size_spec}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Palette className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{s.color_variant}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{s.type}</td>
                          <td className="px-4 py-2.5 text-xs font-mono">{s.unit || 'pc'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {s.requires_qc && <span className="text-[9px] bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">QC</span>}
                              {s.requires_print && <span className="text-[9px] bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-semibold">PRT</span>}
                              {s.requires_inlay && <span className="text-[9px] bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-semibold">INL</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {s.active ? (
                              <StatusBadge variant="success">Active</StatusBadge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground font-medium">Inactive</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleOpenLinkDialog(s)}
                                className="text-muted-foreground hover:text-blue-500 transition-colors p-1" title="Link suppliers">
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => { setEditingSku(s); setShowForm(true); }}
                                className="text-muted-foreground hover:text-gold transition-colors p-1" title="Edit">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteConfirmSku(s.sku_id)}
                                className="text-muted-foreground hover:text-destructive transition-colors p-1" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No packaging SKUs match your filters</p>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      {showForm && (
        <SkuFormDialog
          sku={editingSku}
          suppliers={suppliers}
          onSave={handleSaveSku}
          onClose={() => { setShowForm(false); setEditingSku(undefined); }}
        />
      )}

      {/* Bulk CSV Upload Modal */}
      {showBulkUpload && (
        <GenericBulkImport
          title="Import Packaging Components"
          subtitle="Upload a CSV to add multiple packaging SKUs to your library at once."
          columns={PACKAGING_IMPORT_COLUMNS}
          onImport={handleBulkImport}
          onClose={() => setShowBulkUpload(false)}
          templateFilename="packaging-skus-template.csv"
          templateExample={{
            sku_id: 'EM/ATM/DIAM-8ML-BLK',
            name: 'Diamond Atomiser',
            category: 'Atomiser & Vials',
            size_spec: '8ml',
            color_variant: 'Black',
            type: 'atomizer',
            unit: 'pc',
            min_stock_level: 50,
            active: 'Yes'
          }}
          transformRow={(raw) => {
            const name = raw.name || '';
            const category = (raw.category || 'Others') as PackagingCategory;
            const sizeSpec = raw.size_spec || '';
            const colorVariant = raw.color_variant || '';

            // Generate SKU ID if not provided
            let skuId = raw.sku_id;
            if (!skuId && name && category) {
              skuId = generateSkuId(category, name, sizeSpec, colorVariant);
            }

            return {
              skuId,
              name,
              category,
              sizeSpec,
              colorVariant,
              type: raw.type || 'other',
              requiresPrint: (raw.requires_print || 'No').toLowerCase() === 'yes',
              requiresInlay: (raw.requires_inlay || 'No').toLowerCase() === 'yes',
              requiresQc: (raw.requires_qc || 'No').toLowerCase() === 'yes',
              unit: raw.unit || 'pc',
              minStockLevel: parseInt(raw.min_stock_level) || 50,
              active: (raw.active || 'Yes').toLowerCase() !== 'no'
            };
          }}
        />
      )}

      {/* Supplier Link Dialog */}
      {linkingSku && (
        <SupplierLinkDialog
          sku={linkingSku}
          suppliers={suppliers}
          linkedSupplierIds={linkedSupplierIds}
          onLink={handleLinkSupplier}
          onUnlink={handleUnlinkSupplier}
          onClose={() => { setLinkingSku(null); setLinkedSupplierIds([]); }}
        />
      )}
    </div>
  );
}
