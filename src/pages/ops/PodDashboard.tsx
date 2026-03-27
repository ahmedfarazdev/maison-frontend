// ============================================================
// Pod Dashboard — Operator Station View (Multi-Pipeline)
// Supports up to 3 active jobs per pod simultaneously
// Each job opens its own pipeline based on job tag
// Pipeline type: subscription, one-time, internal/RTS
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, KPICard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Package, Layers, ArrowRight, Clock, CheckCircle2,
  Truck, Tag, FlaskConical, PackageCheck, Play, Pause,
  TrendingUp, Users, Timer, Zap, Activity,
  Eye, RefreshCw, ListChecks, Inbox,
  ChevronRight, CircleDot, RotateCcw, Sparkles, Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

// ---- Types ----
type PodType = 'production' | 'fulfillment';
type StageId = 'picking' | 'labeling' | 'decanting' | 'qc_assembly' | 'shipping' | 'preparing' | 'assembly' | 'labels_generated' | 'ready_pickup' | 'shipped';
type JobTag = 'subscription_cycle' | 'one_time' | 'first_subscription' | 'rts_production';

interface ActiveJob {
  id: string;
  title: string;
  tag: JobTag;
  orderCount: number;
  completedOrders: number;
  currentStage: StageId;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  startedAt: string;
  deadline?: string;
  vialCount: number;
  timelineDays: number;
  contingencyDays: number;
}

interface PodInfo {
  id: string;
  nickname: string;
  type: PodType;
  status: 'active' | 'idle' | 'break';
  activeJobs: ActiveJob[];
  memberCount: number;
  completedToday: number;
  avgTimePerOrder: number;
}

interface QueuedJob {
  id: string;
  title: string;
  tag: JobTag;
  orderCount: number;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  createdAt: string;
  estimatedTime: string;
  timelineDays: number;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  currentTask: string;
  ordersCompleted: number;
  status: 'working' | 'idle' | 'break';
}

// ---- Stage Config ----
const PRODUCTION_STAGES: { id: StageId; label: string; icon: React.ElementType; color: string; route: string }[] = [
  { id: 'picking', label: 'Picking', icon: Package, color: 'text-amber-500', route: '/ops/picking' },
  { id: 'labeling', label: 'Labeling', icon: Tag, color: 'text-blue-500', route: '/ops/labeling' },
  { id: 'decanting', label: 'Decanting', icon: FlaskConical, color: 'text-purple-500', route: '/ops/decanting' },
  { id: 'qc_assembly', label: 'QC & Assembly', icon: PackageCheck, color: 'text-orange-500', route: '/ops/qc-assembly' },
];

const FULFILLMENT_STAGES: { id: StageId; label: string; icon: React.ElementType; color: string; route: string }[] = [
  { id: 'preparing', label: 'Preparing', icon: Package, color: 'text-amber-500', route: '/ops/shipping' },
  { id: 'assembly', label: 'Assembly', icon: PackageCheck, color: 'text-blue-500', route: '/ops/shipping' },
  { id: 'labels_generated', label: 'Labels Generated', icon: Tag, color: 'text-purple-500', route: '/ops/shipping' },
  { id: 'ready_pickup', label: 'Ready for Pickup', icon: Truck, color: 'text-emerald-500', route: '/ops/shipping' },
  { id: 'shipped', label: 'Shipped', icon: CheckCircle2, color: 'text-green-600', route: '/ops/shipping' },
];

const TAG_CONFIG: Record<JobTag, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  subscription_cycle: { label: 'Subscription Cycle', icon: RotateCcw, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  one_time: { label: 'One-Time Order', icon: Key, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  first_subscription: { label: 'First Subscription', icon: Sparkles, color: 'text-gold', bgColor: 'bg-amber-100' },
  rts_production: { label: 'RTS Production', icon: PackageCheck, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-600 bg-red-100',
  high: 'text-orange-600 bg-orange-100',
  normal: 'text-blue-600 bg-blue-100',
  low: 'text-slate-600 bg-slate-100',
};

const PIPELINE_COLORS = ['border-l-gold', 'border-l-blue-500', 'border-l-purple-500'];
const PIPELINE_BG = ['bg-gold/5', 'bg-blue-500/5', 'bg-purple-500/5'];
const PIPELINE_ACCENT = ['text-gold', 'text-blue-500', 'text-purple-500'];

// ---- Mock Data ----
const MOCK_PODS: PodInfo[] = [
  {
    id: 'PP-01', nickname: 'Alpha', type: 'production', status: 'active',
    memberCount: 3, completedToday: 78, avgTimePerOrder: 4.2,
    activeJobs: [
      { id: 'JOB-124', title: 'March Subscription Batch A', tag: 'subscription_cycle', orderCount: 120, completedOrders: 78, currentStage: 'decanting', priority: 'high', startedAt: '08:15 AM', deadline: 'Today 5:00 PM', vialCount: 360, timelineDays: 6, contingencyDays: 1 },
      { id: 'JOB-130', title: 'Daily On-Demand — Urgent', tag: 'one_time', orderCount: 8, completedOrders: 3, currentStage: 'picking', priority: 'urgent', startedAt: '11:30 AM', vialCount: 56, timelineDays: 1, contingencyDays: 1 },
    ],
  },
  {
    id: 'PP-02', nickname: 'Bravo', type: 'production', status: 'active',
    memberCount: 2, completedToday: 18, avgTimePerOrder: 5.1,
    activeJobs: [
      { id: 'JOB-125', title: 'Daily On-Demand — Morning', tag: 'one_time', orderCount: 45, completedOrders: 18, currentStage: 'labeling', priority: 'normal', startedAt: '09:30 AM', vialCount: 135, timelineDays: 1, contingencyDays: 1 },
    ],
  },
  {
    id: 'PP-03', nickname: 'Charlie', type: 'production', status: 'idle',
    memberCount: 2, completedToday: 15, avgTimePerOrder: 4.8,
    activeJobs: [],
  },
  {
    id: 'FP-01', nickname: 'Delta', type: 'fulfillment', status: 'active',
    memberCount: 2, completedToday: 56, avgTimePerOrder: 2.1,
    activeJobs: [
      { id: 'JOB-121', title: 'Shipping Batch — Morning', tag: 'subscription_cycle', orderCount: 80, completedOrders: 56, currentStage: 'ready_pickup', priority: 'normal', startedAt: '07:00 AM', vialCount: 0, timelineDays: 1, contingencyDays: 0 },
      { id: 'JOB-126', title: 'Capsule Fulfillment', tag: 'rts_production', orderCount: 15, completedOrders: 4, currentStage: 'assembly', priority: 'high', startedAt: '10:00 AM', vialCount: 0, timelineDays: 1, contingencyDays: 1 },
    ],
  },
  {
    id: 'FP-02', nickname: 'Echo', type: 'fulfillment', status: 'idle',
    memberCount: 2, completedToday: 0, avgTimePerOrder: 0,
    activeJobs: [],
  },
];

const MOCK_QUEUE: QueuedJob[] = [
  { id: 'JOB-127', title: 'March Subscription Batch B', tag: 'subscription_cycle', orderCount: 95, priority: 'high', createdAt: '10:00 AM', estimatedTime: '~3.5 hrs', timelineDays: 6 },
  { id: 'JOB-128', title: 'Daily On-Demand — Afternoon', tag: 'one_time', orderCount: 32, priority: 'normal', createdAt: '10:15 AM', estimatedTime: '~2 hrs', timelineDays: 1 },
  { id: 'JOB-129', title: 'Welcome Kit — New Subscribers', tag: 'first_subscription', orderCount: 8, priority: 'urgent', createdAt: '10:30 AM', estimatedTime: '~1 hr', timelineDays: 1 },
  { id: 'JOB-131', title: 'RTS Spring Bloom Batch', tag: 'rts_production', orderCount: 50, priority: 'normal', createdAt: '11:00 AM', estimatedTime: '~4 hrs', timelineDays: 2 },
];

const MOCK_TEAM: TeamMember[] = [
  { id: 'T1', name: 'Sarah K.', role: 'Pod Leader', currentTask: 'Decanting — Nishane Ani', ordersCompleted: 28, status: 'working' },
  { id: 'T2', name: 'Ahmed R.', role: 'Pod Senior Member', currentTask: 'Decanting — Baccarat Rouge', ordersCompleted: 24, status: 'working' },
  { id: 'T3', name: 'Lina M.', role: 'Pod Junior Member', currentTask: 'QC Assembly — checking labels', ordersCompleted: 18, status: 'working' },
];

export default function PodDashboard() {
  const [, setLocation] = useLocation();
  const [selectedPod, setSelectedPod] = useState<string>(MOCK_PODS[0].id);
  const [tab, setTab] = useState('pipelines');
  const [showPickJob, setShowPickJob] = useState(false);
  const [pickingJob, setPickingJob] = useState<QueuedJob | null>(null);

  const activePod = useMemo(() => MOCK_PODS.find(p => p.id === selectedPod) || MOCK_PODS[0], [selectedPod]);
  const jobs = activePod.activeJobs;
  const canPickMore = jobs.length < 3;

  const productionPods = MOCK_PODS.filter(p => p.type === 'production');
  const fulfillmentPods = MOCK_PODS.filter(p => p.type === 'fulfillment');
  const totalCompleted = MOCK_PODS.reduce((s, p) => s + p.completedToday, 0);
  const activePodCount = MOCK_PODS.filter(p => p.status === 'active').length;

  // Build pipeline stages for a specific job
  const getPipelineStages = (job: ActiveJob) => {
    const stages = activePod.type === 'production' ? PRODUCTION_STAGES : FULFILLMENT_STAGES;
    const currentIdx = stages.findIndex(s => s.id === job.currentStage);
    return stages.map((stage, i) => ({
      ...stage,
      status: i < currentIdx ? 'completed' as const : i === currentIdx ? 'active' as const : 'pending' as const,
    }));
  };

  const confirmPickJob = () => {
    if (!pickingJob) return;
    toast.success(`Job ${pickingJob.id} "${pickingJob.title}" assigned to Pod ${activePod.nickname}`, {
      description: `Pipeline slot ${jobs.length + 1}/3 · Timeline: ${pickingJob.timelineDays} days`,
      duration: 4000,
    });
    setPickingJob(null);
    setShowPickJob(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Pod Dashboard"
        subtitle={`Operator station for Pod ${activePod.nickname} · ${jobs.length}/3 active pipelines`}
        breadcrumbs={[
          { label: 'Pod Framework' },
          { label: 'Pod Dashboard' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={selectedPod} onValueChange={setSelectedPod}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__header_prod" disabled>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Production Pods</span>
                </SelectItem>
                {productionPods.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', p.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                      Pod {p.nickname}
                      <span className="text-[10px] text-muted-foreground">({p.activeJobs.length}/3)</span>
                    </span>
                  </SelectItem>
                ))}
                <SelectItem value="__header_ful" disabled>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Fulfillment Pods</span>
                </SelectItem>
                {fulfillmentPods.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', p.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                      Pod {p.nickname}
                      <span className="text-[10px] text-muted-foreground">({p.activeJobs.length}/3)</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info('Refreshing pod data...')}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            {canPickMore && (
              <Button size="sm" className="gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground" onClick={() => setShowPickJob(true)}>
                <Inbox className="w-3.5 h-3.5" /> Pick Next Job
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPICard label="Pod Status" value={activePod.status === 'active' ? 'Active' : activePod.status === 'idle' ? 'Idle' : 'Break'} sublabel={`Pod ${activePod.nickname}`} icon={Activity} variant={activePod.status === 'active' ? 'success' : 'warning'} />
          <KPICard label="Active Pipelines" value={`${jobs.length}/3`} sublabel="Capacity" icon={Layers} variant={jobs.length >= 3 ? 'warning' : 'gold'} />
          <KPICard label="Completed Today" value={activePod.completedToday} sublabel="This pod" icon={CheckCircle2} variant="success" />
          <KPICard label="Avg Cycle Time" value={`${activePod.avgTimePerOrder}m`} sublabel="Per order" icon={Timer} variant="default" />
          <KPICard label="All Pods Today" value={totalCompleted} sublabel={`${activePodCount} active pods`} icon={TrendingUp} variant="gold" />
        </div>

        {/* Pod Status Banner */}
        <div className={cn(
          'rounded-lg border p-4 flex items-center justify-between',
          activePod.status === 'active' ? 'bg-emerald-500/5 border-emerald-500/20' :
          activePod.status === 'idle' ? 'bg-muted/50 border-border' : 'bg-amber-500/5 border-amber-500/20',
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              activePod.status === 'active' ? 'bg-emerald-500/10' : activePod.status === 'idle' ? 'bg-muted' : 'bg-amber-500/10',
            )}>
              {activePod.status === 'active' ? <Play className="w-5 h-5 text-emerald-500" /> :
               activePod.status === 'idle' ? <Pause className="w-5 h-5 text-muted-foreground" /> :
               <Clock className="w-5 h-5 text-amber-500" />}
            </div>
            <div>
              <p className="text-sm font-semibold">Pod {activePod.nickname} — {activePod.id} · {activePod.type === 'production' ? 'Production' : 'Fulfillment'} Pod</p>
              <p className="text-xs text-muted-foreground">
                {activePod.status === 'active'
                  ? `Processing ${jobs.length} job${jobs.length !== 1 ? 's' : ''} across ${jobs.length} pipeline${jobs.length !== 1 ? 's' : ''}`
                  : activePod.status === 'idle' ? 'Waiting for next job — use "Pick Next Job" to start' : 'Pod is on break'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canPickMore && (
              <Button size="sm" className="gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground" onClick={() => setShowPickJob(true)}>
                <Inbox className="w-3.5 h-3.5" /> Pick Next Job
              </Button>
            )}
            <StatusBadge variant={activePod.status === 'active' ? 'success' : activePod.status === 'idle' ? 'muted' : 'warning'}>
              {activePod.status}
            </StatusBadge>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pipelines" className="gap-1.5"><Layers className="w-3.5 h-3.5" /> Pipelines ({jobs.length})</TabsTrigger>
            <TabsTrigger value="stations" className="gap-1.5"><Zap className="w-3.5 h-3.5" /> Station Ops</TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Team</TabsTrigger>
            <TabsTrigger value="queue" className="gap-1.5"><ListChecks className="w-3.5 h-3.5" /> Queue ({MOCK_QUEUE.length})</TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════ */}
          {/* PIPELINES TAB — Up to 3 active jobs */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="pipelines" className="mt-4 space-y-4">
            {jobs.length > 0 ? (
              jobs.map((job, pipelineIdx) => {
                const tagCfg = TAG_CONFIG[job.tag];
                const TagIcon = tagCfg.icon;
                const pipelineStages = getPipelineStages(job);
                const progress = Math.round((job.completedOrders / job.orderCount) * 100);

                return (
                  <Card key={job.id} className={cn('border-l-[4px] overflow-hidden', PIPELINE_COLORS[pipelineIdx])}>
                    <CardContent className="p-5">
                      {/* Pipeline Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={cn('text-[9px] font-bold', PIPELINE_ACCENT[pipelineIdx])}>
                              Pipeline {pipelineIdx + 1}
                            </Badge>
                            <span className="text-xs font-mono text-muted-foreground">{job.id}</span>
                            <Badge className={cn('text-[9px]', tagCfg.bgColor, tagCfg.color)}>
                              <TagIcon className="w-3 h-3 mr-1" />
                              {tagCfg.label}
                            </Badge>
                            <Badge className={cn('text-[9px]', PRIORITY_COLORS[job.priority])}>
                              {job.priority}
                            </Badge>
                          </div>
                          <h3 className="text-base font-bold">{job.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Started {job.startedAt} {job.deadline && `· Due ${job.deadline}`}
                            {' · '}{job.timelineDays}d + {job.contingencyDays}d contingency
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold font-mono">{progress}%</p>
                          <p className="text-[10px] text-muted-foreground">{job.completedOrders}/{job.orderCount} orders</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                        {job.vialCount > 0 && (
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{job.vialCount} vials total</p>
                        )}
                      </div>

                      {/* Pipeline Stages */}
                      <div className="flex items-center gap-0 overflow-x-auto py-1">
                        {pipelineStages.map((stage, i) => {
                          const StageIcon = stage.icon;
                          return (
                            <div key={stage.id} className="flex items-center">
                              <div
                                className={cn(
                                  'flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all min-w-[120px]',
                                  stage.status === 'active' ? cn(PIPELINE_BG[pipelineIdx], 'border-current ring-1 ring-current/20 shadow-sm', PIPELINE_ACCENT[pipelineIdx].replace('text-', 'border-')) :
                                  stage.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/30' :
                                  'bg-muted/30 border-border',
                                )}
                                onClick={() => setLocation(stage.route)}
                              >
                                <div className={cn(
                                  'w-7 h-7 rounded-md flex items-center justify-center',
                                  stage.status === 'active' ? cn(PIPELINE_BG[pipelineIdx]) :
                                  stage.status === 'completed' ? 'bg-emerald-500/20' : 'bg-muted',
                                )}>
                                  {stage.status === 'completed' ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <StageIcon className={cn('w-3.5 h-3.5', stage.status === 'active' ? stage.color : 'text-muted-foreground')} />
                                  )}
                                </div>
                                <div>
                                  <p className={cn('text-[11px] font-semibold', stage.status === 'active' ? 'text-foreground' : 'text-muted-foreground')}>
                                    {stage.label}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground">
                                    {stage.status === 'completed' ? 'Done' : stage.status === 'active' ? 'Active' : 'Pending'}
                                  </p>
                                </div>
                              </div>
                              {i < pipelineStages.length - 1 && (
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 mx-0.5 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                icon={Inbox}
                title="No Active Pipelines"
                description="This pod is idle and waiting for jobs. Pick a job from the queue to start a pipeline."
                action={
                  <Button size="sm" className="gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground" onClick={() => setShowPickJob(true)}>
                    <Inbox className="w-3.5 h-3.5" /> Pick Next Job
                  </Button>
                }
              />
            )}

            {/* Capacity Indicator */}
            {jobs.length > 0 && jobs.length < 3 && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
                <div className="flex items-center gap-2">
                  <CircleDot className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {3 - jobs.length} pipeline slot{3 - jobs.length !== 1 ? 's' : ''} available — this pod can take more jobs
                  </span>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowPickJob(true)}>
                  <Inbox className="w-3 h-3" /> Pick Another Job
                </Button>
              </div>
            )}
            {jobs.length >= 3 && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <Timer className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-amber-600 font-medium">
                  Pod at full capacity (3/3 pipelines active) — complete a job to free a slot
                </span>
              </div>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* STATION OPS TAB */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="stations" className="mt-4">
            <SectionCard title="Station Operations" subtitle="Navigate to any station to manage operations">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(activePod.type === 'production' ? PRODUCTION_STAGES : FULFILLMENT_STAGES).map(stage => {
                  const StageIcon = stage.icon;
                  const isActive = jobs.some(j => j.currentStage === stage.id);
                  const activeJobsAtStage = jobs.filter(j => j.currentStage === stage.id);
                  return (
                    <Card
                      key={stage.id}
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-md',
                        isActive ? 'border-gold ring-1 ring-gold/20 bg-gold/5' : 'hover:bg-muted/30',
                      )}
                      onClick={() => setLocation(stage.route)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            isActive ? 'bg-gold/20' : 'bg-muted',
                          )}>
                            <StageIcon className={cn('w-5 h-5', stage.color)} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold">{stage.label}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {isActive ? `${activeJobsAtStage.length} job${activeJobsAtStage.length > 1 ? 's' : ''} active` : 'Navigate to station'}
                            </p>
                          </div>
                          {isActive && <StatusBadge variant="gold">Active</StatusBadge>}
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </SectionCard>
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* TEAM TAB */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="team" className="mt-4">
            <SectionCard title="Team Activity" subtitle={`${MOCK_TEAM.length} members in Pod ${activePod.nickname}`}>
              <div className="space-y-2">
                {MOCK_TEAM.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-sm font-bold text-gold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{member.name}</p>
                        <Badge variant="outline" className="text-[9px]">{member.role}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{member.currentTask}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-semibold">{member.ordersCompleted}</p>
                      <p className="text-[10px] text-muted-foreground">orders</p>
                    </div>
                    <StatusBadge variant={member.status === 'working' ? 'success' : member.status === 'idle' ? 'muted' : 'warning'}>
                      {member.status}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </SectionCard>
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* QUEUE TAB */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="queue" className="mt-4">
            <SectionCard title="Available Jobs in Queue" subtitle={canPickMore ? `Pick a job to assign to Pod ${activePod.nickname} (${3 - jobs.length} slots available)` : 'Pod at full capacity — complete a job first'}>
              {MOCK_QUEUE.length === 0 ? (
                <EmptyState icon={Inbox} title="Queue Empty" description="No jobs waiting in the queue." />
              ) : (
                <div className="space-y-2">
                  {MOCK_QUEUE.map(qJob => {
                    const tagCfg = TAG_CONFIG[qJob.tag];
                    const TagIcon = tagCfg.icon;
                    return (
                      <div key={qJob.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                        <div className={cn('p-2 rounded-lg', tagCfg.bgColor)}>
                          <TagIcon className={cn('w-4 h-4', tagCfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-mono text-muted-foreground">{qJob.id}</span>
                            <Badge className={cn('text-[9px]', tagCfg.bgColor, tagCfg.color)}>{tagCfg.label}</Badge>
                            <Badge className={cn('text-[9px]', PRIORITY_COLORS[qJob.priority])}>{qJob.priority}</Badge>
                          </div>
                          <p className="text-sm font-bold">{qJob.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span>{qJob.orderCount} orders</span>
                            <span>Est. {qJob.estimatedTime}</span>
                            <span>Timeline: {qJob.timelineDays}d</span>
                            <span>Created {qJob.createdAt}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={!canPickMore}
                          onClick={() => { setPickingJob(qJob); setShowPickJob(true); }}
                        >
                          <Play className="w-3.5 h-3.5" /> Pick Job
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* PICK NEXT JOB DIALOG */}
      {/* ═══════════════════════════════════════════ */}
      <Dialog open={showPickJob} onOpenChange={setShowPickJob}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Inbox className="w-5 h-5 text-gold" /> Pick Next Job</DialogTitle>
            <DialogDescription>
              Select a job from the queue to assign to Pod {activePod.nickname}. Pipeline slot {jobs.length + 1}/3.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
            {MOCK_QUEUE.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No jobs in queue</p>
            ) : MOCK_QUEUE.map(qJob => {
              const tagCfg = TAG_CONFIG[qJob.tag];
              const TagIcon = tagCfg.icon;
              return (
                <div
                  key={qJob.id}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    pickingJob?.id === qJob.id ? 'border-gold bg-gold/5 ring-1 ring-gold/20' : 'border-border hover:bg-muted/30',
                  )}
                  onClick={() => setPickingJob(qJob)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{qJob.id}</span>
                        <Badge className={cn('text-[9px]', tagCfg.bgColor, tagCfg.color)}>
                          <TagIcon className="w-3 h-3 mr-1" />{tagCfg.label}
                        </Badge>
                        <Badge className={cn('text-[9px]', PRIORITY_COLORS[qJob.priority])}>{qJob.priority}</Badge>
                      </div>
                      <p className="text-sm font-bold">{qJob.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {qJob.orderCount} orders · Est. {qJob.estimatedTime} · Timeline: {qJob.timelineDays}d
                      </p>
                    </div>
                    {pickingJob?.id === qJob.id && (
                      <CheckCircle2 className="w-5 h-5 text-gold" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPickJob(false); setPickingJob(null); }}>Cancel</Button>
            <Button
              className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              disabled={!pickingJob}
              onClick={confirmPickJob}
            >
              <Play className="w-3.5 h-3.5" /> Assign to Pipeline {jobs.length + 1}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
