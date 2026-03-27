// ============================================================
// Decanting — Batch Decanting (GUIDED — MOST IMPORTANT UI)
// Syringe auto-selected (no manual selection tab)
// Scan bottle → auto-lookup reference ID, link to batch/day/ledger
// ============================================================

import { useState, useMemo } from 'react';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { PageHeader, SectionCard, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  ArrowRight, CheckCircle2, ChevronRight, ArrowLeft,
  Droplets, Lock, Pipette, BookOpen, Calendar, Hash,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { JobSelector } from '@/components/JobSelector';
import StationHeader from '@/components/StationHeader';
import type { BatchDecantItem, DecantMatrixRow } from '@/types';

// Station4 is now unified — no mode prop needed.

/* Auto-assign syringe based on perfume — dedicated syringes for specific perfumes, general pool for others */
const SYRINGE_MAP: Record<string, { id: string; label: string; dedicated: boolean }> = {
  'Baccarat Rouge 540': { id: 'SYR-001', label: 'SYR-001 — BR540 Dedicated', dedicated: true },
  'Tobacco Vanille': { id: 'SYR-002', label: 'SYR-002 — Tobacco Vanille Dedicated', dedicated: true },
  'Aventus': { id: 'SYR-003', label: 'SYR-003 — Aventus Dedicated', dedicated: true },
};
const GENERAL_SYRINGES = [
  { id: 'SYR-004', label: 'SYR-004 — General Use' },
  { id: 'SYR-005', label: 'SYR-005 — General Use' },
  { id: 'SYR-006', label: 'SYR-006 — General Use' },
];

function getAutoSyringe(perfumeName: string, usedGeneralIdx: number) {
  const dedicated = SYRINGE_MAP[perfumeName];
  if (dedicated) return { ...dedicated };
  const gen = GENERAL_SYRINGES[usedGeneralIdx % GENERAL_SYRINGES.length];
  return { id: gen.id, label: gen.label, dedicated: false };
}

export default function Station4() {
  const { data: batchRes } = useApiQuery(() => api.stations.batchDecantItems(), []);
  const items = (batchRes || []) as BatchDecantItem[];

  // ---- Job Selection ----
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [matrixState, setMatrixState] = useState<Record<string, DecantMatrixRow[]>>({});
  const [bottleScanned, setBottleScanned] = useState<Record<string, boolean>>({});
  const [lossInput, setLossInput] = useState('');

  const activeItem = items[activeIndex];
  const currentMatrix = activeItem ? (matrixState[activeItem.master_id] || activeItem.matrix) : [];
  const allCompleted = items.length > 0 && items.every(i => completedItems[i.master_id]);

  // Auto-assign syringes
  const syringeAssignments = useMemo(() => {
    let generalIdx = 0;
    const assignments: Record<string, { id: string; label: string; dedicated: boolean }> = {};
    items.forEach(item => {
      const syringe = getAutoSyringe(item.perfume_name, generalIdx);
      assignments[item.master_id] = syringe;
      if (!syringe.dedicated) generalIdx++;
    });
    return assignments;
  }, [items]);

  const getProgress = (masterId: string) => {
    const matrix = matrixState[masterId];
    if (!matrix) return 0;
    const totalReq = matrix.reduce((s, r) => s + r.qty_required, 0);
    const totalDone = matrix.reduce((s, r) => s + r.qty_completed, 0);
    return totalReq > 0 ? Math.round((totalDone / totalReq) * 100) : 0;
  };

  const handleBottleScan = (code: string) => {
    if (!activeItem) return;
    if (code.trim() === activeItem.bottle_id) {
      setBottleScanned(prev => ({ ...prev, [activeItem.master_id]: true }));
      toast.success(`Bottle verified: ${activeItem.bottle_id}`, {
        description: `Ref: ${activeItem.manufacturer_id} · Location: ${activeItem.location_code}`,
      });
    } else {
      toast.error('Barcode mismatch!', {
        description: `Expected ${activeItem.bottle_id}, scanned ${code}`,
      });
    }
  };

  const updateQtyCompleted = (sizeIdx: number, delta: number) => {
    if (!activeItem) return;
    const matrix = [...(matrixState[activeItem.master_id] || activeItem.matrix.map(r => ({ ...r })))];
    const row = { ...matrix[sizeIdx] };
    const newQty = Math.max(0, Math.min(row.qty_required, row.qty_completed + delta));
    row.qty_completed = newQty;
    row.remaining = row.qty_required - newQty;
    matrix[sizeIdx] = row;
    setMatrixState({ ...matrixState, [activeItem.master_id]: matrix });
  };

  const confirmDone = () => {
    if (!activeItem) return;
    const matrix = matrixState[activeItem.master_id] || activeItem.matrix;
    const allDone = matrix.every(r => r.qty_completed >= r.qty_required);
    if (!allDone) {
      toast.warning('Not all sizes completed', { description: 'Complete all required quantities before confirming.' });
      return;
    }
    setCompletedItems({ ...completedItems, [activeItem.master_id]: true });
    toast.success(`${activeItem.perfume_name} — Done`, { description: 'Ledger events written' });
    if (activeIndex < items.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const currentSyringe = activeItem ? syringeAssignments[activeItem.master_id] : null;
  const isScanned = activeItem ? bottleScanned[activeItem.master_id] : false;

  return (
    <div>
      <PageHeader
        title="Decanting Ops"
        subtitle="Guided decanting flow — scan bottle, auto-syringe, zero-error"
        breadcrumbs={[{ label: 'Pod Framework' }, { label: 'Decanting Ops' }]}
        actions={
          <Link href="/stations/5-fulfillment">
            <Button size="sm" disabled={!allCompleted} className="bg-success hover:bg-success/90 text-success-foreground gap-1.5">
              Mark Batch Completed <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        }
      />

      <StationHeader stationNumber={4} />

      <div className="p-6 pb-0">
        <JobSelector
          stationNumber={4}
          selectedJobIds={selectedJobIds}
          onSelectionChange={setSelectedJobIds}
        />
      </div>

      <div className="flex h-[calc(100vh-16rem)]">
        {/* Left Sidebar: Job Batch List */}
        <div className="w-72 border-r border-border bg-card overflow-y-auto shrink-0">
          <div className="p-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Perfume Batch</p>
          </div>
          {items.map((item, idx) => {
            const progress = completedItems[item.master_id] ? 100 : getProgress(item.master_id);
            return (
              <button
                key={item.master_id}
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 border-b border-border/50 transition-all text-left',
                  idx === activeIndex ? 'bg-accent' : 'hover:bg-muted/50',
                  completedItems[item.master_id] && 'opacity-60',
                )}
              >
                {item.perfume_image ? <img src={item.perfume_image} alt="" className="w-10 h-10 rounded object-cover bg-muted shrink-0" /> : <div className="w-10 h-10 rounded bg-muted shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.perfume_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-300', progress === 100 ? 'bg-success' : 'bg-gold')}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{progress}%</span>
                  </div>
                </div>
                {completedItems[item.master_id] && <Lock className="w-4 h-4 text-success shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Main Panel */}
        {activeItem ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {completedItems[activeItem.master_id] && (
              <div className="flex items-center gap-2 px-4 py-3 bg-success/10 border border-success/20 rounded-lg text-sm">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="text-success font-medium">This perfume is completed and locked.</span>
              </div>
            )}

            {/* Bottle Info + Auto-Syringe */}
            <div className="flex gap-6">
              {activeItem.perfume_image ? <img src={activeItem.perfume_image} alt="" className="w-32 h-32 rounded-lg object-cover bg-muted shrink-0" /> : <div className="w-32 h-32 rounded-lg bg-muted shrink-0" />}
              <div className="space-y-3 flex-1">
                <h2 className="text-lg font-semibold">{activeItem.perfume_name}</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Bottle ID:</span>
                    <span className="font-mono font-medium">{activeItem.bottle_id}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Manufacturer:</span>
                    <span className="font-mono">{activeItem.manufacturer_id}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-gold" />
                    <span className="text-muted-foreground">Current:</span>
                    <span className="font-mono font-semibold text-gold">{activeItem.current_ml}ml</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-mono">{activeItem.location_code}</span>
                  </div>
                </div>

                {/* Auto-Syringe Info (no dropdown, auto-assigned) */}
                {currentSyringe && (
                  <div className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg border',
                    currentSyringe.dedicated ? 'border-purple-500/30 bg-purple-500/5' : 'border-blue-500/30 bg-blue-500/5',
                  )}>
                    <Pipette className={cn('w-5 h-5', currentSyringe.dedicated ? 'text-purple-500' : 'text-blue-500')} />
                    <div>
                      <p className="text-sm font-medium">{currentSyringe.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentSyringe.dedicated ? 'Dedicated syringe — auto-assigned' : 'General pool — auto-assigned'}
                      </p>
                    </div>
                    <StatusBadge variant={currentSyringe.dedicated ? 'default' : 'gold'}>
                      {currentSyringe.dedicated ? 'Dedicated' : 'General'}
                    </StatusBadge>
                  </div>
                )}
              </div>
            </div>

            {/* Scan Bottle → Auto-Lookup Reference */}
            <SectionCard
              title="Scan Bottle"
              subtitle="Scan barcode to verify bottle and auto-lookup reference ID"
              headerActions={
                isScanned ? <StatusBadge variant="success">Verified</StatusBadge> : <StatusBadge variant="gold">Pending Scan</StatusBadge>
              }
            >
              {!isScanned ? (
                <BarcodeScanner
                  label="Scan Bottle Barcode"
                  placeholder="Scan bottle barcode to verify..."
                  disabled={completedItems[activeItem.master_id]}
                  onScan={handleBottleScan}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-4 py-3 bg-success/10 border border-success/20 rounded-lg text-sm">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-success font-medium">Bottle verified — reference data loaded</span>
                  </div>
                  {/* Reference Info from Scan */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reference ID</p>
                      </div>
                      <p className="text-sm font-mono font-semibold">{activeItem.manufacturer_id}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Batch Day</p>
                      </div>
                      <p className="text-sm font-mono font-semibold">{new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ledger Link</p>
                      </div>
                      <p className="text-sm font-mono text-gold cursor-pointer hover:underline">View Ledger →</p>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Decant Matrix */}
            <SectionCard title="Decant Matrix" subtitle="Decant quantities per size — tap + to record each fill">
              <table className="w-full ops-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Size</th>
                    <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Required</th>
                    <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Completed</th>
                    <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Remaining</th>
                    <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMatrix.map((row, idx) => (
                    <tr key={row.size_ml} className="border-b border-border/50">
                      <td className="px-3 py-3 text-sm font-mono font-semibold">{row.size_ml}ml</td>
                      <td className="px-3 py-3 text-sm text-center font-mono">{row.qty_required}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn(
                          'font-mono font-semibold text-sm',
                          row.qty_completed >= row.qty_required ? 'text-success' : 'text-foreground',
                        )}>
                          {row.qty_completed}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn(
                          'font-mono text-sm',
                          row.remaining > 0 ? 'text-warning font-semibold' : 'text-success',
                        )}>
                          {row.remaining}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            disabled={completedItems[activeItem.master_id] || row.qty_completed <= 0}
                            onClick={() => updateQtyCompleted(idx, -1)}
                          >
                            −
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 w-7 p-0 bg-gold hover:bg-gold/90 text-gold-foreground"
                            disabled={completedItems[activeItem.master_id] || row.qty_completed >= row.qty_required}
                            onClick={() => updateQtyCompleted(idx, 1)}
                          >
                            +
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>

            {/* Loss/Leak/Breakage */}
            <SectionCard title="Loss / Leak / Breakage" subtitle="Optional — record any loss event for this bottle">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lossInput}
                  onChange={e => setLossInput(e.target.value)}
                  placeholder="e.g. 0.5ml leak during transfer"
                  disabled={completedItems[activeItem.master_id]}
                  className="flex-1 h-10 px-3 text-sm bg-background border border-input rounded-md"
                />
                <Button
                  variant="outline"
                  disabled={completedItems[activeItem.master_id] || !lossInput}
                  onClick={() => { toast.info('Loss recorded to ledger'); setLossInput(''); }}
                >
                  Record
                </Button>
              </div>
            </SectionCard>

            {/* Confirm / Next */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex(activeIndex - 1)}
                className="gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Previous
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={confirmDone}
                  disabled={completedItems[activeItem.master_id]}
                  className="bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirm Done
                </Button>
                {activeIndex < items.length - 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setActiveIndex(activeIndex + 1)}
                    className="gap-1.5"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>No batch items to decant</p>
          </div>
        )}
      </div>
    </div>
  );
}
