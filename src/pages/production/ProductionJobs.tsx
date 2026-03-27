// ============================================================
// Production Jobs — Track jobs through the 7-stage funnel (F0-F6)
// Queue (F0) → Picking (F1) → Print Labels & Prep (F2) → Decanting (F3) → Assembly (F4) → QC (F5) → Log Inventory (F6)
// Round 40: Major operations restructure
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { PageHeader, SectionCard, KPICard, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Package, Search, Layers, Box, Droplets, Tag,
  CheckCircle2, FlaskConical, Factory, Settings2,
  ChevronRight, Eye, Clock, AlertTriangle, ArrowRight,
  Printer, Plus, Puzzle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { categoryConfig } from '@/lib/product-categories';
import { endProducts as allEndProducts } from '@/lib/bom-data';
import { mockPerfumes } from '@/lib/mock-data';
import type { EndProduct, EndProductCategory } from '@/types';

// ---- Producible categories ----
const PRODUCIBLE_CATEGORIES: EndProductCategory[] = [
  'capsule_themed_set', 'capsule_house_chapter', 'capsule_layering_set', 'capsule_scent_story',
  'whisperer_set', 'gift_set_him', 'gift_set_her', 'gift_set_seasonal',
  'single_aurakey', 'aurakey_refills',
];

// ---- Production Funnel Stages ----
const FUNNEL_STAGES = [
  { id: 'queue', label: 'Queue', short: 'F0', icon: Clock, color: 'bg-slate-500', textColor: 'text-slate-600' },
  { id: 'picking', label: 'Picking', short: 'F1', icon: Package, color: 'bg-amber-500', textColor: 'text-amber-600' },
  { id: 'print_labels_prep', label: 'Print Labels & Prep', short: 'F2', icon: Tag, color: 'bg-blue-500', textColor: 'text-blue-600' },
  { id: 'decanting', label: 'Decanting', short: 'F3', icon: FlaskConical, color: 'bg-purple-500', textColor: 'text-purple-600' },
  { id: 'assembly', label: 'Assembly', short: 'F4', icon: Layers, color: 'bg-orange-500', textColor: 'text-orange-600' },
  { id: 'qc', label: 'QC', short: 'F5', icon: CheckCircle2, color: 'bg-teal-500', textColor: 'text-teal-600' },
  { id: 'log_inventory', label: 'Log Inventory', short: 'F6', icon: Box, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
] as const;

type FunnelStage = typeof FUNNEL_STAGES[number]['id'];

interface ProductionJob {
  jobId: string;
  productName: string;
  productSku: string;
  category: EndProductCategory;
  quantity: number;
  perfumes: { name: string; brand: string; sizeml: number }[];
  totalVials: number;
  totalMl: number;
  currentStage: FunnelStage | 'completed';
  stageHistory: { stage: string; startedAt: string; completedAt?: string; operator?: string }[];
  createdAt: string;
  notes: string;
  priority: 'normal' | 'high' | 'urgent';
}

// Mock production jobs
const mockJobs: ProductionJob[] = [
  {
    jobId: 'PJ-005', productName: 'Floral Discovery Set', productSku: 'EM/PRD/GSH-FLOR',
    category: 'gift_set_her', quantity: 30,
    perfumes: [
      { name: 'Miss Dior', brand: 'Dior', sizeml: 8 },
      { name: 'La Vie Est Belle', brand: 'Lanc\u00f4me', sizeml: 8 },
    ],
    totalVials: 60, totalMl: 480, currentStage: 'queue',
    stageHistory: [],
    createdAt: '2026-02-28T10:00:00Z', notes: 'New batch for spring launch', priority: 'normal',
  },
  {
    jobId: 'PJ-006', productName: 'Oud Royale Capsule', productSku: 'EM/PRD/CTS-OUDR',
    category: 'capsule_themed_set', quantity: 15,
    perfumes: [
      { name: 'Royal Oud', brand: 'Creed', sizeml: 8 },
      { name: 'Oud for Greatness', brand: 'Initio', sizeml: 8 },
      { name: 'Oud Wood', brand: 'Tom Ford', sizeml: 8 },
    ],
    totalVials: 45, totalMl: 360, currentStage: 'queue',
    stageHistory: [],
    createdAt: '2026-02-28T11:00:00Z', notes: 'Priority capsule for VIP clients', priority: 'high',
  },
  {
    jobId: 'PJ-001', productName: 'Oud Legacy Collection', productSku: 'EM/PRD/CTS-OUDL',
    category: 'capsule_themed_set', quantity: 25,
    perfumes: [
      { name: 'Oud Wood', brand: 'Tom Ford', sizeml: 8 },
      { name: 'Oud Ispahan', brand: 'Dior', sizeml: 8 },
      { name: 'Oud Satin Mood', brand: 'MFK', sizeml: 8 },
    ],
    totalVials: 75, totalMl: 600, currentStage: 'decanting',
    stageHistory: [
      { stage: 'picking', startedAt: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T11:30:00Z', operator: 'Ahmed' },
      { stage: 'print_labels_prep', startedAt: '2026-02-25T12:00:00Z', completedAt: '2026-02-25T13:30:00Z', operator: 'Sara' },
      { stage: 'decanting', startedAt: '2026-02-25T14:30:00Z', operator: 'Karim' },
    ],
    createdAt: '2026-02-25T09:00:00Z', notes: 'Capsule drop for March cycle', priority: 'high',
  },
  {
    jobId: 'PJ-002', productName: 'Rose & Oud Discovery', productSku: 'EM/PRD/GSR-ROSE',
    category: 'gift_set_her', quantity: 40,
    perfumes: [
      { name: 'Lost Cherry', brand: 'Tom Ford', sizeml: 8 },
      { name: 'Delina', brand: 'PDM', sizeml: 8 },
    ],
    totalVials: 80, totalMl: 640, currentStage: 'picking',
    stageHistory: [
      { stage: 'picking', startedAt: '2026-02-26T14:00:00Z', operator: 'Ahmed' },
    ],
    createdAt: '2026-02-26T13:00:00Z', notes: 'Restock for March', priority: 'normal',
  },
  {
    jobId: 'PJ-003', productName: 'Whisperer Sampler Set', productSku: 'EM/PRD/WSP-SAMP',
    category: 'whisperer_set', quantity: 100,
    perfumes: [
      { name: 'Baccarat Rouge 540', brand: 'MFK', sizeml: 2 },
      { name: 'Aventus', brand: 'Creed', sizeml: 2 },
      { name: 'Layton', brand: 'PDM', sizeml: 2 },
    ],
    totalVials: 300, totalMl: 600, currentStage: 'completed',
    stageHistory: [
      { stage: 'picking', startedAt: '2026-02-20T09:00:00Z', completedAt: '2026-02-20T10:00:00Z', operator: 'Ahmed' },
      { stage: 'print_labels_prep', startedAt: '2026-02-20T10:30:00Z', completedAt: '2026-02-20T11:30:00Z', operator: 'Sara' },
      { stage: 'decanting', startedAt: '2026-02-20T13:00:00Z', completedAt: '2026-02-20T15:00:00Z', operator: 'Karim' },
      { stage: 'assembly', startedAt: '2026-02-20T15:30:00Z', completedAt: '2026-02-20T16:30:00Z', operator: 'Ahmed' },
      { stage: 'qc', startedAt: '2026-02-21T09:00:00Z', completedAt: '2026-02-21T10:00:00Z', operator: 'Layla' },
      { stage: 'log_inventory', startedAt: '2026-02-21T10:30:00Z', completedAt: '2026-02-21T11:00:00Z', operator: 'Karim' },
    ],
    createdAt: '2026-02-20T08:00:00Z', notes: 'Whisper sampler batch', priority: 'normal',
  },
  {
    jobId: 'PJ-004', productName: 'Aura Key GM1 Refill', productSku: 'EM/PRD/AKR-GM1',
    category: 'aurakey_refills', quantity: 60,
    perfumes: [
      { name: 'Bleu de Chanel', brand: 'Chanel', sizeml: 8 },
      { name: 'Sauvage', brand: 'Dior', sizeml: 8 },
      { name: 'Acqua di Gio', brand: 'Armani', sizeml: 8 },
    ],
    totalVials: 180, totalMl: 1440, currentStage: 'assembly',
    stageHistory: [
      { stage: 'picking', startedAt: '2026-02-24T09:00:00Z', completedAt: '2026-02-24T10:00:00Z', operator: 'Ahmed' },
      { stage: 'print_labels_prep', startedAt: '2026-02-24T10:30:00Z', completedAt: '2026-02-24T11:30:00Z', operator: 'Sara' },
      { stage: 'decanting', startedAt: '2026-02-24T13:00:00Z', completedAt: '2026-02-24T16:00:00Z', operator: 'Karim' },
      { stage: 'assembly', startedAt: '2026-02-25T09:00:00Z', operator: 'Ahmed' },
    ],
    createdAt: '2026-02-24T08:00:00Z', notes: 'Monthly refill batch', priority: 'urgent',
  },
];

export default function ProductionJobs() {
  const [jobs, setJobs] = useState<ProductionJob[]>(mockJobs);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const active = jobs.filter(j => j.currentStage !== 'completed');
    return {
      total: jobs.length,
      active: active.length,
      completed: jobs.filter(j => j.currentStage === 'completed').length,
      totalVials: active.reduce((s, j) => s + j.totalVials, 0),
      urgent: jobs.filter(j => j.priority === 'urgent' && j.currentStage !== 'completed').length,
    };
  }, [jobs]);

  // Stage counts for the funnel view
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    FUNNEL_STAGES.forEach(s => { counts[s.id] = 0; });
    counts['completed'] = 0;
    jobs.forEach(j => { counts[j.currentStage] = (counts[j.currentStage] || 0) + 1; });
    return counts;
  }, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (stageFilter !== 'all') {
      result = result.filter(j => j.currentStage === stageFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j =>
        j.productName.toLowerCase().includes(q) ||
        j.jobId.toLowerCase().includes(q) ||
        j.productSku.toLowerCase().includes(q)
      );
    }
    return result;
  }, [jobs, stageFilter, searchQuery]);

  const handleAdvanceStage = (jobId: string) => {
    setJobs(prev => prev.map(j => {
      if (j.jobId !== jobId) return j;
      const currentIdx = FUNNEL_STAGES.findIndex(s => s.id === j.currentStage);
      if (currentIdx === -1) return j; // already completed
      const nextStage = currentIdx < FUNNEL_STAGES.length - 1
        ? FUNNEL_STAGES[currentIdx + 1].id
        : 'completed';
      const now = new Date().toISOString();
      const updatedHistory = j.stageHistory.map(h =>
        h.stage === j.currentStage && !h.completedAt ? { ...h, completedAt: now } : h
      );
      if (nextStage !== 'completed') {
        updatedHistory.push({ stage: nextStage, startedAt: now });
      }
      return { ...j, currentStage: nextStage as FunnelStage | 'completed', stageHistory: updatedHistory };
    }));
    const job = jobs.find(j => j.jobId === jobId);
    if (job) {
      const currentIdx = FUNNEL_STAGES.findIndex(s => s.id === job.currentStage);
      const nextLabel = currentIdx < FUNNEL_STAGES.length - 1
        ? FUNNEL_STAGES[currentIdx + 1].label
        : 'Completed';
      toast.success(`${jobId} advanced to ${nextLabel}`);
    }
    // Update selected job if viewing it
    if (selectedJob?.jobId === jobId) {
      setSelectedJob(prev => {
        if (!prev) return null;
        const updated = jobs.find(j => j.jobId === jobId);
        return updated || prev;
      });
    }
  };

  const handleConvertToJob = (jobId: string) => {
    const job = jobs.find(j => j.jobId === jobId);
    if (!job || job.currentStage !== 'queue') return;
    // Move from Queue (F0) to Picking (F1) and push to Job Management
    const now = new Date().toISOString();
    setJobs(prev => prev.map(j => {
      if (j.jobId !== jobId) return j;
      return {
        ...j,
        currentStage: 'picking' as FunnelStage,
        stageHistory: [{ stage: 'picking', startedAt: now }],
      };
    }));
    toast.success(`${jobId} converted to job — pushed to Job Management`, {
      description: `${job.productName} moved from Queue to Picking. Job is now visible in Order Grouping under Ready-to-Ship.`,
    });
  };

  const priorityConfig = {
    normal: { label: 'Normal', variant: 'muted' as const },
    high: { label: 'High', variant: 'gold' as const },
    urgent: { label: 'Urgent', variant: 'destructive' as const },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Jobs"
        subtitle="Track production jobs through the funnel — F0 Queue to F6 Log Inventory"
        actions={
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Production Job
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard label="Total Jobs" value={stats.total} icon={Factory} />
        <KPICard label="Active" value={stats.active} icon={FlaskConical} />
        <KPICard label="Completed" value={stats.completed} icon={CheckCircle2} />
        <KPICard label="Active Vials" value={stats.totalVials.toLocaleString()} icon={Droplets} />
        <KPICard label="Urgent" value={stats.urgent} icon={AlertTriangle} variant={stats.urgent > 0 ? 'default' : 'default'} />
      </div>

      {/* Funnel Stage Overview */}
      <SectionCard title="Production Funnel" subtitle="Click a stage to filter jobs">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {FUNNEL_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            const count = stageCounts[stage.id];
            const isActive = stageFilter === stage.id;
            return (
              <div key={stage.id} className="flex items-center">
                <button
                  onClick={() => setStageFilter(isActive ? 'all' : stage.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all min-w-[120px]',
                    isActive
                      ? 'border-gold bg-gold/10 shadow-sm'
                      : 'border-border/50 bg-muted/30 hover:bg-muted/50'
                  )}
                >
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold', stage.color)}>
                    {count}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-medium">{stage.label}</div>
                    <div className="text-[10px] text-muted-foreground">{stage.short}</div>
                  </div>
                </button>
                {i < FUNNEL_STAGES.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-0.5 shrink-0" />
                )}
              </div>
            );
          })}
          {/* Completed */}
          <div className="flex items-center">
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-0.5 shrink-0" />
            <button
              onClick={() => setStageFilter(stageFilter === 'completed' ? 'all' : 'completed')}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all min-w-[120px]',
                stageFilter === 'completed'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                  : 'border-border/50 bg-muted/30 hover:bg-muted/50'
              )}
            >
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                {stageCounts['completed']}
              </div>
              <div className="text-left">
                <div className="text-xs font-medium">Done</div>
                <div className="text-[10px] text-muted-foreground">✓</div>
              </div>
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Job List */}
      <SectionCard
        title={stageFilter === 'all' ? 'All Jobs' : `Jobs in ${FUNNEL_STAGES.find(s => s.id === stageFilter)?.label || 'Completed'}`}
        subtitle={`${filteredJobs.length} jobs`}
        headerActions={
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        }
      >
        {filteredJobs.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="No jobs found"
            description={stageFilter !== 'all' ? 'No jobs in this stage. Try a different filter.' : 'No production jobs yet.'}
          />
        ) : (
          <div className="space-y-3">
            {filteredJobs.map(job => {
              const cat = categoryConfig[job.category];
              const CatIcon = cat?.icon || Package;
              const currentStageInfo = FUNNEL_STAGES.find(s => s.id === job.currentStage);
              const stageIdx = FUNNEL_STAGES.findIndex(s => s.id === job.currentStage);
              const progress = job.currentStage === 'completed' ? 100 : Math.round(((stageIdx) / FUNNEL_STAGES.length) * 100);
              const prio = priorityConfig[job.priority];

              return (
                <Card
                  key={job.jobId}
                  className="hover:shadow-md transition-shadow cursor-pointer border-border/60"
                  onClick={() => setSelectedJob(job)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                          <CatIcon className={cn('w-5 h-5', cat?.color || 'text-muted-foreground')} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">{job.jobId}</span>
                            {job.currentStage === 'completed' ? (
                              <StatusBadge variant="success">Completed</StatusBadge>
                            ) : (
                              <Badge variant="outline" className={cn('text-[10px] gap-1', currentStageInfo?.textColor)}>
                                <div className={cn('w-2 h-2 rounded-full', currentStageInfo?.color)} />
                                {currentStageInfo?.short} · {currentStageInfo?.label}
                              </Badge>
                            )}
                            {job.priority !== 'normal' && (
                              <StatusBadge variant={prio.variant}>{prio.label}</StatusBadge>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm truncate">{job.productName}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {cat?.label} · {job.quantity} units · {job.totalVials} vials
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Progress bar */}
                        <div className="w-24">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">{progress}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', job.currentStage === 'completed' ? 'bg-emerald-500' : 'bg-gold')}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        {job.currentStage === 'queue' ? (
                          <Button
                            size="sm"
                            className="text-xs gap-1 bg-gold hover:bg-gold/90 text-gold-foreground"
                            onClick={e => { e.stopPropagation(); handleConvertToJob(job.jobId); }}
                          >
                            <ArrowRight className="w-3.5 h-3.5" /> Convert to Job
                          </Button>
                        ) : job.currentStage !== 'completed' && (
                          <div className="flex flex-col items-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1"
                              onClick={e => { e.stopPropagation(); handleAdvanceStage(job.jobId); }}
                            >
                              <ArrowRight className="w-3.5 h-3.5" /> Advance
                            </Button>
                            <span className="text-[9px] text-muted-foreground/60 mt-0.5">manual override</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mini funnel progress */}
                    <div className="flex items-center gap-0.5 mt-3">
                      {FUNNEL_STAGES.map((stage, i) => {
                        const isCompleted = stageIdx > i || job.currentStage === 'completed';
                        const isCurrent = stage.id === job.currentStage;
                        return (
                          <div
                            key={stage.id}
                            className={cn(
                              'h-1.5 flex-1 rounded-full transition-colors',
                              isCompleted ? stage.color :
                              isCurrent ? `${stage.color} animate-pulse` :
                              'bg-muted'
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* Perfume chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {job.perfumes.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] gap-1 font-normal">
                          <Droplets className="w-3 h-3 text-purple-500" />
                          {p.name} · {p.sizeml}ml
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Job Detail Dialog */}
      {selectedJob && (
        <JobDetailDialog
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onAdvance={() => {
            handleAdvanceStage(selectedJob.jobId);
            setTimeout(() => {
              setSelectedJob(prev => {
                if (!prev) return null;
                return jobs.find(j => j.jobId === prev.jobId) || prev;
              });
            }, 50);
          }}
        />
      )}

      {/* Create Job Dialog */}
      {showCreateDialog && (
        <CreateJobDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={(job) => {
            setJobs(prev => [job, ...prev]);
            setShowCreateDialog(false);
            toast.success(`Production job ${job.jobId} created — ${job.quantity} units queued`);
          }}
          nextId={`PJ-${String(jobs.length + 1).padStart(3, '0')}`}
        />
      )}
    </div>
  );
}

// ============================================================
// Job Detail Dialog
// ============================================================
function JobDetailDialog({
  job, onClose, onAdvance,
}: {
  job: ProductionJob;
  onClose: () => void;
  onAdvance: () => void;
}) {
  const currentStageInfo = FUNNEL_STAGES.find(s => s.id === job.currentStage);
  const stageIdx = FUNNEL_STAGES.findIndex(s => s.id === job.currentStage);
  const cat = categoryConfig[job.category];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-gold" />
            {job.jobId} — {job.productName}
          </DialogTitle>
          <DialogDescription>
            {cat?.label} · {job.quantity} units · Created {new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </DialogDescription>
        </DialogHeader>

        {/* Current Status */}
        <div className="p-4 rounded-lg border border-border/60 bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Current Stage</h4>
            {job.currentStage === 'completed' ? (
              <StatusBadge variant="success">Completed</StatusBadge>
            ) : (
              <Badge className={cn('gap-1', currentStageInfo?.color, 'text-white border-0')}>
                {currentStageInfo?.short} · {currentStageInfo?.label}
              </Badge>
            )}
          </div>

          {/* Full funnel progress */}
          <div className="space-y-2">
            {FUNNEL_STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const history = job.stageHistory.find(h => h.stage === stage.id);
              const isCompleted = history?.completedAt;
              const isCurrent = stage.id === job.currentStage;
              const isPending = !history;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-lg transition-colors',
                    isCurrent ? 'bg-gold/10 border border-gold/30' :
                    isCompleted ? 'bg-emerald-500/5' :
                    'opacity-50'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
                    isCompleted ? 'bg-emerald-500' :
                    isCurrent ? stage.color :
                    'bg-muted-foreground/20'
                  )}>
                    {isCompleted ? '✓' : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{stage.short} · {stage.label}</div>
                    {history && (
                      <div className="text-[11px] text-muted-foreground">
                        {history.operator && <span>by {history.operator} · </span>}
                        Started {new Date(history.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {history.completedAt && (
                          <span> → Done {new Date(history.completedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    )}
                    {isPending && <div className="text-[11px] text-muted-foreground">Pending</div>}
                  </div>
                  {isCurrent && (
                    <Clock className="w-4 h-4 text-gold animate-pulse shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {job.currentStage !== 'completed' && (
            <Button
              onClick={onAdvance}
              className="w-full mt-3 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              Advance to {stageIdx < FUNNEL_STAGES.length - 1 ? FUNNEL_STAGES[stageIdx + 1].label : 'Completed'}
            </Button>
          )}
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <span className="text-xs text-muted-foreground">Product</span>
              <div className="text-sm font-medium">{job.productName}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">SKU</span>
              <div className="text-sm font-mono">{job.productSku}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Category</span>
              <div className="text-sm">{cat?.label}</div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-muted-foreground">Quantity</span>
              <div className="text-sm font-bold">{job.quantity} units</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Total Vials</span>
              <div className="text-sm font-bold">{job.totalVials}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Total Liquid</span>
              <div className="text-sm font-bold">{job.totalMl.toLocaleString()} ml</div>
            </div>
          </div>
        </div>

        {/* Perfumes */}
        <div>
          <h4 className="text-sm font-medium mb-2">Perfumes</h4>
          <div className="space-y-1.5">
            {job.perfumes.map((p, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/30 border border-border/40">
                <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-purple-600">{i + 1}</span>
                </div>
                <Droplets className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">({p.brand})</span>
                <span className="text-xs text-muted-foreground ml-auto">{p.sizeml}ml × {job.quantity} = {p.sizeml * job.quantity}ml</span>
              </div>
            ))}
          </div>
        </div>

        {job.notes && (
          <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
            <span className="text-xs text-muted-foreground">Notes:</span>
            <p className="text-sm mt-0.5">{job.notes}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Create Job Dialog — 3-step BOM Wizard
// ============================================================
interface PerfumeSelection {
  slotIndex: number;
  perfumeId: string;
  perfumeName: string;
  brand: string;
  sizeml: number;
}

function CreateJobDialog({
  onClose, onCreated, nextId,
}: {
  onClose: () => void;
  onCreated: (job: ProductionJob) => void;
  nextId: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedProduct, setSelectedProduct] = useState<EndProduct | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [quantity, setQuantity] = useState(10);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'normal'>('normal');
  const [perfumeSelections, setPerfumeSelections] = useState<PerfumeSelection[]>([]);

  const producibleProducts = useMemo(() =>
    allEndProducts.filter(p => PRODUCIBLE_CATEGORIES.includes(p.category)),
  []);

  const filteredProducts = useMemo(() => {
    let result = producibleProducts;
    if (categoryFilter !== 'all') result = result.filter(p => p.category === categoryFilter);
    if (productSearch) {
      const q = productSearch.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return result;
  }, [producibleProducts, categoryFilter, productSearch]);

  const uniqueCategories = useMemo(() => {
    const cats = Array.from(new Set(producibleProducts.map(p => p.category)));
    return cats.sort();
  }, [producibleProducts]);

  const handleSelectProduct = useCallback((product: EndProduct) => {
    setSelectedProduct(product);
    const variableSlots = product.bom?.line_items?.filter(li => li.component.is_variable) || [];
    setPerfumeSelections(variableSlots.map((_, i) => ({
      slotIndex: i, perfumeId: '', perfumeName: '', brand: '', sizeml: 8,
    })));
    setStep(2);
  }, []);

  const handlePerfumeSelect = useCallback((slotIndex: number, perfumeId: string) => {
    const perfume = mockPerfumes.find(p => p.master_id === perfumeId);
    if (!perfume) return;
    setPerfumeSelections(prev => prev.map(s =>
      s.slotIndex === slotIndex
        ? { ...s, perfumeId, perfumeName: `${perfume.brand} — ${perfume.name}`, brand: perfume.brand, sizeml: s.sizeml }
        : s
    ));
  }, []);

  const totals = useMemo(() => {
    const totalVials = perfumeSelections.length * quantity;
    const totalMl = perfumeSelections.reduce((sum, p) => sum + p.sizeml * quantity, 0);
    return { totalVials, totalMl };
  }, [perfumeSelections, quantity]);

  const allPerfumesSelected = perfumeSelections.every(s => s.perfumeId);

  const handleCreate = useCallback(() => {
    if (!selectedProduct) return;
    const job: ProductionJob = {
      jobId: nextId,
      productName: selectedProduct.name,
      productSku: selectedProduct.sku,
      category: selectedProduct.category,
      quantity,
      perfumes: perfumeSelections.map(p => ({ name: p.perfumeName, brand: p.brand, sizeml: p.sizeml })),
      totalVials: totals.totalVials,
      totalMl: totals.totalMl,
      currentStage: 'picking',
      stageHistory: [],
      createdAt: new Date().toISOString(),
      notes,
      priority,
    };
    onCreated(job);
  }, [selectedProduct, quantity, perfumeSelections, totals, notes, priority, nextId, onCreated]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-gold" />
            New Production Job
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Step 1 of 3 — Select an End Product from the BOM catalog'}
            {step === 2 && 'Step 2 of 3 — Select perfumes for variable slots and set quantity'}
            {step === 3 && 'Step 3 of 3 — Review and confirm production job'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                s === step ? 'bg-gold text-gold-foreground' :
                s < step ? 'bg-emerald-500 text-white' :
                'bg-muted text-muted-foreground'
              )}>
                {s < step ? '✓' : s}
              </div>
              <span className={cn('text-sm', s === step ? 'font-medium' : 'text-muted-foreground')}>
                {s === 1 ? 'Product' : s === 2 ? 'Perfumes' : 'Review'}
              </span>
              {s < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Product */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48 h-9"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{categoryConfig[cat]?.label || cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <EmptyState icon={Package} title="No products found" description="Try a different search or category." />
              ) : filteredProducts.map(product => {
                const cat = categoryConfig[product.category];
                const CatIcon = cat?.icon || Package;
                return (
                  <Card
                    key={product.sku}
                    className="cursor-pointer hover:shadow-md transition-shadow border-border/60"
                    onClick={() => handleSelectProduct(product)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                        <CatIcon className={cn('w-4.5 h-4.5', cat?.color || 'text-muted-foreground')} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold truncate">{product.name}</h4>
                        <p className="text-[11px] text-muted-foreground">{cat?.label} · {product.sku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">{product.bom?.line_items?.filter(li => li.component.is_variable).length || 0} perfume slots</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Select Perfumes + Quantity */}
        {step === 2 && selectedProduct && (
          <div className="space-y-4">
            <Card className="border-gold/30 bg-gold/5">
              <CardContent className="p-3 flex items-center gap-3">
                <Puzzle className="w-5 h-5 text-gold shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold">{selectedProduct.name}</h4>
                  <p className="text-[11px] text-muted-foreground">{selectedProduct.sku}</p>
                </div>
              </CardContent>
            </Card>

            {/* Perfume Slots */}
            {perfumeSelections.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Select Perfumes ({perfumeSelections.filter(s => s.perfumeId).length}/{perfumeSelections.length})</h4>
                {perfumeSelections.map((slot, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/10">
                    <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-purple-600">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <Select value={slot.perfumeId || 'none'} onValueChange={v => v !== 'none' && handlePerfumeSelect(i, v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select perfume..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Select perfume...</SelectItem>
                          {mockPerfumes.filter(p => p.visibility === 'active').slice(0, 50).map(p => (
                            <SelectItem key={p.master_id} value={p.master_id}>{p.brand} — {p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{slot.sizeml}ml</div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quantity (units)</label>
                <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="h-9" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                <Select value={priority} onValueChange={v => setPriority(v as 'urgent' | 'high' | 'normal')}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Production notes..." className="h-9" />
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
              <div><span className="text-xs text-muted-foreground">Total Vials</span><div className="text-sm font-bold">{totals.totalVials}</div></div>
              <div><span className="text-xs text-muted-foreground">Total Liquid</span><div className="text-sm font-bold">{totals.totalMl.toLocaleString()} ml</div></div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!allPerfumesSelected && perfumeSelections.length > 0}
                className="bg-gold hover:bg-gold/90 text-gold-foreground"
              >Next → Review</Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && selectedProduct && (
          <div className="space-y-4">
            <Card className="border-gold/30 bg-gold/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{selectedProduct.name}</h4>
                  <Badge variant="outline" className={cn(
                    'text-xs',
                    priority === 'urgent' ? 'bg-red-100 text-red-700 border-red-200' :
                    priority === 'high' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  )}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-xs text-muted-foreground block">Quantity</span>{quantity} units</div>
                  <div><span className="text-xs text-muted-foreground block">Total Vials</span>{totals.totalVials}</div>
                  <div><span className="text-xs text-muted-foreground block">Total Liquid</span>{totals.totalMl.toLocaleString()} ml</div>
                </div>
                {perfumeSelections.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Perfumes</span>
                    <div className="flex flex-wrap gap-1.5">
                      {perfumeSelections.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] gap-1">
                          <Droplets className="w-3 h-3 text-purple-500" />
                          {p.perfumeName || 'Not selected'} · {p.sizeml}ml
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {notes && <p className="text-xs text-muted-foreground">Notes: {notes}</p>}
              </CardContent>
            </Card>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
              This will create a production job starting at the <strong>Picking</strong> stage. You can convert it to a Job Management task later.
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={handleCreate} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
                <Plus className="w-4 h-4" /> Create Production Job
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
