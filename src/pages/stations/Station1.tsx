// ============================================================
// Pod Dashboard — Operator Daily Dashboard (Pod Dashboard)
// Round 22: Redesigned as comprehensive operator dashboard.
// - Welcome header with Start/End Day controls
// - Daily timeline with Gantt chart and overdue indicators
// - Subscription 7-day cycle view + One-time daily cutoff
// - Personal KPIs, job queue, and Kanban
// - Managers see full pipeline overview
// - No "Create Job" for operators — moved to /job-creation
// ============================================================

import { useState, useMemo, useCallback, useEffect, DragEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, SectionCard, PipelineProgress, StatusBadge, StationStepper, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  ArrowRight, Beaker, ClipboardList, ShoppingCart, RotateCcw, Clock, Calendar,
  Layers, Package, ChevronDown, ChevronUp, User, MapPin, FileText,
  Play, CheckCircle2, Timer, Kanban, AlertTriangle,
  Truck, Tag, FlaskConical, PackageCheck, Box, Boxes, SplitSquareVertical,
  GripVertical, ArrowLeftRight, Undo2, AlertCircle, Plus,
  BarChart3, TrendingUp, TrendingDown, Coffee, Sun, Square, Filter,
  Zap, Target, Award, Flame, CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { Job, Order, PipelineStage, UserRole } from '@/types';

const JOB_STATUS_VARIANT: Record<string, 'muted' | 'info' | 'gold' | 'success' | 'warning'> = {
  pending: 'muted', picked: 'info', prepped: 'gold', decanted: 'success', packed: 'success', shipped: 'success',
};

const MANAGER_ROLES: UserRole[] = ['owner', 'admin', 'pod_leader', 'system_architect'];
const OPERATOR_ROLES: UserRole[] = ['pod_senior', 'pod_junior'];

type JobTypeFilter = 'all' | 'one_time' | 'subscription' | 'ready_to_ship';

const KANBAN_COLUMNS = [
  { id: 'queued', label: 'Queued', icon: ClipboardList, color: 'bg-slate-500', borderColor: 'border-slate-500/30', bgTint: 'bg-slate-500/5', statusMatch: ['pending'], dropStatus: 'pending' },
  { id: 'picking', label: 'Picking', icon: Package, color: 'bg-amber-500', borderColor: 'border-amber-500/30', bgTint: 'bg-amber-500/5', statusMatch: ['picked'], dropStatus: 'picked' },
  { id: 'labelling', label: 'Labels', icon: Tag, color: 'bg-blue-500', borderColor: 'border-blue-500/30', bgTint: 'bg-blue-500/5', statusMatch: ['prepped'], dropStatus: 'prepped' },
  { id: 'decanting', label: 'Decanting', icon: FlaskConical, color: 'bg-purple-500', borderColor: 'border-purple-500/30', bgTint: 'bg-purple-500/5', statusMatch: ['decanted'], dropStatus: 'decanted' },
  { id: 'packing', label: 'Fulfillment', icon: PackageCheck, color: 'bg-orange-500', borderColor: 'border-orange-500/30', bgTint: 'bg-orange-500/5', statusMatch: ['packed'], dropStatus: 'packed' },
  { id: 'shipped', label: 'Dispatch', icon: Truck, color: 'bg-emerald-500', borderColor: 'border-emerald-500/30', bgTint: 'bg-emerald-500/5', statusMatch: ['shipped'], dropStatus: 'shipped' },
];

const STATUS_ORDER = ['pending', 'picked', 'prepped', 'decanted', 'packed', 'shipped'];

// Timeline hours for daily Gantt
const TIMELINE_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

// Mock daily schedule for operator Gantt
interface ScheduleBlock {
  jobId: string;
  type: 'one_time' | 'subscription';
  startHour: number;
  durationHours: number;
  station: number;
  status: 'completed' | 'in_progress' | 'upcoming' | 'overdue';
  orderCount: number;
}

export default function Station1() {
  const { user, hasRole } = useAuth();
  const isManager = hasRole(...MANAGER_ROLES);
  const isOperator = hasRole(...OPERATOR_ROLES);
  const userName = user?.fullName?.split(' ')[0] || 'Operator';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Job type filter
  const [jobTypeFilter, setJobTypeFilter] = useState<JobTypeFilter>('all');

  // Operator day state
  const [operatorDayStarted, setOperatorDayStarted] = useState(false);
  const [operatorDayStartTime, setOperatorDayStartTime] = useState<string | null>(null);
  const [operatorOnBreak, setOperatorOnBreak] = useState(false);
  const [operatorBreakMinutes, setOperatorBreakMinutes] = useState(0);
  const [operatorBreakStartTime, setOperatorBreakStartTime] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Day management
  const handleStartDay = () => {
    setOperatorDayStarted(true);
    setOperatorDayStartTime(new Date().toISOString());
    setOperatorOnBreak(false);
    setOperatorBreakMinutes(0);
    toast.success(`${greeting}, ${userName}!`, { description: 'Your shift has started. Your jobs and schedule are below.' });
  };
  const handleTakeBreak = () => {
    setOperatorOnBreak(true);
    setOperatorBreakStartTime(new Date().toISOString());
    toast.info('Break started', { description: 'Take your time. Resume when ready.' });
  };
  const handleResumeWork = () => {
    if (operatorBreakStartTime) {
      const breakMs = Date.now() - new Date(operatorBreakStartTime).getTime();
      setOperatorBreakMinutes(prev => prev + Math.round(breakMs / 60000));
    }
    setOperatorOnBreak(false);
    setOperatorBreakStartTime(null);
    toast.success('Welcome back!', { description: 'Break ended. Resuming your shift.' });
  };
  const handleEndDay = () => {
    if (operatorBreakStartTime) {
      const breakMs = Date.now() - new Date(operatorBreakStartTime).getTime();
      setOperatorBreakMinutes(prev => prev + Math.round(breakMs / 60000));
    }
    setOperatorDayStarted(false);
    setOperatorOnBreak(false);
    setOperatorBreakStartTime(null);
    const elapsed = operatorDayStartTime ? Math.round((Date.now() - new Date(operatorDayStartTime).getTime()) / 60000) : 0;
    toast.success('Shift complete!', {
      description: `Total: ${Math.floor(elapsed / 60)}h ${elapsed % 60}m · Breaks: ${operatorBreakMinutes}m · Active: ${elapsed - operatorBreakMinutes}m`,
    });
    setOperatorDayStartTime(null);
    setOperatorBreakMinutes(0);
  };

  const getElapsedStr = (startTime: string | null): string => {
    if (!startTime) return '0m';
    const diff = Math.max(0, Date.now() - new Date(startTime).getTime());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Data queries
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: jobsRes } = useApiQuery(() => api.jobs.list(), []);
  const { data: pipelineRes } = useApiQuery(() => api.dashboard.pipeline(), []);

  const orders = (ordersRes || []) as Order[];
  const jobs = (jobsRes || []) as Job[];
  const pipeline = pipelineRes as PipelineStage[] | undefined;

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [kanbanView, setKanbanView] = useState<'board' | 'list'>('board');

  // DnD State
  const [draggedJob, setDraggedJob] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [jobStatusOverrides, setJobStatusOverrides] = useState<Record<string, string>>({});
  const [moveHistory, setMoveHistory] = useState<Array<{ jobId: string; from: string; to: string; timestamp: number }>>([]);
  const [showMoveConfirm, setShowMoveConfirm] = useState<{ jobId: string; from: string; to: string; fromLabel: string; toLabel: string; isBackward: boolean } | null>(null);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    let baseJobs = jobs;
    if (jobTypeFilter === 'one_time') baseJobs = jobs.filter(j => j.source === 'one_time' || j.source === 'manual');
    else if (jobTypeFilter === 'subscription') baseJobs = jobs.filter(j => j.source === 'subscription');
    else if (jobTypeFilter === 'ready_to_ship') baseJobs = jobs.filter(j => j.source === 'ready_to_ship');
    return baseJobs.map(j => ({
      ...j,
      status: (jobStatusOverrides[j.job_id] || j.status) as Job['status'],
    }));
  }, [jobs, jobTypeFilter, jobStatusOverrides]);

  const filteredOrders = useMemo(() => {
    let base = orders.filter(o => ['new', 'processing'].includes(o.status));
    if (jobTypeFilter === 'one_time') base = base.filter(o => o.type === 'one_time');
    else if (jobTypeFilter === 'subscription') base = base.filter(o => o.type === 'subscription');
    return base;
  }, [orders, jobTypeFilter]);

  const batchSummary = useMemo(() => {
    const pending = filteredJobs.filter(j => j.status === 'pending').length;
    const inProgress = filteredJobs.filter(j => ['picked', 'prepped', 'decanted'].includes(j.status)).length;
    const fulfilled = filteredJobs.filter(j => ['packed', 'shipped'].includes(j.status)).length;
    return { pending, inProgress, fulfilled, total: filteredJobs.length };
  }, [filteredJobs]);

  const kanbanData = useMemo(() => {
    return KANBAN_COLUMNS.map(col => ({
      ...col,
      jobs: filteredJobs.filter(j => col.statusMatch.includes(j.status)),
    }));
  }, [filteredJobs]);

  const jobTypeCounts = useMemo(() => ({
    all: jobs.length,
    one_time: jobs.filter(j => j.source === 'one_time' || j.source === 'manual').length,
    subscription: jobs.filter(j => j.source === 'subscription').length,
    ready_to_ship: jobs.filter(j => j.source === 'ready_to_ship').length,
  }), [jobs]);

  // Mock schedule blocks for Gantt
  const scheduleBlocks: ScheduleBlock[] = useMemo(() => {
    const now = currentTime.getHours() + currentTime.getMinutes() / 60;
    return [
      { jobId: 'JOB-OT-001', type: 'one_time', startHour: 7, durationHours: 1.5, station: 2, status: now > 8.5 ? 'completed' : now >= 7 ? 'in_progress' : 'upcoming', orderCount: 3 },
      { jobId: 'JOB-OT-002', type: 'one_time', startHour: 8.5, durationHours: 2, station: 3, status: now > 10.5 ? 'completed' : now >= 8.5 ? 'in_progress' : 'upcoming', orderCount: 5 },
      { jobId: 'JOB-SUB-001', type: 'subscription', startHour: 10.5, durationHours: 2.5, station: 4, status: now > 13 ? 'completed' : now >= 10.5 ? 'in_progress' : 'upcoming', orderCount: 8 },
      { jobId: 'JOB-OT-003', type: 'one_time', startHour: 13.5, durationHours: 1.5, station: 2, status: now > 15 ? 'overdue' : now >= 13.5 ? 'in_progress' : 'upcoming', orderCount: 2 },
      { jobId: 'JOB-SUB-002', type: 'subscription', startHour: 15, durationHours: 2, station: 5, status: 'upcoming', orderCount: 6 },
    ];
  }, [currentTime]);

  // DnD Handlers
  const handleDragStart = useCallback((e: DragEvent, jobId: string) => {
    setDraggedJob(jobId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', jobId);
    if (e.currentTarget instanceof HTMLElement) {
      setTimeout(() => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '0.4'; }, 0);
    }
  }, []);

  const handleDragEnd = useCallback((e: DragEvent) => {
    setDraggedJob(null);
    setDragOverColumn(null);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '1';
  }, []);

  const handleDragOver = useCallback((e: DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOverColumn(null); }, []);

  const handleDrop = useCallback((e: DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const jobId = e.dataTransfer.getData('text/plain');
    if (!jobId) return;
    const targetCol = KANBAN_COLUMNS.find(c => c.id === targetColumnId);
    if (!targetCol) return;
    const job = filteredJobs.find(j => j.job_id === jobId);
    if (!job) return;
    const currentColIdx = KANBAN_COLUMNS.findIndex(c => c.statusMatch.includes(job.status));
    const targetColIdx = KANBAN_COLUMNS.findIndex(c => c.id === targetColumnId);
    if (currentColIdx === targetColIdx) return;
    const currentCol = KANBAN_COLUMNS[currentColIdx];
    const isBackward = targetColIdx < currentColIdx;
    const isSkip = Math.abs(targetColIdx - currentColIdx) > 1;

    if (isBackward || isSkip) {
      setShowMoveConfirm({
        jobId, from: currentCol?.id || '', to: targetColumnId,
        fromLabel: currentCol?.label || '', toLabel: targetCol.label, isBackward,
      });
      return;
    }
    executeMove(jobId, targetCol.dropStatus, currentCol?.label || '', targetCol.label);
  }, [filteredJobs]);

  const executeMove = useCallback((jobId: string, newStatus: string, fromLabel: string, toLabel: string) => {
    const oldStatus = jobStatusOverrides[jobId] || filteredJobs.find(j => j.job_id === jobId)?.status || '';
    setJobStatusOverrides(prev => ({ ...prev, [jobId]: newStatus }));
    setMoveHistory(prev => [...prev, { jobId, from: oldStatus, to: newStatus, timestamp: Date.now() }]);
    toast.success(<span><strong>{jobId}</strong>: {fromLabel} → {toLabel}</span>, {
      action: {
        label: 'Undo',
        onClick: () => {
          setJobStatusOverrides(prev => {
            const next = { ...prev };
            if (oldStatus === filteredJobs.find(j => j.job_id === jobId)?.status) delete next[jobId];
            else next[jobId] = oldStatus;
            return next;
          });
          toast.info('Move undone');
        },
      },
    });
    setShowMoveConfirm(null);
  }, [jobStatusOverrides, filteredJobs]);

  const undoLastMove = useCallback(() => {
    if (moveHistory.length === 0) return;
    const last = moveHistory[moveHistory.length - 1];
    setJobStatusOverrides(prev => {
      const next = { ...prev };
      if (last.from === filteredJobs.find(j => j.job_id === last.jobId)?.status) delete next[last.jobId];
      else next[last.jobId] = last.from;
      return next;
    });
    setMoveHistory(prev => prev.slice(0, -1));
    toast.info('Last move undone');
  }, [moveHistory, filteredJobs]);

  // Operator stats
  const completedJobs = filteredJobs.filter(j => j.station_statuses.every(s => s.status === 'completed' || s.status === 'skipped')).length;
  const activeJobs = filteredJobs.filter(j => j.station_statuses.some(s => s.status === 'in_progress')).length;
  const overdueBlocks = scheduleBlocks.filter(b => b.status === 'overdue').length;
  const completedBlocks = scheduleBlocks.filter(b => b.status === 'completed').length;
  const totalBlocks = scheduleBlocks.length;
  const progressPercent = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

  // Current hour for timeline marker
  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;

  // One-time cutoff time (e.g., 2 PM)
  const OT_CUTOFF_HOUR = 14;
  const otCutoffRemaining = Math.max(0, OT_CUTOFF_HOUR - currentHour);
  const otCutoffPassed = currentHour >= OT_CUTOFF_HOUR;

  // Page header
  const pageTitle = isOperator && !isManager
    ? `${greeting}, ${userName}`
    : 'Pod Dashboard';
  const pageSubtitle = isOperator && !isManager
    ? `${currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : 'Unified job queue — all one-time and subscription jobs';

  return (
    <div>
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        breadcrumbs={[
          { label: 'Pod Framework' },
          { label: 'Pod Dashboard' },
        ]}
        actions={
          <div className="flex gap-2">
            {isManager && (
              <Link href="/job-creation">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Create Job
                </Button>
              </Link>
            )}
            <Link href="/stations/2-picking">
              <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" /> {isOperator && !isManager ? 'My Pick Lists' : 'Pick Lists'} <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            {isOperator && (
              <Link href="/manual-decant">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Beaker className="w-3.5 h-3.5" /> Manual Decant
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* ========== OPERATOR DASHBOARD ========== */}
        {isOperator && !isManager && (
          <>
            {/* ---- Shift Control + KPIs ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Shift Control Card */}
              <div className={cn(
                'lg:col-span-2 rounded-xl border-2 p-5 transition-all',
                operatorDayStarted
                  ? operatorOnBreak
                    ? 'border-amber-500/40 bg-amber-500/[0.02]'
                    : 'border-gold/40 bg-gold/[0.02]'
                  : 'border-border bg-card',
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center transition-all',
                      operatorDayStarted
                        ? operatorOnBreak ? 'bg-amber-500/10' : 'bg-gold/10'
                        : 'bg-muted',
                    )}>
                      {operatorDayStarted
                        ? operatorOnBreak
                          ? <Coffee className="w-7 h-7 text-amber-500" />
                          : <Sun className="w-7 h-7 text-gold animate-pulse" />
                        : <Play className="w-7 h-7 text-muted-foreground" />
                      }
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight">
                        {operatorDayStarted
                          ? operatorOnBreak ? 'On Break' : 'Shift Active'
                          : 'Ready to Start Your Day'
                        }
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {operatorDayStarted
                          ? `Started ${getElapsedStr(operatorDayStartTime)} ago · Breaks: ${operatorBreakMinutes}m`
                          : 'Press Start My Day to begin your shift and see your schedule'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!operatorDayStarted ? (
                      <Button onClick={handleStartDay} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-2 h-11 px-6 shadow-lg shadow-gold/20">
                        <Play className="w-4 h-4" /> Start My Day
                      </Button>
                    ) : operatorOnBreak ? (
                      <Button onClick={handleResumeWork} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-2 h-11 px-6">
                        <Play className="w-4 h-4" /> Resume Work
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={handleTakeBreak} className="gap-2 h-10 border-amber-300 text-amber-600 hover:bg-amber-50">
                          <Coffee className="w-4 h-4" /> Break
                        </Button>
                        <Button variant="outline" onClick={handleEndDay} className="gap-2 h-10 border-destructive/30 text-destructive hover:bg-destructive/10">
                          <Square className="w-4 h-4" /> End Day
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Shift Timer Metrics */}
                {operatorDayStarted && (
                  <div className="grid grid-cols-4 gap-3 pt-4 border-t border-border/50">
                    <div className="text-center p-2.5 rounded-lg bg-muted/30">
                      <p className="text-xl font-bold font-mono text-gold">{getElapsedStr(operatorDayStartTime)}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Shift Duration</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-muted/30">
                      <p className="text-xl font-bold font-mono">{operatorBreakMinutes}m</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Break Time</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-muted/30">
                      <p className="text-xl font-bold">{activeJobs}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Active Jobs</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-muted/30">
                      <p className="text-xl font-bold text-emerald-600">{completedJobs}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Completed</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Daily KPIs Card */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-gold" /> Today's Progress
                </h3>
                {/* Progress Ring */}
                <div className="flex items-center justify-center">
                  <div className="relative w-28 h-28">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
                        strokeDasharray={`${progressPercent * 2.64} 264`}
                        strokeLinecap="round"
                        className={cn(overdueBlocks > 0 ? 'text-amber-500' : 'text-gold')}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">{progressPercent}%</span>
                      <span className="text-[9px] text-muted-foreground">Complete</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Completed</span>
                    <span className="font-semibold">{completedBlocks}/{totalBlocks}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Flame className="w-3 h-3 text-gold" /> In Progress</span>
                    <span className="font-semibold">{scheduleBlocks.filter(b => b.status === 'in_progress').length}</span>
                  </div>
                  {overdueBlocks > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-600 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Overdue</span>
                      <span className="font-semibold text-amber-600">{overdueBlocks}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5"><CircleDot className="w-3 h-3 text-blue-500" /> Upcoming</span>
                    <span className="font-semibold">{scheduleBlocks.filter(b => b.status === 'upcoming').length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Cutoff Indicators ---- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* One-Time Cutoff */}
              <div className={cn(
                'rounded-lg border p-3 flex items-center gap-3 transition-all',
                otCutoffPassed ? 'border-red-500/30 bg-red-500/5' : otCutoffRemaining < 2 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border',
              )}>
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  otCutoffPassed ? 'bg-red-500/10' : 'bg-blue-500/10',
                )}>
                  <ShoppingCart className={cn('w-4.5 h-4.5', otCutoffPassed ? 'text-red-500' : 'text-blue-500')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">One-Time Orders Cutoff</p>
                  <p className="text-[10px] text-muted-foreground">
                    {otCutoffPassed
                      ? 'Cutoff passed — remaining orders move to tomorrow'
                      : `${Math.floor(otCutoffRemaining)}h ${Math.round((otCutoffRemaining % 1) * 60)}m remaining until 2:00 PM cutoff`
                    }
                  </p>
                </div>
                <Badge variant="outline" className={cn('text-[10px] shrink-0',
                  otCutoffPassed ? 'border-red-500/30 text-red-600' : otCutoffRemaining < 2 ? 'border-amber-500/30 text-amber-600' : '',
                )}>
                  {otCutoffPassed ? 'Closed' : `${Math.floor(otCutoffRemaining)}h left`}
                </Badge>
              </div>

              {/* Subscription Cycle */}
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4.5 h-4.5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">Subscription Cycle</p>
                  <p className="text-[10px] text-muted-foreground">7-day window · Day 3 of current cycle</p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {[1,2,3,4,5,6,7].map(d => (
                    <div key={d} className={cn(
                      'w-4 h-4 rounded-sm text-[8px] flex items-center justify-center font-bold',
                      d < 3 ? 'bg-violet-500 text-white' : d === 3 ? 'bg-violet-500/60 text-white ring-1 ring-violet-400' : 'bg-violet-500/10 text-violet-400',
                    )}>{d}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* ---- Daily Gantt Timeline ---- */}
            {operatorDayStarted && (
              <SectionCard
                title="Today's Schedule"
                subtitle="Your job timeline with station assignments"
                headerActions={
                  overdueBlocks > 0 ? (
                    <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/30 text-[10px] gap-1">
                      <AlertTriangle className="w-3 h-3" /> {overdueBlocks} overdue
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-[10px] gap-1">
                      <CheckCircle2 className="w-3 h-3" /> On track
                    </Badge>
                  )
                }
              >
                <div className="relative">
                  {/* Hour headers */}
                  <div className="flex border-b border-border pb-1 mb-2">
                    <div className="w-28 shrink-0" />
                    {TIMELINE_HOURS.map(h => (
                      <div key={h} className="flex-1 text-center">
                        <span className={cn(
                          'text-[10px] font-medium',
                          Math.floor(currentHour) === h ? 'text-gold font-bold' : 'text-muted-foreground',
                        )}>
                          {h > 12 ? `${h - 12}PM` : h === 12 ? '12PM' : `${h}AM`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Schedule rows */}
                  <div className="space-y-2">
                    {scheduleBlocks.map((block, idx) => {
                      const startOffset = ((block.startHour - TIMELINE_HOURS[0]) / (TIMELINE_HOURS[TIMELINE_HOURS.length - 1] - TIMELINE_HOURS[0] + 1)) * 100;
                      const width = (block.durationHours / (TIMELINE_HOURS[TIMELINE_HOURS.length - 1] - TIMELINE_HOURS[0] + 1)) * 100;
                      const stationCol = KANBAN_COLUMNS[block.station - 1];
                      const StationIcon = stationCol?.icon || ClipboardList;

                      return (
                        <div key={idx} className="flex items-center">
                          <div className="w-28 shrink-0 pr-3">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={cn('text-[8px] px-1 py-0 h-4',
                                block.type === 'one_time' ? 'border-blue-500/30 text-blue-600' : 'border-violet-500/30 text-violet-600',
                              )}>
                                {block.type === 'one_time' ? 'OT' : 'SUB'}
                              </Badge>
                              <span className="text-[10px] font-mono font-semibold truncate">{block.jobId}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{block.orderCount} orders · S{block.station}</p>
                          </div>
                          <div className="flex-1 relative h-10 bg-muted/20 rounded-md overflow-hidden">
                            {/* Grid lines */}
                            {TIMELINE_HOURS.map((h, i) => (
                              <div key={h} className="absolute top-0 bottom-0 border-l border-border/30" style={{ left: `${(i / (TIMELINE_HOURS.length)) * 100}%` }} />
                            ))}
                            {/* Block */}
                            <div
                              className={cn(
                                'absolute top-1 bottom-1 rounded-md flex items-center gap-1.5 px-2 transition-all',
                                block.status === 'completed' ? 'bg-emerald-500/20 border border-emerald-500/30' :
                                block.status === 'in_progress' ? 'bg-gold/20 border border-gold/30' :
                                block.status === 'overdue' ? 'bg-red-500/20 border border-red-500/30 animate-pulse' :
                                'bg-muted/40 border border-border',
                              )}
                              style={{ left: `${Math.max(0, startOffset)}%`, width: `${Math.min(width, 100 - startOffset)}%` }}
                            >
                              <StationIcon className={cn('w-3 h-3 shrink-0',
                                block.status === 'completed' ? 'text-emerald-600' :
                                block.status === 'in_progress' ? 'text-gold' :
                                block.status === 'overdue' ? 'text-red-500' :
                                'text-muted-foreground',
                              )} />
                              <span className={cn('text-[9px] font-medium truncate',
                                block.status === 'completed' ? 'text-emerald-700' :
                                block.status === 'in_progress' ? 'text-gold' :
                                block.status === 'overdue' ? 'text-red-600' :
                                'text-muted-foreground',
                              )}>
                                S{block.station} · {stationCol?.label.replace(/^S\d\s/, '')}
                              </span>
                              {block.status === 'overdue' && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                              {block.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                            </div>
                            {/* Current time marker */}
                            {currentHour >= TIMELINE_HOURS[0] && currentHour <= TIMELINE_HOURS[TIMELINE_HOURS.length - 1] + 1 && (
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-gold z-10"
                                style={{ left: `${((currentHour - TIMELINE_HOURS[0]) / (TIMELINE_HOURS[TIMELINE_HOURS.length - 1] - TIMELINE_HOURS[0] + 1)) * 100}%` }}
                              >
                                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-gold" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <div className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/30" /> Completed
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <div className="w-3 h-3 rounded-sm bg-gold/20 border border-gold/30" /> In Progress
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <div className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/30" /> Overdue
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <div className="w-3 h-3 rounded-sm bg-muted/40 border border-border" /> Upcoming
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gold ml-auto">
                      <div className="w-0.5 h-3 bg-gold rounded-full" /> Current Time
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ---- My Jobs Quick View ---- */}
            {operatorDayStarted && (
              <SectionCard
                title="My Jobs Today"
                subtitle={`${filteredJobs.length} jobs allocated to you`}
                headerActions={
                  <StatusBadge variant={operatorOnBreak ? 'warning' : 'success'}>
                    {operatorOnBreak ? 'On Break' : 'Working'}
                  </StatusBadge>
                }
              >
                {filteredJobs.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No jobs allocated yet"
                    description="Your manager hasn't allocated any jobs to you yet. Check back soon or contact your supervisor."
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredJobs.slice(0, 8).map(j => {
                      const activeStation = j.station_statuses.find(s => s.status === 'in_progress');
                      const completedCount = j.station_statuses.filter(s => s.status === 'completed').length;
                      const totalStations = j.station_statuses.length;
                      const progress = totalStations > 0 ? Math.round((completedCount / totalStations) * 100) : 0;
                      const isOT = j.source === 'one_time' || j.source === 'manual';
                      return (
                        <div key={j.job_id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                          <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                            <Layers className="w-5 h-5 text-gold" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-semibold">{j.job_id}</span>
                              <StatusBadge variant={JOB_STATUS_VARIANT[j.status] || 'muted'}>{j.status}</StatusBadge>
                              <Badge variant="outline" className={cn('text-[8px] px-1 py-0 h-4', isOT ? 'border-blue-500/30 text-blue-600' : 'border-violet-500/30 text-violet-600')}>
                                {isOT ? 'One-Time' : 'Subscription'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {j.order_ids.length} orders · {activeStation ? `At S${activeStation.station}` : `${completedCount}/${totalStations} stations done`}
                            </p>
                          </div>
                          <div className="w-24">
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-[9px] text-muted-foreground text-right mt-0.5">{progress}%</p>
                          </div>
                          <StationStepper
                            currentStation={activeStation?.station || 0}
                            stations={j.station_statuses.map(s => ({
                              id: s.station,
                              label: `S${s.station}`,
                              status: s.status === 'completed' ? 'completed' : s.status === 'in_progress' ? 'active' : 'pending',
                            }))}
                          />
                        </div>
                      );
                    })}
                    {filteredJobs.length > 8 && (
                      <p className="text-xs text-muted-foreground text-center py-2">+ {filteredJobs.length - 8} more jobs below</p>
                    )}
                  </div>
                )}
              </SectionCard>
            )}
          </>
        )}

        {/* ========== JOB TYPE FILTER TABS ========== */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground mr-1">Job Type:</span>
          {([
            { key: 'all' as const, label: 'All Jobs', icon: Layers, count: jobTypeCounts.all },
            { key: 'one_time' as const, label: 'One-Time Products', icon: ShoppingCart, count: jobTypeCounts.one_time },
            { key: 'subscription' as const, label: 'Subscription', icon: RotateCcw, count: jobTypeCounts.subscription },
            { key: 'ready_to_ship' as const, label: 'Ready-to-Ship', icon: PackageCheck, count: jobTypeCounts.ready_to_ship },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setJobTypeFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                jobTypeFilter === tab.key
                  ? 'bg-gold/10 border-gold text-gold'
                  : 'border-border hover:bg-muted/50 text-muted-foreground',
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', jobTypeFilter === tab.key ? 'bg-gold/20' : 'bg-muted')}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Batch Status Summary */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card text-center">
            <p className="text-2xl font-bold">{batchSummary.total}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Total Jobs</p>
          </div>
          <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-center">
            <p className="text-2xl font-bold text-amber-600">{batchSummary.pending}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Pending</p>
          </div>
          <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 text-center">
            <p className="text-2xl font-bold text-blue-600">{batchSummary.inProgress}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">In Progress</p>
          </div>
          <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center">
            <p className="text-2xl font-bold text-emerald-600">{batchSummary.fulfilled}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Fulfilled</p>
          </div>
        </div>

        {/* Unified Kanban Board */}
        <SectionCard
          title="Job Kanban"
          subtitle={`${jobTypeFilter === 'all' ? 'All jobs' : jobTypeFilter === 'one_time' ? 'One-time jobs' : 'Subscription jobs'} — drag to move between stations`}
          headerActions={
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant={kanbanView === 'board' ? 'default' : 'outline'} className={cn('h-7 px-2 text-xs', kanbanView === 'board' && 'bg-gold hover:bg-gold/90 text-gold-foreground')} onClick={() => setKanbanView('board')}>
                <Kanban className="w-3 h-3" />
              </Button>
              <Button size="sm" variant={kanbanView === 'list' ? 'default' : 'outline'} className={cn('h-7 px-2 text-xs', kanbanView === 'list' && 'bg-gold hover:bg-gold/90 text-gold-foreground')} onClick={() => setKanbanView('list')}>
                <ClipboardList className="w-3 h-3" />
              </Button>
            </div>
          }
        >
          {/* Kanban Board */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Drag jobs between columns to update station status</span>
              </div>
              {moveHistory.length > 0 && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={undoLastMove}>
                  <Undo2 className="w-3 h-3" /> Undo ({moveHistory.length})
                </Button>
              )}
            </div>

            {kanbanView === 'board' ? (
              <div className="grid grid-cols-6 gap-2">
                {kanbanData.map(col => {
                  const ColIcon = col.icon;
                  const isDragOver = dragOverColumn === col.id;
                  const canDrop = draggedJob !== null;
                  return (
                    <div
                      key={col.id}
                      onDragOver={(e) => handleDragOver(e, col.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, col.id)}
                      className={cn(
                        'rounded-xl border-2 p-2.5 transition-all min-h-[200px]',
                        isDragOver && canDrop ? 'border-gold bg-gold/5 shadow-md scale-[1.01]' : col.borderColor,
                        col.bgTint,
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border/50">
                        <div className={cn('w-5 h-5 rounded flex items-center justify-center', col.color)}>
                          <ColIcon className="w-3 h-3 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[11px] font-semibold truncate">{col.label}</h4>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">{col.jobs.length}</span>
                      </div>
                      {isDragOver && canDrop && (
                        <div className="mb-2 p-2 rounded-md border-2 border-dashed border-gold/40 bg-gold/5 text-center">
                          <p className="text-[10px] text-gold font-medium">Drop here to move</p>
                        </div>
                      )}
                      <div className="space-y-2 min-h-[60px] max-h-[300px] overflow-y-auto">
                        {col.jobs.length === 0 && !isDragOver ? (
                          <div className="p-3 rounded-lg border border-dashed border-border text-center text-[10px] text-muted-foreground">Empty</div>
                        ) : (
                          col.jobs.map(j => {
                            const isDragging = draggedJob === j.job_id;
                            const isOT = j.source === 'one_time' || j.source === 'manual';
                            return (
                              <div
                                key={j.job_id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, j.job_id)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                  'p-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-all hover:shadow-sm group cursor-grab active:cursor-grabbing',
                                  isDragging && 'opacity-40 scale-95',
                                  jobStatusOverrides[j.job_id] && 'ring-1 ring-gold/30',
                                )}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <GripVertical className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                                    <p className="text-[11px] font-mono font-semibold truncate">{j.job_id}</p>
                                  </div>
                                  {jobStatusOverrides[j.job_id] && (
                                    <span className="text-[8px] px-1 py-0.5 rounded bg-gold/10 text-gold font-medium">Moved</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-4.5">
                                  <span>{j.order_ids.length} orders</span>
                                  <span className="text-muted-foreground/30">·</span>
                                  <Badge variant="outline" className={cn('text-[8px] px-1 py-0 h-4', isOT ? 'border-blue-500/30 text-blue-600' : 'border-violet-500/30 text-violet-600')}>
                                    {isOT ? 'OT' : 'SUB'}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {kanbanData.map(col => {
                  const ColIcon = col.icon;
                  if (col.jobs.length === 0) return null;
                  return (
                    <div key={col.id} className={cn('rounded-lg border p-3', col.borderColor, col.bgTint)}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn('w-5 h-5 rounded flex items-center justify-center', col.color)}>
                          <ColIcon className="w-3 h-3 text-white" />
                        </div>
                        <h4 className="text-xs font-semibold">{col.label}</h4>
                        <span className="text-[10px] text-muted-foreground ml-auto">{col.jobs.length} jobs</span>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {col.jobs.map(j => {
                          const isOT = j.source === 'one_time' || j.source === 'manual';
                          return (
                            <div key={j.job_id} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
                              <p className="text-[10px] font-mono font-medium truncate">{j.job_id}</p>
                              <Badge variant="outline" className={cn('text-[8px] px-1 py-0 h-4 ml-auto', isOT ? 'border-blue-500/30 text-blue-600' : 'border-violet-500/30 text-violet-600')}>
                                {isOT ? 'OT' : 'SUB'}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground">{j.order_ids.length} ord</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Move Confirmation Dialog */}
            <AnimatePresence>
              {showMoveConfirm && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowMoveConfirm(null)}>
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', showMoveConfirm.isBackward ? 'bg-amber-500/10' : 'bg-blue-500/10')}>
                        {showMoveConfirm.isBackward ? <AlertCircle className="w-5 h-5 text-amber-500" /> : <ArrowRight className="w-5 h-5 text-blue-500" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{showMoveConfirm.isBackward ? 'Move Backward?' : 'Skip Stations?'}</h3>
                        <p className="text-xs text-muted-foreground">{showMoveConfirm.isBackward ? 'This will move the job to a previous station' : 'This will skip one or more stations'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 mb-4">
                      <Badge variant="outline">{showMoveConfirm.fromLabel}</Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="outline">{showMoveConfirm.toLabel}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowMoveConfirm(null)}>Cancel</Button>
                      <Button size="sm" className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground" onClick={() => {
                        const targetCol = KANBAN_COLUMNS.find(c => c.id === showMoveConfirm.to);
                        if (targetCol) executeMove(showMoveConfirm.jobId, targetCol.dropStatus, showMoveConfirm.fromLabel, showMoveConfirm.toLabel);
                      }}>Confirm Move</Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SectionCard>

        {/* Pipeline Progress */}
        <SectionCard title="Pipeline Progress" subtitle="Job flow through stations">
          {pipeline ? <PipelineProgress stages={pipeline} /> : <p className="text-sm text-muted-foreground">Loading...</p>}
        </SectionCard>

        {/* Order Queue */}
        <SectionCard
          title="Order Queue"
          subtitle={`${filteredOrders.length} orders${jobTypeFilter !== 'all' ? ` (${jobTypeFilter === 'one_time' ? 'one-time' : 'subscription'})` : ''}`}
          headerActions={
            <Link href="/orders/one-time">
              <Button size="sm" variant="ghost" className="text-xs gap-1">View All <ArrowRight className="w-3 h-3" /></Button>
            </Link>
          }
        >
          {filteredOrders.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No pending orders" description="No orders in this batch." />
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredOrders.map(o => {
                const isExpanded = expandedOrder === o.order_id;
                const isOT = o.type === 'one_time';
                return (
                  <div key={o.order_id} className="rounded-lg border border-border overflow-hidden">
                    <button className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition-colors text-left" onClick={() => setExpandedOrder(isExpanded ? null : o.order_id)}>
                      <div className="flex items-center gap-3">
                        {isOT ? <ShoppingCart className="w-4 h-4 text-blue-500 shrink-0" /> : <RotateCcw className="w-4 h-4 text-violet-500 shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium font-mono">{o.order_id}</p>
                            <StatusBadge variant={o.status === 'new' ? 'gold' : 'info'}>{o.status}</StatusBadge>
                            <Badge variant="outline" className={cn('text-[8px] px-1 py-0 h-4', isOT ? 'border-blue-500/30 text-blue-600' : 'border-violet-500/30 text-violet-600')}>
                              {isOT ? 'One-Time' : 'Subscription'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{o.customer.name} · {o.items.length} items</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/10 p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Customer:</span>
                            <span className="font-medium">{o.customer.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Location:</span>
                            <span className="font-medium">{o.customer.city}, {o.customer.country}</span>
                          </div>
                        </div>
                        {o.notes && (
                          <div className="flex items-center gap-2 text-sm text-warning">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Note: {o.notes}</span>
                          </div>
                        )}
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-1.5">Item</th>
                              <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-1.5">Type</th>
                              <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-1.5">Size</th>
                              <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-1.5">Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.items.map(item => (
                              <tr key={item.item_id} className="border-b border-border/30">
                                <td className="py-1.5 font-medium">{item.perfume_name}</td>
                                <td className="py-1.5 capitalize text-muted-foreground">{item.type.replace('_', ' ')}</td>
                                <td className="py-1.5 text-center font-mono">{item.size_ml}ml</td>
                                <td className="py-1.5 text-center font-mono">×{item.qty}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Jobs List */}
        <SectionCard title="Jobs" subtitle={`${filteredJobs.length} jobs`}>
          {filteredJobs.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No jobs" description="No jobs generated yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full ops-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Job ID</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Type</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Status</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Stations</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Orders</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map(j => {
                    const isOT = j.source === 'one_time' || j.source === 'manual';
                    return (
                      <tr key={j.job_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 text-sm font-mono font-medium">{j.job_id}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', isOT ? 'border-blue-500/30 text-blue-600' : 'border-violet-500/30 text-violet-600')}>
                            {isOT ? 'One-Time' : 'Subscription'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2"><StatusBadge variant={JOB_STATUS_VARIANT[j.status] || 'muted'}>{j.status}</StatusBadge></td>
                        <td className="px-3 py-2">
                          <StationStepper
                            currentStation={j.station_statuses.find(s => s.status === 'in_progress')?.station || 0}
                            stations={j.station_statuses.map(s => ({
                              id: s.station,
                              label: `S${s.station}`,
                              status: s.status === 'completed' ? 'completed' : s.status === 'in_progress' ? 'active' : 'pending',
                            }))}
                          />
                        </td>
                        <td className="px-3 py-2 text-sm font-mono text-muted-foreground">{j.order_ids.length}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(j.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
