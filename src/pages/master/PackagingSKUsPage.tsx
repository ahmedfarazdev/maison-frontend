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

// ---- Bulk CSV Upload Modal (matching Perfume Master BulkCsvUpload pattern) ----
function BulkPackagingCsvUpload({ onImport, onClose }: {
  onImport: (items: Partial<PackagingSKU>[]) => void;
  onClose: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<{ rowIndex: number; raw: Record<string, string>; item: Partial<PackagingSKU> | null; errors: string[]; warnings: string[] }[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV must have at least a header and one data row'); return; }

      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
          else { current += ch; }
        }
        result.push(current.trim());
        return result;
      };

      const csvHeaders = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_\/ ]/g, '').trim());
      setHeaders(csvHeaders);

      // Map CSV headers to expected fields
      const colMap: Record<string, number> = {};
      csvHeaders.forEach((h, i) => {
        const normalized = h.replace(/\s+/g, '_');
        if (/sku.?id/i.test(normalized)) colMap['sku_id'] = i;
        else if (/^name$/i.test(normalized)) colMap['name'] = i;
        else if (/category/i.test(normalized)) colMap['category'] = i;
        else if (/size|spec/i.test(normalized)) colMap['size_spec'] = i;
        else if (/color/i.test(normalized)) colMap['color_variant'] = i;
        else if (/^type$/i.test(normalized)) colMap['type'] = i;
        else if (/^unit$/i.test(normalized)) colMap['unit'] = i;
        else if (/min.?stock/i.test(normalized)) colMap['min_stock_level'] = i;
        else if (/active/i.test(normalized)) colMap['active'] = i;
      });

      const results = lines.slice(1).map((line, idx) => {
        const cols = parseLine(line);
        const raw: Record<string, string> = {};
        csvHeaders.forEach((h, i) => { raw[h] = cols[i] || ''; });

        const errors: string[] = [];
        const warnings: string[] = [];

        const skuId = cols[colMap['sku_id'] ?? 0] || '';
        const name = cols[colMap['name'] ?? 1] || '';
        const category = (cols[colMap['category'] ?? 2] || 'Others') as PackagingCategory;

        if (!skuId && !name) errors.push('SKU ID and Name are both empty');
        if (!name) errors.push('Name is required');
        if (!CATEGORIES.includes(category)) warnings.push(`Unknown category "${category}", will use as-is`);

        const item: Partial<PackagingSKU> | null = errors.length > 0 ? null : {
          sku_id: skuId,
          name,
          category,
          size_spec: cols[colMap['size_spec'] ?? 3] || '',
          color_variant: cols[colMap['color_variant'] ?? 4] || '',
          type: (cols[colMap['type'] ?? 5] || 'other') as PackagingSKU['type'],
          unit: cols[colMap['unit'] ?? 6] || 'pc',
          min_stock_level: parseInt(cols[colMap['min_stock_level'] ?? 7]) || 50,
          active: (cols[colMap['active'] ?? 8] || 'Yes').toLowerCase() !== 'no',
        };



        return { rowIndex: idx + 1, raw, item, errors, warnings };
      });

      setParsed(results);
      const valid = results.filter(r => r.errors.length === 0).length;
      const invalid = results.filter(r => r.errors.length > 0).length;
      toast.success(`Parsed ${results.length} rows: ${valid} valid, ${invalid} with errors`);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const validRows = parsed.filter(r => r.errors.length === 0);
  const invalidRows = parsed.filter(r => r.errors.length > 0);

  const handleImport = () => {
    if (validRows.length === 0) { toast.error('No valid rows to import'); return; }
    setImporting(true);
    const items = validRows.map(r => r.item as Partial<PackagingSKU>);
    setTimeout(() => {
      onImport(items);
      toast.success(`Importing ${items.length} packaging SKUs`);
    }, 500);
  };

  const handleDownloadTemplate = () => {
    downloadCsvTemplate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">Bulk CSV Import — Packaging Components</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload a CSV to create packaging SKUs in bulk with auto-validation
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Drop zone */}
          {parsed.length === 0 && (
            <>
              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer',
                  dragOver
                    ? 'border-gold bg-gold/5 scale-[1.01]'
                    : 'border-border hover:border-gold/50 hover:bg-muted/30'
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
                    <FileSpreadsheet className="w-8 h-8 text-gold" />
                  </div>
                  <div>
                    <p className="text-base font-semibold">Drop your CSV file here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Required columns: <span className="font-mono text-foreground">SKU ID, Name, Category</span>.
                    Optional: Size/Spec, Color, Type, Zone, Initial Qty, On Hand, Used, Unit Cost, Unit, Min Stock, Active
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadTemplate}>
                  <Download className="w-3.5 h-3.5" /> Download CSV Template
                </Button>
              </div>
            </>
          )}

          {/* Results */}
          {parsed.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-semibold">{parsed.length} rows parsed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-emerald-600 font-medium">{validRows.length} valid</span>
                </div>
                {invalidRows.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600 font-medium">{invalidRows.length} errors</span>
                  </div>
                )}
                <div className="ml-auto">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"
                    onClick={() => { setParsed([]); setHeaders([]); }}>
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </Button>
                </div>
              </div>

              {/* Column mapping */}
              <div className="bg-muted/20 rounded-lg p-3 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Detected Columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {headers.map(h => {
                    const isRequired = ['sku id', 'name', 'category'].some(r => h.includes(r));
                    return (
                      <span key={h} className={cn(
                        'text-[10px] px-2 py-1 rounded-full font-mono',
                        isRequired ? 'bg-gold/15 text-gold border border-gold/30' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                      )}>
                        {h}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Row table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5 w-12">#</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">SKU ID</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Name</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Category</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Size/Spec</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5 w-20">Status</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map(row => {
                      const isOpen = expandedRow === row.rowIndex;
                      const hasErrors = row.errors.length > 0;
                      return (
                        <tr key={row.rowIndex} className="group">
                          <td colSpan={7} className="p-0">
                            <div>
                              <button
                                className={cn(
                                  'w-full flex items-center text-left hover:bg-muted/20 transition-colors border-b border-border/50',
                                  hasErrors && 'bg-red-50/50 dark:bg-red-950/10'
                                )}
                                onClick={() => setExpandedRow(isOpen ? null : row.rowIndex)}
                              >
                                <div className="px-4 py-2.5 w-12 text-xs font-mono text-muted-foreground">{row.rowIndex}</div>
                                <div className="px-4 py-2.5 flex-1 text-xs font-mono">{row.item?.sku_id || row.raw[headers[0]] || '—'}</div>
                                <div className="px-4 py-2.5 flex-1 text-sm font-medium truncate">{row.item?.name || row.raw[headers[1]] || '—'}</div>
                                <div className="px-4 py-2.5 flex-1 text-sm truncate">{row.item?.category || row.raw[headers[2]] || '—'}</div>
                                <div className="px-4 py-2.5 flex-1 text-sm truncate">{row.item?.size_spec || row.raw[headers[3]] || '—'}</div>
                                <div className="px-4 py-2.5 w-20">
                                  {hasErrors ? (
                                    <StatusBadge variant="destructive">Error</StatusBadge>
                                  ) : row.warnings.length > 0 ? (
                                    <StatusBadge variant="warning">Warn</StatusBadge>
                                  ) : (
                                    <StatusBadge variant="success">Valid</StatusBadge>
                                  )}
                                </div>
                                <div className="px-2 py-2.5 w-10 text-muted-foreground">
                                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </div>
                              </button>

                              {isOpen && (
                                <div className="px-6 py-4 bg-muted/10 border-b border-border space-y-3">
                                  {row.errors.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">Errors</p>
                                      {row.errors.map((err, i) => (
                                        <p key={i} className="text-xs text-red-600 flex items-center gap-1.5">
                                          <AlertTriangle className="w-3 h-3 shrink-0" /> {err}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {row.warnings.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">Warnings</p>
                                      {row.warnings.map((w, i) => (
                                        <p key={i} className="text-xs text-amber-600 flex items-center gap-1.5">
                                          <AlertTriangle className="w-3 h-3 shrink-0" /> {w}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  <div className="grid grid-cols-3 gap-3">
                                    {Object.entries(row.raw).slice(0, 14).map(([key, val]) => (
                                      <div key={key}>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{key}</p>
                                        <p className="text-sm font-medium mt-0.5 truncate">{val || '—'}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {parsed.length > 0 && (
              <span>{validRows.length} of {parsed.length} rows ready to import</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {parsed.length > 0 && (
              <Button
                className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                onClick={handleImport}
                disabled={validRows.length === 0 || importing}
              >
                {importing ? (
                  <>Importing...</>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Import {validRows.length} Components
                  </>
                )}
              </Button>
            )}
          </div>
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

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, PackagingSKU[]>();
    for (const s of filtered) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // Stats
  const totalSKUs = skus.length;
  const activeSKUs = skus.filter(s => s.active).length;
  const categoryCount = new Set(skus.map(s => s.category)).size;

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
    if (!deleteConfirmSku) return;
    try {
      await api.mutations.packagingSkus.delete(deleteConfirmSku);
      queryClient.invalidateQueries({ queryKey: ['packagingSKUs'] });
      toast.success(`SKU ${deleteConfirmSku} deleted`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete SKU');
    } finally {
      setDeleteConfirmSku(null);
    }
  };

  return (
    <div>
      <AlertDialog open={!!deleteConfirmSku} onOpenChange={(open) => !open && setDeleteConfirmSku(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete SKU</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete SKU {deleteConfirmSku}? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel onClick={() => setDeleteConfirmSku(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
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
        <BulkPackagingCsvUpload
          onImport={async (items) => {
            try {
              const payload = items.map(row => ({
                skuId: row.sku_id,
                name: row.name,
                category: row.category,
                sizeSpec: row.size_spec,
                colorVariant: row.color_variant,
                type: row.type,
                requiresPrint: row.requires_print || false,
                requiresInlay: row.requires_inlay || false,
                requiresQc: row.requires_qc || false,
                unit: row.unit || 'pc',
                minStockLevel: row.min_stock_level || 50,
                active: row.active !== false,
              }));
              await api.mutations.packagingSkus.bulkCreate(payload);
              toast.success(`Imported ${items.length} SKUs`);
              setShowBulkUpload(false);
              queryClient.invalidateQueries({ queryKey: ['packagingSKUs'] });
            } catch (e: any) {
              toast.error(e.message || 'Failed to bulk import SKUs');
            }
          }}
          onClose={() => setShowBulkUpload(false)}
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
