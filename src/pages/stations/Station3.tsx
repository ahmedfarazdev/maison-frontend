// ============================================================
// Labeling — Prep & Label Application
// Per-perfume headings with sizes listed underneath.
// Tick after each label applied. Tray prepared confirmation.
// Label and insert sections preserved.
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState, CheckboxRow } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  ArrowRight, ArrowLeft, CheckCircle2, Tag, Layers,
  FlaskConical, Package, ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { JobSelector } from '@/components/JobSelector';
import StationHeader from '@/components/StationHeader';
import type { BatchDecantItem } from '@/types';

export default function Station3() {

  const { data: batchRes } = useApiQuery(() => api.stations.batchDecantItems(), []);
  const batchItems = (batchRes || []) as BatchDecantItem[];

  // ---- Job Selection ----
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  // State: track which labels have been applied (perfumeId-sizeml key)
  const [appliedLabels, setAppliedLabels] = useState<Record<string, boolean>>({});
  // State: track tray prepared per perfume
  const [trayPrepared, setTrayPrepared] = useState<Record<string, boolean>>({});
  // State: inserts placed
  const [insertsPlaced, setInsertsPlaced] = useState(false);

  // Group by perfume: each perfume is a heading, sizes listed underneath
  const perfumeGroups = useMemo(() => {
    return batchItems.map(item => {
      const sizes = item.matrix
        .filter(m => m.qty_required > 0)
        .map(m => ({
          size_ml: m.size_ml,
          qty: m.qty_required,
          completed: m.qty_completed,
          key: `${item.master_id}-${m.size_ml}ml`,
        }))
        .sort((a, b) => a.size_ml - b.size_ml);

      return {
        masterId: item.master_id,
        perfumeName: item.perfume_name,
        image: item.perfume_image,
        bottleId: item.bottle_id,
        locationCode: item.location_code,
        sizes,
        totalLabels: sizes.reduce((s, sz) => s + sz.qty, 0),
      };
    });
  }, [batchItems]);

  // All label keys for completion check
  const allLabelKeys = useMemo(() => {
    return perfumeGroups.flatMap(g => g.sizes.map(s => s.key));
  }, [perfumeGroups]);

  const allLabelsApplied = allLabelKeys.length > 0 && allLabelKeys.every(k => appliedLabels[k]);
  const allTraysReady = perfumeGroups.length > 0 && perfumeGroups.every(g => trayPrepared[g.masterId]);
  const allReady = allLabelsApplied && allTraysReady && insertsPlaced;

  const appliedCount = allLabelKeys.filter(k => appliedLabels[k]).length;

  const toggleLabel = (key: string, value: boolean) => {
    setAppliedLabels(prev => ({ ...prev, [key]: value }));
    if (value) toast.success('Label applied');
  };

  const toggleTray = (masterId: string, value: boolean) => {
    setTrayPrepared(prev => ({ ...prev, [masterId]: value }));
    if (value) toast.success('Tray prepared');
  };

  return (
    <div>
      <PageHeader
        title="Labeling Ops"
        subtitle="Apply labels per perfume per size, prepare trays, place inserts"
        breadcrumbs={[
          { label: 'Pod Framework' },
          { label: 'Labeling Ops' },
        ]}
        actions={
          <div className="flex gap-2">
            <Link href="/stations/2-picking">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to S2
              </Button>
            </Link>
            <Link href="/stations/4-batch-decant">
              <Button size="sm" disabled={!allReady} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
                Proceed to Decanting <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        }
      />

      <StationHeader stationNumber={3} />

      <div className="p-6 space-y-6">

        {/* ===== JOB SELECTOR ===== */}
        <JobSelector
          stationNumber={3}
          selectedJobIds={selectedJobIds}
          onSelectionChange={setSelectedJobIds}
        />

        {/* ===== SECTION 1:PLICATION — Per Perfume ===== */}
        <SectionCard
          title="Label Application"
          subtitle="Apply labels to atomizers — grouped by perfume, sizes listed underneath"
          headerActions={
            <StatusBadge variant={allLabelsApplied ? 'success' : 'gold'}>
              {allLabelsApplied ? 'All Applied' : `${appliedCount}/${allLabelKeys.length} labels`}
            </StatusBadge>
          }
        >
          {perfumeGroups.length === 0 ? (
            <EmptyState icon={Tag} title="No labels to apply" description="No batch decant items found for this cycle." />
          ) : (
            <div className="space-y-4">
              {perfumeGroups.map(group => {
                const groupApplied = group.sizes.every(s => appliedLabels[s.key]);
                const groupTrayDone = trayPrepared[group.masterId];

                return (
                  <div key={group.masterId} className={cn(
                    'rounded-lg border transition-all overflow-hidden',
                    groupApplied && groupTrayDone ? 'border-success/30' : 'border-border',
                  )}>
                    {/* Perfume Header */}
                    <div className={cn(
                      'flex items-center gap-3 px-4 py-3 border-b',
                      groupApplied && groupTrayDone ? 'bg-success/5 border-success/20' : 'bg-muted/30 border-border',
                    )}>
                      <div className="w-10 h-10 rounded-lg bg-card overflow-hidden shrink-0 border border-border">
                        {group.image ? (
                          <img src={group.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <FlaskConical className="w-5 h-5 m-2.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{group.perfumeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.totalLabels} labels · {group.sizes.length} sizes · Bottle {group.bottleId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {groupApplied && <StatusBadge variant="success">Labels Done</StatusBadge>}
                        {groupTrayDone && <StatusBadge variant="success">Tray Ready</StatusBadge>}
                      </div>
                    </div>

                    {/* Size Rows */}
                    <div className="p-3 space-y-2">
                      {group.sizes.map(sizeItem => (
                        <CheckboxRow
                          key={sizeItem.key}
                          checked={!!appliedLabels[sizeItem.key]}
                          onChange={(v) => toggleLabel(sizeItem.key, v)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs',
                                appliedLabels[sizeItem.key] ? 'bg-success/10 text-success' : 'bg-gold/10 text-gold',
                              )}>
                                {sizeItem.size_ml}ml
                              </div>
                              <div>
                                <p className="text-sm font-medium">{sizeItem.size_ml}ml Labels</p>
                                <p className="text-xs text-muted-foreground">
                                  Apply {sizeItem.qty} label{sizeItem.qty > 1 ? 's' : ''} to {sizeItem.size_ml}ml atomizers
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold font-mono">×{sizeItem.qty}</span>
                            </div>
                          </div>
                        </CheckboxRow>
                      ))}

                      {/* Tray Prepared Confirmation */}
                      <div className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-md border cursor-pointer transition-all mt-2',
                        groupTrayDone ? 'bg-success/5 border-success/30' : 'border-dashed border-border hover:bg-muted/50',
                      )} onClick={() => toggleTray(group.masterId, !groupTrayDone)}>
                        <div className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
                          groupTrayDone ? 'bg-success border-success' : 'border-muted-foreground/30',
                        )}>
                          {groupTrayDone && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {groupTrayDone ? 'Tray prepared ✓' : 'Confirm tray prepared'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ===== INSERTS PLACED ===== */}
        <SectionCard
          title="Insert Placement"
          subtitle="Confirm all inserts have been placed with the labeled atomizers"
        >
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-4 rounded-lg border cursor-pointer transition-all',
              insertsPlaced ? 'bg-success/5 border-success/30' : 'border-dashed border-border hover:bg-muted/50',
            )}
            onClick={() => {
              setInsertsPlaced(!insertsPlaced);
              if (!insertsPlaced) toast.success('Inserts placement confirmed');
            }}
          >
            <div className={cn(
              'w-6 h-6 rounded border-2 flex items-center justify-center shrink-0',
              insertsPlaced ? 'bg-success border-success' : 'border-muted-foreground/30',
            )}>
              {insertsPlaced && <CheckCircle2 className="w-4 h-4 text-white" />}
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">
                  {insertsPlaced ? 'All inserts placed ✓' : 'Confirm all inserts placed'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Welcome cards, aura guides, promo flyers, and care instructions
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ===== PROGRESS SUMMARY ===== */}
        <SectionCard title="Prep Summary" subtitle="Overall progress for labeling">
          <div className="grid grid-cols-3 gap-3">
            <div className={cn(
              'p-3 rounded-lg border text-center',
              allLabelsApplied ? 'border-success/30 bg-success/5' : 'border-border',
            )}>
              <Tag className={cn('w-5 h-5 mx-auto mb-1', allLabelsApplied ? 'text-success' : 'text-muted-foreground')} />
              <p className="text-lg font-bold">{appliedCount}/{allLabelKeys.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Labels Applied</p>
            </div>
            <div className={cn(
              'p-3 rounded-lg border text-center',
              allTraysReady ? 'border-success/30 bg-success/5' : 'border-border',
            )}>
              <Layers className={cn('w-5 h-5 mx-auto mb-1', allTraysReady ? 'text-success' : 'text-muted-foreground')} />
              <p className="text-lg font-bold">
                {perfumeGroups.filter(g => trayPrepared[g.masterId]).length}/{perfumeGroups.length}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trays Ready</p>
            </div>
            <div className={cn(
              'p-3 rounded-lg border text-center',
              insertsPlaced ? 'border-success/30 bg-success/5' : 'border-border',
            )}>
              <ClipboardCheck className={cn('w-5 h-5 mx-auto mb-1', insertsPlaced ? 'text-success' : 'text-muted-foreground')} />
              <p className="text-lg font-bold">{insertsPlaced ? '✓' : '—'}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Inserts Placed</p>
            </div>
          </div>
        </SectionCard>

        {/* ===== STATUS BAR ===== */}
        <div className={cn(
          'flex items-center justify-between p-4 rounded-lg border',
          allReady ? 'border-success/30 bg-success/5' : 'border-amber-500/20 bg-amber-500/5',
        )}>
          <div className="flex items-center gap-3">
            {allReady ? <CheckCircle2 className="w-5 h-5 text-success" /> : <ClipboardCheck className="w-5 h-5 text-amber-500" />}
            <div>
              <p className="text-sm font-semibold">
                {allReady ? 'All labels applied and trays prepared' : 'Label application in progress'}
              </p>
              <p className="text-xs text-muted-foreground">
                {allReady
                  ? 'Proceed to decanting station'
                  : `${[!allLabelsApplied && 'labels', !allTraysReady && 'trays', !insertsPlaced && 'inserts'].filter(Boolean).join(', ')} still pending`
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
