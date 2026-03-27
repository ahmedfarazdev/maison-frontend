// ============================================================
// Inventory — Packaging Stock Registry
// Operational stock tracking: qty, unit cost, zone, notes
// Intake form + CSV bulk import + ledger-style view
// ============================================================

import { useState, useMemo, useCallback, useRef } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  PackageOpen, AlertTriangle, Search, Download, Upload,
  DollarSign, Package, Layers, Box, Tag, Truck, Sticker,
  ChevronDown, ChevronRight, BarChart3, Plus, X, FileSpreadsheet,
  MapPin, StickyNote, Check, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PackagingSKU, PackagingStock } from '@/types';

// ---- Category config ----
const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; borderColor: string }> = {
  'Atomiser & Vials': { icon: Package, color: 'text-emerald-500', borderColor: 'border-l-emerald-500' },
  'Decant Bottles': { icon: Box, color: 'text-blue-500', borderColor: 'border-l-blue-500' },
  'Packaging Material': { icon: PackageOpen, color: 'text-amber-500', borderColor: 'border-l-amber-500' },
  'Packaging Accessories': { icon: Tag, color: 'text-purple-500', borderColor: 'border-l-purple-500' },
  'Shipping Material': { icon: Truck, color: 'text-cyan-500', borderColor: 'border-l-cyan-500' },
  'Labels': { icon: Sticker, color: 'text-pink-500', borderColor: 'border-l-pink-500' },
};

// ---- CSV Export ----
function exportPackagingCsv(skus: PackagingSKU[], stockMap: Map<string, PackagingStock>) {
  const headers = ['SKU ID', 'Name', 'Category', 'Type', 'Qty On Hand', 'Unit Cost (AED)', 'Zone', 'Notes', 'Status'];
  const rows = skus.map(s => {
    const st = stockMap.get(s.sku_id);
    const qty = st?.qty_on_hand ?? 0;
    return [
      s.sku_id, s.name, s.category, s.type,
      String(qty),
      st?.unit_cost ? String(st.unit_cost) : '0',
      st?.zone || '',
      st?.notes || '',
      qty < 10 ? 'Low Stock' : 'OK',
    ];
  });
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `packaging-stock-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('Packaging stock exported');
}

// ---- CSV Template ----
function downloadStockCsvTemplate() {
  const headers = ['sku_id', 'qty_on_hand', 'unit_cost', 'zone', 'notes'];
  const example = ['EM/ATM/ATOM-8ML-PNK', '500', '1.50', 'Zone A - Atomizers', 'Initial stock intake'];
  const csv = [headers.join(','), example.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'packaging-stock-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('CSV template downloaded');
}

// ---- Parse CSV ----
function parseStockCsv(text: string): { valid: ParsedStockRow[]; invalid: { row: number; reason: string }[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { valid: [], invalid: [{ row: 0, reason: 'No data rows found' }] };

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  const skuIdx = headers.findIndex(h => h === 'sku_id' || h === 'sku id');
  const qtyIdx = headers.findIndex(h => h === 'qty_on_hand' || h === 'qty' || h === 'quantity');
  const costIdx = headers.findIndex(h => h === 'unit_cost' || h === 'cost' || h === 'unit_price');
  const zoneIdx = headers.findIndex(h => h === 'zone' || h === 'storage_zone' || h === 'location');
  const notesIdx = headers.findIndex(h => h === 'notes' || h === 'note' || h === 'comment');

  if (skuIdx === -1) return { valid: [], invalid: [{ row: 0, reason: 'Missing sku_id column' }] };
  if (qtyIdx === -1) return { valid: [], invalid: [{ row: 0, reason: 'Missing qty_on_hand column' }] };

  const valid: ParsedStockRow[] = [];
  const invalid: { row: number; reason: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const skuId = cols[skuIdx]?.trim();
    const qtyStr = cols[qtyIdx]?.trim();

    if (!skuId) { invalid.push({ row: i + 1, reason: 'Missing sku_id' }); continue; }
    const qty = parseInt(qtyStr || '0', 10);
    if (isNaN(qty) || qty < 0) { invalid.push({ row: i + 1, reason: `Invalid qty: ${qtyStr}` }); continue; }

    const costStr = costIdx >= 0 ? cols[costIdx]?.trim() : '';
    const cost = costStr ? parseFloat(costStr) : 0;
    if (costStr && isNaN(cost)) { invalid.push({ row: i + 1, reason: `Invalid cost: ${costStr}` }); continue; }

    valid.push({
      skuId,
      qtyOnHand: qty,
      unitCost: cost.toFixed(2),
      zone: zoneIdx >= 0 ? cols[zoneIdx]?.trim() || '' : '',
      notes: notesIdx >= 0 ? cols[notesIdx]?.trim() || '' : '',
    });
  }

  return { valid, invalid };
}

interface ParsedStockRow {
  skuId: string;
  qtyOnHand: number;
  unitCost: string;
  zone: string;
  notes: string;
}

// ---- Intake Form ----
interface IntakeFormData {
  skuId: string;
  qtyOnHand: number;
  unitCost: string;
  zone: string;
  notes: string;
}

export default function PackagingInventory() {
  const { data: skusRes, refetch: refetchSkus } = useApiQuery(() => api.master.packagingSKUs(), []);
  const { data: stockRes, refetch: refetchStock } = useApiQuery(() => api.inventory.packaging(), []);
  const skus = (skusRes?.data || []) as PackagingSKU[];
  const stockData = stockRes as { data: PackagingStock[] } | undefined;
  const stock = (stockData?.data || []) as PackagingStock[];

  const stockMap = useMemo(() => {
    const m = new Map<string, PackagingStock>();
    stock.forEach(s => m.set(s.sku_id, s));
    return m;
  }, [stock]);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'qty' | 'category'>('category');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Intake dialog
  const [showIntake, setShowIntake] = useState(false);
  const [intakeForm, setIntakeForm] = useState<IntakeFormData>({ skuId: '', qtyOnHand: 0, unitCost: '0', zone: '', notes: '' });
  const [intakeSaving, setIntakeSaving] = useState(false);

  // CSV Import
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvParsed, setCsvParsed] = useState<{ valid: ParsedStockRow[]; invalid: { row: number; reason: string }[] } | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getStock = useCallback((skuId: string) => stockMap.get(skuId)?.qty_on_hand ?? 0, [stockMap]);
  const getStockObj = useCallback((skuId: string) => stockMap.get(skuId), [stockMap]);

  const filtered = useMemo(() => {
    let result = skus.filter(s => {
      if (filterCategory !== 'all' && s.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return `${s.name} ${s.sku_id} ${s.type} ${s.category}`.toLowerCase().includes(q);
      }
      return true;
    });
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'qty') return getStock(b.sku_id) - getStock(a.sku_id);
      return a.category.localeCompare(b.category);
    });
    return result;
  }, [skus, search, filterCategory, sortBy, getStock]);

  // KPI calculations
  const totalSKUs = skus.length;
  const totalUnits = skus.reduce((sum, s) => sum + getStock(s.sku_id), 0);
  const lowStockCount = skus.filter(s => getStock(s.sku_id) < (s.min_stock_level || 10)).length;
  const categories = Array.from(new Set(skus.map(s => s.category)));
  const estimatedValue = stock.reduce((sum, s) => sum + (s.qty_on_hand * (s.unit_cost || 0)), 0);
  const outOfStockCount = skus.filter(s => getStock(s.sku_id) === 0).length;

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, PackagingSKU[]> = {};
    filtered.forEach(s => {
      const cat = s.category || 'Others';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [filtered]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // ---- Intake handlers ----
  const handleIntakeSubmit = async () => {
    if (!intakeForm.skuId) { toast.error('Please select a SKU'); return; }
    if (intakeForm.qtyOnHand <= 0) { toast.error('Quantity must be greater than 0'); return; }
    setIntakeSaving(true);
    try {
      await api.mutations.packagingStock.upsert({
        skuId: intakeForm.skuId,
        qtyOnHand: intakeForm.qtyOnHand,
        unitCost: intakeForm.unitCost || '0',
        zone: intakeForm.zone || undefined,
        notes: intakeForm.notes || undefined,
        lastRestocked: new Date().toISOString().split('T')[0],
      });
      toast.success('Stock intake recorded');
      setShowIntake(false);
      setIntakeForm({ skuId: '', qtyOnHand: 0, unitCost: '0', zone: '', notes: '' });
      refetchStock();
    } catch (e: any) {
      toast.error(e.message || 'Failed to record intake');
    } finally {
      setIntakeSaving(false);
    }
  };

  // ---- CSV handlers ----
  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseStockCsv(text);
      setCsvParsed(parsed);
    };
    reader.readAsText(file);
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCsvDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleCsvFile(file);
    } else {
      toast.error('Please drop a CSV file');
    }
  };

  const handleCsvImport = async () => {
    if (!csvParsed?.valid.length) return;
    setCsvImporting(true);
    try {
      await api.mutations.packagingStock.bulkUpsert(
        csvParsed.valid.map(r => ({
          skuId: r.skuId,
          qtyOnHand: r.qtyOnHand,
          unitCost: r.unitCost,
          zone: r.zone || undefined,
          notes: r.notes || undefined,
          lastRestocked: new Date().toISOString().split('T')[0],
        }))
      );
      toast.success(`${csvParsed.valid.length} stock records imported`);
      setShowCsvImport(false);
      setCsvParsed(null);
      refetchStock();
    } catch (e: any) {
      toast.error(e.message || 'Failed to import stock');
    } finally {
      setCsvImporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Packaging Stock Registry"
        subtitle={`${totalSKUs} SKUs · ${totalUnits.toLocaleString()} total units · ${lowStockCount} low stock`}
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Packaging Stock' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs"
              onClick={() => setShowCsvImport(true)}>
              <Upload className="w-3.5 h-3.5" /> CSV Import
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs"
              onClick={() => exportPackagingCsv(filtered, stockMap)}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button size="sm" className="gap-1.5 text-xs bg-gold hover:bg-gold/90 text-gold-foreground"
              onClick={() => setShowIntake(true)}>
              <Plus className="w-3.5 h-3.5" /> Stock Intake
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-emerald-500">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="w-3 h-3 text-emerald-500" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Total SKUs</p>
            </div>
            <p className="text-xl font-mono font-bold">{totalSKUs}</p>
            <p className="text-[10px] text-muted-foreground">{categories.length} categories</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-blue-500">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers className="w-3 h-3 text-blue-500" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Total Units</p>
            </div>
            <p className="text-xl font-mono font-bold">{totalUnits.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">On hand</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-gold">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3 h-3 text-gold" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Est. Value</p>
            </div>
            <p className="text-xl font-mono font-bold">AED {estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </div>
          <div className={cn(
            'bg-card border border-border rounded-xl p-3.5 border-l-[3px]',
            lowStockCount > 0 ? 'border-l-destructive' : 'border-l-amber-500',
          )}>
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className={cn('w-3 h-3', lowStockCount > 0 ? 'text-destructive' : 'text-amber-500')} />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Low Stock</p>
            </div>
            <p className={cn('text-xl font-mono font-bold', lowStockCount > 0 && 'text-destructive')}>{lowStockCount}</p>
            <p className="text-[10px] text-muted-foreground">Below minimum</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-red-500">
            <div className="flex items-center gap-1.5 mb-1">
              <PackageOpen className="w-3 h-3 text-red-500" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Out of Stock</p>
            </div>
            <p className={cn('text-xl font-mono font-bold', outOfStockCount > 0 && 'text-red-500')}>{outOfStockCount}</p>
            <p className="text-[10px] text-muted-foreground">Zero on hand</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-violet-500">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3 h-3 text-violet-500" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Categories</p>
            </div>
            <p className="text-xl font-mono font-bold">{categories.length}</p>
            <p className="text-[10px] text-muted-foreground">Active groups</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search SKU, name, category..." className="pl-9" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Category:</span>
            <button onClick={() => setFilterCategory('all')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filterCategory === 'all' ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all truncate max-w-[120px]',
                  filterCategory === cat ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                {cat}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="ml-auto bg-background border border-input rounded-md px-3 py-1.5 text-xs">
            <option value="category">Sort: Category</option>
            <option value="name">Sort: Name</option>
            <option value="qty">Sort: Quantity</option>
          </select>
        </div>

        {/* Category Sections */}
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => {
            const isCollapsed = collapsedCategories.has(category);
            const catConfig = CATEGORY_CONFIG[category] || { icon: PackageOpen, color: 'text-muted-foreground', borderColor: 'border-l-muted-foreground' };
            const CatIcon = catConfig.icon;
            const catLowStock = items.filter(s => getStock(s.sku_id) < (s.min_stock_level || 10)).length;
            const catTotalUnits = items.reduce((sum, s) => sum + getStock(s.sku_id), 0);

            return (
              <div key={category} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors"
                >
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                  <CatIcon className={cn('w-4 h-4 shrink-0', catConfig.color)} />
                  <div className="flex-1 min-w-0 text-left">
                    <h3 className="text-sm font-semibold">{category}</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {items.length} SKUs · {catTotalUnits.toLocaleString()} units
                      {catLowStock > 0 && <span className="text-destructive ml-2">· {catLowStock} low stock</span>}
                    </p>
                  </div>
                  <StatusBadge variant={catLowStock > 0 ? 'warning' : 'success'}>
                    {catLowStock > 0 ? `${catLowStock} low` : 'OK'}
                  </StatusBadge>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/10 border-b border-border">
                          <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">SKU</th>
                          <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-2.5">Name</th>
                          <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-2.5">On Hand</th>
                          <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-2.5">Unit Cost</th>
                          <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-2.5">Zone</th>
                          <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-2.5">Status</th>
                          <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-2.5">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(sku => {
                          const qty = getStock(sku.sku_id);
                          const stObj = getStockObj(sku.sku_id);
                          const minLevel = sku.min_stock_level || 10;
                          const isLow = qty > 0 && qty < minLevel;
                          const isOut = qty === 0;
                          return (
                            <tr key={sku.sku_id} className={cn(
                              'border-b border-border/50 hover:bg-muted/10 transition-colors',
                              isOut && 'bg-red-500/5',
                              isLow && 'bg-amber-500/5',
                            )}>
                              <td className="px-4 py-2.5">
                                <p className="text-xs font-mono font-bold">{sku.sku_id}</p>
                              </td>
                              <td className="px-3 py-2.5">
                                <p className="text-sm font-medium">{sku.name}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">{sku.type} · {sku.unit || 'pcs'}</p>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={cn(
                                    'text-sm font-mono font-bold',
                                    isOut ? 'text-red-500' : isLow ? 'text-amber-600' : 'text-foreground',
                                  )}>
                                    {qty.toLocaleString()}
                                  </span>
                                  <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
                                    <div className={cn(
                                      'h-full rounded-full transition-all',
                                      isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500',
                                    )} style={{ width: `${Math.min(100, (qty / Math.max(qty, 100)) * 100)}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right text-xs font-mono text-gold">
                                {stObj?.unit_cost ? `AED ${Number(stObj.unit_cost).toFixed(2)}` : '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                {stObj?.zone ? (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {stObj.zone}
                                  </span>
                                ) : <span className="text-xs text-muted-foreground/50">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <StatusBadge variant={isOut ? 'destructive' : isLow ? 'warning' : 'success'}>
                                  {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                                </StatusBadge>
                              </td>
                              <td className="px-3 py-2.5 max-w-[150px]">
                                {stObj?.notes ? (
                                  <span className="text-xs text-muted-foreground truncate block" title={stObj.notes}>
                                    {stObj.notes}
                                  </span>
                                ) : <span className="text-xs text-muted-foreground/50">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-16">
            <PackageOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-muted-foreground">No packaging items found</h3>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add packaging SKUs in Master Data first, then record stock here
            </p>
          </div>
        )}
      </div>

      {/* ---- Stock Intake Dialog ---- */}
      {showIntake && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowIntake(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-gold" /> Stock Intake
              </h2>
              <button onClick={() => setShowIntake(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">SKU *</label>
                <select
                  value={intakeForm.skuId}
                  onChange={e => setIntakeForm(f => ({ ...f, skuId: e.target.value }))}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select a packaging SKU...</option>
                  {skus.filter(s => s.active).map(s => (
                    <option key={s.sku_id} value={s.sku_id}>{s.sku_id} — {s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Quantity *</label>
                  <Input type="number" min={0} value={intakeForm.qtyOnHand || ''} placeholder="0"
                    onChange={e => setIntakeForm(f => ({ ...f, qtyOnHand: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Unit Cost (AED)</label>
                  <Input type="number" min={0} step="0.01" value={intakeForm.unitCost || ''} placeholder="0.00"
                    onChange={e => setIntakeForm(f => ({ ...f, unitCost: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  <MapPin className="w-3 h-3 inline mr-1" /> Storage Zone
                </label>
                <Input value={intakeForm.zone} placeholder="e.g., Zone A - Atomizers"
                  onChange={e => setIntakeForm(f => ({ ...f, zone: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  <StickyNote className="w-3 h-3 inline mr-1" /> Notes
                </label>
                <Input value={intakeForm.notes} placeholder="Optional notes..."
                  onChange={e => setIntakeForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowIntake(false)}>Cancel</Button>
              <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                onClick={handleIntakeSubmit} disabled={intakeSaving}>
                {intakeSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Record Intake
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- CSV Import Dialog ---- */}
      {showCsvImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowCsvImport(false); setCsvParsed(null); }}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-gold" /> CSV Stock Import
              </h2>
              <button onClick={() => { setShowCsvImport(false); setCsvParsed(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Download Template */}
              <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Download CSV Template</p>
                  <p className="text-[10px] text-muted-foreground">Columns: sku_id, qty_on_hand, unit_cost, zone, notes</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={downloadStockCsvTemplate}>
                  <Download className="w-3.5 h-3.5" /> Template
                </Button>
              </div>

              {/* Drop Zone */}
              {!csvParsed && (
                <div
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
                    csvDragOver ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/50',
                  )}
                  onDragOver={e => { e.preventDefault(); setCsvDragOver(true); }}
                  onDragLeave={() => setCsvDragOver(false)}
                  onDrop={handleCsvDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">Drop your CSV file here</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">or click to browse</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleCsvFile(file);
                    }}
                  />
                </div>
              )}

              {/* Parsed Results */}
              {csvParsed && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-emerald-500">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">{csvParsed.valid.length} valid rows</span>
                    </div>
                    {csvParsed.invalid.length > 0 && (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">{csvParsed.invalid.length} invalid</span>
                      </div>
                    )}
                  </div>

                  {csvParsed.valid.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/20 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold">SKU ID</th>
                            <th className="text-right px-3 py-2 font-semibold">Qty</th>
                            <th className="text-right px-3 py-2 font-semibold">Cost</th>
                            <th className="text-left px-3 py-2 font-semibold">Zone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvParsed.valid.slice(0, 20).map((r, i) => (
                            <tr key={i} className="border-t border-border/50">
                              <td className="px-3 py-1.5 font-mono">{r.skuId}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{r.qtyOnHand}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{r.unitCost}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{r.zone || '—'}</td>
                            </tr>
                          ))}
                          {csvParsed.valid.length > 20 && (
                            <tr className="border-t border-border/50">
                              <td colSpan={4} className="px-3 py-1.5 text-center text-muted-foreground">
                                ... and {csvParsed.valid.length - 20} more
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {csvParsed.invalid.length > 0 && (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                      <p className="text-xs font-semibold text-destructive mb-1">Invalid rows:</p>
                      {csvParsed.invalid.slice(0, 5).map((inv, i) => (
                        <p key={i} className="text-[10px] text-destructive/80">Row {inv.row}: {inv.reason}</p>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => { setCsvParsed(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  >
                    Choose different file
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
              <Button variant="outline" size="sm" onClick={() => { setShowCsvImport(false); setCsvParsed(null); }}>Cancel</Button>
              <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                onClick={handleCsvImport} disabled={csvImporting || !csvParsed?.valid.length}>
                {csvImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Import {csvParsed?.valid.length || 0} Records
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
