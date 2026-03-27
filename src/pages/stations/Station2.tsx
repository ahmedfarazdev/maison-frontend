// ============================================================
// Picking Station
// Full item checklist: bottles, atomizers, perfumes, packaging
// Each item has a tick checkbox. Picking summary at the end.
// Label CSV generation and insert preparation preserved.
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState, CheckboxRow } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  ArrowRight, Download, Printer, FileSpreadsheet, CheckCircle2,
  Package, Tag, FileText, FolderDown, Eye, Droplets, FlaskConical,
  Box, Layers, ScanBarcode, CircleDot, Shield, Send, Clock, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { JobSelector } from '@/components/JobSelector';
import type { BatchDecantItem, Order, PackagingPickItem } from '@/types';
import StationHeader from '@/components/StationHeader';

// Station2 is now unified — no mode prop needed.
// Job type is determined by the job itself.

/* Generate CSV content for a specific size group */
function generateLabelCSV(items: { brand: string; perfumeName: string; size: string; scentSignature: string; madeIn: string }[]): string {
  const header = 'Brand,Perfume Name,Size · Concentration,Scent Signature,Made In';
  const rows = items.map(i =>
    `"${i.brand}","${i.perfumeName}","${i.size}","${i.scentSignature}","${i.madeIn}"`
  );
  return [header, ...rows].join('\n');
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* Mock insert types */
const MOCK_INSERTS = [
  { id: 'ins-welcome', name: 'Welcome Card', type: 'card', linkedTo: 'all', qty: 12, printed: false },
  { id: 'ins-aura-guide', name: 'Aura Guide Booklet', type: 'booklet', linkedTo: 'subscription', qty: 8, printed: false },
  { id: 'ins-promo', name: 'Promo Flyer (Feb 2026)', type: 'flyer', linkedTo: 'one_time', qty: 5, printed: false },
  { id: 'ins-care', name: 'Fragrance Care Instructions', type: 'card', linkedTo: 'all', qty: 12, printed: false },
  { id: 'ins-thank-you', name: 'Thank You Note', type: 'card', linkedTo: 'all', qty: 12, printed: false },
];

export default function Station2() {

  const { data: batchRes } = useApiQuery(() => api.stations.batchDecantItems(), []);
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: packProdRes } = useApiQuery(() => api.stations.packagingPickProduction(), []);
  const { data: packFulRes } = useApiQuery(() => api.stations.packagingPickFulfillment(), []);

  const batchItems = (batchRes || []) as BatchDecantItem[];
  const orders = (ordersRes || []) as Order[];
  const packagingProd = (packProdRes || []) as PackagingPickItem[];
  const packagingFul = (packFulRes || []) as PackagingPickItem[];

  // ---- Job Selection ----
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  // ---- Pick states ----
  const [pickedBottles, setPickedBottles] = useState<Record<string, boolean>>({});
  const [pickedAtomizers, setPickedAtomizers] = useState<Record<string, boolean>>({});
  const [pickedPackaging, setPickedPackaging] = useState<Record<string, boolean>>({});
  const [printedSizes, setPrintedSizes] = useState<Record<string, boolean>>({});
  const [printedInserts, setPrintedInserts] = useState<Record<string, boolean>>({});
  const [jobCreated, setJobCreated] = useState(false);

  // ---- Vault Guardian Request State ----
  // When "Request All" is clicked, status goes to 'requested' (Pending).
  // When Vault Guardian scans/approves/hands over, status auto-adjusts to 'fulfilled' (Received).
  type VaultRequestStatus = 'none' | 'requested' | 'fulfilled';
  const [bottleVaultStatus, setBottleVaultStatus] = useState<Record<string, VaultRequestStatus>>({});
  const [allBottlesRequested, setAllBottlesRequested] = useState(false);

  const requestBottleFromVault = (bottleId: string, bottleName: string) => {
    // Status immediately goes to 'requested' (Pending)
    setBottleVaultStatus(prev => ({ ...prev, [bottleId]: 'requested' }));
    toast.info(`Request sent to Vault Guardian`, { description: `${bottleName} — status: Pending. Will auto-update when guardian scans.` });
    // Simulate Vault Guardian scanning and handing over (auto-adjust to Received)
    setTimeout(() => {
      setBottleVaultStatus(prev => ({ ...prev, [bottleId]: 'fulfilled' }));
      setPickedBottles(prev => ({ ...prev, [bottleId]: true }));
      toast.success(`Vault Guardian scanned out: ${bottleName}`, { description: 'Status auto-adjusted to Received' });
    }, 2000 + Math.random() * 1500);
  };

  const requestAllBottlesFromVault = () => {
    bottlesToPick.forEach((bottle, i) => {
      if (bottleVaultStatus[bottle.id] !== 'fulfilled') {
        setTimeout(() => requestBottleFromVault(bottle.id, bottle.perfumeName), i * 300);
      }
    });
    setAllBottlesRequested(true);
    toast.info('Compiled request sent to Vault Guardian', { description: `${bottlesToPick.filter(b => bottleVaultStatus[b.id] !== 'fulfilled').length} bottles — status: Pending. Auto-adjusts to Received when guardian scans.` });
  };

  // ---- Derive pick lists from batch items ----
  // Bottles to pick (one per perfume in batch)
  const bottlesToPick = useMemo(() => {
    return batchItems.map(item => ({
      id: item.bottle_id,
      perfumeName: item.perfume_name,
      image: item.perfume_image,
      locationCode: item.location_code,
      currentMl: item.current_ml,
      manufacturerId: item.manufacturer_id,
      sizes: item.matrix.map(m => ({ size: m.size_ml, qty: m.qty_required })),
    }));
  }, [batchItems]);

  // Atomizers needed (aggregate by size from batch matrix)
  const atomizersNeeded = useMemo(() => {
    const sizeMap: Record<number, number> = {};
    batchItems.forEach(item => {
      item.matrix.forEach(m => {
        sizeMap[m.size_ml] = (sizeMap[m.size_ml] || 0) + m.qty_required;
      });
    });
    return Object.entries(sizeMap)
      .map(([size, qty]) => ({ size: Number(size), qty, id: `atm-${size}ml` }))
      .sort((a, b) => a.size - b.size);
  }, [batchItems]);

  // All packaging items (production + fulfillment)
  const allPackaging = useMemo(() => {
    const combined = [...packagingProd, ...packagingFul];
    // Also add boxes based on order count
    const activeOrders = orders.filter(o => ['new', 'processing'].includes(o.status));
    if (activeOrders.length > 0) {
      combined.push({
        sku_id: 'PKG-BOX-MAIN',
        name: 'Shipping Box',
        qty_required: activeOrders.length,
        picked: false,
      });
    }
    return combined;
  }, [packagingProd, packagingFul, orders]);

  // Labels by size (for CSV generation)
  const labelsBySize = useMemo(() => {
    const sizeMap: Record<string, { size: string; totalQty: number; perfumes: { brand: string; perfumeName: string; size: string; scentSignature: string; madeIn: string; qty: number }[] }> = {};
    batchItems.forEach(item => {
      item.matrix.forEach(m => {
        const sizeKey = `${m.size_ml}ml`;
        if (!sizeMap[sizeKey]) {
          sizeMap[sizeKey] = { size: sizeKey, totalQty: 0, perfumes: [] };
        }
        sizeMap[sizeKey].totalQty += m.qty_required;
        for (let i = 0; i < m.qty_required; i++) {
          sizeMap[sizeKey].perfumes.push({
            brand: item.perfume_name.split(' ')[0] || 'Maison Em',
            perfumeName: item.perfume_name,
            size: `${m.size_ml}ml · EDP`,
            scentSignature: 'Woody Amber Oriental',
            madeIn: 'UAE',
            qty: 1,
          });
        }
      });
    });
    return Object.values(sizeMap).sort((a, b) => parseInt(a.size) - parseInt(b.size));
  }, [batchItems]);

  const inserts = MOCK_INSERTS;

  // ---- Completion checks ----
  const allBottlesPicked = bottlesToPick.length > 0 && bottlesToPick.every(b => pickedBottles[b.id]);
  const allAtomizersPicked = atomizersNeeded.length > 0 && atomizersNeeded.every(a => pickedAtomizers[a.id]);
  const allPackagingPicked = allPackaging.length > 0 && allPackaging.every(p => pickedPackaging[p.sku_id]);
  const allLabelsPrinted = labelsBySize.length > 0 && labelsBySize.every(s => printedSizes[s.size]);
  const allInsertsPrinted = inserts.every(ins => printedInserts[ins.id]);

  const pickingComplete = allBottlesPicked && allAtomizersPicked && allPackagingPicked;
  const labelsComplete = allLabelsPrinted && allInsertsPrinted;
  const allReady = pickingComplete && labelsComplete;

  // ---- Handlers ----
  const handleDownloadCSV = (sizeGroup: typeof labelsBySize[0]) => {
    const csv = generateLabelCSV(sizeGroup.perfumes);
    downloadCSV(`labels_${sizeGroup.size}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Downloaded ${sizeGroup.size} label CSV (${sizeGroup.totalQty} labels)`);
  };

  const handlePrintSize = (sizeKey: string) => {
    setPrintedSizes(prev => ({ ...prev, [sizeKey]: true }));
    toast.success(`${sizeKey} labels sent to printer`);
  };

  const handlePrintInsert = (insertId: string) => {
    setPrintedInserts(prev => ({ ...prev, [insertId]: true }));
    toast.success('Insert sent to printer');
  };

  const handleCreatePrintJob = () => {
    labelsBySize.forEach(sg => {
      const csv = generateLabelCSV(sg.perfumes);
      downloadCSV(`labels_${sg.size}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    });
    setJobCreated(true);
    toast.success('Print job created — all CSV files downloaded');
  };

  // ---- Summary counts ----
  const totalBottles = bottlesToPick.length;
  const totalAtomizers = atomizersNeeded.reduce((s, a) => s + a.qty, 0);
  const totalLabels = labelsBySize.reduce((s, g) => s + g.totalQty, 0);
  const totalPackaging = allPackaging.reduce((s, p) => s + p.qty_required, 0);
  const totalInserts = inserts.reduce((s, i) => s + i.qty, 0);

  return (
    <div>
      <PageHeader
        title="Picking Ops"
        subtitle="Pick all items for the batch — bottles, atomizers, packaging, labels, inserts"
        breadcrumbs={[
          { label: 'Pod Framework' },
          { label: 'Picking Ops' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleCreatePrintJob}
              disabled={labelsBySize.length === 0}
            >
              <FolderDown className="w-3.5 h-3.5" /> Create Print Job
            </Button>
            <Link href="/stations/3-prep-label">
              <Button size="sm" disabled={!allReady} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
                Proceed to Labels <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        }
      />

      <StationHeader stationNumber={2} />

      <div className="p-6 space-y-6">

        {/* ===== JOB SELECTOR ===== */}
        <JobSelector
          stationNumber={2}
          selectedJobIds={selectedJobIds}
          onSelectionChange={setSelectedJobIds}
        />

        {/* ===== SECTION 1: Perfume Bottles (Vault Guardian Request Flow) ===== */}
        <SectionCard
          title="1 · Perfume Bottles"
          subtitle="Request bottles from the Vault Guardian — no self-picking allowed"
          headerActions={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 text-indigo-600 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 text-xs">
                <Shield className="w-3 h-3" /> Vault Guardian
              </Badge>
              <StatusBadge variant={allBottlesPicked ? 'success' : 'gold'}>
                {allBottlesPicked ? 'All Received' : `${Object.values(pickedBottles).filter(Boolean).length}/${totalBottles} received`}
              </StatusBadge>
            </div>
          }
        >
          {bottlesToPick.length === 0 ? (
            <EmptyState icon={Droplets} title="No bottles to pick" description="No batch decant items found for this cycle." />
          ) : (
            <div className="space-y-3">
              {/* Compiled Request Button */}
              {!allBottlesRequested && bottlesToPick.some(b => bottleVaultStatus[b.id] !== 'fulfilled') && (
                <div className="p-3 rounded-lg border-2 border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Request all bottles from Vault Guardian</p>
                      <p className="text-xs text-muted-foreground">Sends a compiled request — guardian scans each bottle out</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={requestAllBottlesFromVault} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
                    <Send className="w-3.5 h-3.5" /> Request All ({bottlesToPick.filter(b => bottleVaultStatus[b.id] !== 'fulfilled').length})
                  </Button>
                </div>
              )}
              {allBottlesRequested && !allBottlesPicked && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">Waiting for Vault Guardian to fulfill requests...</p>
                </div>
              )}
              {allBottlesPicked && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">All bottles received from Vault Guardian</p>
                </div>
              )}

              {/* Individual bottle rows */}
              <div className="space-y-2">
                {bottlesToPick.map(bottle => {
                  const status = bottleVaultStatus[bottle.id] || 'none';
                  return (
                    <div key={bottle.id} className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all',
                      status === 'fulfilled' ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' :
                      status === 'requested' ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' :
                      'bg-background border-border hover:border-indigo-300',
                    )}>
                      {/* Status indicator */}
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                        status === 'fulfilled' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                        status === 'requested' ? 'bg-amber-100 dark:bg-amber-900/30' :
                        'bg-muted',
                      )}>
                        {status === 'fulfilled' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                         status === 'requested' ? <Loader2 className="w-4 h-4 text-amber-600 animate-spin" /> :
                         <FlaskConical className="w-4 h-4 text-muted-foreground" />}
                      </div>

                      {/* Bottle info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{bottle.perfumeName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono">{bottle.locationCode}</span>
                          <span>·</span>
                          <span>{bottle.currentMl}ml remaining</span>
                        </div>
                      </div>

                      {/* Sizes */}
                      <div className="flex flex-wrap gap-1 shrink-0">
                        {bottle.sizes.map(s => (
                          <span key={s.size} className="text-[10px] font-mono bg-gold/10 text-gold px-1.5 py-0.5 rounded">
                            {s.size}ml ×{s.qty}
                          </span>
                        ))}
                      </div>

                      {/* Action */}
                      <div className="shrink-0">
                        {status === 'none' && (
                          <Button size="sm" variant="outline" onClick={() => requestBottleFromVault(bottle.id, bottle.perfumeName)} className="gap-1 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                            <Shield className="w-3 h-3" /> Request
                          </Button>
                        )}
                        {status === 'requested' && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs gap-1"><Clock className="w-3 h-3" /> Pending</Badge>
                        )}
                        {status === 'fulfilled' && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs gap-1"><CheckCircle2 className="w-3 h-3" /> Received</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ===== SECTION 2: Atomizers ===== */}
        <SectionCard
          title="2 · Atomizers"
          subtitle="Pick atomizers by size — match to decant quantities"
          headerActions={
            <StatusBadge variant={allAtomizersPicked ? 'success' : 'gold'}>
              {allAtomizersPicked ? 'All Picked' : `${Object.values(pickedAtomizers).filter(Boolean).length}/${atomizersNeeded.length} sizes`}
            </StatusBadge>
          }
        >
          {atomizersNeeded.length === 0 ? (
            <EmptyState icon={CircleDot} title="No atomizers needed" description="No decant items in this batch." />
          ) : (
            <div className="space-y-2">
              {atomizersNeeded.map(atm => (
                <CheckboxRow
                  key={atm.id}
                  checked={!!pickedAtomizers[atm.id]}
                  onChange={(v) => setPickedAtomizers(prev => ({ ...prev, [atm.id]: v }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <CircleDot className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{atm.size}ml Atomizer</p>
                        <p className="text-xs text-muted-foreground">Standard atomizer for {atm.size}ml decants</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono">{atm.qty}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">units</p>
                    </div>
                  </div>
                </CheckboxRow>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ===== SECTION 3: Packaging Materials ===== */}
        <SectionCard
          title="3 · Packaging Materials"
          subtitle="Boxes, inlays, caps, and other packaging items"
          headerActions={
            <StatusBadge variant={allPackagingPicked ? 'success' : 'gold'}>
              {allPackagingPicked ? 'All Picked' : `${Object.values(pickedPackaging).filter(Boolean).length}/${allPackaging.length} items`}
            </StatusBadge>
          }
        >
          {allPackaging.length === 0 ? (
            <EmptyState icon={Box} title="No packaging to pick" description="No packaging items required for this batch." />
          ) : (
            <div className="space-y-2">
              {allPackaging.map(pkg => (
                <CheckboxRow
                  key={pkg.sku_id}
                  checked={!!pickedPackaging[pkg.sku_id]}
                  onChange={(v) => setPickedPackaging(prev => ({ ...prev, [pkg.sku_id]: v }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pkg.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{pkg.sku_id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono">{pkg.qty_required}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">units</p>
                    </div>
                  </div>
                </CheckboxRow>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ===== SECTION 4: Label Queue (CSV generation) ===== */}
        <SectionCard
          title="4 · Label Queue"
          subtitle="One CSV file per size — download or print directly"
          headerActions={
            <StatusBadge variant={allLabelsPrinted ? 'success' : 'gold'}>
              {allLabelsPrinted ? 'All Printed' : `${Object.values(printedSizes).filter(Boolean).length}/${labelsBySize.length} printed`}
            </StatusBadge>
          }
        >
          {labelsBySize.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} title="No labels to generate" description="No batch decant items found for this cycle." />
          ) : (
            <div className="space-y-3">
              {/* CSV Column Header Preview */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">CSV Column Structure</p>
                <div className="flex gap-2 flex-wrap">
                  {['Brand', 'Perfume Name', 'Size · Concentration', 'Scent Signature', 'Made In'].map(col => (
                    <span key={col} className="text-xs font-mono bg-blue-500/10 text-blue-600 px-2 py-1 rounded">{col}</span>
                  ))}
                </div>
              </div>

              {/* Per-Size Cards */}
              {labelsBySize.map(sizeGroup => {
                const isPrinted = printedSizes[sizeGroup.size];
                return (
                  <div key={sizeGroup.size} className={cn(
                    'p-4 rounded-lg border transition-all',
                    isPrinted ? 'border-success/30 bg-success/5' : 'border-border',
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm',
                          isPrinted ? 'bg-success/10 text-success' : 'bg-gold/10 text-gold',
                        )}>
                          {sizeGroup.size}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{sizeGroup.size} Labels</p>
                          <p className="text-xs text-muted-foreground">
                            {sizeGroup.totalQty} labels · {new Set(sizeGroup.perfumes.map(p => p.perfumeName)).size} perfumes
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPrinted && <CheckCircle2 className="w-5 h-5 text-success" />}
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleDownloadCSV(sizeGroup)}>
                          <Download className="w-3.5 h-3.5" /> CSV
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={isPrinted} onClick={() => handlePrintSize(sizeGroup.size)}>
                          <Printer className="w-3.5 h-3.5" /> {isPrinted ? 'Printed' : 'Print'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ===== SECTION 5: Insert Preparation ===== */}
        <SectionCard
          title="5 · Insert Preparation"
          subtitle="Inserts to include in orders — print and prepare for packing"
          headerActions={
            <StatusBadge variant={allInsertsPrinted ? 'success' : 'gold'}>
              {allInsertsPrinted ? 'All Ready' : `${Object.values(printedInserts).filter(Boolean).length}/${inserts.length} ready`}
            </StatusBadge>
          }
        >
          <div className="space-y-2">
            {inserts.map(ins => {
              const isPrinted = printedInserts[ins.id];
              return (
                <div key={ins.id} className={cn(
                  'flex items-center justify-between p-3 rounded-md border transition-all',
                  isPrinted ? 'border-success/30 bg-success/5' : 'border-border',
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded flex items-center justify-center',
                      ins.type === 'booklet' ? 'bg-purple-500/10' : ins.type === 'flyer' ? 'bg-blue-500/10' : 'bg-amber-500/10',
                    )}>
                      {ins.type === 'booklet' ? <FileText className="w-4 h-4 text-purple-500" /> :
                       ins.type === 'flyer' ? <Tag className="w-4 h-4 text-blue-500" /> :
                       <FileText className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{ins.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ins.type} · ×{ins.qty} needed · for {ins.linkedTo === 'all' ? 'all orders' : `${ins.linkedTo} orders`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPrinted && <CheckCircle2 className="w-4 h-4 text-success" />}
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast.info(`Preview ${ins.name}`)}>
                      <Eye className="w-3 h-3" /> Preview
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={isPrinted} onClick={() => handlePrintInsert(ins.id)}>
                      <Printer className="w-3.5 h-3.5" /> {isPrinted ? 'Printed' : 'Print'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ===== PICKING SUMMARY ===== */}
        <SectionCard title="Picking Summary" subtitle="Total items to pick for this batch">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Bottles', count: totalBottles, icon: FlaskConical, done: allBottlesPicked },
              { label: 'Atomizers', count: totalAtomizers, icon: CircleDot, done: allAtomizersPicked },
              { label: 'Packaging', count: totalPackaging, icon: Package, done: allPackagingPicked },
              { label: 'Labels', count: totalLabels, icon: Tag, done: allLabelsPrinted },
              { label: 'Inserts', count: totalInserts, icon: FileText, done: allInsertsPrinted },
            ].map(item => (
              <div key={item.label} className={cn(
                'p-3 rounded-lg border text-center transition-all',
                item.done ? 'border-success/30 bg-success/5' : 'border-border',
              )}>
                <item.icon className={cn('w-5 h-5 mx-auto mb-1', item.done ? 'text-success' : 'text-muted-foreground')} />
                <p className="text-lg font-bold">{item.count}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                {item.done && <CheckCircle2 className="w-3.5 h-3.5 mx-auto mt-1 text-success" />}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ===== STATUS BAR ===== */}
        <div className={cn(
          'flex items-center justify-between p-4 rounded-lg border',
          allReady ? 'border-success/30 bg-success/5' : 'border-amber-500/20 bg-amber-500/5',
        )}>
          <div className="flex items-center gap-3">
            {allReady ? <CheckCircle2 className="w-5 h-5 text-success" /> : <ScanBarcode className="w-5 h-5 text-amber-500" />}
            <div>
              <p className="text-sm font-semibold">
                {allReady ? 'All items picked and labels ready' : 'Picking in progress'}
              </p>
              <p className="text-xs text-muted-foreground">
                {allReady
                  ? 'Proceed to labeling station'
                  : `${[!allBottlesPicked && 'bottles', !allAtomizersPicked && 'atomizers', !allPackagingPicked && 'packaging', !allLabelsPrinted && 'labels', !allInsertsPrinted && 'inserts'].filter(Boolean).join(', ')} still pending`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {jobCreated && <StatusBadge variant="success">Print Job Created</StatusBadge>}
            {pickingComplete && !labelsComplete && <StatusBadge variant="gold">Picking Done — Labels Pending</StatusBadge>}
          </div>
        </div>
      </div>
    </div>
  );
}
