// ============================================================
// Master Pods & Jobs — Admin Command Center
// Pod CRUD, Kanban board, interactive Gantt chart, analytics
// Navigation: Master Pods & Jobs (top-level)
// ============================================================

import { useState, useMemo, useRef, useCallback } from 'react';
import { PageHeader, SectionCard, KPICard, StatusBadge, PipelineProgress, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Kanban, Layers, PackageCheck, Activity, Play, Pause, Clock,
  CheckCircle2, Truck, Package, Timer, BarChart3, TrendingUp,
  Users, Eye, RefreshCw, Zap, Box, AlertTriangle, Target,
  ArrowRight, FlaskConical, Tag, Plus, Edit, Trash2, UserPlus,
  UserMinus, Settings, GripVertical, MoreHorizontal, X,
  CalendarDays, ChevronLeft, ChevronRight, GanttChart,
  ArrowUpDown, Filter, Repeat, ShoppingBag, Factory, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---- Types ----
interface PodMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

interface Pod {
  id: string;
  nickname: string;
  type: 'production' | 'fulfillment';
  status: 'active' | 'idle' | 'break' | 'offline';
  members: PodMember[];
  currentJobId: string | null;
  currentJobTitle: string | null;
  currentStage?: string;
  completedToday: number;
  avgCycleTime: number;
  throughputRate: number;
  createdAt: string;
}

type JobType = 'Subscription' | 'First Subscription' | 'On-Demand' | 'RTS Production';
type JobStatus = 'queued' | 'in_progress' | 'completed' | 'paused';

interface Job {
  id: string;
  title: string;
  type: JobType;
  status: JobStatus;
  priority: 'high' | 'normal' | 'low';
  orderCount: number;
  completedOrders: number;
  pod?: string;
  podNickname?: string;
  fulfillmentPod?: string;
  fulfillmentPodNickname?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedCompletion?: string;
  // Gantt chart fields
  startDay: number; // day offset from week start (0-6)
  durationDays: number;
  tag?: string;
}

// ---- Mock Data ----
const MOCK_MEMBERS: PodMember[] = [
  { id: 'M-01', name: 'Sarah K.', role: 'Pod Lead' },
  { id: 'M-02', name: 'Ahmed R.', role: 'Pod Senior' },
  { id: 'M-03', name: 'Lina M.', role: 'QC Inspector' },
  { id: 'M-04', name: 'Omar H.', role: 'Picker' },
  { id: 'M-05', name: 'Fatima A.', role: 'Labeler' },
  { id: 'M-06', name: 'Youssef B.', role: 'Shipping Clerk' },
  { id: 'M-07', name: 'Nadia T.', role: 'Fulfillment Lead' },
  { id: 'M-08', name: 'Karim D.', role: 'Assembly' },
];

const initialPods: Pod[] = [
  {
    id: 'PP-01', nickname: 'Alpha', type: 'production', status: 'active',
    members: [MOCK_MEMBERS[0], MOCK_MEMBERS[1], MOCK_MEMBERS[2]],
    currentJobId: 'JOB-124', currentJobTitle: 'March Sub Batch A', currentStage: 'Decanting',
    completedToday: 78, avgCycleTime: 4.2, throughputRate: 14.3, createdAt: '2026-01-15',
  },
  {
    id: 'PP-02', nickname: 'Bravo', type: 'production', status: 'active',
    members: [MOCK_MEMBERS[3], MOCK_MEMBERS[4]],
    currentJobId: 'JOB-125', currentJobTitle: 'Daily On-Demand', currentStage: 'Labeling',
    completedToday: 18, avgCycleTime: 5.1, throughputRate: 11.8, createdAt: '2026-01-15',
  },
  {
    id: 'PP-03', nickname: 'Charlie', type: 'production', status: 'idle',
    members: [MOCK_MEMBERS[7], MOCK_MEMBERS[4]],
    currentJobId: null, currentJobTitle: null,
    completedToday: 15, avgCycleTime: 4.8, throughputRate: 12.5, createdAt: '2026-02-01',
  },
  {
    id: 'FP-01', nickname: 'Delta', type: 'fulfillment', status: 'active',
    members: [MOCK_MEMBERS[5], MOCK_MEMBERS[6]],
    currentJobId: 'JOB-121', currentJobTitle: 'Shipping Batch', currentStage: 'Shipping',
    completedToday: 56, avgCycleTime: 2.1, throughputRate: 28.6, createdAt: '2026-01-15',
  },
];

const getWeekDates = (offset: number) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek + (offset * 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });
};

const initialJobs: Job[] = [
  { id: 'JOB-124', title: 'March Subscription Batch A', type: 'Subscription', status: 'in_progress', priority: 'high', orderCount: 120, completedOrders: 78, pod: 'PP-01', podNickname: 'Alpha', fulfillmentPod: 'FP-01', fulfillmentPodNickname: 'Delta', startedAt: '08:15 AM', estimatedCompletion: '2:30 PM', startDay: 0, durationDays: 5, tag: 'Subscription' },
  { id: 'JOB-125', title: 'Daily On-Demand — Morning', type: 'On-Demand', status: 'in_progress', priority: 'normal', orderCount: 45, completedOrders: 18, pod: 'PP-02', podNickname: 'Bravo', fulfillmentPod: 'FP-01', fulfillmentPodNickname: 'Delta', startedAt: '09:30 AM', estimatedCompletion: '1:00 PM', startDay: 1, durationDays: 1, tag: 'On-Demand' },
  { id: 'JOB-121', title: 'Shipping Batch — Morning', type: 'On-Demand', status: 'in_progress', priority: 'high', orderCount: 80, completedOrders: 56, pod: 'FP-01', podNickname: 'Delta', startedAt: '07:00 AM', estimatedCompletion: '11:30 AM', startDay: 1, durationDays: 1, tag: 'Fulfillment' },
  { id: 'JOB-127', title: 'March Subscription Batch B', type: 'Subscription', status: 'queued', priority: 'high', orderCount: 95, completedOrders: 0, startDay: 3, durationDays: 4, tag: 'Subscription' },
  { id: 'JOB-128', title: 'Daily On-Demand — Afternoon', type: 'On-Demand', status: 'queued', priority: 'normal', orderCount: 32, completedOrders: 0, startDay: 2, durationDays: 1, tag: 'On-Demand' },
  { id: 'JOB-129', title: 'RTS Capsule Whisperer', type: 'RTS Production', status: 'queued', priority: 'low', orderCount: 20, completedOrders: 0, startDay: 4, durationDays: 2, tag: 'RTS Production' },
  { id: 'JOB-130', title: 'First Sub — New Members', type: 'First Subscription', status: 'queued', priority: 'high', orderCount: 35, completedOrders: 0, startDay: 2, durationDays: 2, tag: 'First Subscription' },
  { id: 'JOB-120', title: 'Feb Subscription Final', type: 'Subscription', status: 'completed', priority: 'high', orderCount: 150, completedOrders: 150, pod: 'PP-01', podNickname: 'Alpha', startedAt: '07:00 AM', completedAt: '12:30 PM', startDay: 0, durationDays: 5, tag: 'Subscription' },
  { id: 'JOB-119', title: 'RTS Vial Batch', type: 'RTS Production', status: 'completed', priority: 'normal', orderCount: 100, completedOrders: 100, pod: 'PP-03', podNickname: 'Charlie', startedAt: '08:00 AM', completedAt: '11:45 AM', startDay: 0, durationDays: 2, tag: 'RTS Production' },
];

// ---- Colors ----
const priorityColors: Record<string, string> = {
  high: 'text-destructive bg-destructive/10',
  normal: 'text-info bg-info/10',
  low: 'text-muted-foreground bg-muted',
};

const jobTypeColors: Record<JobType, { bg: string; text: string; icon: React.ElementType; bar: string }> = {
  'Subscription': { bg: 'bg-gold/10', text: 'text-gold', icon: Repeat, bar: 'bg-gold' },
  'First Subscription': { bg: 'bg-purple-500/10', text: 'text-purple-600', icon: Sparkles, bar: 'bg-purple-500' },
  'On-Demand': { bg: 'bg-info/10', text: 'text-info', icon: ShoppingBag, bar: 'bg-info' },
  'RTS Production': { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: Factory, bar: 'bg-emerald-500' },
};

const statusColors: Record<JobStatus, { label: string; variant: 'gold' | 'success' | 'muted' | 'warning' }> = {
  queued: { label: 'Queued', variant: 'muted' },
  in_progress: { label: 'In Progress', variant: 'gold' },
  completed: { label: 'Completed', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
};

// ============================================================
// GANTT CHART COMPONENT
// ============================================================
function GanttChartView({ jobs, pods, weekOffset, setWeekOffset }: {
  jobs: Job[];
  pods: Pod[];
  weekOffset: number;
  setWeekOffset: (v: number) => void;
}) {
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const today = new Date();
  const todayIdx = weekDates.findIndex(d =>
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  );

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group jobs by pod
  const podRows = useMemo(() => {
    const rows: { pod: Pod | null; podLabel: string; jobs: Job[] }[] = [];

    // Active pods with jobs
    pods.forEach(pod => {
      const podJobs = jobs.filter(j => j.pod === pod.id || j.fulfillmentPod === pod.id);
      if (podJobs.length > 0) {
        rows.push({ pod, podLabel: `${pod.nickname} (${pod.id})`, jobs: podJobs });
      }
    });

    // Unassigned jobs
    const unassigned = jobs.filter(j => !j.pod && !j.fulfillmentPod);
    if (unassigned.length > 0) {
      rows.push({ pod: null, podLabel: 'Unassigned', jobs: unassigned });
    }

    return rows;
  }, [jobs, pods]);

  const [hoveredJob, setHoveredJob] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setWeekOffset(weekOffset - 1)}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-3 text-xs font-semibold" onClick={() => setWeekOffset(0)}>
            This Week
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setWeekOffset(weekOffset + 1)}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Gantt Grid */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Header Row */}
        <div className="grid" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
          <div className="p-2.5 border-b border-r bg-muted/30 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <GanttChart className="w-3.5 h-3.5" /> Pods / Days
          </div>
          {weekDates.map((d, i) => (
            <div
              key={i}
              className={cn(
                'p-2 border-b text-center text-xs',
                i < 6 && 'border-r',
                i === todayIdx ? 'bg-gold/10 font-bold text-gold' : 'bg-muted/20 text-muted-foreground font-medium',
              )}
            >
              <div>{dayLabels[d.getDay()]}</div>
              <div className="text-[10px]">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            </div>
          ))}
        </div>

        {/* Pod Rows */}
        {podRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground italic">No jobs scheduled this week</div>
        ) : podRows.map((row, rowIdx) => (
          <div key={row.podLabel} className="grid" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
            {/* Pod Label */}
            <div className={cn(
              'p-2.5 border-r flex flex-col justify-center',
              rowIdx < podRows.length - 1 && 'border-b',
              row.pod ? '' : 'bg-muted/10',
            )}>
              <div className="flex items-center gap-1.5">
                {row.pod ? (
                  <StatusBadge variant={row.pod.type === 'production' ? 'info' : 'gold'}>
                    {row.pod.type === 'production' ? 'PROD' : 'FULL'}
                  </StatusBadge>
                ) : (
                  <StatusBadge variant="muted">QUEUE</StatusBadge>
                )}
              </div>
              <span className="text-xs font-bold mt-0.5">{row.pod ? `Pod ${row.pod.nickname}` : 'Unassigned'}</span>
              {row.pod && (
                <span className="text-[10px] text-muted-foreground">{row.pod.members.length} members · {row.pod.status}</span>
              )}
            </div>

            {/* Day Cells with Job Bars */}
            <div
              className={cn('col-span-7 relative', rowIdx < podRows.length - 1 && 'border-b')}
              style={{ minHeight: `${Math.max(row.jobs.length * 32 + 8, 48)}px` }}
            >
              {/* Day grid lines */}
              <div className="absolute inset-0 grid grid-cols-7">
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} className={cn(
                    'h-full',
                    i < 6 && 'border-r border-border/30',
                    i === todayIdx && 'bg-gold/[0.03]',
                  )} />
                ))}
              </div>

              {/* Job Bars */}
              {row.jobs.map((job, jobIdx) => {
                const tc = jobTypeColors[job.type];
                const startPct = (job.startDay / 7) * 100;
                const widthPct = (Math.min(job.durationDays, 7 - job.startDay) / 7) * 100;
                const isHovered = hoveredJob === job.id;

                return (
                  <div
                    key={job.id}
                    className={cn(
                      'absolute rounded-md transition-all cursor-pointer flex items-center gap-1.5 px-2 overflow-hidden',
                      tc.bar, 'bg-opacity-80',
                      isHovered ? 'ring-2 ring-foreground/20 shadow-md z-10 scale-[1.02]' : 'z-0',
                      job.status === 'completed' && 'opacity-50',
                      job.status === 'paused' && 'opacity-60',
                    )}
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                      top: `${jobIdx * 32 + 4}px`,
                      height: '28px',
                    }}
                    onMouseEnter={() => setHoveredJob(job.id)}
                    onMouseLeave={() => setHoveredJob(null)}
                    title={`${job.id}: ${job.title} (${job.type}) — ${job.orderCount} orders`}
                  >
                    <span className="text-[10px] font-bold text-white truncate">{job.id}</span>
                    <span className="text-[10px] text-white/80 truncate hidden sm:inline">{job.title}</span>
                    {job.status === 'in_progress' && (
                      <span className="text-[10px] text-white/90 font-mono ml-auto shrink-0">
                        {Math.round((job.completedOrders / job.orderCount) * 100)}%
                      </span>
                    )}
                    {job.status === 'completed' && (
                      <CheckCircle2 className="w-3 h-3 text-white/80 ml-auto shrink-0" />
                    )}
                    {job.status === 'paused' && (
                      <Pause className="w-3 h-3 text-white/80 ml-auto shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {(Object.entries(jobTypeColors) as [JobType, typeof jobTypeColors[JobType]][]).map(([type, tc]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded-sm', tc.bar)} />
            <span className="text-[11px] text-muted-foreground">{type}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
          <span className="text-[11px] text-muted-foreground">Completed (dimmed)</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function MasterDashboard() {
  const [tab, setTab] = useState('gantt');
  const [pods, setPods] = useState<Pod[]>(initialPods);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [showCreatePod, setShowCreatePod] = useState(false);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Create Pod form state
  const [newPodNickname, setNewPodNickname] = useState('');
  const [newPodType, setNewPodType] = useState<'production' | 'fulfillment'>('production');
  const [newPodMembers, setNewPodMembers] = useState<string[]>([]);

  // KPIs
  const activePods = pods.filter(p => p.status === 'active').length;
  const idlePods = pods.filter(p => p.status === 'idle').length;
  const totalPods = pods.length;
  const activeJobs = jobs.filter(j => j.status === 'in_progress').length;
  const queuedJobs = jobs.filter(j => j.status === 'queued').length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const pausedJobs = jobs.filter(j => j.status === 'paused').length;
  const totalProducedToday = pods.filter(p => p.type === 'production').reduce((s, p) => s + p.completedToday, 0);
  const totalShippedToday = pods.filter(p => p.type === 'fulfillment').reduce((s, p) => s + p.completedToday, 0);
  const avgThroughput = pods.length > 0 ? (pods.reduce((s, p) => s + p.throughputRate, 0) / pods.length).toFixed(1) : '0';

  // Available members
  const assignedMemberIds = useMemo(() => new Set(pods.flatMap(p => p.members.map(m => m.id))), [pods]);
  const availableMembers = MOCK_MEMBERS.filter(m => !assignedMemberIds.has(m.id));

  // ---- Create Pod ----
  const handleCreatePod = () => {
    if (!newPodNickname.trim()) {
      toast.error('Pod nickname is required');
      return;
    }
    const id = newPodType === 'production'
      ? `PP-${String(pods.filter(p => p.type === 'production').length + 1).padStart(2, '0')}`
      : `FP-${String(pods.filter(p => p.type === 'fulfillment').length + 1).padStart(2, '0')}`;
    const selectedMembers = MOCK_MEMBERS.filter(m => newPodMembers.includes(m.id));
    const newPod: Pod = {
      id, nickname: newPodNickname.trim(), type: newPodType, status: 'idle',
      members: selectedMembers, currentJobId: null, currentJobTitle: null,
      completedToday: 0, avgCycleTime: 0, throughputRate: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setPods(prev => [...prev, newPod]);
    setShowCreatePod(false);
    setNewPodNickname('');
    setNewPodType('production');
    setNewPodMembers([]);
    toast.success(`Pod "${newPod.nickname}" (${newPod.id}) created`);
  };

  const handleSaveEditPod = () => {
    if (!editingPod) return;
    setPods(prev => prev.map(p => p.id === editingPod.id ? editingPod : p));
    setEditingPod(null);
    toast.success(`Pod "${editingPod.nickname}" updated`);
  };

  const handleDeletePod = (podId: string) => {
    const pod = pods.find(p => p.id === podId);
    if (pod?.currentJobId) {
      toast.error('Cannot delete a pod with an active job');
      return;
    }
    setPods(prev => prev.filter(p => p.id !== podId));
    toast.success('Pod deleted');
  };

  // Kanban columns
  const kanbanColumns: { key: JobStatus; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'queued', label: 'Queued', icon: Clock, color: 'border-t-muted-foreground' },
    { key: 'in_progress', label: 'In Progress', icon: Play, color: 'border-t-gold' },
    { key: 'paused', label: 'Paused', icon: Pause, color: 'border-t-warning' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'border-t-success' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Master Pods & Jobs"
        subtitle="Create pods, manage teams, track jobs across the entire operation"
        breadcrumbs={[{ label: 'Master Pods & Jobs' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info('Refreshing...')}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button size="sm" className="gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground" onClick={() => setShowCreatePod(true)}>
              <Plus className="w-3.5 h-3.5" /> Create Pod
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <KPICard label="Total Pods" value={totalPods} sublabel={`${activePods} active`} icon={Activity} variant="gold" />
          <KPICard label="Active Pods" value={activePods} sublabel={`${idlePods} idle`} icon={Play} variant="success" />
          <KPICard label="Active Jobs" value={activeJobs} sublabel="In progress" icon={Zap} variant="gold" />
          <KPICard label="Queued Jobs" value={queuedJobs} sublabel="Waiting" icon={Layers} variant="warning" />
          <KPICard label="Completed" value={completedJobs} sublabel="Today" icon={CheckCircle2} variant="success" />
          <KPICard label="Produced" value={totalProducedToday} sublabel="Orders today" icon={Package} />
          <KPICard label="Shipped" value={totalShippedToday} sublabel="Orders today" icon={Truck} />
          <KPICard label="Avg Throughput" value={`${avgThroughput}/hr`} sublabel="All pods" icon={TrendingUp} />
        </div>

        {/* Pipeline Overview */}
        <SectionCard title="Pipeline Overview" subtitle="Orders flowing through the system">
          <PipelineProgress stages={[
            { stage: 'Queue', count: queuedJobs * 30 },
            { stage: 'Picking', count: 12 },
            { stage: 'Labeling', count: 18 },
            { stage: 'Decanting', count: 78 },
            { stage: 'QC & Assembly', count: 23 },
            { stage: 'Shipping', count: 56 },
          ]} />
        </SectionCard>

        {/* Main Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="gantt" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Gantt Chart</TabsTrigger>
            <TabsTrigger value="kanban" className="gap-1.5"><Kanban className="w-3.5 h-3.5" /> Kanban Board</TabsTrigger>
            <TabsTrigger value="pods" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> All Pods ({totalPods})</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Analytics</TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════ */}
          {/* GANTT CHART */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="gantt" className="mt-4">
            <GanttChartView jobs={jobs} pods={pods} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* KANBAN BOARD */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="kanban" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {kanbanColumns.map(col => {
                const colJobs = jobs.filter(j => j.status === col.key);
                return (
                  <div key={col.key} className={cn('rounded-lg border bg-card', 'border-t-[3px]', col.color)}>
                    <div className="p-3 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <col.icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{col.label}</span>
                      </div>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full">{colJobs.length}</span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
                      {colJobs.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8 italic">No jobs</p>
                      ) : colJobs.map(job => {
                        const tc = jobTypeColors[job.type];
                        return (
                          <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow border-border/50">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-mono text-muted-foreground">{job.id}</span>
                                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', priorityColors[job.priority])}>
                                  {job.priority}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold leading-tight mb-1.5">{job.title}</h4>
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1', tc.bg, tc.text)}>
                                  <tc.icon className="w-3 h-3" /> {job.type}
                                </span>
                              </div>
                              {job.status === 'in_progress' && (
                                <>
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                    <span>{job.completedOrders}/{job.orderCount}</span>
                                    <span>{Math.round((job.completedOrders / job.orderCount) * 100)}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${(job.completedOrders / job.orderCount) * 100}%` }} />
                                  </div>
                                  {job.podNickname && (
                                    <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                                      <Activity className="w-3 h-3" /> Pod {job.podNickname}
                                    </div>
                                  )}
                                </>
                              )}
                              {job.status === 'queued' && (
                                <p className="text-[10px] text-muted-foreground">{job.orderCount} orders · {job.durationDays}d timeline</p>
                              )}
                              {job.status === 'completed' && (
                                <div className="text-[10px] text-muted-foreground">
                                  <p>{job.completedOrders} orders completed</p>
                                  {job.podNickname && <p>Pod {job.podNickname}</p>}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* ALL PODS */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="pods" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pods.map(pod => (
                <Card key={pod.id} className={cn(
                  'border-l-[3px] transition-all hover:shadow-md',
                  pod.status === 'active' ? 'border-l-success' :
                  pod.status === 'idle' ? 'border-l-muted-foreground/30' :
                  pod.status === 'break' ? 'border-l-warning' : 'border-l-destructive/30',
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">{pod.id}</span>
                          <StatusBadge variant={pod.type === 'production' ? 'info' : 'gold'}>{pod.type}</StatusBadge>
                          <StatusBadge variant={
                            pod.status === 'active' ? 'success' :
                            pod.status === 'idle' ? 'muted' :
                            pod.status === 'break' ? 'warning' : 'destructive'
                          }>{pod.status}</StatusBadge>
                        </div>
                        <h4 className="text-base font-bold mt-1">Pod {pod.nickname}</h4>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedPod(pod)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingPod({...pod})}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeletePod(pod.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {pod.currentJobId ? (
                      <div className="mt-3 p-2.5 rounded-md bg-muted/30 border border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] text-muted-foreground">{pod.currentJobId}</p>
                            <p className="text-xs font-semibold">{pod.currentJobTitle}</p>
                          </div>
                          {pod.currentStage && <StatusBadge variant="gold">{pod.currentStage}</StatusBadge>}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground italic">No active job — waiting for queue</p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <div className="flex items-center gap-1">
                        {pod.members.slice(0, 4).map(m => (
                          <div key={m.id} className="w-6 h-6 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center" title={m.name}>
                            {m.name.split(' ').map(n => n[0]).join('')}
                          </div>
                        ))}
                        {pod.members.length > 4 && <span className="text-[10px] text-muted-foreground ml-1">+{pod.members.length - 4}</span>}
                      </div>
                      <span className="text-[11px] text-muted-foreground ml-auto">{pod.members.length} members</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {pod.completedToday} today</span>
                      <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {pod.avgCycleTime}m/order</span>
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {pod.throughputRate}/hr</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* ANALYTICS */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="analytics" className="mt-4 space-y-6">
            {/* Pod Performance Comparison */}
            <SectionCard title="Pod Performance Comparison" subtitle="Today's metrics across all pods">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-semibold text-muted-foreground">Pod</th>
                      <th className="pb-2 font-semibold text-muted-foreground">Type</th>
                      <th className="pb-2 font-semibold text-muted-foreground">Status</th>
                      <th className="pb-2 font-semibold text-muted-foreground text-right">Completed</th>
                      <th className="pb-2 font-semibold text-muted-foreground text-right">Cycle Time</th>
                      <th className="pb-2 font-semibold text-muted-foreground text-right">Throughput</th>
                      <th className="pb-2 font-semibold text-muted-foreground text-right">Members</th>
                      <th className="pb-2 font-semibold text-muted-foreground text-right">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pods.map(pod => {
                      const efficiency = pod.members.length > 0 ? (pod.completedToday / pod.members.length).toFixed(1) : '0';
                      return (
                        <tr key={pod.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-2.5">
                            <div>
                              <span className="font-semibold">{pod.nickname}</span>
                              <span className="text-xs text-muted-foreground ml-1.5">{pod.id}</span>
                            </div>
                          </td>
                          <td><StatusBadge variant={pod.type === 'production' ? 'info' : 'gold'}>{pod.type}</StatusBadge></td>
                          <td><StatusBadge variant={pod.status === 'active' ? 'success' : pod.status === 'idle' ? 'muted' : 'warning'}>{pod.status}</StatusBadge></td>
                          <td className="text-right font-mono font-bold">{pod.completedToday}</td>
                          <td className="text-right font-mono">{pod.avgCycleTime}m</td>
                          <td className="text-right font-mono">{pod.throughputRate}/hr</td>
                          <td className="text-right">{pod.members.length}</td>
                          <td className="text-right font-mono">{efficiency}/person</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* Throughput Chart */}
            <SectionCard title="Throughput by Pod" subtitle="Orders per hour — visual comparison">
              <div className="space-y-3">
                {pods.map(pod => {
                  const maxRate = Math.max(...pods.map(p => p.throughputRate));
                  const pct = maxRate > 0 ? (pod.throughputRate / maxRate) * 100 : 0;
                  return (
                    <div key={pod.id} className="flex items-center gap-3">
                      <span className="text-xs font-semibold w-20 truncate">{pod.nickname}</span>
                      <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                        <div
                          className={cn('h-full rounded-md transition-all flex items-center justify-end pr-2',
                            pod.type === 'production' ? 'bg-info/30' : 'bg-gold/30'
                          )}
                          style={{ width: `${pct}%` }}
                        >
                          <span className="text-[10px] font-mono font-bold">{pod.throughputRate}/hr</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Job Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SectionCard title="Jobs by Type" subtitle="Distribution of job types">
                <div className="space-y-2">
                  {(['Subscription', 'First Subscription', 'On-Demand', 'RTS Production'] as JobType[]).map(type => {
                    const count = jobs.filter(j => j.type === type).length;
                    const tc = jobTypeColors[type];
                    return (
                      <div key={type} className="flex items-center justify-between py-1.5 border-b border-border/30">
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1', tc.bg, tc.text)}>
                          <tc.icon className="w-3 h-3" /> {type}
                        </span>
                        <span className="text-sm font-mono font-bold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
              <SectionCard title="Jobs by Status" subtitle="Current job status breakdown">
                <div className="space-y-2">
                  {([
                    { status: 'queued' as const, label: 'Queued', variant: 'muted' as const },
                    { status: 'in_progress' as const, label: 'In Progress', variant: 'gold' as const },
                    { status: 'paused' as const, label: 'Paused', variant: 'warning' as const },
                    { status: 'completed' as const, label: 'Completed', variant: 'success' as const },
                  ]).map(({ status, label, variant }) => {
                    const count = jobs.filter(j => j.status === status).length;
                    return (
                      <div key={status} className="flex items-center justify-between py-1.5 border-b border-border/30">
                        <StatusBadge variant={variant}>{label}</StatusBadge>
                        <span className="text-sm font-mono font-bold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>

            {/* Daily Output Trend */}
            <SectionCard title="Daily Output Trend" subtitle="Orders processed over the past 7 days">
              <div className="flex items-end gap-2 h-40">
                {[
                  { day: 'Mon', prod: 145, ship: 98 },
                  { day: 'Tue', prod: 162, ship: 112 },
                  { day: 'Wed', prod: 138, ship: 105 },
                  { day: 'Thu', prod: 178, ship: 130 },
                  { day: 'Fri', prod: 155, ship: 118 },
                  { day: 'Sat', prod: 88, ship: 72 },
                  { day: 'Sun', prod: totalProducedToday, ship: totalShippedToday },
                ].map((d, i) => {
                  const max = 180;
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex gap-0.5 items-end h-28 w-full justify-center">
                        <div
                          className="w-3 bg-info/60 rounded-t-sm transition-all"
                          style={{ height: `${(d.prod / max) * 100}%` }}
                          title={`Produced: ${d.prod}`}
                        />
                        <div
                          className="w-3 bg-gold/60 rounded-t-sm transition-all"
                          style={{ height: `${(d.ship / max) * 100}%` }}
                          title={`Shipped: ${d.ship}`}
                        />
                      </div>
                      <span className={cn('text-[10px] font-medium', i === 6 ? 'text-gold font-bold' : 'text-muted-foreground')}>{d.day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-info/60" />
                  <span className="text-[11px] text-muted-foreground">Produced</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gold/60" />
                  <span className="text-[11px] text-muted-foreground">Shipped</span>
                </div>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* CREATE POD DIALOG */}
      {/* ═══════════════════════════════════════════ */}
      <Dialog open={showCreatePod} onOpenChange={setShowCreatePod}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-gold" /> Create New Pod</DialogTitle>
            <DialogDescription>Set up a new production or fulfillment pod with team members.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Pod Nickname *</Label>
              <Input placeholder="e.g. Echo, Foxtrot, Gamma..." value={newPodNickname} onChange={e => setNewPodNickname(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Pod Type *</Label>
              <Select value={newPodType} onValueChange={(v: 'production' | 'fulfillment') => setNewPodType(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production Pod</SelectItem>
                  <SelectItem value="fulfillment">Fulfillment Pod</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {newPodType === 'production' ? 'Handles: Picking → Labeling → Decanting → QC & Assembly' : 'Handles: Preparing → Assembly → Labels → Ready for Pickup → Shipped'}
              </p>
            </div>
            <div>
              <Label>Team Members</Label>
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {MOCK_MEMBERS.map(m => {
                  const isAssigned = assignedMemberIds.has(m.id);
                  const isSelected = newPodMembers.includes(m.id);
                  return (
                    <label key={m.id} className={cn(
                      'flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors',
                      isAssigned && !isSelected ? 'opacity-40 cursor-not-allowed' : '',
                      isSelected ? 'border-gold bg-gold/5' : 'border-border hover:bg-muted/30',
                    )}>
                      <input type="checkbox" checked={isSelected} disabled={isAssigned && !isSelected}
                        onChange={() => setNewPodMembers(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                        className="rounded" />
                      <div className="w-6 h-6 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center">
                        {m.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.role}</p>
                      </div>
                      {isAssigned && !isSelected && <span className="text-[10px] text-muted-foreground ml-auto">In another pod</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePod(false)}>Cancel</Button>
            <Button className="bg-gold hover:bg-gold/90 text-gold-foreground" onClick={handleCreatePod}>Create Pod</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════ */}
      {/* EDIT POD DIALOG */}
      {/* ═══════════════════════════════════════════ */}
      <Dialog open={!!editingPod} onOpenChange={open => !open && setEditingPod(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5 text-gold" /> Edit Pod {editingPod?.nickname}</DialogTitle>
            <DialogDescription>Update pod details, manage team members.</DialogDescription>
          </DialogHeader>
          {editingPod && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Pod Nickname</Label>
                <Input value={editingPod.nickname} onChange={e => setEditingPod({ ...editingPod, nickname: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editingPod.status} onValueChange={(v: Pod['status']) => setEditingPod({ ...editingPod, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="idle">Idle</SelectItem>
                    <SelectItem value="break">Break</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Team Members ({editingPod.members.length})</Label>
                <div className="mt-2 space-y-1">
                  {editingPod.members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center">
                          {m.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.role}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => setEditingPod({ ...editingPod, members: editingPod.members.filter(x => x.id !== m.id) })}>
                        <UserMinus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                {MOCK_MEMBERS.filter(m => !editingPod.members.find(em => em.id === m.id) && !pods.filter(p => p.id !== editingPod.id).flatMap(p => p.members).find(pm => pm.id === m.id)).length > 0 && (
                  <div className="mt-2">
                    <Select onValueChange={id => {
                      const member = MOCK_MEMBERS.find(m => m.id === id);
                      if (member && !editingPod.members.find(m => m.id === id)) {
                        setEditingPod({ ...editingPod, members: [...editingPod.members, member] });
                      }
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Add member..." /></SelectTrigger>
                      <SelectContent>
                        {MOCK_MEMBERS.filter(m => !editingPod.members.find(em => em.id === m.id) && !pods.filter(p => p.id !== editingPod.id).flatMap(p => p.members).find(pm => pm.id === m.id)).map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name} — {m.role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPod(null)}>Cancel</Button>
            <Button className="bg-gold hover:bg-gold/90 text-gold-foreground" onClick={handleSaveEditPod}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════ */}
      {/* POD DETAILS DIALOG */}
      {/* ═══════════════════════════════════════════ */}
      <Dialog open={!!selectedPod} onOpenChange={open => !open && setSelectedPod(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-gold" /> Pod {selectedPod?.nickname} — Details
            </DialogTitle>
            <DialogDescription>Full pod information, members, and performance.</DialogDescription>
          </DialogHeader>
          {selectedPod && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-muted/30 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pod ID</p>
                  <p className="text-sm font-mono font-bold">{selectedPod.id}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</p>
                  <StatusBadge variant={selectedPod.type === 'production' ? 'info' : 'gold'}>{selectedPod.type}</StatusBadge>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                  <StatusBadge variant={selectedPod.status === 'active' ? 'success' : 'muted'}>{selectedPod.status}</StatusBadge>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Created</p>
                  <p className="text-sm font-mono">{selectedPod.createdAt}</p>
                </div>
              </div>
              {selectedPod.currentJobId && (
                <div className="p-3 rounded-md bg-gold/5 border border-gold/20">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Job</p>
                  <p className="text-xs font-mono text-muted-foreground">{selectedPod.currentJobId}</p>
                  <p className="text-sm font-bold">{selectedPod.currentJobTitle}</p>
                  {selectedPod.currentStage && <StatusBadge variant="gold" className="mt-1">{selectedPod.currentStage}</StatusBadge>}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold mb-2">Performance Today</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded bg-muted/30">
                    <p className="text-lg font-bold font-mono">{selectedPod.completedToday}</p>
                    <p className="text-[10px] text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <p className="text-lg font-bold font-mono">{selectedPod.avgCycleTime}m</p>
                    <p className="text-[10px] text-muted-foreground">Avg Cycle</p>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <p className="text-lg font-bold font-mono">{selectedPod.throughputRate}/hr</p>
                    <p className="text-[10px] text-muted-foreground">Throughput</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2">Team Members ({selectedPod.members.length})</p>
                <div className="space-y-1.5">
                  {selectedPod.members.map(m => (
                    <div key={m.id} className="flex items-center gap-2 p-2 rounded-md border border-border/50">
                      <div className="w-7 h-7 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center">
                        {m.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
