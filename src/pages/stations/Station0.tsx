// ============================================================
// Stock Register (Admin / Inventory Admin only)
// Intake sealed bottles + packaging
// New bottles are allocated to either "sealed" (for resale) or
// "decanting" (opened for decanting pool) inventory.
// Perfume must exist in Master Perfume before intake.
// ============================================================

import { useState, useMemo, useRef, useCallback } from 'react';
import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Plus, Printer, Package, Search, X, Loader2,
  Lock, Unlock, FlaskConical, Upload, Download,
  FileSpreadsheet, CheckCircle2, AlertCircle, Wine, MapPin, Sparkles,
  Box, QrCode, Tag, Barcode, ShoppingBag, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Perfume, PackagingSKU, Supplier, VaultLocation, EndProductCategory } from '@/types';
import { endProducts as allEndProducts } from '@/lib/bom-data';
import { categoryConfig } from '@/lib/product-categories';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AllocationTarget = 'sealed' | 'decanting';
type BottleType = 'sealed' | 'open' | 'tester';

interface BottleEntry {
  id: string;
  master_id: string;
  perfume_name: string;
  bottle_type: BottleType;
  supplier_id: string;
  purchase_price: number;
  size_ml: number;
  manufacturer_id: string;
  location_code: string;
  allocation: AllocationTarget;
}

interface PackagingEntry {
  id: string;
  sku_id: string;
  sku_name: string;
  sku_type: string;
  qty: number;
  supplier: string;
  price: number;
  notes: string;
}

export default function Station0() {
  const [activeTab, setActiveTab] = useState('bottles');
  const { data: perfumesRes } = useApiQuery(() => api.master.perfumes(), []);
  const { data: skusRes } = useApiQuery(() => api.master.packagingSKUs(), []);
  const { data: suppliersRes } = useApiQuery(() => api.master.suppliers(), []);
  const { data: locationsRes } = useApiQuery(() => api.master.locations(), []);
  const perfumes = (perfumesRes || []) as Perfume[];
  const skus = (skusRes || []) as PackagingSKU[];
  const suppliers = (suppliersRes || []) as Supplier[];
  const locations = ((locationsRes as any) || []) as VaultLocation[];

  return (
    <div>
      <PageHeader
        title="Stock Register"
        subtitle="Intake inventory — perfume bottles, packaging materials, and ready-to-ship products"
        breadcrumbs={[{ label: 'Inventory', href: '/inventory/sealed' }, { label: 'Stock Register' }]}
      />
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="bottles" className="gap-1.5">
              <Wine className="w-3.5 h-3.5" /> Intake Perfume Bottles
            </TabsTrigger>
            <TabsTrigger value="packaging" className="gap-1.5">
              <Package className="w-3.5 h-3.5" /> Intake Packaging
            </TabsTrigger>
            <TabsTrigger value="rts" className="gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" /> Intake RTS Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bottles">
            <BottleIntakeForm
              perfumes={perfumes}
              suppliers={suppliers}
              locations={locations}
            />
          </TabsContent>

          <TabsContent value="packaging">
            <PackagingIntakeForm skus={skus} suppliers={suppliers} />
          </TabsContent>

          <TabsContent value="rts">
            <RTSProductIntakeForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================
// BOTTLE INTAKE FORM
// ============================================================
function BottleIntakeForm({
  perfumes,
  suppliers,
  locations,
}: {
  perfumes: Perfume[];
  suppliers: Supplier[];
  locations: VaultLocation[];
}) {
  const [entries, setEntries] = useState<BottleEntry[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPerfume, setSelectedPerfume] = useState<Perfume | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [csvData, setCsvData] = useState<BottleEntry[]>([]);
  const [csvParsing, setCsvParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    bottle_type: 'sealed' as BottleType,
    supplier_id: '',
    purchase_price: '',
    size_ml: '',
    manufacturer_id: '',
    location_code: '',
    allocation: 'sealed' as AllocationTarget,
  });

  const [showPerfumeDropdown, setShowPerfumeDropdown] = useState(false);
  const [showCsvReference, setShowCsvReference] = useState(false);

  const filteredPerfumes = useMemo(() => {
    if (!search) return perfumes.slice(0, 50);
    return perfumes.filter(p =>
      `${p.brand} ${p.name} ${p.master_id}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [perfumes, search]);

  const addEntry = () => {
    if (!selectedPerfume) return;
    if (!form.purchase_price || !form.size_ml) {
      toast.error('Please fill in purchase price and size');
      return;
    }
    const entry: BottleEntry = {
      id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      master_id: selectedPerfume.master_id,
      perfume_name: `${selectedPerfume.brand} — ${selectedPerfume.name}`,
      bottle_type: form.bottle_type,
      supplier_id: form.supplier_id,
      purchase_price: parseFloat(form.purchase_price) || 0,
      size_ml: parseFloat(form.size_ml) || 0,
      manufacturer_id: form.manufacturer_id,
      location_code: form.location_code,
      allocation: form.allocation,
    };
    setEntries([...entries, entry]);
    setSelectedPerfume(null);
    setForm({ bottle_type: 'sealed', supplier_id: '', purchase_price: '', size_ml: '', manufacturer_id: '', location_code: '', allocation: 'sealed' });
    setSearch('');
    toast.success(`Bottle added to batch (${form.bottle_type} → ${form.allocation === 'sealed' ? 'Sealed' : 'Decanting'})`);
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const finishIntake = async () => {
    if (entries.length === 0) return;
    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    for (const entry of entries) {
      try {
        const bottleId = `BTL-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const now = new Date().toISOString().split('T')[0];

        if (entry.allocation === 'sealed') {
          await api.mutations.bottles.create({
            bottleId,
            masterId: entry.master_id,
            bottleType: entry.bottle_type,
            sizeMl: entry.size_ml,
            currentMl: String(entry.size_ml),
            supplierId: entry.supplier_id,
            purchasePrice: String(entry.purchase_price),
            purchaseDate: now,
            locationCode: entry.location_code,
            status: 'available',
            manufacturerId: entry.manufacturer_id,
            notes: `Intake via Stock Register (${entry.bottle_type})`,
          });

          await api.mutations.ledger.createBottleEvent({
            eventId: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            bottleId,
            type: 'intake_sealed',
            qtyMl: String(entry.size_ml),
            reason: `New ${entry.bottle_type} bottle intake: ${entry.perfume_name}`,
          });
        } else {
          await api.mutations.bottles.create({
            bottleId,
            masterId: entry.master_id,
            bottleType: 'open',
            sizeMl: entry.size_ml,
            currentMl: String(entry.size_ml),
            supplierId: entry.supplier_id,
            purchasePrice: String(entry.purchase_price),
            purchaseDate: now,
            locationCode: entry.location_code,
            status: 'in_decanting',
            manufacturerId: entry.manufacturer_id,
            notes: `Intake via Stock Register — allocated to decanting (${entry.bottle_type})`,
          });

          const decantBottleId = `DEC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          await api.mutations.decantBottles.create({
            bottleId: decantBottleId,
            masterId: entry.master_id,
            sizeMl: entry.size_ml,
            currentMl: String(entry.size_ml),
            openedAt: now,
            locationCode: entry.location_code,
            manufacturerId: entry.manufacturer_id,
          });

          await api.mutations.ledger.createBottleEvent({
            eventId: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            bottleId,
            type: 'intake_decanting',
            qtyMl: String(entry.size_ml),
            reason: `New bottle opened for decanting: ${entry.perfume_name}`,
          });
        }
        successCount++;
      } catch (err: any) {
        console.error('Failed to register bottle:', err);
        failCount++;
      }
    }

    setSubmitting(false);
    if (successCount > 0) {
      toast.success(`${successCount} bottle${successCount > 1 ? 's' : ''} registered successfully`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} bottle${failCount > 1 ? 's' : ''} failed to register`);
    }
    setEntries([]);
  };

  const downloadCsvTemplate = useCallback(() => {
    const headers = 'master_id,bottle_type,supplier_id,purchase_price,size_ml,manufacturer_batch_id,location_code,allocation\n';
    const example = 'PERF-001,sealed,SUP-001,350,100,BATCH-2024-01,MAIN-A-1-01,sealed\nPERF-002,open,SUP-002,280,50,BATCH-2024-02,MAIN-B-2-03,decanting\n';
    const blob = new Blob([headers + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bottle_intake_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const parseCsvFile = useCallback((file: File) => {
    setCsvParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        toast.error('CSV file is empty or has no data rows');
        setCsvParsing(false);
        return;
      }
      const parsed: BottleEntry[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 6) continue;
        const masterId = cols[0];
        const perfume = perfumes.find(p => p.master_id === masterId);
        if (!perfume) {
          toast.error(`Row ${i + 1}: Perfume "${masterId}" not found in master data`);
          continue;
        }
        const bottleType = (['sealed', 'open', 'tester'].includes(cols[1]) ? cols[1] : 'sealed') as BottleType;
        parsed.push({
          id: `csv_${Date.now()}_${i}`,
          master_id: masterId,
          perfume_name: `${perfume.brand} — ${perfume.name}`,
          bottle_type: bottleType,
          supplier_id: cols[2] || '',
          purchase_price: parseFloat(cols[3]) || 0,
          size_ml: parseFloat(cols[4]) || 0,
          manufacturer_id: cols[5] || '',
          location_code: cols[6] || '',
          allocation: (cols[7] === 'decanting' ? 'decanting' : 'sealed') as AllocationTarget,
        });
      }
      setCsvData(parsed);
      setCsvParsing(false);
      if (parsed.length > 0) {
        toast.success(`${parsed.length} bottles parsed from CSV`);
      }
    };
    reader.readAsText(file);
  }, [perfumes]);

  const importCsvToEntries = () => {
    setEntries(prev => [...prev, ...csvData]);
    setCsvData([]);
    setShowCsvUpload(false);
    toast.success(`${csvData.length} bottles added to intake batch`);
  };

  const sealedCount = entries.filter(e => e.allocation === 'sealed').length;
  const decantingCount = entries.filter(e => e.allocation === 'decanting').length;

  const BOTTLE_TYPES: { value: BottleType; label: string; icon: typeof Lock; color: string }[] = [
    { value: 'sealed', label: 'Sealed Bottle', icon: Lock, color: 'emerald' },
    { value: 'open', label: 'Open Bottle', icon: Unlock, color: 'blue' },
    { value: 'tester', label: 'Tester Bottle', icon: FlaskConical, color: 'purple' },
  ];

  return (
    <div>
      {/* CSV Upload Toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={showCsvUpload ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowCsvUpload(!showCsvUpload)}
          className={cn('gap-1.5', showCsvUpload && 'bg-gold hover:bg-gold/90 text-gold-foreground')}
        >
          <Upload className="w-3.5 h-3.5" /> CSV Bulk Import
        </Button>
      </div>

      {/* CSV Upload Section */}
      {showCsvUpload && (
        <SectionCard title="Bulk CSV Import — Perfume Bottles" subtitle="Upload a CSV file to import multiple bottles at once" className="mb-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Download Template
              </Button>
            </div>

            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file && file.name.endsWith('.csv')) parseCsvFile(file);
                else toast.error('Please upload a .csv file');
              }}
            >
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">Drag & drop your CSV file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) parseCsvFile(file);
                }}
              />
            </div>

            {csvParsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Parsing CSV...
              </div>
            )}

            {csvData.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{csvData.length} bottles parsed</p>
                  <Button size="sm" onClick={importCsvToEntries} className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Import to Batch
                  </Button>
                </div>
                <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                  {csvData.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm border-b border-border last:border-0">
                      <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}</span>
                      <span className="font-medium flex-1 truncate">{e.perfume_name}</span>
                      <span className="text-xs font-mono">{e.size_ml}ml</span>
                      <span className={cn(
                        'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                        e.bottle_type === 'sealed' ? 'bg-emerald-500/15 text-emerald-500' :
                        e.bottle_type === 'tester' ? 'bg-purple-500/15 text-purple-500' :
                        'bg-blue-500/15 text-blue-500'
                      )}>{e.bottle_type}</span>
                      <span className={cn(
                        'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                        e.allocation === 'sealed' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-blue-500/15 text-blue-500'
                      )}>{e.allocation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  CSV format: <code className="font-mono bg-amber-500/10 px-1 rounded">master_id, bottle_type, supplier_id, purchase_price, size_ml, manufacturer_batch_id, location_code, allocation</code>.
                  Perfumes must exist in Master Data. Bottle types: sealed, open, tester. Allocation: sealed or decanting.
                </p>
              </div>
            </div>

            {/* Master Data Reference List */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCsvReference(!showCsvReference)}
                className="gap-1.5 mb-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {showCsvReference ? 'Hide' : 'Show'} Perfume Reference List ({perfumes.length} perfumes)
              </Button>
              {showCsvReference && (
                <div className="border border-border rounded-md max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">Master ID</th>
                        <th className="text-left px-3 py-2 font-semibold">Brand</th>
                        <th className="text-left px-3 py-2 font-semibold">Name</th>
                        <th className="text-left px-3 py-2 font-semibold">Concentration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfumes.map(p => (
                        <tr key={p.master_id} className="border-t border-border hover:bg-accent/50">
                          <td className="px-3 py-1.5 font-mono">{p.master_id}</td>
                          <td className="px-3 py-1.5">{p.brand}</td>
                          <td className="px-3 py-1.5 font-medium">{p.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{p.concentration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Manual Entry + Batch Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-3 space-y-4">
          <SectionCard title="1. Select Perfume" subtitle="Perfume must already exist in Master Perfume database">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowPerfumeDropdown(true); }}
                  onFocus={() => setShowPerfumeDropdown(true)}
                  placeholder="Search by brand, name, or master ID... (or click to browse all)"
                  className="w-full h-10 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
              </div>
              {(search || showPerfumeDropdown) && !selectedPerfume && (
                <div className="border border-border rounded-md max-h-60 overflow-y-auto">
                  {filteredPerfumes.length > 0 ? filteredPerfumes.map(p => (
                    <button
                      key={p.master_id}
                      onClick={() => { setSelectedPerfume(p); setSearch(`${p.brand} — ${p.name}`); setShowPerfumeDropdown(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left border-b border-border last:border-0"
                    >
                      {p.bottle_image_url ? <img src={p.bottle_image_url} alt="" className="w-8 h-8 rounded object-cover bg-muted" /> : <div className="w-8 h-8 rounded bg-muted" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{p.brand} — {p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.master_id} · {p.concentration}</p>
                      </div>
                    </button>
                  )) : (
                    <div className="px-3 py-4 text-center">
                      <p className="text-sm text-muted-foreground">No perfume found in Master Data</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Please add the perfume in <strong>Master Data → Perfume Master</strong> first.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {selectedPerfume && (
                <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-md">
                  {selectedPerfume.bottle_image_url ? <img src={selectedPerfume.bottle_image_url} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-muted" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedPerfume.brand} — {selectedPerfume.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedPerfume.master_id}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedPerfume(null); setSearch(''); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </SectionCard>

          {selectedPerfume && (
            <>
              {/* Bottle Type Selection */}
              <SectionCard title="2. Bottle Type" subtitle="What type of bottle is this?">
                <div className="grid grid-cols-3 gap-3">
                  {BOTTLE_TYPES.map(bt => {
                    const Icon = bt.icon;
                    const isActive = form.bottle_type === bt.value;
                    return (
                      <button
                        key={bt.value}
                        type="button"
                        onClick={() => setForm({ ...form, bottle_type: bt.value })}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                          isActive
                            ? bt.color === 'emerald' ? 'border-emerald-500 bg-emerald-500/10'
                              : bt.color === 'blue' ? 'border-blue-500 bg-blue-500/10'
                              : 'border-purple-500 bg-purple-500/10'
                            : 'border-border hover:border-muted-foreground/30'
                        )}
                      >
                        <Icon className={cn('w-6 h-6',
                          isActive
                            ? bt.color === 'emerald' ? 'text-emerald-500'
                              : bt.color === 'blue' ? 'text-blue-500'
                              : 'text-purple-500'
                            : 'text-muted-foreground'
                        )} />
                        <p className={cn('text-sm font-semibold',
                          isActive
                            ? bt.color === 'emerald' ? 'text-emerald-500'
                              : bt.color === 'blue' ? 'text-blue-500'
                              : 'text-purple-500'
                            : 'text-foreground'
                        )}>{bt.label}</p>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              {/* Bottle Details */}
              <SectionCard title="3. Bottle Details">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier</label>
                    <select
                      value={form.supplier_id}
                      onChange={e => setForm({ ...form, supplier_id: e.target.value })}
                      className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1"
                    >
                      <option value="">Select supplier...</option>
                      {suppliers.map(s => (
                        <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Size (ml)</label>
                    <input
                      type="number"
                      value={form.size_ml}
                      onChange={e => setForm({ ...form, size_ml: e.target.value })}
                      placeholder="e.g. 100"
                      className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchase Price (AED)</label>
                    <input
                      type="number"
                      value={form.purchase_price}
                      onChange={e => setForm({ ...form, purchase_price: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manufacturer / Batch ID</label>
                    <input
                      type="text"
                      value={form.manufacturer_id}
                      onChange={e => setForm({ ...form, manufacturer_id: e.target.value })}
                      placeholder="Batch/lot number"
                      className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Allocation */}
              <SectionCard title="4. Allocation" subtitle="Where should this bottle go?">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, allocation: 'sealed' })}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      form.allocation === 'sealed'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-border hover:border-emerald-500/50'
                    )}
                  >
                    <Lock className={cn('w-6 h-6', form.allocation === 'sealed' ? 'text-emerald-500' : 'text-muted-foreground')} />
                    <div className="text-center">
                      <p className={cn('text-sm font-semibold', form.allocation === 'sealed' ? 'text-emerald-500' : 'text-foreground')}>
                        Sealed Inventory
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        For resale as full bottle or future decanting
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, allocation: 'decanting' })}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      form.allocation === 'decanting'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-border hover:border-blue-500/50'
                    )}
                  >
                    <FlaskConical className={cn('w-6 h-6', form.allocation === 'decanting' ? 'text-blue-500' : 'text-muted-foreground')} />
                    <div className="text-center">
                      <p className={cn('text-sm font-semibold', form.allocation === 'decanting' ? 'text-blue-500' : 'text-foreground')}>
                        Decanting Pool
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Open immediately and add to decanting liquid pool
                      </p>
                    </div>
                  </button>
                </div>
              </SectionCard>

              {/* Location */}
              <SectionCard title="5. Vault Location">
                {/* Auto-suggest next empty location per bottle type */}
                {(() => {
                  const emptyLocations = locations.filter(l => !l.occupied && !l.bottle_id);
                  const suggestedForSealed = emptyLocations.find(l => l.type === 'sealed' || l.zone?.toLowerCase().includes('sealed'));
                  const suggestedForOpen = emptyLocations.find(l => l.type === 'decant' || l.zone?.toLowerCase().includes('decant'));
                  const suggestedForTester = emptyLocations.find(l => l.zone?.toLowerCase().includes('tester') || l.type === 'staging');
                  const suggested = form.bottle_type === 'sealed' ? suggestedForSealed : form.bottle_type === 'tester' ? suggestedForTester : suggestedForOpen;
                  const fallback = emptyLocations[0];
                  const suggestion = suggested || fallback;
                  return suggestion ? (
                    <div className="mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <div>
                          <p className="text-xs font-medium text-amber-700">Suggested for <span className="font-bold uppercase">{form.bottle_type}</span> bottles:</p>
                          <p className="text-sm font-mono font-bold text-amber-800">{suggestion.location_id} — {suggestion.zone} / {suggestion.shelf}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, location_code: suggestion.location_id })}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                      >
                        <MapPin className="w-3 h-3 inline mr-1" />Accept
                      </button>
                    </div>
                  ) : null;
                })()}
                <select
                  value={form.location_code}
                  onChange={e => setForm({ ...form, location_code: e.target.value })}
                  className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md"
                >
                  <option value="">Select location...</option>
                  {locations.map(l => (
                    <option key={l.location_id} value={l.location_id}>
                      {l.location_id} — {l.zone} / {l.shelf}
                      {l.occupied ? ' (occupied)' : ' (empty)'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">Or type a custom location code:</p>
                <input
                  type="text"
                  value={form.location_code}
                  onChange={e => setForm({ ...form, location_code: e.target.value })}
                  placeholder="e.g. MAIN-A-1-01"
                  className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1"
                />
              </SectionCard>

              <Button onClick={addEntry} className="w-full gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground">
                <Plus className="w-4 h-4" /> Add Bottle to Batch
              </Button>
            </>
          )}
        </div>

        {/* Right: Batch List */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Intake Batch"
            subtitle={`${entries.length} bottle${entries.length !== 1 ? 's' : ''} pending · ${sealedCount} sealed · ${decantingCount} decanting`}
            headerActions={
              entries.length > 0 ? (
                <Button
                  size="sm"
                  onClick={finishIntake}
                  disabled={submitting}
                  className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                  {submitting ? 'Registering...' : 'Finish & Register'}
                </Button>
              ) : null
            }
          >
            {entries.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No bottles in batch"
                description="Select a perfume from the Master Data and fill in details to start building your intake batch."
              />
            ) : (
              <div className="space-y-2">
                {entries.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
                        e.allocation === 'sealed' ? 'bg-emerald-500/15' : 'bg-blue-500/15'
                      )}>
                        {e.allocation === 'sealed'
                          ? <Lock className="w-4 h-4 text-emerald-500" />
                          : <FlaskConical className="w-4 h-4 text-blue-500" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium">{e.perfume_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {e.size_ml}ml · AED {e.purchase_price} · {e.location_code || 'No location'}
                        </p>
                        <div className="flex gap-1 mt-0.5">
                          <span className={cn(
                            'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-block',
                            e.bottle_type === 'sealed' ? 'bg-emerald-500/15 text-emerald-500' :
                            e.bottle_type === 'tester' ? 'bg-purple-500/15 text-purple-500' :
                            'bg-blue-500/15 text-blue-500'
                          )}>
                            {e.bottle_type}
                          </span>
                          <span className={cn(
                            'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-block',
                            e.allocation === 'sealed'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-blue-500/15 text-blue-500'
                          )}>
                            → {e.allocation === 'sealed' ? 'Sealed' : 'Decanting'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeEntry(e.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Allocation Summary */}
          {entries.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                <Lock className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-lg font-bold font-mono">{sealedCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sealed Bottles</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  +{entries.filter(e => e.allocation === 'sealed').reduce((s, e) => s + e.size_ml, 0)}ml total
                </p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                <FlaskConical className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold font-mono">{decantingCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Decanting Pool</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  +{entries.filter(e => e.allocation === 'decanting').reduce((s, e) => s + e.size_ml, 0)}ml liquid
                </p>
              </div>
            </div>
          )}

          {/* Status Label */}
          {entries.length > 0 && (
            <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Intake Batch — Waiting to Confirm</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PACKAGING INTAKE FORM
// ============================================================
function PackagingIntakeForm({ skus, suppliers }: { skus: PackagingSKU[]; suppliers: Supplier[] }) {
  const [entries, setEntries] = useState<PackagingEntry[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSku, setSelectedSku] = useState<PackagingSKU | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [csvData, setCsvData] = useState<PackagingEntry[]>([]);
  const [csvParsing, setCsvParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    qty: '',
    supplier: '',
    price: '',
    notes: '',
  });

  const [showSkuDropdown, setShowSkuDropdown] = useState(false);
  const [showCsvReference, setShowCsvReference] = useState(false);

  const filteredSkus = useMemo(() => {
    if (!search) return skus.slice(0, 50);
    return skus.filter(s =>
      `${s.name} ${s.sku_id} ${s.type}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [skus, search]);

  const addEntry = () => {
    if (!selectedSku || !form.qty) {
      toast.error('Please select a packaging SKU and enter quantity');
      return;
    }
    const entry: PackagingEntry = {
      id: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sku_id: selectedSku.sku_id,
      sku_name: selectedSku.name,
      sku_type: selectedSku.type,
      qty: parseInt(form.qty) || 0,
      supplier: form.supplier,
      price: parseFloat(form.price) || 0,
      notes: form.notes,
    };
    setEntries([...entries, entry]);
    setSelectedSku(null);
    setSearch('');
    setForm({ qty: '', supplier: '', price: '', notes: '' });
    toast.success(`${entry.qty}× ${entry.sku_name} added to batch`);
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const finishIntake = async () => {
    if (entries.length === 0) return;
    setSubmitting(true);
    // In a real implementation, this would call the backend to update packaging inventory
    await new Promise(r => setTimeout(r, 800));
    toast.success(`${entries.length} packaging item${entries.length > 1 ? 's' : ''} registered (${entries.reduce((s, e) => s + e.qty, 0)} total units)`);
    setEntries([]);
    setSubmitting(false);
  };

  const downloadCsvTemplate = useCallback(() => {
    const headers = 'sku_id,quantity,supplier,price,notes\n';
    const example = 'PKG-ATM-001,50,Al Nahda Trading,2.50,Standard 5ml atomizers\nPKG-BOX-001,100,Emirates Packaging,1.20,Gift boxes\n';
    const blob = new Blob([headers + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'packaging_intake_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const parseCsvFile = useCallback((file: File) => {
    setCsvParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        toast.error('CSV file is empty or has no data rows');
        setCsvParsing(false);
        return;
      }
      const parsed: PackagingEntry[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 2) continue;
        const skuId = cols[0];
        const sku = skus.find(s => s.sku_id === skuId);
        if (!sku) {
          toast.error(`Row ${i + 1}: SKU "${skuId}" not found in master data`);
          continue;
        }
        parsed.push({
          id: `csv_pkg_${Date.now()}_${i}`,
          sku_id: skuId,
          sku_name: sku.name,
          sku_type: sku.type,
          qty: parseInt(cols[1]) || 0,
          supplier: cols[2] || '',
          price: parseFloat(cols[3]) || 0,
          notes: cols[4] || '',
        });
      }
      setCsvData(parsed);
      setCsvParsing(false);
      if (parsed.length > 0) {
        toast.success(`${parsed.length} packaging items parsed from CSV`);
      }
    };
    reader.readAsText(file);
  }, [skus]);

  const importCsvToEntries = () => {
    setEntries(prev => [...prev, ...csvData]);
    setCsvData([]);
    setShowCsvUpload(false);
    toast.success(`${csvData.length} packaging items added to intake batch`);
  };

  return (
    <div>
      {/* CSV Upload Toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={showCsvUpload ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowCsvUpload(!showCsvUpload)}
          className={cn('gap-1.5', showCsvUpload && 'bg-gold hover:bg-gold/90 text-gold-foreground')}
        >
          <Upload className="w-3.5 h-3.5" /> CSV Bulk Import
        </Button>
      </div>

      {/* CSV Upload Section */}
      {showCsvUpload && (
        <SectionCard title="Bulk CSV Import — Packaging" subtitle="Upload a CSV file to import multiple packaging items at once" className="mb-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Download Template
              </Button>
            </div>

            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file && file.name.endsWith('.csv')) parseCsvFile(file);
                else toast.error('Please upload a .csv file');
              }}
            >
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">Drag & drop your CSV file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) parseCsvFile(file);
                }}
              />
            </div>

            {csvParsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Parsing CSV...
              </div>
            )}

            {csvData.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{csvData.length} items parsed ({csvData.reduce((s, e) => s + e.qty, 0)} total units)</p>
                  <Button size="sm" onClick={importCsvToEntries} className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Import to Batch
                  </Button>
                </div>
                <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                  {csvData.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm border-b border-border last:border-0">
                      <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}</span>
                      <span className="font-medium flex-1 truncate">{e.sku_name}</span>
                      <span className="text-xs font-mono">×{e.qty}</span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-500">{e.sku_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  CSV format: <code className="font-mono bg-amber-500/10 px-1 rounded">sku_id, quantity, supplier, price, notes</code>.
                  SKU IDs must exist in Master Data → Packaging SKUs.
                </p>
              </div>
            </div>

            {/* Master Data Reference List */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCsvReference(!showCsvReference)}
                className="gap-1.5 mb-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {showCsvReference ? 'Hide' : 'Show'} Packaging SKU Reference List ({skus.length} SKUs)
              </Button>
              {showCsvReference && (
                <div className="border border-border rounded-md max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">SKU ID</th>
                        <th className="text-left px-3 py-2 font-semibold">Name</th>
                        <th className="text-left px-3 py-2 font-semibold">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skus.map(s => (
                        <tr key={s.sku_id} className="border-t border-border hover:bg-accent/50">
                          <td className="px-3 py-1.5 font-mono">{s.sku_id}</td>
                          <td className="px-3 py-1.5 font-medium">{s.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{s.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Manual Entry + Batch Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-3 space-y-4">
          <SectionCard title="1. Select Packaging SKU" subtitle="Search or scan packaging barcode">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowSkuDropdown(true); }}
                  onFocus={() => setShowSkuDropdown(true)}
                  placeholder="Search by name, SKU ID, or type... (or click to browse all)"
                  className="w-full h-10 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
              </div>
              {(search || showSkuDropdown) && !selectedSku && (
                <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                  {filteredSkus.length > 0 ? filteredSkus.map(s => (
                    <button
                      key={s.sku_id}
                      onClick={() => { setSelectedSku(s); setSearch(s.name); setShowSkuDropdown(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left border-b border-border last:border-0"
                    >
                      <Package className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.sku_id} · {s.type}</p>
                      </div>
                    </button>
                  )) : (
                    <div className="px-3 py-4 text-center">
                      <p className="text-sm text-muted-foreground">No packaging SKU found</p>
                    </div>
                  )}
                </div>
              )}
              {selectedSku && (
                <div className="flex items-center gap-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-md">
                  <Package className="w-5 h-5 text-purple-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedSku.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedSku.sku_id} · {selectedSku.type}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedSku(null); setSearch(''); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </SectionCard>

          {selectedSku && (
            <>
              <SectionCard title="2. Intake Details">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</label>
                    <input
                      type="number"
                      value={form.qty}
                      onChange={e => setForm({ ...form, qty: e.target.value })}
                      placeholder="0"
                      className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier</label>
                    <select
                      value={form.supplier}
                      onChange={e => setForm({ ...form, supplier: e.target.value })}
                      className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1"
                    >
                      <option value="">Select supplier...</option>
                      {suppliers.map(s => (
                        <option key={s.supplier_id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit Price (AED)</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={e => setForm({ ...form, price: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="Optional notes..."
                      className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md mt-1"
                    />
                  </div>
                </div>
              </SectionCard>

              <Button onClick={addEntry} className="w-full gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground">
                <Plus className="w-4 h-4" /> Add to Batch
              </Button>
            </>
          )}
        </div>

        {/* Right: Batch List */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Intake Batch"
            subtitle={`${entries.length} item${entries.length !== 1 ? 's' : ''} · ${entries.reduce((s, e) => s + e.qty, 0)} total units`}
            headerActions={
              entries.length > 0 ? (
                <Button
                  size="sm"
                  onClick={finishIntake}
                  disabled={submitting}
                  className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                  {submitting ? 'Registering...' : 'Register & Finish'}
                </Button>
              ) : null
            }
          >
            {entries.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No items in batch"
                description="Select a packaging SKU and fill in details to start building your intake batch."
              />
            ) : (
              <div className="space-y-2">
                {entries.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-purple-500/15">
                        <Package className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{e.sku_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          ×{e.qty} · {e.supplier || 'No supplier'} · AED {e.price}/unit
                        </p>
                        {e.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">{e.notes}</p>}
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-500 inline-block mt-0.5">
                          {e.sku_type}
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeEntry(e.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Status Label */}
          {entries.length > 0 && (
            <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Intake Batch — Waiting to Confirm</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RTS PRODUCT INTAKE FORM
// Log completed ready-to-ship products into inventory
// Same pattern as Bottle & Packaging intake: scan/select → verify → log
// ============================================================
interface RTSEntry {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  category: string;
  qty: number;
  batch_ref: string;
  serial_number: string;
  condition: 'new' | 'refurbished' | 'returned';
  notes: string;
  barcode: string;
}

function RTSProductIntakeForm() {
  const [entries, setEntries] = useState<RTSEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<typeof allEndProducts[0] | null>(null);
  const [qty, setQty] = useState(1);
  const [batchRef, setBatchRef] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [scanBarcode, setScanBarcode] = useState('');
  const [condition, setCondition] = useState<'new' | 'refurbished' | 'returned'>('new');
  const [notes, setNotes] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Producible categories that can be logged as RTS products
  const PRODUCIBLE_CATEGORIES: EndProductCategory[] = [
    'capsule_themed_set', 'capsule_house_chapter', 'capsule_layering_set', 'capsule_scent_story',
    'whisperer_set', 'gift_set_him', 'gift_set_her', 'gift_set_seasonal',
    'single_aurakey', 'aurakey_refills',
    'first_time_subscription', 'monthly_subscription',
    'one_time_decant', 'gift_subscription', 'corporate_subscription',
    'other',
  ];

  const producibleProducts = useMemo(() =>
    allEndProducts.filter(p => PRODUCIBLE_CATEGORIES.includes(p.category)),
  []);

  const filteredProducts = useMemo(() => {
    let result = producibleProducts;
    if (categoryFilter !== 'all') result = result.filter(p => p.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    }
    return result;
  }, [producibleProducts, categoryFilter, searchQuery]);

  const uniqueCategories = useMemo(() => {
    const cats = Array.from(new Set(producibleProducts.map(p => p.category)));
    return cats.sort();
  }, [producibleProducts]);

  const handleAddEntry = useCallback(() => {
    if (!selectedProduct) return;
    const entry: RTSEntry = {
      id: `rts-intake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product_id: selectedProduct.product_id,
      product_name: selectedProduct.name,
      product_sku: selectedProduct.sku,
      category: categoryConfig[selectedProduct.category]?.label || selectedProduct.category,
      qty,
      batch_ref: batchRef,
      serial_number: serialNumber || `SN-${selectedProduct.sku.split('/').pop()}-${Date.now().toString(36).toUpperCase()}`,
      condition,
      notes,
      barcode: scanBarcode || `EM/RTS/${selectedProduct.sku.split('/').pop()}-${Date.now().toString(36).toUpperCase()}`,
    };
    setEntries(prev => [entry, ...prev]);
    setSelectedProduct(null);
    setQty(1);
    setBatchRef('');
    setSerialNumber('');
    setScanBarcode('');
    setCondition('new');
    setNotes('');
    toast.success(`Added ${qty}× ${selectedProduct.name} to intake batch`);
  }, [selectedProduct, qty, batchRef, serialNumber, scanBarcode, condition, notes]);

  const handleRemoveEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleConfirmAll = useCallback(() => {
    if (entries.length === 0) return;
    const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
    toast.success(`${entries.length} RTS product entries (${totalQty} units) logged to inventory`);
    setEntries([]);
  }, [entries]);

  const totalUnits = entries.reduce((sum, e) => sum + e.qty, 0);

  return (
    <div className="space-y-6">
      {/* Product Selection */}
      <SectionCard title="Select Product" subtitle="Search and select a ready-to-ship product to log into inventory">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by product name or SKU..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-52 h-9"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{categoryConfig[cat as EndProductCategory]?.label || cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">No products found</div>
            ) : filteredProducts.map(product => {
              const cat = categoryConfig[product.category];
              const CatIcon = cat?.icon || Package;
              const isSelected = selectedProduct?.product_id === product.product_id;
              return (
                <Card
                  key={product.product_id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    isSelected ? 'ring-2 ring-gold border-gold/40 bg-gold/5' : 'border-border/60'
                  )}
                  onClick={() => setSelectedProduct(product)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      isSelected ? 'bg-gold/20' : 'bg-muted/80'
                    )}>
                      <CatIcon className={cn('w-4.5 h-4.5', cat?.color || 'text-muted-foreground')} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold truncate">{product.name}</h4>
                      <p className="text-[11px] text-muted-foreground">{cat?.label} · {product.sku}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-gold shrink-0" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* Entry Details */}
      {selectedProduct && (
        <SectionCard title="Entry Details" subtitle={`Logging: ${selectedProduct.name}`}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Batch Reference</label>
              <input
                type="text"
                placeholder="e.g. RTS-B001"
                value={batchRef}
                onChange={e => setBatchRef(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Serial Number</label>
              <input
                type="text"
                placeholder="Auto-generated if empty"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Barcode className="w-3 h-3" /> Scan Barcode <span className="text-[10px] text-muted-foreground/60">(optional)</span></label>
              <input
                ref={barcodeRef}
                type="text"
                placeholder="Scan or type barcode..."
                value={scanBarcode}
                onChange={e => setScanBarcode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Condition</label>
              <Select value={condition} onValueChange={v => setCondition(v as 'new' | 'refurbished' | 'returned')}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New (Production)</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                  <SelectItem value="returned">Returned / Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
              <input
                type="text"
                placeholder="Any notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleAddEntry}
              className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add to Intake Batch
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Intake Batch Ledger */}
      <SectionCard
        title={`Intake Batch (${entries.length} entries · ${totalUnits} units)`}
        subtitle="Review entries before confirming intake to inventory"
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No entries yet"
            description="Select a product above and add it to the intake batch."
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left py-2 px-3 font-medium">Product</th>
                    <th className="text-left py-2 px-3 font-medium">SKU</th>
                    <th className="text-left py-2 px-3 font-medium">Category</th>
                    <th className="text-center py-2 px-3 font-medium">Qty</th>
                    <th className="text-left py-2 px-3 font-medium">Condition</th>
                    <th className="text-left py-2 px-3 font-medium">Batch Ref</th>
                    <th className="text-left py-2 px-3 font-medium">Serial #</th>
                    <th className="text-left py-2 px-3 font-medium">Barcode</th>
                    <th className="text-right py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{entry.product_name}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{entry.product_sku}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px]">{entry.category}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">{entry.qty}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className={cn(
                          'text-[10px]',
                          entry.condition === 'new' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          entry.condition === 'returned' ? 'bg-red-100 text-red-700 border-red-200' :
                          'bg-amber-100 text-amber-700 border-amber-200'
                        )}>
                          {entry.condition === 'new' ? 'New' : entry.condition === 'returned' ? 'Returned' : 'Refurbished'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{entry.batch_ref || '—'}</td>
                      <td className="py-2.5 px-3">
                        <code className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-mono">{entry.serial_number}</code>
                      </td>
                      <td className="py-2.5 px-3">
                        <code className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded font-mono">{entry.barcode}</code>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveEntry(entry.id)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Confirm Batch */}
            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{entries.length}</span> entries · <span className="font-semibold text-foreground">{totalUnits}</span> total units
              </div>
              <Button
                onClick={handleConfirmAll}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm Intake to Inventory
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Status Label */}
      {entries.length > 0 && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">RTS Intake Batch — Waiting to Confirm</p>
        </div>
      )}
    </div>
  );
}
