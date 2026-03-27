// ============================================================
// Subscription Cycles — Production Planning Module
// Overview of subscription cycle batches and their progress
// Create cycles → jobs flow to Job Management → work at Pod Operations → Fulfillment → Shipping
// This is a PLANNING view — actual production work is at the stations
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  RotateCcw, Users, Clock, CheckCircle2, AlertTriangle,
  Package, ArrowRight, Calendar, Truck, Layers, Droplets,
  CalendarDays, Tag, FlaskConical, Box, PackageCheck,
  BarChart3, ExternalLink, Play, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

// ---- Pipeline Stages (for progress visualization only) ----
const ALL_STAGES = [
  { id: 'picking', label: 'Picking', short: 'S2', icon: Package, color: 'bg-amber-500' },
  { id: 'labeling', label: 'Labeling', short: 'S3', icon: Tag, color: 'bg-blue-500' },
  { id: 'decanting', label: 'Decanting', short: 'S4', icon: FlaskConical, color: 'bg-purple-500' },
  { id: 'assembly', label: 'Assembly', short: 'S5', icon: Layers, color: 'bg-orange-500' },
  { id: 'fulfillment', label: 'Fulfillment', short: 'S5', icon: PackageCheck, color: 'bg-cyan-500' },
  { id: 'shipping', label: 'Shipping', short: 'S6', icon: Truck, color: 'bg-emerald-500' },
] as const;

type StageId = typeof ALL_STAGES[number]['id'];
type CycleStatus = 'planning' | 'in_production' | 'fulfillment' | 'shipping' | 'completed';

interface SubscriptionCycle {
  id: string;
  cycleNumber: number;
  month: string;
  year: number;
  status: CycleStatus;
  startDate: string;
  endDate: string;
  subscriberCount: number;
  totalVials: number;
  completedVials: number;
  currentStage: StageId;
  jobRef?: string;
  perfumeSelections: string[];
}

// ---- Mock Data ----
const mockCycles: SubscriptionCycle[] = [
  {
    id: 'CYC-2026-03-W1', cycleNumber: 1, month: 'March', year: 2026,
    status: 'in_production', startDate: '2026-03-01', endDate: '2026-03-07',
    subscriberCount: 420, totalVials: 1680, completedVials: 840, currentStage: 'decanting',
    jobRef: 'JOB-2026-0045',
    perfumeSelections: ['Aventus', 'Baccarat Rouge 540', 'Oud Wood', 'Sauvage'],
  },
  {
    id: 'CYC-2026-03-W2', cycleNumber: 2, month: 'March', year: 2026,
    status: 'planning', startDate: '2026-03-08', endDate: '2026-03-14',
    subscriberCount: 385, totalVials: 1540, completedVials: 0, currentStage: 'picking',
    perfumeSelections: ['La Nuit de L\'Homme', 'Tobacco Vanille', 'Bleu de Chanel', 'Eros'],
  },
  {
    id: 'CYC-2026-03-W3', cycleNumber: 3, month: 'March', year: 2026,
    status: 'planning', startDate: '2026-03-15', endDate: '2026-03-21',
    subscriberCount: 395, totalVials: 1580, completedVials: 0, currentStage: 'picking',
    perfumeSelections: [],
  },
  {
    id: 'CYC-2026-02-W4', cycleNumber: 4, month: 'February', year: 2026,
    status: 'completed', startDate: '2026-02-22', endDate: '2026-02-28',
    subscriberCount: 410, totalVials: 1640, completedVials: 1640, currentStage: 'shipping',
    jobRef: 'JOB-2026-0039',
    perfumeSelections: ['Layton', 'Hacivat', 'Green Irish Tweed', 'Millesime Imperial'],
  },
];

const STATUS_CONFIG: Record<CycleStatus, { label: string; color: string }> = {
  planning: { label: 'Planning', color: 'bg-slate-100 text-slate-700' },
  in_production: { label: 'In Production', color: 'bg-amber-100 text-amber-700' },
  fulfillment: { label: 'Fulfillment', color: 'bg-cyan-100 text-cyan-700' },
  shipping: { label: 'Shipping', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
};

export default function SubscriptionCyclesModule() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCycle, setSelectedCycle] = useState<SubscriptionCycle | null>(null);

  const filteredCycles = useMemo(() => {
    return mockCycles.filter(c => statusFilter === 'all' || c.status === statusFilter);
  }, [statusFilter]);

  const stats = useMemo(() => ({
    active: mockCycles.filter(c => c.status !== 'completed' && c.status !== 'planning').length,
    planned: mockCycles.filter(c => c.status === 'planning').length,
    totalSubscribers: mockCycles.filter(c => c.status !== 'completed').reduce((s, c) => s + c.subscriberCount, 0),
    totalVials: mockCycles.filter(c => c.status !== 'completed').reduce((s, c) => s + c.totalVials, 0),
  }), []);

  const getStageIndex = (stage: StageId) => ALL_STAGES.findIndex(s => s.id === stage);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Cycles"
        subtitle="Plan and track subscription production cycles. Work flows through Job Management → Pod Operations → Fulfillment → Shipping."
      />

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-indigo-200/60 bg-indigo-50/40">
        <CalendarDays className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-indigo-800">Cycle Planning & Tracking</p>
          <p className="text-indigo-700/70 mt-0.5">
            Each cycle combines ALL subscribers into one production batch. Create cycles here, then send to{' '}
            <Link href="/jobs/allocation" className="underline font-medium">Job Management</Link>{' '}
            for station allocation. Track progress as work moves through{' '}
            <Link href="/ops/pod-dashboard" className="underline font-medium">Pod Operations</Link>.
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-amber-200/50 bg-amber-50/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-700">{stats.active}</div>
            <div className="text-xs text-muted-foreground mt-1">Active Cycles</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/50 bg-slate-50/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-700">{stats.planned}</div>
            <div className="text-xs text-muted-foreground mt-1">Planned</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200/50 bg-blue-50/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{stats.totalSubscribers.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Subscribers</div>
          </CardContent>
        </Card>
        <Card className="border-purple-200/50 bg-purple-50/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">{stats.totalVials.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Vials</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="in_production">In Production</SelectItem>
            <SelectItem value="fulfillment">Fulfillment</SelectItem>
            <SelectItem value="shipping">Shipping</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cycle Cards */}
      <div className="space-y-3">
        {filteredCycles.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No cycles found" description="Adjust your filters to see cycles." />
        ) : (
          filteredCycles.map(cycle => {
            const stageIdx = getStageIndex(cycle.currentStage);
            const progress = cycle.totalVials > 0 ? Math.round((cycle.completedVials / cycle.totalVials) * 100) : 0;
            return (
              <Card key={cycle.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedCycle(cycle)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{cycle.id}</span>
                        <Badge variant="outline" className={cn('text-[10px]', STATUS_CONFIG[cycle.status].color)}>
                          {STATUS_CONFIG[cycle.status].label}
                        </Badge>
                        {cycle.jobRef && (
                          <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-600">
                            {cycle.jobRef}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm">{cycle.month} {cycle.year} — Cycle {cycle.cycleNumber}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cycle.subscriberCount} subscribers · {cycle.totalVials.toLocaleString()} vials ·{' '}
                        {new Date(cycle.startDate).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })} –{' '}
                        {new Date(cycle.endDate).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{progress}%</div>
                      <div className="text-[10px] text-muted-foreground">Complete</div>
                    </div>
                  </div>

                  {/* Pipeline Progress (read-only) */}
                  {cycle.status !== 'planning' && (
                    <div className="flex items-center gap-1 mb-2">
                      {ALL_STAGES.map((stage, idx) => {
                        const StageIcon = stage.icon;
                        const isComplete = idx < stageIdx;
                        const isCurrent = idx === stageIdx;
                        return (
                          <div key={stage.id} className="flex items-center gap-1 flex-1">
                            <div className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                              isComplete ? 'bg-emerald-500 text-white' : isCurrent ? `${stage.color} text-white` : 'bg-muted text-muted-foreground',
                            )}>
                              {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : <StageIcon className="w-3 h-3" />}
                            </div>
                            {idx < ALL_STAGES.length - 1 && (
                              <div className={cn('h-0.5 flex-1', isComplete ? 'bg-emerald-500' : 'bg-muted')} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="flex-1 h-2" />
                    <span className="text-xs font-medium text-muted-foreground">{cycle.completedVials.toLocaleString()}/{cycle.totalVials.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Cycle Detail Dialog */}
      <Dialog open={!!selectedCycle} onOpenChange={() => setSelectedCycle(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-500" />
              {selectedCycle?.month} {selectedCycle?.year} — Cycle {selectedCycle?.cycleNumber}
            </DialogTitle>
            <DialogDescription>{selectedCycle?.id}</DialogDescription>
          </DialogHeader>
          {selectedCycle && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-[10px] text-muted-foreground">Subscribers</div>
                  <div className="text-lg font-bold">{selectedCycle.subscriberCount}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-[10px] text-muted-foreground">Total Vials</div>
                  <div className="text-lg font-bold">{selectedCycle.totalVials.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-[10px] text-muted-foreground">Completed</div>
                  <div className="text-lg font-bold text-emerald-600">{selectedCycle.completedVials.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-[10px] text-muted-foreground">Stage</div>
                  <div className="text-sm font-semibold mt-1">{ALL_STAGES.find(s => s.id === selectedCycle.currentStage)?.label || 'N/A'}</div>
                </div>
              </div>

              {selectedCycle.perfumeSelections.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2">Perfume Selections</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCycle.perfumeSelections.map(p => (
                      <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedCycle.jobRef && (
                <div className="p-3 rounded-lg border border-violet-200/60 bg-violet-50/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-500" />
                      <span className="text-xs">Job Reference: <strong>{selectedCycle.jobRef}</strong></span>
                    </div>
                    <Link href="/jobs/allocation">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-violet-600">
                        View in Job Management <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Pipeline visualization (read-only) */}
              <div>
                <h4 className="text-xs font-semibold mb-2">Pipeline Progress</h4>
                <div className="flex items-center gap-1">
                  {ALL_STAGES.map((stage, idx) => {
                    const stageIdx = getStageIndex(selectedCycle.currentStage);
                    const isComplete = idx < stageIdx;
                    const isCurrent = idx === stageIdx;
                    const StageIcon = stage.icon;
                    return (
                      <div key={stage.id} className="flex items-center gap-1 flex-1">
                        <div className="flex flex-col items-center gap-1">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            isComplete ? 'bg-emerald-500 text-white' : isCurrent ? `${stage.color} text-white ring-2 ring-offset-2 ring-indigo-300` : 'bg-muted text-muted-foreground',
                          )}>
                            {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <StageIcon className="w-3.5 h-3.5" />}
                          </div>
                          <span className={cn('text-[9px]', isCurrent ? 'font-bold' : 'text-muted-foreground')}>{stage.label}</span>
                        </div>
                        {idx < ALL_STAGES.length - 1 && (
                          <div className={cn('h-0.5 flex-1 mt-[-12px]', isComplete ? 'bg-emerald-500' : 'bg-muted')} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCycle(null)}>Close</Button>
            {selectedCycle?.status === 'planning' && (
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5" onClick={() => {
                toast.success(`Cycle ${selectedCycle.id} sent to Job Management for allocation`);
                setSelectedCycle(null);
              }}>
                <ArrowRight className="w-4 h-4" /> Send to Job Management
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
