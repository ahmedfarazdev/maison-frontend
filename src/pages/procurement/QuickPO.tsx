// ============================================================
// Quick PO — Purchase Order generation
// Pipeline: Created → Ordered → Received & QC → Submitted → Approved
// Perfume POs: select perfume, quantity, ML required, type (tester/sealed)
// Target price NOT mandatory
// Invoice attachment, price validation before Approved, PDF+CSV export
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  FileText, Plus, Search, Loader2, ArrowRight, Package,
  Clock, CheckCircle2, DollarSign, ShoppingCart,
  ClipboardList, Download, Eye, Trash2, X, Hash,
  Paperclip, AlertTriangle, FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Pipeline: Created → Ordered → Received & QC → Submitted → Approved
const QPO_STATUSES = [
  { value: 'created', label: 'Created', icon: FileText, color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  { value: 'ordered', label: 'Ordered', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 'received_qc', label: 'Received & QC', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { value: 'submitted', label: 'Submitted', icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  { value: 'approved', label: 'Approved', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
] as const;

type QPOStatus = typeof QPO_STATUSES[number]['value'];

interface QuickPOItem {
  id: string;
  name: string;
  sku: string;
  category: 'perfume' | 'packaging';
  size?: string;
  brand?: string;
  quantity: number;
  targetPrice: number;
  actualPrice: number;
  mlRequired?: number;
  bottleType?: 'tester' | 'sealed';
}

interface QuickPOData {
  id: string;
  poNumber: string;
  poType: 'perfume' | 'packaging' | 'mixed';
  status: QPOStatus;
  items: QuickPOItem[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  totalTarget: number;
  totalActual: number;
  invoiceFileName?: string;
  invoiceAttachedAt?: string;
}

// Local state management
function useQuickPOs() {
  const [pos, setPOs] = useState<QuickPOData[]>(() => {
    try {
      const stored = localStorage.getItem('aura_quick_pos');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const save = (updated: QuickPOData[]) => {
    setPOs(updated);
    localStorage.setItem('aura_quick_pos', JSON.stringify(updated));
  };

  const add = (po: QuickPOData) => save([po, ...pos]);
  const update = (id: string, patch: Partial<QuickPOData>) => {
    save(pos.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
  };
  const remove = (id: string) => save(pos.filter(p => p.id !== id));

  return { pos, add, update, remove };
}

function getNextStatus(current: QPOStatus): QPOStatus | null {
  const idx = QPO_STATUSES.findIndex(s => s.value === current);
  if (idx < 0 || idx >= QPO_STATUSES.length - 1) return null;
  return QPO_STATUSES[idx + 1].value;
}

// ---- Status Pipeline Visual ----
function StatusPipeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = QPO_STATUSES.findIndex(s => s.value === currentStatus);
  return (
    <div className="flex items-center gap-1">
      {QPO_STATUSES.map((s, i) => {
        const Icon = s.icon;
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={s.value} className="flex items-center gap-1">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
              isCurrent ? `${s.bg} ${s.color} ring-1 ring-current font-bold` :
              isPast ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' :
              'bg-muted/30 text-muted-foreground/40'
            )}>
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </div>
            {i < QPO_STATUSES.length - 1 && (
              <ArrowRight className={cn('w-3.5 h-3.5', isPast ? 'text-emerald-400' : 'text-muted-foreground/20')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Searchable Item Picker ----
function ItemPicker({ items, value, onChange, placeholder }: {
  items: { id: string; label: string; sub: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 50);
    const q = query.toLowerCase();
    return items.filter(i => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)).slice(0, 50);
  }, [items, query]);

  const selected = items.find(i => i.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          'w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-left flex items-center justify-between',
          !value && 'text-muted-foreground'
        )}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b">
            <Input
              placeholder="Search..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="h-8 text-xs"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length > 0 ? filtered.map(item => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
                  value === item.id && 'bg-gold/10'
                )}
                onClick={() => { onChange(item.id); setOpen(false); setQuery(''); }}
              >
                <div className="font-medium text-xs">{item.label}</div>
                <div className="text-[10px] text-muted-foreground">{item.sub}</div>
              </button>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">No items found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- CSV Export ----
function downloadCSV(po: QuickPOData) {
  const headers = ['#', 'Item Name', 'SKU', 'Brand', 'Size', 'Qty', 'Target Price (AED)', 'Actual Price (AED)', 'Line Total (AED)'];
  if (po.poType !== 'packaging') {
    headers.splice(5, 0, 'ML Required', 'Bottle Type');
  }
  const rows = po.items.map((item, i) => {
    const base = [
      String(i + 1),
      `"${item.name}"`,
      item.sku,
      item.brand || '',
      item.size || '',
      String(item.quantity),
      item.targetPrice.toFixed(2),
      item.actualPrice > 0 ? item.actualPrice.toFixed(2) : '',
      ((item.actualPrice || item.targetPrice) * item.quantity).toFixed(2),
    ];
    if (po.poType !== 'packaging') {
      base.splice(5, 0, item.mlRequired ? String(item.mlRequired) : '', item.bottleType || 'sealed');
    }
    return base;
  });

  // Summary row
  const emptyCount = po.poType !== 'packaging' ? 8 : 6;
  const summaryRow = Array(emptyCount).fill('');
  summaryRow.push('');
  summaryRow[0] = '';
  summaryRow[1] = 'TOTAL';
  summaryRow[summaryRow.length - 3] = po.totalTarget.toFixed(2);
  summaryRow[summaryRow.length - 2] = po.totalActual > 0 ? po.totalActual.toFixed(2) : '';
  summaryRow[summaryRow.length - 1] = (po.totalActual > 0 ? po.totalActual : po.totalTarget).toFixed(2);

  const csv = [
    `PO Number: ${po.poNumber}`,
    `Type: ${po.poType}`,
    `Status: ${QPO_STATUSES.find(s => s.value === po.status)?.label ?? po.status}`,
    `Created: ${new Date(po.createdAt).toLocaleDateString('en-GB')}`,
    ``,
    headers.join(','),
    ...rows.map(r => r.join(',')),
    summaryRow.join(','),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${po.poNumber}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exported');
}

// ---- PDF Export (text-based) ----
function downloadPDF(po: QuickPOData) {
  const now = new Date();
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const variance = po.totalActual > 0 ? ((po.totalActual - po.totalTarget) / po.totalTarget * 100).toFixed(1) : null;

  const lines = [
    `╔══════════════════════════════════════════════════════╗`,
    `║           MAISON EM — PURCHASE ORDER                 ║`,
    `║           AURA VAULT Ops Console                     ║`,
    `╚══════════════════════════════════════════════════════╝`,
    ``,
    `  PO Number:    ${po.poNumber}`,
    `  Type:         ${po.poType === 'perfume' ? 'Perfume PO' : po.poType === 'packaging' ? 'Packaging & Materials PO' : 'Mixed PO'}`,
    `  Status:       ${QPO_STATUSES.find(s => s.value === po.status)?.label ?? po.status}`,
    `  Created:      ${fmtDate(po.createdAt)} at ${fmtTime(po.createdAt)}`,
    `  Last Updated: ${fmtDate(po.updatedAt)} at ${fmtTime(po.updatedAt)}`,
    `  Exported:     ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
  ];

  if (po.invoiceFileName) {
    lines.push(`  Invoice:      ${po.invoiceFileName} (attached ${po.invoiceAttachedAt ? fmtDate(po.invoiceAttachedAt) : ''})`);
  }

  lines.push(``);
  lines.push(`══════════════════════════════════════════════════════`);
  lines.push(`  LINE ITEMS (${po.items.length})`);
  lines.push(`══════════════════════════════════════════════════════`);
  lines.push(``);

  po.items.forEach((item, i) => {
    const lineTotal = (item.actualPrice || item.targetPrice) * item.quantity;
    lines.push(`  ${String(i + 1).padStart(2, '0')}. ${item.name}`);
    lines.push(`      SKU: ${item.sku}`);
    if (item.brand) lines.push(`      Brand: ${item.brand}`);
    if (item.size) lines.push(`      Size: ${item.size}`);
    if (item.mlRequired) lines.push(`      ML Required: ${item.mlRequired}ml`);
    if (item.bottleType) lines.push(`      Bottle Type: ${item.bottleType === 'tester' ? 'Tester' : 'Sealed'}`);
    lines.push(`      Quantity: ${item.quantity}`);
    lines.push(`      Target Price: AED ${item.targetPrice.toFixed(2)}`);
    if (item.actualPrice > 0) lines.push(`      Actual Price: AED ${item.actualPrice.toFixed(2)}`);
    lines.push(`      Line Total:   AED ${lineTotal.toFixed(2)}`);
    lines.push(``);
  });

  lines.push(`══════════════════════════════════════════════════════`);
  lines.push(`  TOTALS`);
  lines.push(`──────────────────────────────────────────────────────`);
  lines.push(`  Target Total:  AED ${po.totalTarget.toFixed(2)}`);
  if (po.totalActual > 0) {
    lines.push(`  Actual Total:  AED ${po.totalActual.toFixed(2)}`);
    if (variance) {
      const sign = Number(variance) >= 0 ? '+' : '';
      lines.push(`  Variance:      ${sign}${variance}% vs target`);
    }
  }
  if (po.notes) {
    lines.push(``);
    lines.push(`──────────────────────────────────────────────────────`);
    lines.push(`  NOTES`);
    lines.push(`──────────────────────────────────────────────────────`);
    lines.push(`  ${po.notes}`);
  }
  lines.push(``);
  lines.push(`══════════════════════════════════════════════════════`);
  lines.push(`  Generated by AURA VAULT Ops Console`);
  lines.push(`  ${now.toISOString()}`);
  lines.push(`══════════════════════════════════════════════════════`);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${po.poNumber}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('PO document downloaded');
}

export default function QuickPO() {
  const { pos, add, update, remove } = useQuickPOs();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);

  // Load perfumes and packaging for item selection
  const { data: perfumesData } = useApiQuery<any>(api.master.perfumes);
  const { data: packagingData } = useApiQuery<any>(api.master.packagingSKUs);
  const perfumes = (perfumesData as any)?.data ?? [];
  const packagingItems = (packagingData as any)?.data ?? [];

  // Normalize items for picker
  const perfumePickerItems = useMemo(() =>
    perfumes.map((p: any) => ({
      id: p.masterId || p.id || `p-${Math.random()}`,
      label: `${p.name || p.perfumeName || 'Unknown'} — ${p.sizeMl || '?'}ml`,
      sub: `${p.brand || 'Unknown Brand'} · ${p.masterId || p.id || ''}`,
      raw: p,
    })), [perfumes]);

  const packagingPickerItems = useMemo(() =>
    packagingItems.map((p: any) => ({
      id: p.skuId || p.id || `pkg-${Math.random()}`,
      label: p.name || p.skuName || 'Unknown',
      sub: `${p.category || 'Packaging'} · ${p.skuId || p.id || ''}`,
      raw: p,
    })), [packagingItems]);

  // Create form
  const [form, setForm] = useState({
    poType: 'perfume' as 'perfume' | 'packaging' | 'mixed',
    notes: '',
    items: [] as QuickPOItem[],
  });

  const [itemForm, setItemForm] = useState({
    selectedId: '', quantity: 1, targetPrice: 0,
    mlRequired: 0, bottleType: 'sealed' as 'tester' | 'sealed',
  });

  const currentPickerItems = form.poType === 'packaging' ? packagingPickerItems : perfumePickerItems;

  const handleAddItem = () => {
    if (!itemForm.selectedId) { toast.error('Please select an item first'); return; }
    const pickerItem = currentPickerItems.find((i: any) => i.id === itemForm.selectedId);
    if (!pickerItem) { toast.error('Item not found in catalog'); return; }
    const raw = pickerItem.raw;

    const isPerfume = form.poType !== 'packaging';
    const newItem: QuickPOItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: raw.name || raw.perfumeName || raw.skuName || 'Unknown',
      sku: raw.masterId || raw.skuId || raw.id || '',
      category: form.poType === 'packaging' ? 'packaging' : 'perfume',
      size: raw.sizeMl ? `${raw.sizeMl}ml` : raw.size || '',
      brand: raw.brand || '',
      quantity: Math.max(1, itemForm.quantity),
      targetPrice: Math.max(0, itemForm.targetPrice),
      actualPrice: 0,
      ...(isPerfume && {
        mlRequired: itemForm.mlRequired || undefined,
        bottleType: itemForm.bottleType,
      }),
    };

    setForm(f => ({ ...f, items: [...f.items, newItem] }));
    setItemForm({ selectedId: '', quantity: 1, targetPrice: 0, mlRequired: 0, bottleType: 'sealed' });
    toast.success(`Added: ${newItem.name}`);
  };

  const handleRemoveItem = (id: string) => {
    setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));
  };

  const handleCreate = useCallback(() => {
    if (form.items.length === 0) { toast.error('Add at least one line item'); return; }
    const poNumber = `QPO-${String(pos.length + 1).padStart(3, '0')}`;
    const totalTarget = form.items.reduce((s, i) => s + i.targetPrice * i.quantity, 0);
    const newPO: QuickPOData = {
      id: `qpo-${Date.now()}`,
      poNumber,
      poType: form.poType,
      status: 'created',
      items: form.items,
      notes: form.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalTarget,
      totalActual: 0,
    };
    add(newPO);
    toast.success(`${poNumber} created with ${form.items.length} items`);
    setShowCreate(false);
    setForm({ poType: 'perfume', notes: '', items: [] });
  }, [form, pos, add]);

  const handleAdvanceStatus = (id: string) => {
    const po = pos.find(p => p.id === id);
    if (!po) return;
    const next = getNextStatus(po.status);
    if (!next) { toast.info('PO is already approved'); return; }
    update(id, { status: next });
    toast.success(`Advanced to "${QPO_STATUSES.find(s => s.value === next)?.label}"`);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this Quick PO?')) return;
    remove(id);
    toast.success('Quick PO deleted');
  };

  // Filters
  const filtered = pos.filter(po => {
    if (tab !== 'all' && po.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return po.poNumber.toLowerCase().includes(q) || po.items.some(i => i.name.toLowerCase().includes(q));
    }
    return true;
  });

  const statusCounts = pos.reduce((acc, po) => {
    acc[po.status] = (acc[po.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <PageHeader
        title="Quick PO"
        subtitle="Generate purchase orders — select items, track through Created → Ordered → Received & QC → Submitted → Approved"
        actions={
          <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Create PO
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center"><ClipboardList className="w-4 h-4 text-gold" /></div>
                <div><p className="text-xl font-bold">{pos.length}</p><p className="text-[10px] text-muted-foreground">Total POs</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-blue-600" /></div>
                <div><p className="text-xl font-bold">{(statusCounts.ordered ?? 0) + (statusCounts.received_qc ?? 0) + (statusCounts.submitted ?? 0)}</p><p className="text-[10px] text-muted-foreground">In Progress</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
                <div><p className="text-xl font-bold">{statusCounts.approved ?? 0}</p><p className="text-[10px] text-muted-foreground">Approved</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-purple-600" /></div>
                <div><p className="text-xl font-bold">AED {pos.reduce((s, p) => s + (p.totalActual || p.totalTarget), 0).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Total Value</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({pos.length})</TabsTrigger>
              <TabsTrigger value="created">Created ({statusCounts.created ?? 0})</TabsTrigger>
              <TabsTrigger value="ordered">Ordered ({statusCounts.ordered ?? 0})</TabsTrigger>
              <TabsTrigger value="received_qc">Received ({statusCounts.received_qc ?? 0})</TabsTrigger>
              <TabsTrigger value="submitted">Submitted ({statusCounts.submitted ?? 0})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({statusCounts.approved ?? 0})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search PO or item..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {filtered.length === 0 && (
          <EmptyState icon={FileText} title="No Quick POs" description="Create your first Quick PO to start tracking purchases." />
        )}

        {/* PO List */}
        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(po => {
              const statusConfig = QPO_STATUSES.find(s => s.value === po.status) ?? QPO_STATUSES[0];
              return (
                <Card key={po.id} className={cn(
                  'hover:shadow-md transition-all',
                  po.status === 'ordered' && 'border-blue-500/30',
                  po.status === 'received_qc' && 'border-amber-500/30',
                  po.status === 'submitted' && 'border-indigo-500/30',
                  po.status === 'approved' && 'border-emerald-500/30',
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-mono text-sm font-bold">{po.poNumber}</span>
                          <Badge variant="outline" className={cn('text-[10px] uppercase',
                            po.poType === 'perfume' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' :
                            po.poType === 'packaging' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' :
                            'bg-gold/10 border-gold/20 text-gold'
                          )}>
                            {po.poType === 'perfume' ? 'Perfume' : po.poType === 'packaging' ? 'Packaging' : 'Mixed'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(po.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {po.invoiceFileName && (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 border-emerald-500/20 text-emerald-600 gap-1">
                              <Paperclip className="w-2.5 h-2.5" /> Invoice
                            </Badge>
                          )}
                        </div>

                        {/* Pipeline */}
                        <StatusPipeline currentStatus={po.status} />

                        {/* Items preview */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {po.items.slice(0, 4).map(item => (
                            <span key={item.id} className="text-[10px] px-2 py-0.5 rounded-md bg-muted/50 border border-border text-foreground">
                              {item.name} <span className="text-muted-foreground">×{item.quantity}</span>
                            </span>
                          ))}
                          {po.items.length > 4 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted/50 border border-border text-muted-foreground">
                              +{po.items.length - 4} more
                            </span>
                          )}
                        </div>

                        {/* Pricing summary */}
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-muted-foreground">{po.items.length} items</span>
                          <span className="font-medium">Target: <span className="text-gold">AED {po.totalTarget.toLocaleString()}</span></span>
                          {po.totalActual > 0 && (
                            <span className="font-medium">Actual: <span className={po.totalActual > po.totalTarget ? 'text-red-500' : 'text-emerald-600'}>AED {po.totalActual.toLocaleString()}</span></span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => setShowDetail(po.id)}>
                          <Eye className="w-3 h-3" /> View
                        </Button>
                        {/* Export dropdown — PDF + CSV */}
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="text-xs gap-1 h-7 flex-1" onClick={() => downloadPDF(po)}>
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs gap-1 h-7 flex-1" onClick={() => downloadCSV(po)}>
                            <FileSpreadsheet className="w-3 h-3" /> CSV
                          </Button>
                        </div>
                        {po.status !== 'approved' && (
                          <Button size="sm" className="text-xs gap-1 h-7 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleAdvanceStatus(po.id)}>
                            <ArrowRight className="w-3 h-3" /> Advance
                          </Button>
                        )}
                        {po.status === 'created' && (
                          <Button variant="outline" size="sm" className="text-xs gap-1 h-7 text-red-500" onClick={() => handleDelete(po.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== CREATE DIALOG ===== */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gold" /> New Quick PO
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* PO Type */}
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">PO Type</Label>
              <Select value={form.poType} onValueChange={(v: any) => setForm(f => ({ ...f, poType: v, items: [] }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="perfume">Perfume PO</SelectItem>
                  <SelectItem value="packaging">Packaging & Materials PO</SelectItem>
                  <SelectItem value="mixed">Mixed PO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Add Item Section */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-1.5"><Plus className="w-3.5 h-3.5 text-gold" /> Add Line Item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Select {form.poType === 'packaging' ? 'Packaging Item' : 'Perfume'}</Label>
                  <ItemPicker
                    items={currentPickerItems}
                    value={itemForm.selectedId}
                    onChange={id => setItemForm(f => ({ ...f, selectedId: id }))}
                    placeholder={`Search and select ${form.poType === 'packaging' ? 'packaging item' : 'perfume'}...`}
                  />
                </div>
                {/* Perfume-specific fields */}
                {form.poType !== 'packaging' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">ML Required</Label>
                      <Input type="number" min={0} value={itemForm.mlRequired || ''} onChange={e => setItemForm(f => ({ ...f, mlRequired: parseInt(e.target.value) || 0 }))} placeholder="e.g. 100" />
                    </div>
                    <div>
                      <Label className="text-xs">Bottle Type</Label>
                      <Select value={itemForm.bottleType} onValueChange={(v: any) => setItemForm(f => ({ ...f, bottleType: v }))}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sealed">Sealed</SelectItem>
                          <SelectItem value="tester">Tester</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input type="number" min={1} value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Target Price per Unit (AED) <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input type="number" min={0} step={0.01} value={itemForm.targetPrice || ''} onChange={e => setItemForm(f => ({ ...f, targetPrice: parseFloat(e.target.value) || 0 }))} placeholder="Optional" />
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={handleAddItem}>
                  <Plus className="w-3 h-3" /> Add to PO
                </Button>
              </CardContent>
            </Card>

            {/* Items Table */}
            {form.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground" /> Line Items ({form.items.length})
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b">
                        <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">Item</th>
                        <th className="text-center p-2.5 text-xs font-medium text-muted-foreground w-16">Size</th>
                        {form.poType !== 'packaging' && <th className="text-center p-2.5 text-xs font-medium text-muted-foreground w-16">ML Req</th>}
                        {form.poType !== 'packaging' && <th className="text-center p-2.5 text-xs font-medium text-muted-foreground w-16">Type</th>}
                        <th className="text-center p-2.5 text-xs font-medium text-muted-foreground w-14">Qty</th>
                        <th className="text-right p-2.5 text-xs font-medium text-muted-foreground w-24">Unit Price</th>
                        <th className="text-right p-2.5 text-xs font-medium text-muted-foreground w-24">Line Total</th>
                        <th className="p-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/10">
                          <td className="p-2.5">
                            <div className="text-xs font-medium">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{item.sku} {item.brand ? `· ${item.brand}` : ''}</div>
                          </td>
                          <td className="p-2.5 text-center text-xs">{item.size || '—'}</td>
                          {form.poType !== 'packaging' && <td className="p-2.5 text-center text-xs">{item.mlRequired ? `${item.mlRequired}ml` : '—'}</td>}
                          {form.poType !== 'packaging' && <td className="p-2.5 text-center text-xs"><Badge variant="outline" className="text-[9px]">{item.bottleType || 'sealed'}</Badge></td>}
                          <td className="p-2.5 text-center text-xs font-medium">{item.quantity}</td>
                          <td className="p-2.5 text-right text-xs">AED {item.targetPrice.toFixed(2)}</td>
                          <td className="p-2.5 text-right text-xs font-bold text-gold">AED {(item.targetPrice * item.quantity).toFixed(2)}</td>
                          <td className="p-2.5 text-center">
                            <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gold/5">
                        <td colSpan={form.poType !== 'packaging' ? 6 : 4} className="p-2.5 text-right text-xs font-semibold">Total Target:</td>
                        <td className="p-2.5 text-right text-sm font-bold text-gold">
                          AED {form.items.reduce((s, i) => s + i.targetPrice * i.quantity, 0).toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Internal notes..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1" onClick={handleCreate} disabled={form.items.length === 0}>
              <FileText className="w-4 h-4" /> Create PO ({form.items.length} items)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {showDetail && (
        <QuickPODetail
          poId={showDetail}
          pos={pos}
          onClose={() => setShowDetail(null)}
          onUpdate={update}
          onAdvance={handleAdvanceStatus}
        />
      )}
    </div>
  );
}

// ---- Detail Dialog with Update Pricing, Invoice, Price Validation ----
function QuickPODetail({ poId, pos, onClose, onUpdate, onAdvance }: {
  poId: string;
  pos: QuickPOData[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<QuickPOData>) => void;
  onAdvance: (id: string) => void;
}) {
  const po = pos.find(p => p.id === poId);
  if (!po) return null;

  const [editingPrices, setEditingPrices] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    po.items.forEach(i => { init[i.id] = String(i.actualPrice || ''); });
    return init;
  });
  const [showPriceWarning, setShowPriceWarning] = useState(false);

  const hasPrices = po.items.some(i => i.actualPrice > 0);

  const handleSavePrices = () => {
    const updatedItems = po.items.map(item => ({
      ...item,
      actualPrice: parseFloat(prices[item.id] || '0') || 0,
    }));
    const totalActual = updatedItems.reduce((s, i) => s + i.actualPrice * i.quantity, 0);
    onUpdate(po.id, { items: updatedItems, totalActual });
    setEditingPrices(false);
    toast.success('Actual prices saved');
  };

  const handleInvoiceAttach = () => {
    // Simulate file picker
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        onUpdate(po.id, {
          invoiceFileName: file.name,
          invoiceAttachedAt: new Date().toISOString(),
        });
        toast.success(`Invoice "${file.name}" attached`);
      }
    };
    input.click();
  };

  const handleRemoveInvoice = () => {
    onUpdate(po.id, { invoiceFileName: undefined, invoiceAttachedAt: undefined });
    toast.success('Invoice removed');
  };

  const handleTryAdvance = () => {
    const next = getNextStatus(po.status);
    if (!next) { toast.info('PO is already approved'); return; }

    // If advancing to 'approved' and no actual prices set, show warning popup
    if (next === 'approved' && !hasPrices) {
      setShowPriceWarning(true);
      return;
    }

    onAdvance(po.id);
    onClose();
  };

  const handleForceAdvance = () => {
    setShowPriceWarning(false);
    onAdvance(po.id);
    onClose();
  };

  const nextStatus = getNextStatus(po.status);

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gold" /> {po.poNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn('text-[10px] uppercase',
                po.poType === 'perfume' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' :
                po.poType === 'packaging' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' :
                'bg-gold/10 border-gold/20 text-gold'
              )}>
                {po.poType === 'perfume' ? 'Perfume' : po.poType === 'packaging' ? 'Packaging' : 'Mixed'}
              </Badge>
              <span className="text-xs text-muted-foreground">Created: {new Date(po.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(po.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              {po.updatedAt !== po.createdAt && (
                <span className="text-xs text-muted-foreground">· Updated: {new Date(po.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(po.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>

            <StatusPipeline currentStatus={po.status} />

            {/* Invoice Section */}
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Invoice</span>
                </div>
                {po.invoiceFileName ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-600 gap-1">
                      <Paperclip className="w-2.5 h-2.5" /> {po.invoiceFileName}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {po.invoiceAttachedAt && new Date(po.invoiceAttachedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={handleRemoveInvoice}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleInvoiceAttach}>
                    <Paperclip className="w-3 h-3" /> Attach Invoice
                  </Button>
                )}
              </div>
            </div>

            {/* Items Table with Target vs Actual */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-left p-2.5 text-xs font-medium text-muted-foreground">Item</th>
                    <th className="text-center p-2.5 text-xs font-medium text-muted-foreground w-14">Qty</th>
                    <th className="text-right p-2.5 text-xs font-medium text-muted-foreground w-24">Target</th>
                    <th className="text-right p-2.5 text-xs font-medium text-muted-foreground w-24">Actual</th>
                    <th className="text-right p-2.5 text-xs font-medium text-muted-foreground w-24">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map(item => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="p-2.5">
                        <div className="text-xs font-medium">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{item.sku} · {item.size || '—'}</div>
                      </td>
                      <td className="p-2.5 text-center text-xs font-medium">{item.quantity}</td>
                      <td className="p-2.5 text-right text-xs">AED {item.targetPrice.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-xs">
                        {editingPrices ? (
                          <Input type="number" min={0} step={0.01} className="w-24 h-7 text-xs text-right ml-auto" value={prices[item.id] || ''} onChange={e => setPrices(p => ({ ...p, [item.id]: e.target.value }))} />
                        ) : (
                          <span className={item.actualPrice > 0 ? 'font-medium' : 'text-muted-foreground'}>
                            {item.actualPrice > 0 ? `AED ${item.actualPrice.toFixed(2)}` : '—'}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right text-xs font-bold text-gold">
                        AED {((item.actualPrice || item.targetPrice) * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gold/5">
                    <td colSpan={2}></td>
                    <td className="p-2.5 text-right text-xs font-semibold">AED {po.totalTarget.toFixed(2)}</td>
                    <td className="p-2.5 text-right text-xs font-semibold">{po.totalActual > 0 ? `AED ${po.totalActual.toFixed(2)}` : '—'}</td>
                    <td className="p-2.5 text-right text-sm font-bold text-gold">
                      AED {(po.totalActual > 0 ? po.totalActual : po.totalTarget).toFixed(2)}
                    </td>
                  </tr>
                  {po.totalActual > 0 && po.totalActual !== po.totalTarget && (
                    <tr>
                      <td colSpan={5} className="p-2 text-right text-[10px]">
                        <span className={po.totalActual > po.totalTarget ? 'text-red-500' : 'text-emerald-600'}>
                          {po.totalActual > po.totalTarget ? '▲' : '▼'} {Math.abs(((po.totalActual - po.totalTarget) / po.totalTarget) * 100).toFixed(1)}% vs target
                        </span>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            {po.notes && <p className="text-sm text-muted-foreground border-l-2 border-gold/30 pl-3">{po.notes}</p>}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap border-t pt-4">
              {/* Update Pricing button — always visible after creation */}
              {!editingPrices && (
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setEditingPrices(true)}>
                  <DollarSign className="w-3 h-3" /> {hasPrices ? 'Update Prices' : 'Set Actual Prices'}
                </Button>
              )}
              {editingPrices && (
                <>
                  <Button size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSavePrices}>Save Prices</Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditingPrices(false)}>Cancel</Button>
                </>
              )}

              {/* Invoice attach */}
              {!po.invoiceFileName && (
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleInvoiceAttach}>
                  <Paperclip className="w-3 h-3" /> Attach Invoice
                </Button>
              )}

              {/* Export buttons */}
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => downloadPDF(po)}>
                <Download className="w-3 h-3" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => downloadCSV(po)}>
                <FileSpreadsheet className="w-3 h-3" /> CSV
              </Button>

              {/* Advance with price validation */}
              {nextStatus && (
                <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1 ml-auto" onClick={handleTryAdvance}>
                  <ArrowRight className="w-3 h-3" /> Advance to {QPO_STATUSES.find(s => s.value === nextStatus)?.label}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price Warning Popup — shown when trying to approve without prices */}
      <Dialog open={showPriceWarning} onOpenChange={setShowPriceWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" /> Prices Not Updated
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Final actual prices have not been set for this PO. It is recommended to update prices before approving to ensure accurate cost tracking.
            </p>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Missing:</strong> {po.items.filter(i => !i.actualPrice || i.actualPrice === 0).length} of {po.items.length} items have no actual price set.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setShowPriceWarning(false);
              setEditingPrices(true);
            }}>
              <DollarSign className="w-3 h-3 mr-1" /> Update Prices Now
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleForceAdvance}>
              Approve Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
