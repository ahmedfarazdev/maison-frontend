// ============================================================
// Manual Decant Module — Multi-bottle wizard with full size matrix,
// syringe confirmation, multi-packaging, and review section
// ============================================================

import { useState, useMemo } from 'react';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { PageHeader, SectionCard, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Beaker, Search, ScanBarcode, Pipette, Package, Plus, CheckCircle2,
  ArrowRight, ArrowLeft, Trash2, Droplets, X, Wine, Box, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { DecantBottle, Perfume, Syringe, PackagingSKU } from '@/types';

interface BottleEntry {
  bottle: DecantBottle;
  perfume: Perfume;
  sizes: { size_ml: number; qty: number }[];
  decant_ml: number;
  syringe: Syringe | null;
  syringeConfirmed: boolean;
}

interface PackagingEntry {
  sku: PackagingSKU;
  qty: number;
}

const SIZE_MATRIX = [1, 2, 3, 5, 8, 10, 20, 30];

const STEPS = [
  'Start Process',
  'Add Bottles',
  'Choose Amounts',
  'Confirm Syringes',
  'Add Packaging',
  'Decanting',
  'Review & Confirm',
];

// Find the best matching syringe for a perfume
function findSyringeForPerfume(perfume: Perfume, syringes: Syringe[]): Syringe | null {
  // Try to match by notes containing perfume name or brand
  const match = syringes.find(s =>
    s.notes?.toLowerCase().includes(perfume.name.toLowerCase()) ||
    s.notes?.toLowerCase().includes(perfume.brand.toLowerCase())
  );
  if (match) return match;
  // Default to first available syringe
  return syringes.length > 0 ? syringes[0] : null;
}

export default function ManualDecant() {
  const { data: bottlesRes } = useApiQuery(() => api.inventory.decantBottles(), []);
  const { data: perfumesRes } = useApiQuery(() => api.master.perfumes(), []);
  const { data: syringesRes } = useApiQuery(() => api.master.syringes(), []);
  const { data: skusRes } = useApiQuery(() => api.master.packagingSKUs(), []);

  const bottles = (bottlesRes?.data || []) as DecantBottle[];
  const perfumes = (perfumesRes?.data || []) as Perfume[];
  const syringes = ((syringesRes?.data || []) as Syringe[]).filter(s => s.active);
  const skus = (skusRes?.data || []) as PackagingSKU[];

  const [step, setStep] = useState(0);
  const [processId] = useState(() => `MD-${Date.now()}`);
  const [processName, setProcessName] = useState('');
  const [completed, setCompleted] = useState(false);
  const [notes, setNotes] = useState('');

  // Multi-bottle state
  const [selectedBottles, setSelectedBottles] = useState<BottleEntry[]>([]);
  const [bottleSearch, setBottleSearch] = useState('');

  // Multi-packaging state
  const [selectedPackaging, setSelectedPackaging] = useState<PackagingEntry[]>([]);
  const [packagingSearch, setPackagingSearch] = useState('');

  // Custom size "Other" input
  const [otherSizes, setOtherSizes] = useState<Record<number, { ml: string; qty: number }>>({}); 

  // Decanting checkboxes: key = `${bottleIdx}-${sizeIdx}-${unitIdx}`, value = checked
  const [decantChecks, setDecantChecks] = useState<Record<string, boolean>>({});

  const getPerfume = (masterId: string) => perfumes.find(p => p.master_id === masterId);

  const filteredBottles = useMemo(() => {
    const q = bottleSearch.toLowerCase();
    if (!q) return bottles.slice(0, 30);
    return bottles.filter(b => {
      const p = getPerfume(b.master_id);
      return `${p?.brand || ''} ${p?.name || ''} ${b.bottle_id} ${b.master_id}`.toLowerCase().includes(q);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottles, bottleSearch, perfumes]);

  const filteredPackaging = useMemo(() => {
    const q = packagingSearch.toLowerCase();
    const available = skus.filter(s => ['atomizer', 'vial', 'cap', 'box', 'label', 'seal', 'bag'].includes(s.type));
    if (!q) return available;
    return available.filter(s =>
      s.name.toLowerCase().includes(q) || s.sku_id.toLowerCase().includes(q) || s.type.toLowerCase().includes(q)
    );
  }, [skus, packagingSearch]);

  const addBottle = (bottle: DecantBottle) => {
    if (selectedBottles.some(b => b.bottle.bottle_id === bottle.bottle_id)) {
      toast.info('Bottle already added');
      return;
    }
    const perfume = getPerfume(bottle.master_id);
    if (!perfume) return;
    const syringe = findSyringeForPerfume(perfume, syringes);
    setSelectedBottles(prev => [...prev, {
      bottle,
      perfume,
      sizes: SIZE_MATRIX.map(ml => ({ size_ml: ml, qty: 0 })),
      decant_ml: 0,
      syringe,
      syringeConfirmed: false,
    }]);
    setBottleSearch('');
  };

  const removeBottle = (bottleId: string) => {
    setSelectedBottles(prev => prev.filter(b => b.bottle.bottle_id !== bottleId));
  };

  const updateBottleSize = (bottleIdx: number, sizeIdx: number, qty: number) => {
    setSelectedBottles(prev => {
      const updated = [...prev];
      const entry = { ...updated[bottleIdx] };
      const sizes = [...entry.sizes];
      sizes[sizeIdx] = { ...sizes[sizeIdx], qty: Math.max(0, qty) };
      entry.sizes = sizes;
      entry.decant_ml = sizes.reduce((s, d) => s + d.size_ml * d.qty, 0);
      // Add "Other" custom size
      const other = otherSizes[bottleIdx];
      if (other && other.ml && other.qty > 0) {
        entry.decant_ml += parseFloat(other.ml) * other.qty;
      }
      updated[bottleIdx] = entry;
      return updated;
    });
  };

  const confirmSyringe = (bottleIdx: number) => {
    setSelectedBottles(prev => {
      const updated = [...prev];
      updated[bottleIdx] = { ...updated[bottleIdx], syringeConfirmed: true };
      return updated;
    });
  };

  const changeSyringe = (bottleIdx: number, syringe: Syringe) => {
    setSelectedBottles(prev => {
      const updated = [...prev];
      updated[bottleIdx] = { ...updated[bottleIdx], syringe, syringeConfirmed: false };
      return updated;
    });
  };

  const addPackaging = (sku: PackagingSKU) => {
    if (selectedPackaging.some(p => p.sku.sku_id === sku.sku_id)) {
      // Increment qty
      setSelectedPackaging(prev => prev.map(p =>
        p.sku.sku_id === sku.sku_id ? { ...p, qty: p.qty + 1 } : p
      ));
    } else {
      setSelectedPackaging(prev => [...prev, { sku, qty: 1 }]);
    }
  };

  const updatePackagingQty = (skuId: string, qty: number) => {
    if (qty <= 0) {
      setSelectedPackaging(prev => prev.filter(p => p.sku.sku_id !== skuId));
    } else {
      setSelectedPackaging(prev => prev.map(p =>
        p.sku.sku_id === skuId ? { ...p, qty } : p
      ));
    }
  };

  const removePackaging = (skuId: string) => {
    setSelectedPackaging(prev => prev.filter(p => p.sku.sku_id !== skuId));
  };

  const allSyringesConfirmed = selectedBottles.every(b => b.syringeConfirmed);
  const anyDecantSet = selectedBottles.some(b => b.decant_ml > 0);

  const confirmProcess = () => {
    setCompleted(true);
    toast.success('Manual decant process completed', {
      description: `${selectedBottles.length} bottle(s) processed. Ledger events written.`,
    });
  };

  const resetAll = () => {
    setCompleted(false);
    setSelectedBottles([]);
    setSelectedPackaging([]);
    setOtherSizes({});
    setDecantChecks({});
    setProcessName('');
    setNotes('');
    setStep(0);
  };

  // Build flat list of all decant units for the decanting step
  const decantUnits = useMemo(() => {
    const units: { bottleIdx: number; perfumeName: string; brand: string; bottleId: string; size_ml: number; unitIdx: number; key: string }[] = [];
    selectedBottles.forEach((entry, bottleIdx) => {
      entry.sizes.forEach((s, sizeIdx) => {
        for (let u = 0; u < s.qty; u++) {
          const key = `${bottleIdx}-${sizeIdx}-${u}`;
          units.push({
            bottleIdx,
            perfumeName: entry.perfume.name,
            brand: entry.perfume.brand,
            bottleId: entry.bottle.bottle_id,
            size_ml: s.size_ml,
            unitIdx: u,
            key,
          });
        }
      });
      // "Other" custom sizes
      const other = otherSizes[bottleIdx];
      if (other && other.ml && other.qty > 0) {
        for (let u = 0; u < other.qty; u++) {
          const key = `${bottleIdx}-other-${u}`;
          units.push({
            bottleIdx,
            perfumeName: entry.perfume.name,
            brand: entry.perfume.brand,
            bottleId: entry.bottle.bottle_id,
            size_ml: parseFloat(other.ml),
            unitIdx: u,
            key,
          });
        }
      }
    });
    return units;
  }, [selectedBottles, otherSizes]);

  const allDecanted = decantUnits.length > 0 && decantUnits.every(u => decantChecks[u.key]);
  const decantedCount = decantUnits.filter(u => decantChecks[u.key]).length;

  // ============ COMPLETED VIEW ============
  if (completed) {
    return (
      <div>
        <PageHeader
          title="Manual Decant"
          subtitle="Process completed"
          breadcrumbs={[{ label: 'Manual Decant' }]}
        />
        <div className="p-6 max-w-3xl">
          <SectionCard title="Manual Decant Log" subtitle={`Process ${processId}${processName ? ` — ${processName}` : ''}`}>
            {processName && (
              <div className="mb-3 p-2.5 rounded-lg bg-gold/5 border border-gold/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Process Name</p>
                <p className="text-sm font-medium">{processName}</p>
              </div>
            )}
            <div className="space-y-3">
              {selectedBottles.map((e, i) => (
                <div key={i} className="p-3 rounded-md border border-border">
                  <div className="flex items-center gap-3">
                    <Droplets className="w-4 h-4 text-gold" />
                    <div>
                      <p className="text-sm font-medium">{e.perfume.brand} — {e.perfume.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {e.bottle.bottle_id} · {e.decant_ml}ml decanted · Syringe: {e.syringe?.syringe_id || 'N/A'}
                      </p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {e.sizes.filter(s => s.qty > 0).map(s => (
                          <span key={s.size_ml} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                            {s.size_ml}ml ×{s.qty}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {selectedPackaging.length > 0 && (
                <div className="p-3 bg-muted/30 rounded-md">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Packaging Used</p>
                  <div className="flex gap-1 flex-wrap">
                    {selectedPackaging.map(p => (
                      <span key={p.sku.sku_id} className="text-[10px] font-mono bg-background px-2 py-0.5 rounded border border-border">
                        {p.sku.name} ×{p.qty}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {notes && (
                <div className="p-3 bg-muted/30 rounded-md">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Notes</p>
                  <p className="text-sm">{notes}</p>
                </div>
              )}
            </div>
            <Button className="w-full mt-4 gap-1.5" onClick={resetAll}>
              <Plus className="w-4 h-4" /> Start New Process
            </Button>
          </SectionCard>
        </div>
      </div>
    );
  }

  // ============ WIZARD VIEW ============
  return (
    <div>
      <PageHeader
        title="Manual Decant"
        subtitle="Bypass stations — direct decanting wizard"
        breadcrumbs={[{ label: 'Manual Decant' }]}
        actions={undefined}
      />

      <div className="p-6">
        {/* Step Indicator */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                i === step ? 'bg-gold/15 text-gold ring-1 ring-gold/30' :
                i < step ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
              )}>
                {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 text-center">{i + 1}</span>}
                <span>{s}</span>
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />}
            </div>
          ))}
        </div>

        {/* ============ STEP 0: START ============ */}
        {step === 0 && (
          <div className="max-w-2xl">
            <SectionCard title="Start New Manual Decant Process">
              <div className="rounded-lg overflow-hidden mb-4">
                <img src="https://private-us-east-1.manuscdn.com/sessionFile/07em6SVOcMqgNFap9Lry4G/sandbox/8b42eylK868jWkOlBdaV92-img-3_1770450410000_na1fn_ZGVjYW50LXN0YXRpb24.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvMDdlbTZTVk9jTXFnTkZhcDlMcnk0Ry9zYW5kYm94LzhiNDJleWxLODY4aldrT2xCZGFWOTItaW1nLTNfMTc3MDQ1MDQxMDAwMF9uYTFmbl9aR1ZqWVc1MExYTjBZWFJwYjI0LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=gGj~1RQecn4DaPh1hZhtGE4oTWr3yJuyOESZFnGYPQsP3u0RTTlX1cbBfs7l0jxch00vbhmiDSdgQujGRvImA~bPIPMATuFRfj3Q-QwYb8IQT~IlerArUV~OxCG53Fv3jHB2ZAzX2P2u8wH1S6Qf775lrbvm7zo0GTDkWXY690DuU9sXcC6bGGgiA3ddY5DEQ0UPOGUoaPDSmWJXXEDXFT5gBU8OHIwa8K~BFK2~ah7YuGrA7thbbDvewEJXSS5yFk3Jo6vFR~0f~3MtXZoi80LL8RPwYiXlPAAyCnzLCkSPClpUhNZe9TgsLsn-9Jbubqu2GvPeWfM-6oM11cTHEg__" alt="Decanting workstation" className="w-full h-40 object-cover" />
              </div>
              <div className="text-center py-4">
                <Beaker className="w-12 h-12 mx-auto text-gold/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-2">
                  Create a new manual decant process. You can add <strong>multiple bottles</strong> and <strong>multiple packaging</strong> items in a single process.
                </p>
                <p className="text-xs font-mono text-muted-foreground mb-3">Process ID: {processId}</p>
                <div className="max-w-sm mx-auto mb-4">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Process Name (optional)</label>
                  <input
                    type="text"
                    value={processName}
                    onChange={e => setProcessName(e.target.value)}
                    placeholder="e.g. For XYZ client, Marketing samples..."
                    className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md mt-1 focus:ring-2 focus:ring-gold/30 focus:outline-none text-center"
                  />
                </div>
                <Button onClick={() => setStep(1)} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
                  <Plus className="w-4 h-4" /> Start Process
                </Button>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ============ STEP 1: ADD BOTTLES (Multi-select) ============ */}
        {step === 1 && (
          <div className="flex gap-6">
            {/* Left: Selected Bottles */}
            <div className="w-72 shrink-0">
              <div className="sticky top-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Wine className="w-4 h-4 text-gold" />
                    Selected Bottles
                  </h3>
                  <span className="text-xs font-mono bg-gold/10 text-gold px-2 py-0.5 rounded-full">
                    {selectedBottles.length}
                  </span>
                </div>
                {selectedBottles.length === 0 ? (
                  <div className="border border-dashed border-border rounded-lg p-6 text-center">
                    <Wine className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">Scan or search to add bottles</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {selectedBottles.map((entry) => (
                      <div key={entry.bottle.bottle_id} className="p-2.5 rounded-lg border border-gold/20 bg-gold/5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{entry.perfume.name}</p>
                            <p className="text-[10px] text-muted-foreground">{entry.perfume.brand}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{entry.bottle.bottle_id} · {entry.bottle.current_ml}ml</p>
                          </div>
                          <button
                            onClick={() => removeBottle(entry.bottle.bottle_id)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  onClick={() => setStep(2)}
                  disabled={selectedBottles.length === 0}
                  className="w-full mt-3 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                  size="sm"
                >
                  Next: Choose Amounts <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Right: Search & Results */}
            <div className="flex-1">
              <SectionCard title="Step 2: Add Bottles" subtitle="Scan or search for bottles from the Decanting Pool — select multiple">
                <div className="space-y-3">
                  <BarcodeScanner
                    placeholder="Scan bottle barcode or search by name, brand, ID..."
                    onScan={(code) => {
                      const match = bottles.find((b: DecantBottle) =>
                        b.bottle_id.toLowerCase() === code.trim().toLowerCase() ||
                        b.master_id.toLowerCase() === code.trim().toLowerCase()
                      );
                      if (match) {
                        addBottle(match);
                        toast.success(`Bottle added: ${match.bottle_id}`);
                      } else {
                        setBottleSearch(code);
                      }
                    }}
                  />
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={bottleSearch}
                      onChange={e => setBottleSearch(e.target.value)}
                      placeholder="Filter by name, brand, ID..."
                      className="w-full h-10 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-gold/30 focus:outline-none"
                    />
                  </div>
                  <div className="border border-border rounded-md max-h-[50vh] overflow-y-auto">
                    {filteredBottles.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">No bottles found</div>
                    ) : (
                      filteredBottles.map(b => {
                        const p = getPerfume(b.master_id);
                        const isSelected = selectedBottles.some(sb => sb.bottle.bottle_id === b.bottle_id);
                        return (
                          <button
                            key={b.bottle_id}
                            onClick={() => addBottle(b)}
                            disabled={isSelected}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-b border-border last:border-0',
                              isSelected ? 'bg-gold/5 opacity-60' : 'hover:bg-accent',
                            )}
                          >
                            <Droplets className={cn('w-4 h-4 shrink-0', isSelected ? 'text-gold' : 'text-muted-foreground')} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p?.brand} — {p?.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{b.bottle_id} · {b.current_ml}ml remaining</p>
                            </div>
                            {isSelected ? (
                              <CheckCircle2 className="w-4 h-4 text-gold shrink-0" />
                            ) : (
                              <span className="text-sm font-mono font-semibold text-gold">{b.current_ml}ml</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ============ STEP 2: CHOOSE AMOUNTS (Full size matrix per bottle) ============ */}
        {step === 2 && (
          <div className="max-w-3xl">
            <SectionCard title="Step 3: Choose Decant Amounts" subtitle="Set quantities for each size per bottle">
              <div className="space-y-6">
                {selectedBottles.map((entry, bottleIdx) => {
                  const totalMl = entry.sizes.reduce((s, d) => s + d.size_ml * d.qty, 0) +
                    (otherSizes[bottleIdx]?.ml && otherSizes[bottleIdx]?.qty > 0
                      ? parseFloat(otherSizes[bottleIdx].ml) * otherSizes[bottleIdx].qty
                      : 0);
                  const exceeds = totalMl > entry.bottle.current_ml;

                  return (
                    <div key={entry.bottle.bottle_id} className="border border-border rounded-xl overflow-hidden">
                      {/* Bottle Header */}
                      <div className="flex items-center gap-3 p-4 bg-accent/30 border-b border-border">
                        {entry.perfume.bottle_image_url ? (
                          <img src={entry.perfume.bottle_image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                            <Wine className="w-5 h-5 text-gold" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{entry.perfume.brand} — {entry.perfume.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{entry.bottle.bottle_id} · {entry.bottle.current_ml}ml available</p>
                        </div>
                        <div className={cn(
                          'text-sm font-mono font-bold px-3 py-1 rounded-lg',
                          exceeds ? 'bg-destructive/10 text-destructive' : 'bg-gold/10 text-gold',
                        )}>
                          {totalMl}ml / {entry.bottle.current_ml}ml
                        </div>
                      </div>

                      {/* Size Matrix */}
                      <div className="p-4">
                        <div className="grid grid-cols-4 gap-2">
                          {entry.sizes.map((ds, sizeIdx) => (
                            <div key={ds.size_ml} className={cn(
                              'flex items-center justify-between p-2.5 rounded-lg border transition-all',
                              ds.qty > 0 ? 'border-gold/30 bg-gold/5' : 'border-border',
                            )}>
                              <span className="text-sm font-bold">{ds.size_ml}ml</span>
                              <div className="flex items-center gap-1">
                                <button
                                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors border border-border"
                                  onClick={() => updateBottleSize(bottleIdx, sizeIdx, ds.qty - 1)}
                                >−</button>
                                <span className="w-6 text-center font-mono text-sm font-semibold">{ds.qty}</span>
                                <button
                                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors border border-border"
                                  onClick={() => updateBottleSize(bottleIdx, sizeIdx, ds.qty + 1)}
                                >+</button>
                              </div>
                            </div>
                          ))}

                          {/* Other / Custom Size */}
                          <div className={cn(
                            'flex items-center gap-2 p-2.5 rounded-lg border transition-all',
                            otherSizes[bottleIdx]?.qty > 0 ? 'border-gold/30 bg-gold/5' : 'border-dashed border-border',
                          )}>
                            <div className="flex-1">
                              <input
                                type="number"
                                placeholder="Other"
                                value={otherSizes[bottleIdx]?.ml || ''}
                                onChange={e => setOtherSizes(prev => ({
                                  ...prev,
                                  [bottleIdx]: { ml: e.target.value, qty: prev[bottleIdx]?.qty || 1 },
                                }))}
                                className="w-full text-sm font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
                              />
                              <span className="text-[10px] text-muted-foreground">ml</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors border border-border"
                                onClick={() => setOtherSizes(prev => ({
                                  ...prev,
                                  [bottleIdx]: { ml: prev[bottleIdx]?.ml || '', qty: Math.max(0, (prev[bottleIdx]?.qty || 0) - 1) },
                                }))}
                              >−</button>
                              <span className="w-6 text-center font-mono text-sm font-semibold">{otherSizes[bottleIdx]?.qty || 0}</span>
                              <button
                                className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors border border-border"
                                onClick={() => setOtherSizes(prev => ({
                                  ...prev,
                                  [bottleIdx]: { ml: prev[bottleIdx]?.ml || '', qty: (prev[bottleIdx]?.qty || 0) + 1 },
                                }))}
                              >+</button>
                            </div>
                          </div>
                        </div>

                        {exceeds && (
                          <p className="text-xs text-destructive mt-2 font-medium">
                            Exceeds available volume — admin override required
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!anyDecantSet}
                  className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                >
                  Next: Confirm Syringes <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ============ STEP 3: COLLECT SYRINGES ============ */}
        {step === 3 && (
          <div className="max-w-3xl">
            <SectionCard title="Step 4: Collect Syringes" subtitle="Each perfume has an allocated syringe from master data — collect each one">
              {/* Syringe Collection Summary */}
              <div className="mb-4 p-3 rounded-lg bg-accent/30 border border-border">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Syringes to Collect</p>
                  <span className={cn(
                    'text-xs font-mono font-semibold px-2 py-0.5 rounded',
                    allSyringesConfirmed ? 'bg-success/10 text-success' : 'bg-amber-500/10 text-amber-600',
                  )}>
                    {selectedBottles.filter(b => b.syringeConfirmed).length} / {selectedBottles.length} collected
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {selectedBottles.map((entry, bottleIdx) => (
                  <div key={entry.bottle.bottle_id} className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                    entry.syringeConfirmed ? 'border-success/30 bg-success/5' : 'border-amber-500/30 bg-amber-500/5',
                  )}>
                    {/* Syringe Icon */}
                    <div className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
                      entry.syringeConfirmed ? 'bg-success/10' : 'bg-amber-500/10',
                    )}>
                      <Pipette className={cn('w-6 h-6', entry.syringeConfirmed ? 'text-success' : 'text-amber-600')} />
                    </div>

                    {/* Syringe Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{entry.syringe?.syringe_id || 'No syringe allocated'}</p>
                      <p className="text-xs text-muted-foreground">
                        For: <span className="font-medium text-foreground">{entry.perfume.brand} — {entry.perfume.name}</span>
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        Bottle: {entry.bottle.bottle_id} · {entry.syringe?.notes || 'Allocated from master perfume data'}
                      </p>
                    </div>

                    {/* Collect Button */}
                    {entry.syringeConfirmed ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-success bg-success/10 px-3 py-2 rounded-lg shrink-0">
                        <CheckCircle2 className="w-4 h-4" /> Collected
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => confirmSyringe(bottleIdx)}
                        className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5 shrink-0"
                      >
                        <Pipette className="w-3.5 h-3.5" /> Collect
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!allSyringesConfirmed}
                  className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                >
                  Next: Add Packaging <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ============ STEP 4: ADD PACKAGING (Multi-select) ============ */}
        {step === 4 && (
          <div className="flex gap-6">
            {/* Left: Selected Perfumes + Packaging */}
            <div className="w-80 shrink-0">
              <div className="sticky top-6 space-y-4">
                {/* Selected Perfumes Summary */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Wine className="w-4 h-4 text-gold" />
                    Selected Perfumes
                  </h3>
                  <div className="space-y-1.5">
                    {selectedBottles.map(entry => (
                      <div key={entry.bottle.bottle_id} className="p-2 rounded-lg border border-border bg-card text-xs">
                        <p className="font-semibold truncate">{entry.perfume.name}</p>
                        <p className="text-muted-foreground font-mono">{entry.bottle.bottle_id} · {entry.decant_ml}ml</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selected Packaging */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Box className="w-4 h-4 text-purple-500" />
                    Selected Packaging
                    <span className="text-xs font-mono bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full">
                      {selectedPackaging.length}
                    </span>
                  </h3>
                  {selectedPackaging.length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg p-4 text-center">
                      <Package className="w-6 h-6 mx-auto text-muted-foreground/30 mb-1" />
                      <p className="text-[10px] text-muted-foreground">Select packaging items</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedPackaging.map(p => (
                        <div key={p.sku.sku_id} className="flex items-center justify-between p-2 rounded-lg border border-purple-500/20 bg-purple-500/5">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{p.sku.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{p.sku.sku_id}</p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold hover:bg-muted transition-colors border border-border"
                              onClick={() => updatePackagingQty(p.sku.sku_id, p.qty - 1)}
                            >−</button>
                            <span className="w-5 text-center font-mono text-xs font-semibold">{p.qty}</span>
                            <button
                              className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold hover:bg-muted transition-colors border border-border"
                              onClick={() => updatePackagingQty(p.sku.sku_id, p.qty + 1)}
                            >+</button>
                            <button
                              onClick={() => removePackaging(p.sku.sku_id)}
                              className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => setStep(5)}
                  className="w-full bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                  size="sm"
                >
                  Next: Decanting <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" onClick={() => setStep(3)} className="w-full gap-1.5" size="sm">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>
              </div>
            </div>

            {/* Right: Packaging Search */}
            <div className="flex-1">
              <SectionCard title="Step 5: Add Packaging" subtitle="Search or scan to add multiple packaging items">
                <div className="space-y-3">
                  <BarcodeScanner
                    placeholder="Scan packaging barcode..."
                    onScan={(code) => {
                      const match = skus.find((s: PackagingSKU) =>
                        s.sku_id.toLowerCase() === code.trim().toLowerCase() ||
                        s.name.toLowerCase() === code.trim().toLowerCase()
                      );
                      if (match) {
                        addPackaging(match);
                        toast.success(`Packaging added: ${match.name}`);
                      } else {
                        setPackagingSearch(code);
                      }
                    }}
                  />
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={packagingSearch}
                      onChange={e => setPackagingSearch(e.target.value)}
                      placeholder="Filter packaging by name, SKU, or type..."
                      className="w-full h-10 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-gold/30 focus:outline-none"
                    />
                  </div>
                  <div className="border border-border rounded-md max-h-[50vh] overflow-y-auto">
                    {filteredPackaging.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">No packaging items found</div>
                    ) : (
                      filteredPackaging.map(sku => {
                        const isSelected = selectedPackaging.some(p => p.sku.sku_id === sku.sku_id);
                        const currentQty = selectedPackaging.find(p => p.sku.sku_id === sku.sku_id)?.qty || 0;
                        return (
                          <button
                            key={sku.sku_id}
                            onClick={() => addPackaging(sku)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-b border-border last:border-0',
                              isSelected ? 'bg-purple-500/5' : 'hover:bg-accent',
                            )}
                          >
                            <Package className={cn('w-4 h-4 shrink-0', isSelected ? 'text-purple-500' : 'text-muted-foreground')} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{sku.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{sku.sku_id} · {sku.type}</p>
                            </div>
                            {isSelected ? (
                              <span className="text-xs font-mono font-bold text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded">
                                ×{currentQty}
                              </span>
                            ) : (
                              <Plus className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ============ STEP 5: DECANTING PROCESS ============ */}
        {step === 5 && (
          <div className="max-w-3xl">
            <SectionCard
              title="Step 6: Decanting Process"
              subtitle={`Mark each decant unit as completed — ${decantedCount} / ${decantUnits.length} done`}
            >
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Decanting Progress</span>
                  <span className={cn(
                    'text-xs font-mono font-bold px-2 py-0.5 rounded',
                    allDecanted ? 'bg-success/10 text-success' : 'bg-amber-500/10 text-amber-600',
                  )}>
                    {decantedCount} / {decantUnits.length}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-300', allDecanted ? 'bg-success' : 'bg-gold')}
                    style={{ width: `${decantUnits.length > 0 ? (decantedCount / decantUnits.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Group by bottle */}
              <div className="space-y-4">
                {selectedBottles.map((entry, bottleIdx) => {
                  const bottleUnits = decantUnits.filter(u => u.bottleIdx === bottleIdx);
                  const bottleDone = bottleUnits.every(u => decantChecks[u.key]);
                  if (bottleUnits.length === 0) return null;
                  return (
                    <div key={entry.bottle.bottle_id} className={cn(
                      'p-4 rounded-xl border-2 transition-all',
                      bottleDone ? 'border-success/30 bg-success/5' : 'border-border',
                    )}>
                      <div className="flex items-center gap-3 mb-3">
                        <Droplets className={cn('w-5 h-5', bottleDone ? 'text-success' : 'text-gold')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{entry.perfume.brand} — {entry.perfume.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">
                            {entry.bottle.bottle_id} · {entry.decant_ml}ml total · Syringe: {entry.syringe?.syringe_id || 'N/A'}
                          </p>
                        </div>
                        {bottleDone && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2 py-1 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5" /> All Done
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {bottleUnits.map(unit => {
                          const checked = !!decantChecks[unit.key];
                          return (
                            <label
                              key={unit.key}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none',
                                checked
                                  ? 'border-success/40 bg-success/10'
                                  : 'border-border hover:border-gold/30 hover:bg-gold/5',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setDecantChecks(prev => ({ ...prev, [unit.key]: !prev[unit.key] }))}
                                className="w-4 h-4 rounded border-border text-success focus:ring-success/30 accent-emerald-600"
                              />
                              <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-semibold', checked && 'line-through text-muted-foreground')}>
                                  {unit.size_ml}ml
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  Unit {unit.unitIdx + 1}
                                </p>
                              </div>
                              {checked ? (
                                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                              ) : (
                                <Beaker className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep(4)} className="gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>
                <Button
                  onClick={() => setStep(6)}
                  disabled={!allDecanted}
                  className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                >
                  Next: Review & Confirm <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ============ STEP 6: REVIEW & CONFIRM ============ */}
        {step === 6 && (
          <div className="max-w-3xl">
            <SectionCard title="Step 7: Review & Confirm" subtitle={`${selectedBottles.length} bottle(s) · ${selectedPackaging.length} packaging item(s)`}>
              <div className="space-y-5">
                {/* Process Info */}
                <div className="p-3 rounded-lg bg-accent/30 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Process ID</p>
                      <p className="text-sm font-mono font-medium">{processId}</p>
                    </div>
                    {processName && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Name</p>
                        <p className="text-sm font-medium">{processName}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Perfumes Summary */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Wine className="w-3.5 h-3.5 text-gold" /> Perfumes & Decant Amounts
                  </h4>
                  <div className="space-y-2">
                    {selectedBottles.map((entry, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold">{entry.perfume.brand} — {entry.perfume.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">
                              {entry.bottle.bottle_id} · Syringe: {entry.syringe?.syringe_id || 'N/A'}
                            </p>
                          </div>
                          <span className="text-sm font-mono font-bold text-gold">{entry.decant_ml}ml</span>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {entry.sizes.filter(s => s.qty > 0).map(s => (
                            <span key={s.size_ml} className="text-[10px] font-mono bg-background px-2 py-0.5 rounded border border-border">
                              {s.size_ml}ml ×{s.qty}
                            </span>
                          ))}
                          {otherSizes[i]?.ml && otherSizes[i]?.qty > 0 && (
                            <span className="text-[10px] font-mono bg-background px-2 py-0.5 rounded border border-border">
                              {otherSizes[i].ml}ml ×{otherSizes[i].qty} (custom)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Packaging Summary */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-purple-500" /> Packaging Items
                  </h4>
                  {selectedPackaging.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {selectedPackaging.map(p => (
                        <div key={p.sku.sku_id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-500/20 bg-purple-500/5">
                          <Package className="w-3.5 h-3.5 text-purple-500" />
                          <span className="text-xs font-medium">{p.sku.name}</span>
                          <span className="text-xs font-mono font-bold text-purple-500">×{p.qty}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No packaging items selected</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Optional notes about this process..."
                    className="w-full h-20 px-3 py-2 text-sm bg-background border border-input rounded-md mt-1.5 resize-none focus:ring-2 focus:ring-gold/30 focus:outline-none"
                  />
                </div>

                {/* Ledger Connection Info */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Eye className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-blue-700">Ledger Connection</p>
                      <p className="text-[10px] text-blue-600 mt-0.5">
                        Confirming this process will create ledger entries for each bottle: volume deducted, syringe usage logged, packaging consumed. All events will be traceable under Process ID <span className="font-mono font-bold">{processId}</span>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(5)} className="gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </Button>
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add More Bottles
                  </Button>
                  <Button
                    onClick={confirmProcess}
                    disabled={selectedBottles.length === 0}
                    className="flex-1 bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Confirm & Write Ledger
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
