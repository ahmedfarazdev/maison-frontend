// ============================================================
// Day Tracker — Operations Cockpit
// Under Decanting Stations: Start/End Day for One-Time & Subscription
// Shows today's jobs, active operators, pending orders, cycle status
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState, PipelineProgress } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  Play, Square, CheckCircle2, Clock, ArrowRight, ChevronDown, ChevronUp,
  ClipboardList, Beaker, FlaskConical, Truck, Package, ScanBarcode,
  Printer, CheckSquare, Timer, Zap, AlertTriangle, RotateCcw,
  Users, User, Calendar, Boxes, Box, SplitSquareVertical,
  BarChart3, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Job, Order, PipelineStage, SubscriptionCycle, DashboardKPIs, UserRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// Station metadata
const STATION_META: Record<number, { label: string; icon: React.ElementType; color: string }> = {
  1: { label: 'Pod Dashboard', icon: ClipboardList, color: 'text-indigo-500' },
  2: { label: 'Picking', icon: ScanBarcode, color: 'text-amber-500' },
  3: { label: 'Prep & Label', icon: Printer, color: 'text-orange-500' },
  4: { label: 'Batch Decant', icon: FlaskConical, color: 'text-emerald-500' },
  5: { label: 'Fulfillment', icon: CheckSquare, color: 'text-teal-500' },
  6: { label: 'Shipping', icon: Truck, color: 'text-violet-500' },
};

// Mock operators
const MOCK_OPERATORS: { id: string; name: string; avatar: string; role: UserRole }[] = [
  { id: 'op-1', name: 'Ahmed K.', avatar: 'AK', role: 'pod_senior' },
  { id: 'op-2', name: 'Sara M.', avatar: 'SM', role: 'pod_senior' },
  { id: 'op-3', name: 'Khalid R.', avatar: 'KR', role: 'pod_junior' },
  { id: 'op-4', name: 'Fatima A.', avatar: 'FA', role: 'pod_senior' },
  { id: 'op-5', name: 'Omar H.', avatar: 'OH', role: 'pod_junior' },
];

interface DaySession {
  mode: 'one_time' | 'subscription';
  startedAt: string;
  endedAt: string | null;
  status: 'active' | 'ended';
}

interface OperatorAssignment {
  operatorId: string;
  jobIds: string[];
  station: number | null;
  status: 'idle' | 'working' | 'done';
}

function getElapsedTime(startTime: string): string {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - start);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getJobProgress(job: Job): number {
  const total = job.station_statuses.length;
  if (total === 0) return 0;
  const completed = job.station_statuses.filter(s => s.status === 'completed').length;
  const inProgress = job.station_statuses.filter(s => s.status === 'in_progress').length;
  return Math.round(((completed + inProgress * 0.5) / total) * 100);
}

// Roles that can see the full team management section
const MANAGER_ROLES: UserRole[] = ['owner', 'admin', 'pod_leader', 'system_architect'];
// Roles that are operators (see personalized view)
const OPERATOR_ROLES: UserRole[] = ['pod_senior', 'pod_junior', 'vault_guardian'];

export default function DayTracker() {
  const { user, hasRole } = useAuth();
  const isManager = hasRole(...MANAGER_ROLES);
  const isOperator = hasRole(...OPERATOR_ROLES);
  const userName = user?.fullName?.split(' ')[0] || 'Operator';

  const { data: jobsRes } = useApiQuery(() => api.jobs.list(), []);
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: pipelineRes } = useApiQuery(() => api.dashboard.pipeline(), []);
  const { data: kpisRes } = useApiQuery(() => api.dashboard.kpis(), []);
  const { data: cyclesRes } = useApiQuery(() => api.subscriptions.cycles(), []);

  const jobs = (jobsRes || []) as Job[];
  const orders = (ordersRes || []) as Order[];
  const pipeline = pipelineRes as PipelineStage[] | undefined;
  const kpis = kpisRes as DashboardKPIs | undefined;
  const cycles = (cyclesRes || []) as SubscriptionCycle[];
  const activeCycle = cycles.find(c => c.status === 'active' || c.status === 'processing');

  // Day sessions state
  const [daySessions, setDaySessions] = useState<DaySession[]>([]);
  const [operatorAssignments, setOperatorAssignments] = useState<OperatorAssignment[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const otSession = daySessions.find(s => s.mode === 'one_time' && s.status === 'active');
  const subSession = daySessions.find(s => s.mode === 'subscription' && s.status === 'active');

  // Filter jobs by type
  const otJobs = useMemo(() => jobs.filter(j => j.source === 'one_time' || j.source === 'manual'), [jobs]);
  const subJobs = useMemo(() => jobs.filter(j => j.source === 'subscription'), [jobs]);

  // Job status groupings
  const groupJobs = (jobList: Job[]) => {
    const active = jobList.filter(j => j.station_statuses.some(s => s.status === 'in_progress'));
    const pending = jobList.filter(j => j.station_statuses.every(s => s.status === 'pending'));
    const completed = jobList.filter(j => j.station_statuses.every(s => s.status === 'completed' || s.status === 'skipped'));
    return { active, pending, completed, total: jobList.length };
  };

  const otStats = useMemo(() => groupJobs(otJobs), [otJobs]);
  const subStats = useMemo(() => groupJobs(subJobs), [subJobs]);

  // Pending orders
  const pendingOtOrders = useMemo(() => orders.filter(o => o.type === 'one_time' && ['new', 'processing'].includes(o.status)).length, [orders]);
  const pendingSubOrders = useMemo(() => orders.filter(o => o.type === 'subscription' && ['new', 'processing'].includes(o.status)).length, [orders]);

  // Overall day progress
  const dayProgress = useMemo(() => {
    if (jobs.length === 0) return 0;
    const totalProgress = jobs.reduce((sum, j) => sum + getJobProgress(j), 0);
    return Math.round(totalProgress / jobs.length);
  }, [jobs]);

  // Handlers
  const startDay = (mode: 'one_time' | 'subscription') => {
    const session: DaySession = {
      mode,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'active',
    };
    setDaySessions(prev => [...prev.filter(s => !(s.mode === mode && s.status === 'active')), session]);
    const label = mode === 'one_time' ? 'One-Time' : 'Subscription';
    toast.success(`${label} day started`, {
      description: `${label} stations are now active. Process picking, decanting, and fulfillment.`,
    });
  };

  const endDay = (mode: 'one_time' | 'subscription') => {
    setDaySessions(prev => prev.map(s =>
      s.mode === mode && s.status === 'active'
        ? { ...s, endedAt: new Date().toISOString(), status: 'ended' as const }
        : s
    ));
    const label = mode === 'one_time' ? 'One-Time' : 'Subscription';
    toast.success(`${label} day ended`, {
      description: 'Day recorded. Status saved for next session.',
    });
  };

  const assignOperator = (operatorId: string, jobId: string) => {
    setOperatorAssignments(prev => {
      const existing = prev.find(a => a.operatorId === operatorId);
      if (existing) {
        return prev.map(a =>
          a.operatorId === operatorId
            ? { ...a, jobIds: Array.from(new Set([...a.jobIds, jobId])), status: 'working' as const }
            : a
        );
      }
      return [...prev, { operatorId, jobIds: [jobId], station: null, status: 'working' as const }];
    });
    const op = MOCK_OPERATORS.find(o => o.id === operatorId);
    toast.success(`${op?.name || operatorId} assigned to job`);
  };

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader
        title={isOperator && !isManager ? `Welcome, ${userName}` : 'Day Tracker'}
        subtitle={isOperator && !isManager ? `Your daily operations · ${todayStr}` : todayStr}
        breadcrumbs={[{ label: 'Decanting Stations' }, { label: 'Day Tracker' }]}
      />

      <div className="p-6 space-y-6">
        {/* ===== Day Progress Hero ===== */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Today's Overview</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {jobs.length} total jobs · {pendingOtOrders + pendingSubOrders} pending orders · Day {dayProgress}% complete
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tracking-tight">{dayProgress}%</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Complete</p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-gold/80 via-gold to-success"
              initial={{ width: 0 }}
              animate={{ width: `${dayProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* ===== Start/End Day Buttons ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* One-Time Day Card */}
          <div className={cn(
            'rounded-lg border p-5 transition-all',
            otSession ? 'border-gold/40 bg-gold/[0.03]' : 'border-border',
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">One-Time Orders</h3>
                  <p className="text-xs text-muted-foreground">{otStats.total} jobs · {pendingOtOrders} pending orders</p>
                </div>
              </div>
              {otSession ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Active · {getElapsedTime(otSession.startedAt)}
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/5" onClick={() => endDay('one_time')}>
                    <Square className="w-3 h-3" /> End Day
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => startDay('one_time')}>
                  <Play className="w-3.5 h-3.5" /> Start Day
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-lg font-bold">{otStats.active.length}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Active</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-lg font-bold">{otStats.pending.length}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Queued</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-lg font-bold">{otStats.completed.length}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Done</p>
              </div>
            </div>
            {otSession && (
              <div className="mt-3 flex gap-2">
                <Link href="/stations/1-job-board" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full gap-1 text-xs">
                    Pod Dashboard <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
                <Link href="/stations/2-picking" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full gap-1 text-xs">
                    S2 Picking <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Subscription Day Card */}
          <div className={cn(
            'rounded-lg border p-5 transition-all',
            subSession ? 'border-gold/40 bg-gold/[0.03]' : 'border-border',
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Subscription Cycle</h3>
                  <p className="text-xs text-muted-foreground">
                    {subStats.total} jobs · {pendingSubOrders} pending
                    {activeCycle && ` · ${activeCycle.cycle_id || 'Active Cycle'}`}
                  </p>
                </div>
              </div>
              {subSession ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Active · {getElapsedTime(subSession.startedAt)}
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/5" onClick={() => endDay('subscription')}>
                    <Square className="w-3 h-3" /> End Day
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={() => startDay('subscription')}>
                  <Play className="w-3.5 h-3.5" /> Start Day
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-lg font-bold">{subStats.active.length}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Active</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-lg font-bold">{subStats.pending.length}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Queued</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-md">
                <p className="text-lg font-bold">{subStats.completed.length}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Done</p>
              </div>
            </div>
            {subSession && (
              <div className="mt-3 flex gap-2">
                <Link href="/stations/1-job-board" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full gap-1 text-xs">
                    Pod Dashboard <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
                <Link href="/stations/2-picking" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full gap-1 text-xs">
                    S2 Picking <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ===== Subscription Cycle Quick Gantt ===== */}
        {activeCycle && (
          <SectionCard
            title="Subscription Cycle Progress"
            subtitle={`${activeCycle.cycle_id || 'Current Cycle'} — Cutoff: ${new Date(activeCycle.cutoff_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
            headerActions={
              <Link href="/stations/1-job-board">
                <Button size="sm" variant="ghost" className="text-xs gap-1">
                  Open Board <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            }
          >
            <div className="space-y-3">
              {/* Mini Gantt — 7-day timeline */}
              <div className="grid grid-cols-7 gap-0">
                {[1,2,3,4,5,6,7].map(day => {
                  const currentDay = 1; // TODO: wire to actual cycle day from backend
                  const isComplete = day < currentDay;
                  const isCurrent = day === currentDay;
                  const labels = ['Queue', 'Pick', 'Label', 'Decant', 'Fulfill', 'Ship', 'Buffer'];
                  return (
                    <div key={day} className={cn(
                      'text-center py-2 border-b-2 transition-all',
                      isComplete ? 'border-success bg-success/5' :
                      isCurrent ? 'border-gold bg-gold/5' : 'border-border',
                    )}>
                      <div className={cn('text-[10px] font-semibold', isCurrent ? 'text-gold' : isComplete ? 'text-success' : 'text-muted-foreground')}>
                        Day {day}
                      </div>
                      <div className="text-[9px] text-muted-foreground">{labels[day-1]}</div>
                      {isCurrent && <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gold mx-auto animate-pulse" />}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-muted/30 rounded-md">
                  <p className="text-lg font-semibold">{activeCycle.forecast_summary?.total_orders || 0}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Orders</p>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded-md">
                  <p className="text-lg font-semibold">{activeCycle.forecast_summary?.total_decants || 0}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Decants</p>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded-md">
                  <p className="text-lg font-semibold">{subStats.total}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Jobs</p>
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ===== Operator Assignment Module (managers only) ===== */}
        {isManager && <SectionCard
          title="Team & Operators"
          subtitle={`${MOCK_OPERATORS.length} operators available · ${operatorAssignments.filter(a => a.status === 'working').length} active`}
          headerActions={
            <StatusBadge variant={operatorAssignments.length > 0 ? 'gold' : 'muted'}>
              {operatorAssignments.filter(a => a.status === 'working').length} Working
            </StatusBadge>
          }
        >
          <div className="space-y-3">
            {MOCK_OPERATORS.map(op => {
              const assignment = operatorAssignments.find(a => a.operatorId === op.id);
              const assignedJobCount = assignment?.jobIds.length || 0;
              const roleLabel = op.role === 'pod_senior' ? 'Senior' : op.role === 'pod_junior' ? 'Junior' : op.role === 'pod_leader' ? 'Leader' : 'General';
              return (
                <div key={op.id} className={cn(
                  'flex items-center gap-4 p-3 rounded-lg border transition-all',
                  assignment?.status === 'working' ? 'border-gold/30 bg-gold/[0.02]' :
                  assignment?.status === 'done' ? 'border-success/30 bg-success/[0.02]' : 'border-border',
                )}>
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {op.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{op.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{roleLabel}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {assignedJobCount > 0 ? `${assignedJobCount} job${assignedJobCount > 1 ? 's' : ''} assigned` : 'No jobs assigned'}
                      {assignment?.station && ` · Station S${assignment.station}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {assignment?.status === 'working' && (
                      <div className="flex items-center gap-1 text-[10px] text-gold font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                        Working
                      </div>
                    )}
                    {assignment?.status === 'done' && (
                      <div className="flex items-center gap-1 text-[10px] text-success font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Done
                      </div>
                    )}
                    {!assignment && (
                      <span className="text-[10px] text-muted-foreground">Idle</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>}

        {/* ===== My Assignments (operators only) ===== */}
        {isOperator && !isManager && (
          <SectionCard
            title="My Assignments"
            subtitle="Jobs assigned to you today"
          >
            {(() => {
              // In a real app, filter by current user's operator ID
              // For now, show a personalized view with mock data
              const myAssignment = operatorAssignments.find(a => a.operatorId === 'op-1');
              const myJobIds = myAssignment?.jobIds || [];
              const myJobs = jobs.filter(j => myJobIds.includes(j.job_id));
              return myJobs.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No jobs assigned yet" description="Your manager will assign jobs to you when the day starts." />
              ) : (
                <div className="space-y-2">
                  {myJobs.map(job => {
                    const progress = getJobProgress(job);
                    const activeStation = job.station_statuses.find(s => s.status === 'in_progress');
                    const meta = activeStation ? STATION_META[activeStation.station] : null;
                    return (
                      <div key={job.job_id} className="flex items-center gap-4 p-3 rounded-lg border border-gold/30 bg-gold/[0.02]">
                        <div className="relative w-10 h-10 shrink-0">
                          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/50" />
                            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3"
                              strokeDasharray={`${2 * Math.PI * 16}`}
                              strokeDashoffset={`${2 * Math.PI * 16 * (1 - progress / 100)}`}
                              strokeLinecap="round" className="text-gold transition-all duration-500"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{progress}%</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-mono font-semibold">{job.job_id}</span>
                          <p className="text-xs text-muted-foreground">
                            {job.order_ids.length} orders
                            {meta && <> · <span className={meta.color}>S{activeStation?.station} {meta.label}</span></>}
                          </p>
                        </div>
                        <Link href={job.source === 'subscription' ? '/stations/1-job-board' : '/stations/1-job-board'}>
                          <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1 text-xs h-7">
                            Work on this <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </SectionCard>
        )}

        {/* ===== Active Jobs Overview ===== */}
        <SectionCard
          title="All Active Jobs"
          subtitle={`${otStats.active.length + subStats.active.length} in progress across all stations`}
        >
          {[...otStats.active, ...subStats.active].length === 0 ? (
            <EmptyState icon={ClipboardList} title="No active jobs" description="Start the day and create jobs from the station boards." />
          ) : (
            <div className="space-y-2">
              {[...otStats.active, ...subStats.active].map(job => {
                const progress = getJobProgress(job);
                const activeStation = job.station_statuses.find(s => s.status === 'in_progress');
                const meta = activeStation ? STATION_META[activeStation.station] : null;
                return (
                  <div key={job.job_id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:border-gold/30 transition-all">
                    {/* Progress circle */}
                    <div className="relative w-10 h-10 shrink-0">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/50" />
                        <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3"
                          strokeDasharray={`${2 * Math.PI * 16}`}
                          strokeDashoffset={`${2 * Math.PI * 16 * (1 - progress / 100)}`}
                          strokeLinecap="round" className="text-gold transition-all duration-500"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{progress}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold">{job.job_id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {job.source === 'subscription' ? 'SUB' : 'OT'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.order_ids.length} orders
                        {meta && <> · <span className={meta.color}>S{activeStation?.station} {meta.label}</span></>}
                      </p>
                    </div>
                    <Link href={job.source === 'subscription' ? '/stations/1-job-board' : '/stations/1-job-board'}>
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                        View <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ===== Completed Jobs Today ===== */}
        {(otStats.completed.length + subStats.completed.length) > 0 && (
          <SectionCard
            title="Completed Today"
            subtitle={`${otStats.completed.length + subStats.completed.length} jobs finished`}
            headerActions={<StatusBadge variant="success">Done</StatusBadge>}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[...otStats.completed, ...subStats.completed].map(job => (
                <div key={job.job_id} className="flex items-center gap-3 p-2.5 rounded-md border border-success/20 bg-success/[0.02]">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-mono font-medium">{job.job_id}</span>
                    <span className="text-xs text-muted-foreground ml-2">{job.order_ids.length} orders</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {job.source === 'subscription' ? 'SUB' : 'OT'}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ===== Quick Station Links ===== */}
        <SectionCard title="Quick Access" subtitle="Jump to any station">
          {(() => {
            // Filter stations based on role
            const userRole = user?.role;
            const allowedStations = Object.keys(STATION_META).map(Number); // All pod roles access all stations
            const filteredMeta = Object.entries(STATION_META).filter(([id]) => allowedStations.includes(Number(id)));
            const stationPath = (id: string) => id === '1' ? '1-job-board' : id === '2' ? '2-picking' : id === '3' ? '3-prep-label' : id === '4' ? '4-batch-decant' : id === '5' ? '5-fulfillment' : '6-shipping';
            // All operators see both OT and Sub stations now
            const showOT = true;
            const showSub = true;
            return (
              <div className="grid grid-cols-2 gap-3">
                {showOT && (
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">One-Time</h4>
                    <div className="grid grid-cols-3 gap-1.5">
                      {filteredMeta.map(([id, meta]) => (
                        <Link key={`ot-${id}`} href={`/stations/${stationPath(id)}`}>
                          <button className="w-full flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/50 hover:border-gold/30 transition-all text-left group">
                            <meta.icon className={cn('w-3.5 h-3.5', meta.color)} />
                            <span className="text-[11px] font-medium">S{id}</span>
                          </button>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {showSub && (
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Subscription</h4>
                    <div className="grid grid-cols-3 gap-1.5">
                      {filteredMeta.map(([id, meta]) => (
                        <Link key={`sub-${id}`} href={`/stations/${stationPath(id)}`}>
                          <button className="w-full flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/50 hover:border-blue-500/30 transition-all text-left group">
                            <meta.icon className={cn('w-3.5 h-3.5', meta.color)} />
                            <span className="text-[11px] font-medium">S{id}</span>
                          </button>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </SectionCard>
      </div>
    </div>
  );
}
