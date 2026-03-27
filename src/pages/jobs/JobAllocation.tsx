// ============================================================
// Job Allocation — Pod-Based Job Assignment
// Assign production jobs to pods with tags, timelines, and priority
// Manual allocation is an override — default allocation from Production Queue
// ============================================================
import { useState, useMemo } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Layers, Package, ArrowRight, Search, Clock,
  CheckCircle2, AlertTriangle, Truck, Users, Eye,
  Beaker, Key, Sparkles, Gift, Tag, CalendarDays,
  Timer, Zap, RotateCcw, Target, PackageCheck,
  Briefcase, FlaskConical, SplitSquareVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
type JobTag = 'subscription_cycle' | 'one_time' | 'first_subscription' | 'rts_production';
type AllocationStatus = 'unallocated' | 'allocated' | 'in_progress' | 'completed';
type PriorityLevel = 'urgent' | 'high' | 'normal' | 'low';

interface ProductionJob {
  id: string;
  name: string;
  title: string;
  tag: JobTag;
  sourceLabel: string;
  priority: PriorityLevel;
  itemCount: number;
  vialsNeeded: number;
  assignedPod?: string;
  status: AllocationStatus;
  createdAt: string;
  dueDate?: string;
  timelineDays: number;
  contingencyDays: number;
}

// ---- Tag Config ----
const TAG_CONFIG: Record<JobTag, { label: string; icon: React.ElementType; color: string; bgColor: string; defaultTimeline: number; contingency: number; description: string }> = {
  subscription_cycle: {
    label: 'Subscription Cycle',
    icon: RotateCcw,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    defaultTimeline: 6,
    contingency: 1,
    description: 'Monthly subscription batch — 5-7 day timeline',
  },
  one_time: {
    label: 'One-Time Order',
    icon: Key,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    defaultTimeline: 1,
    contingency: 1,
    description: 'Single order — 1 day + 1 day contingency',
  },
  first_subscription: {
    label: 'First Subscription Order',
    icon: Sparkles,
    color: 'text-gold',
    bgColor: 'bg-amber-100',
    defaultTimeline: 1,
    contingency: 1,
    description: 'New subscriber welcome kit — 1 day + 1 day contingency',
  },
  rts_production: {
    label: 'Ready to Ship Products Production',
    icon: PackageCheck,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    defaultTimeline: 2,
    contingency: 1,
    description: 'Internal RTS production — 1-3 days adjustable',
  },
};

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; color: string; bgColor: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-700', bgColor: 'bg-red-100' },
  high: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  normal: { label: 'Normal', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  low: { label: 'Low', color: 'text-slate-600', bgColor: 'bg-slate-100' },
};

const STATUS_CONFIG: Record<AllocationStatus, { label: string; color: string }> = {
  unallocated: { label: 'Unallocated', color: 'bg-red-100 text-red-700' },
  allocated: { label: 'Allocated', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
};

// ---- Pods ----
const PRODUCTION_PODS = [
  { id: 'pod-alpha', name: 'Pod Alpha', type: 'production', activeJobs: 2 },
  { id: 'pod-bravo', name: 'Pod Bravo', type: 'production', activeJobs: 1 },
  { id: 'pod-charlie', name: 'Pod Charlie', type: 'production', activeJobs: 0 },
];

const FULFILLMENT_PODS = [
  { id: 'pod-delta', name: 'Pod Delta', type: 'fulfillment', activeJobs: 1 },
  { id: 'pod-echo', name: 'Pod Echo', type: 'fulfillment', activeJobs: 0 },
];

// ---- Mock Data ----
const mockJobs: ProductionJob[] = [
  { id: 'JOB-4201', name: 'March Cycle', title: 'March Cycle — GM1 Batch', tag: 'subscription_cycle', sourceLabel: 'CYC-2026-03', priority: 'high', itemCount: 180, vialsNeeded: 540, assignedPod: 'Pod Alpha', status: 'in_progress', createdAt: '2026-02-25', dueDate: '2026-03-03', timelineDays: 6, contingencyDays: 1 },
  { id: 'JOB-4202', name: 'March Cycle', title: 'March Cycle — GM2 Batch', tag: 'subscription_cycle', sourceLabel: 'CYC-2026-03', priority: 'high', itemCount: 85, vialsNeeded: 425, assignedPod: 'Pod Bravo', status: 'in_progress', createdAt: '2026-02-27', dueDate: '2026-03-05', timelineDays: 6, contingencyDays: 1 },
  { id: 'JOB-4203', name: 'March Cycle', title: 'March Cycle — GM3 Batch', tag: 'subscription_cycle', sourceLabel: 'CYC-2026-03', priority: 'normal', itemCount: 32, vialsNeeded: 256, status: 'unallocated', createdAt: '2026-02-27', dueDate: '2026-03-05', timelineDays: 6, contingencyDays: 1 },
  { id: 'JOB-4204', name: 'Daily Batch #127', title: 'AuraKey Order — Batch #127', tag: 'one_time', sourceLabel: 'Daily Cutoff', priority: 'urgent', itemCount: 12, vialsNeeded: 84, assignedPod: 'Pod Alpha', status: 'allocated', createdAt: '2026-02-28', timelineDays: 1, contingencyDays: 1 },
  { id: 'JOB-4205', name: 'Daily Batch #128', title: 'AuraKey Refill — Batch #128', tag: 'one_time', sourceLabel: 'Daily Cutoff', priority: 'normal', itemCount: 8, vialsNeeded: 56, status: 'unallocated', createdAt: '2026-02-28', timelineDays: 1, contingencyDays: 1 },
  { id: 'JOB-4206', name: 'Welcome Kit Batch', title: 'First Sub — Welcome Kit Batch', tag: 'first_subscription', sourceLabel: 'New Subs', priority: 'urgent', itemCount: 15, vialsNeeded: 105, status: 'unallocated', createdAt: '2026-02-28', timelineDays: 1, contingencyDays: 1 },
  { id: 'JOB-4207', name: 'Spring Bloom RTS', title: 'RTS Production — Spring Bloom', tag: 'rts_production', sourceLabel: 'PROD-089', priority: 'normal', itemCount: 50, vialsNeeded: 200, assignedPod: 'Pod Charlie', status: 'in_progress', createdAt: '2026-02-26', timelineDays: 2, contingencyDays: 1 },
  { id: 'JOB-4208', name: 'Corporate Gift', title: 'Corporate Gift — Emirates NBD', tag: 'rts_production', sourceLabel: 'CG-045', priority: 'high', itemCount: 100, vialsNeeded: 0, assignedPod: 'Pod Delta', status: 'in_progress', createdAt: '2026-02-27', dueDate: '2026-03-02', timelineDays: 3, contingencyDays: 0 },
  { id: 'JOB-4209', name: 'Capsule Fulfillment', title: 'Capsule Fulfillment — 15 orders', tag: 'rts_production', sourceLabel: 'RF-201', priority: 'normal', itemCount: 15, vialsNeeded: 0, status: 'unallocated', createdAt: '2026-02-28', timelineDays: 1, contingencyDays: 1 },
  { id: 'JOB-4210', name: 'Whisper Vials', title: 'Whisper Vials — 5 orders', tag: 'one_time', sourceLabel: 'Daily Cutoff', priority: 'normal', itemCount: 5, vialsNeeded: 5, status: 'unallocated', createdAt: '2026-02-28', timelineDays: 1, contingencyDays: 1 },
];

// ---- Component ----
export default function JobAllocation() {
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [allocateDialog, setAllocateDialog] = useState<ProductionJob | null>(null);
  const [selectedPod, setSelectedPod] = useState<string>('');
  const [allocNotes, setAllocNotes] = useState('');
  const [customTimeline, setCustomTimeline] = useState<string>('');

  const filtered = useMemo(() => {
    return mockJobs.filter(j => {
      if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.id.toLowerCase().includes(search.toLowerCase()) && !j.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTag !== 'all' && j.tag !== filterTag) return false;
      if (filterStatus !== 'all' && j.status !== filterStatus) return false;
      return true;
    });
  }, [search, filterTag, filterStatus]);

  const stats = useMemo(() => ({
    total: mockJobs.length,
    unallocated: mockJobs.filter(j => j.status === 'unallocated').length,
    inProgress: mockJobs.filter(j => j.status === 'in_progress').length,
    completed: mockJobs.filter(j => j.status === 'completed').length,
  }), []);

  // Determine which pods to show based on job tag
  const getAvailablePods = (job: ProductionJob | null) => {
    if (!job) return [];
    // RTS Production only needs production pod
    if (job.tag === 'rts_production') return PRODUCTION_PODS;
    // All other jobs can go to either production or fulfillment pods
    return [...PRODUCTION_PODS, ...FULFILLMENT_PODS];
  };

  const handleAllocate = () => {
    if (!allocateDialog || !selectedPod) return;
    const pod = [...PRODUCTION_PODS, ...FULFILLMENT_PODS].find(p => p.id === selectedPod);
    const timeline = customTimeline ? parseInt(customTimeline) : allocateDialog.timelineDays;
    toast.success(`${allocateDialog.id} allocated to ${pod?.name || selectedPod}`, {
      description: `Timeline: ${timeline} days + ${allocateDialog.contingencyDays} day contingency`,
    });
    setAllocateDialog(null);
    setSelectedPod('');
    setAllocNotes('');
    setCustomTimeline('');
  };

  const openAllocateDialog = (job: ProductionJob) => {
    setAllocateDialog(job);
    setSelectedPod('');
    setAllocNotes('');
    setCustomTimeline(job.timelineDays.toString());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Allocation"
        subtitle="Assign jobs to production and fulfillment pods — manual override of queue-based allocation"
        breadcrumbs={[
          { label: 'Jobs & Queue Mgmt' },
          { label: 'Job Allocation' },
        ]}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50"><Layers className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-50"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.unallocated}</p>
                <p className="text-xs text-muted-foreground">Unallocated</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50"><Clock className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search jobs by name, title, or ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {Object.entries(TAG_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Job List */}
      <SectionCard title={`Jobs (${filtered.length})`} subtitle="Click Allocate to manually assign unallocated jobs to a pod — default allocation happens from Production Queue">
        <div className="space-y-2">
          {filtered.map(job => {
            const tagCfg = TAG_CONFIG[job.tag];
            const TagIcon = tagCfg.icon;
            return (
              <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className={cn('p-2 rounded-lg', tagCfg.bgColor)}>
                  <TagIcon className={cn('w-4 h-4', tagCfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{job.title}</span>
                    <Badge className={cn('text-[9px] shrink-0', tagCfg.bgColor, tagCfg.color)}>{tagCfg.label}</Badge>
                    <Badge className={cn('text-[9px] shrink-0', PRIORITY_CONFIG[job.priority].bgColor, PRIORITY_CONFIG[job.priority].color)}>{job.priority}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono">{job.id}</span>
                    <span>·</span>
                    <span>{job.name}</span>
                    <span>·</span>
                    <span>{job.itemCount} items</span>
                    {job.vialsNeeded > 0 && <><span>·</span><span>{job.vialsNeeded} vials</span></>}
                    <span>·</span>
                    <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{job.timelineDays}d + {job.contingencyDays}d</span>
                    {job.dueDate && <><span>·</span><span>Due: {new Date(job.dueDate).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {job.assignedPod && (
                    <Badge variant="outline" className="text-[10px]">{job.assignedPod}</Badge>
                  )}
                  <Badge className={cn('text-[10px]', STATUS_CONFIG[job.status].color)}>
                    {STATUS_CONFIG[job.status].label}
                  </Badge>
                  {job.status === 'unallocated' && (
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => openAllocateDialog(job)}>
                      Allocate <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">No jobs match your filters</div>
          )}
        </div>
      </SectionCard>

      {/* Allocate Dialog — Enhanced with pod selection, tags, timeline */}
      <Dialog open={!!allocateDialog} onOpenChange={() => setAllocateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Allocate Job to Pod
            </DialogTitle>
            <DialogDescription>
              Manual allocation override — assign this job directly to a pod
            </DialogDescription>
          </DialogHeader>

          {allocateDialog && (
            <div className="space-y-4">
              {/* Job Summary Card */}
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  {(() => { const TagIcon = TAG_CONFIG[allocateDialog.tag].icon; return <TagIcon className={cn('w-4 h-4', TAG_CONFIG[allocateDialog.tag].color)} />; })()}
                  <span className="font-semibold text-sm">{allocateDialog.title}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge className={cn('text-[9px]', TAG_CONFIG[allocateDialog.tag].bgColor, TAG_CONFIG[allocateDialog.tag].color)}>
                    {TAG_CONFIG[allocateDialog.tag].label}
                  </Badge>
                  <Badge className={cn('text-[9px]', PRIORITY_CONFIG[allocateDialog.priority].bgColor, PRIORITY_CONFIG[allocateDialog.priority].color)}>
                    {allocateDialog.priority}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>{allocateDialog.itemCount} items · {allocateDialog.vialsNeeded} vials needed</p>
                  <p className="italic">{TAG_CONFIG[allocateDialog.tag].description}</p>
                </div>
              </div>

              {/* Pod Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assign to Pod</Label>
                <Select value={selectedPod} onValueChange={setSelectedPod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a pod..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailablePods(allocateDialog).map(pod => (
                      <SelectItem key={pod.id} value={pod.id}>
                        <div className="flex items-center gap-2">
                          <span>{pod.name}</span>
                          <span className="text-[10px] text-muted-foreground capitalize">({pod.type})</span>
                          {pod.activeJobs >= 3 ? (
                            <span className="text-[9px] text-red-500 font-medium">Full</span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground">{pod.activeJobs}/3 active</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {allocateDialog.tag === 'rts_production' && (
                  <p className="text-[11px] text-cyan-600 bg-cyan-50 p-2 rounded-md">
                    RTS Production jobs only need a production pod — no fulfillment pod required.
                  </p>
                )}
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> Timeline (days)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    max="14"
                    value={customTimeline}
                    onChange={e => setCustomTimeline(e.target.value)}
                    className="w-20 h-9"
                  />
                  <span className="text-xs text-muted-foreground">
                    + {allocateDialog.contingencyDays} day contingency = <span className="font-semibold">{(parseInt(customTimeline) || allocateDialog.timelineDays) + allocateDialog.contingencyDays} total days</span>
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Default: {TAG_CONFIG[allocateDialog.tag].defaultTimeline} days for {TAG_CONFIG[allocateDialog.tag].label}
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes (optional)</Label>
                <Textarea
                  value={allocNotes}
                  onChange={e => setAllocNotes(e.target.value)}
                  placeholder="Allocation notes..."
                  className="h-16 text-sm resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateDialog(null)}>Cancel</Button>
            <Button onClick={handleAllocate} disabled={!selectedPod} className="gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> Allocate to Pod
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
