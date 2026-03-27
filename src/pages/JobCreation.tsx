// ============================================================
// Job Creation — Central hub for creating jobs from orders
// Two sections: One-Time Orders and Subscription Cycles
// Moved from Pod Dashboard — this is the ops manager's command center
// Round 21: Pod Operations restructure
// ============================================================

import { useState, useMemo, useCallback, DragEvent } from 'react';
import { PageHeader, SectionCard, PipelineProgress, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  ArrowRight, ClipboardList, ShoppingCart, RotateCcw, Clock, Calendar,
  Layers, Package, ChevronDown, ChevronUp, User, MapPin, FileText,
  Play, CheckCircle2, Timer, Kanban, AlertTriangle,
  Truck, Tag, FlaskConical, PackageCheck, Box, Boxes, SplitSquareVertical,
  GripVertical, ArrowLeftRight, Undo2, AlertCircle, Plus, Lock, Unlock,
  BarChart3, TrendingUp, TrendingDown, Zap, Target, Briefcase,
  Factory, Droplets, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { Job, Order, SubscriptionCycle, PipelineStage } from '@/types';
import JobPickList from '@/components/JobPickList';
import type { OrderCategory, OrderGroup } from './OrderGrouping';

/* Mock cutoff times for one-time orders */
const MOCK_CUTOFFS = [
  { id: 'cut-2026-02-13-am', label: 'Feb 13, 2026 — 10:00 AM', status: 'active' as const, orderCount: 8 },
  { id: 'cut-2026-02-13-pm', label: 'Feb 13, 2026 — 4:00 PM', status: 'upcoming' as const, orderCount: 3 },
  { id: 'cut-2026-02-14-am', label: 'Feb 14, 2026 — 10:00 AM', status: 'upcoming' as const, orderCount: 0 },
];

/* 7-day cycle day labels — batch-first model */
const CYCLE_DAYS = [
  { day: 1, label: 'Day 1', station: 'Pod Dashboard', description: 'Queue all orders, generate batch pick lists', mode: 'batch' as const },
  { day: 2, label: 'Day 2', station: 'Picking', description: 'Batch pick — all items for entire cycle', mode: 'batch' as const },
  { day: 3, label: 'Day 3', station: 'Labels', description: 'Batch print — all labels for entire cycle', mode: 'batch' as const },
  { day: 4, label: 'Day 4', station: 'Decanting', description: 'Batch decant — all perfumes for entire cycle', mode: 'batch' as const },
  { day: 5, label: 'Day 5', station: 'Segregation', description: 'Per-order — segregate, classify, prepare each order', mode: 'per_order' as const },
  { day: 6, label: 'Day 6', station: 'Shipping', description: 'Per-order — pack, QC, generate labels, courier pickup', mode: 'per_order' as const },
  { day: 7, label: 'Day 7', station: 'Buffer', description: 'Catch-up, exceptions, returns', mode: 'batch' as const },
];

/* Cycle analytics — historical averages per station */
const CYCLE_ANALYTICS = [
  { station: 'Queue', label: 'Pod Dashboard', avgHours: 2.4, lastCycleHours: 3.1, trend: 'up' as const },
  { station: 'S2', label: 'Picking', avgHours: 6.2, lastCycleHours: 5.8, trend: 'down' as const },
  { station: 'S3', label: 'Labels', avgHours: 3.8, lastCycleHours: 4.2, trend: 'up' as const },
  { station: 'S4', label: 'Decanting', avgHours: 8.5, lastCycleHours: 7.9, trend: 'down' as const },
  { station: 'S5', label: 'Segregation', avgHours: 5.1, lastCycleHours: 5.5, trend: 'up' as const },
  { station: 'S6', label: 'Shipping', avgHours: 4.3, lastCycleHours: 3.9, trend: 'down' as const },
];

/* Kanban columns — unified (same for both types) */
const KANBAN_COLUMNS = [
  { id: 'queued', label: 'Queued', icon: ClipboardList, color: 'bg-slate-500', borderColor: 'border-slate-500/30', bgTint: 'bg-slate-500/5', statusMatch: ['pending'], dropStatus: 'pending' },
  { id: 'picking', label: 'Picking', icon: Package, color: 'bg-amber-500', borderColor: 'border-amber-500/30', bgTint: 'bg-amber-500/5', statusMatch: ['picked'], dropStatus: 'picked' },
  { id: 'labelling', label: 'Labels', icon: Tag, color: 'bg-blue-500', borderColor: 'border-blue-500/30', bgTint: 'bg-blue-500/5', statusMatch: ['prepped'], dropStatus: 'prepped' },
  { id: 'decanting', label: 'Decanting', icon: FlaskConical, color: 'bg-purple-500', borderColor: 'border-purple-500/30', bgTint: 'bg-purple-500/5', statusMatch: ['decanted'], dropStatus: 'decanted' },
  { id: 'packing', label: 'Packing', icon: PackageCheck, color: 'bg-orange-500', borderColor: 'border-orange-500/30', bgTint: 'bg-orange-500/5', statusMatch: ['packed'], dropStatus: 'packed' },
  { id: 'shipped', label: 'Shipped', icon: Truck, color: 'bg-emerald-500', borderColor: 'border-emerald-500/30', bgTint: 'bg-emerald-500/5', statusMatch: ['shipped'], dropStatus: 'shipped' },
];

const JOB_STATUS_VARIANT: Record<string, 'muted' | 'info' | 'gold' | 'success' | 'warning'> = {
  pending: 'muted', picked: 'info', prepped: 'gold', decanted: 'success', packed: 'success', shipped: 'success',
};

// Mock operators
const OPERATORS = [
  { id: 'op-1', name: 'Ahmed K.', avatar: 'AK' },
  { id: 'op-2', name: 'Sara M.', avatar: 'SM' },
  { id: 'op-3', name: 'Khalid R.', avatar: 'KR' },
  { id: 'op-4', name: 'Fatima A.', avatar: 'FA' },
  { id: 'op-5', name: 'Omar H.', avatar: 'OH' },
];
const FULFILLMENT_OPS = [
  { id: 'ff-1', name: 'Nora T.', avatar: 'NT' },
  { id: 'ff-2', name: 'Youssef B.', avatar: 'YB' },
];

// Station-level assignment for a job
interface StationAssignment {
  station: number;
  stationLabel: string;
  operatorId: string | null;
  operatorName: string | null;
  mode: 'batch' | 'per_order';
}

const STATION_DEFS: { station: number; label: string; mode: 'batch' | 'per_order' }[] = [
  { station: 1, label: 'Pod Dashboard', mode: 'batch' },
  { station: 2, label: 'Picking', mode: 'batch' },
  { station: 3, label: 'Labeling', mode: 'batch' },
  { station: 4, label: 'Batch Decant', mode: 'batch' },
  { station: 5, label: 'QC & Assembly', mode: 'per_order' },
  { station: 6, label: 'Shipping', mode: 'per_order' },
];

// All team members (combined)
const ALL_TEAM = [
  ...OPERATORS.map(o => ({ ...o, specialization: 'decant' as const })),
  ...FULFILLMENT_OPS.map(o => ({ ...o, specialization: 'fulfillment' as const })),
  { id: 'qc-1', name: 'Reem S.', avatar: 'RS', specialization: 'qc' as const },
];

export default function JobCreation() {
  const [activeTab, setActiveTab] = useState('one-time');

  // Data
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: jobsRes } = useApiQuery(() => api.jobs.list(), []);
  const { data: cyclesRes } = useApiQuery(() => api.subscriptions.cycles(), []);
  const { data: pipelineRes } = useApiQuery(() => api.dashboard.pipeline(), []);

  const orders = (ordersRes?.data || []) as Order[];
  const jobs = (jobsRes?.data || []) as Job[];
  const cycles = (cyclesRes?.data || []) as SubscriptionCycle[];
  const pipeline = pipelineRes?.data as PipelineStage[] | undefined;

  // One-Time state
  const [selectedCutoff, setSelectedCutoff] = useState(MOCK_CUTOFFS[0].id);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [kanbanView, setKanbanView] = useState<'board' | 'list'>('board');

  // Job Creation State
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [createdJobs, setCreatedJobs] = useState<Array<{ id: string; orderIds: string[]; createdAt: string; status: string; type: 'one_time' | 'subscription'; operatorId?: string; operatorName?: string; fulfillmentOperatorId?: string; fulfillmentOperatorName?: string }>>([]);
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false);
  const [createJobType, setCreateJobType] = useState<'one_time' | 'subscription'>('one_time');
  const [splitCount, setSplitCount] = useState(1);
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<string[]>([]);
  const [selectedFulfillmentIds, setSelectedFulfillmentIds] = useState<string[]>([]);
  const [showPickListForJob, setShowPickListForJob] = useState<string | null>(null);

  // Station-level assignment state
  const [stationAssignments, setStationAssignments] = useState<StationAssignment[]>(
    STATION_DEFS.map(s => ({ station: s.station, stationLabel: s.label, operatorId: null, operatorName: null, mode: s.mode }))
  );

  const assignPersonToStation = (station: number, personId: string | null) => {
    const person = personId ? ALL_TEAM.find(t => t.id === personId) : null;
    setStationAssignments(prev => prev.map(s =>
      s.station === station ? { ...s, operatorId: personId, operatorName: person?.name || null } : s
    ));
  };

  // Subscription Cycle State
  const [cycleState, setCycleState] = useState<'collecting' | 'locked' | 'active'>('collecting');
  const [cycleDays] = useState(7);
  const [currentDay, setCurrentDay] = useState(1);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Drag-and-Drop State
  const [draggedJob, setDraggedJob] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [jobStatusOverrides, setJobStatusOverrides] = useState<Record<string, string>>({});
  const [moveHistory, setMoveHistory] = useState<Array<{ jobId: string; from: string; to: string; timestamp: number }>>([]);
  const [showMoveConfirm, setShowMoveConfirm] = useState<{ jobId: string; from: string; to: string; fromLabel: string; toLabel: string; isBackward: boolean } | null>(null);

  // Filter orders by type
  const otOrders = useMemo(() => orders.filter(o => o.type === 'one_time' && ['new', 'processing'].includes(o.status)), [orders]);
  const subOrders = useMemo(() => orders.filter(o => o.type === 'subscription' && ['new', 'processing'].includes(o.status)), [orders]);

  // Unassigned orders
  const assignedIds = useMemo(() => new Set(createdJobs.flatMap(j => j.orderIds)), [createdJobs]);
  const unassignedOtOrders = useMemo(() => otOrders.filter(o => !assignedIds.has(o.order_id)), [otOrders, assignedIds]);
  const unassignedSubOrders = useMemo(() => subOrders.filter(o => !assignedIds.has(o.order_id)), [subOrders, assignedIds]);

  // Jobs by type
  const otJobs = useMemo(() => {
    return jobs.filter(j => j.source === 'one_time' || j.source === 'manual').map(j => ({
      ...j, status: (jobStatusOverrides[j.job_id] || j.status) as Job['status'],
    }));
  }, [jobs, jobStatusOverrides]);
  const subJobs = useMemo(() => {
    return jobs.filter(j => j.source === 'subscription').map(j => ({
      ...j, status: (jobStatusOverrides[j.job_id] || j.status) as Job['status'],
    }));
  }, [jobs, jobStatusOverrides]);

  const activeCycle = cycles.find((c: any) => c.status === 'processing') || cycles.find((c: any) => c.status === 'delivering') || cycles.find((c: any) => c.status === 'collecting' || c.status === 'closed');

  // Batch summary
  const otSummary = useMemo(() => {
    const pending = otJobs.filter(j => j.status === 'pending').length;
    const inProgress = otJobs.filter(j => ['picked', 'prepped', 'decanted'].includes(j.status)).length;
    const fulfilled = otJobs.filter(j => ['packed', 'shipped'].includes(j.status)).length;
    return { pending, inProgress, fulfilled, total: otJobs.length };
  }, [otJobs]);

  const subSummary = useMemo(() => {
    const pending = subJobs.filter(j => j.status === 'pending').length;
    const inProgress = subJobs.filter(j => ['picked', 'prepped', 'decanted'].includes(j.status)).length;
    const fulfilled = subJobs.filter(j => ['packed', 'shipped'].includes(j.status)).length;
    return { pending, inProgress, fulfilled, total: subJobs.length };
  }, [subJobs]);

  // Kanban data builder
  const buildKanbanData = (jobList: Job[]) => KANBAN_COLUMNS.map(col => ({
    ...col, jobs: jobList.filter(j => col.statusMatch.includes(j.status)),
  }));

  const otKanbanData = useMemo(() => buildKanbanData(otJobs), [otJobs]);
  const subKanbanData = useMemo(() => buildKanbanData(subJobs), [subJobs]);

  // ---- Job Creation Handlers ----
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const selectAllUnassigned = (orderList: Order[]) => {
    if (selectedOrderIds.size === orderList.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orderList.map(o => o.order_id)));
    }
  };

  const openCreateJobDialog = (type: 'one_time' | 'subscription') => {
    setCreateJobType(type);
    setShowCreateJobDialog(true);
  };

  // Auto-select specialists when split count changes
  const autoSelectSpecialists = useCallback((count: number) => {
    // Auto-select matching number of decant specialists
    const autoDecant = OPERATORS.slice(0, Math.min(count, OPERATORS.length)).map(o => o.id);
    setSelectedOperatorIds(autoDecant);
    // Auto-select fulfillment specialists (can stack multiple)
    const autoFulfill = FULFILLMENT_OPS.slice(0, Math.min(Math.ceil(count / 2), FULFILLMENT_OPS.length)).map(o => o.id);
    setSelectedFulfillmentIds(autoFulfill);
  }, []);

  const handleSplitChange = useCallback((count: number) => {
    setSplitCount(count);
    autoSelectSpecialists(count);
  }, [autoSelectSpecialists]);

  const toggleOperatorSelection = (opId: string) => {
    setSelectedOperatorIds(prev => 
      prev.includes(opId) ? prev.filter(id => id !== opId) : [...prev, opId]
    );
  };

  const toggleFulfillmentSelection = (opId: string) => {
    setSelectedFulfillmentIds(prev =>
      prev.includes(opId) ? prev.filter(id => id !== opId) : [...prev, opId]
    );
  };

  const createJob = () => {
    if (selectedOrderIds.size === 0) {
      toast.warning('Select at least one order to create a job');
      return;
    }
    const allIds = Array.from(selectedOrderIds);
    const actualSplit = Math.min(splitCount, allIds.length);
    const typePrefix = createJobType === 'subscription' ? 'SUB' : 'OT';
    const windowLabel = createJobType === 'subscription' ? '7-day window' : '1-day window';

    // Build jobs with auto-distribution across selected operators
    const chunkSize = Math.ceil(allIds.length / actualSplit);
    const newJobs: typeof createdJobs = [];
    for (let i = 0; i < actualSplit; i++) {
      const chunk = allIds.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length === 0) continue;
      // Round-robin distribute operators across jobs
      const assignedOp = selectedOperatorIds.length > 0 ? OPERATORS.find(o => o.id === selectedOperatorIds[i % selectedOperatorIds.length]) : undefined;
      const assignedFf = selectedFulfillmentIds.length > 0 ? FULFILLMENT_OPS.find(o => o.id === selectedFulfillmentIds[i % selectedFulfillmentIds.length]) : undefined;
      const jobId = actualSplit === 1
        ? `JOB-${typePrefix}-${Date.now().toString(36).toUpperCase()}`
        : `JOB-${typePrefix}-${Date.now().toString(36).toUpperCase()}${String.fromCharCode(65 + i)}`;
      newJobs.push({
        id: jobId, orderIds: chunk, createdAt: new Date().toISOString(), status: 'pending',
        type: createJobType, operatorId: assignedOp?.id, operatorName: assignedOp?.name,
        fulfillmentOperatorId: assignedFf?.id, fulfillmentOperatorName: assignedFf?.name,
      });
    }
    setCreatedJobs(prev => [...prev, ...newJobs]);

    if (newJobs.length === 1) {
      const j = newJobs[0];
      toast.success(`Job ${j.id} created · ${j.orderIds.length} orders · ${windowLabel}`, {
        description: [j.operatorName && `Decant: ${j.operatorName}`, j.fulfillmentOperatorName && `Fulfillment: ${j.fulfillmentOperatorName}`].filter(Boolean).join(' · ') || 'Unassigned — allocate in Work Allocation',
      });
    } else {
      const assignedNames = newJobs.map(j => j.operatorName).filter((n): n is string => !!n);
      const uniqueNames = Array.from(new Set(assignedNames));
      toast.success(`${newJobs.length} jobs auto-distributed from ${allIds.length} orders · ${windowLabel}`, {
        description: uniqueNames.length > 0 ? `Assigned to: ${uniqueNames.join(', ')}` : 'Unassigned — allocate in Work Allocation',
      });
    }

    setSelectedOrderIds(new Set());
    setSplitCount(1);
    setSelectedOperatorIds([]);
    setSelectedFulfillmentIds([]);
    setShowCreateJobDialog(false);
  };

  // ---- Subscription Cycle Handlers ----
  const lockCycle = () => {
    setCycleState('locked');
    toast.success('Cycle locked — no new orders will be added', {
      description: `${subOrders.length} orders locked for processing.`,
    });
  };

  const activateCycle = () => {
    const subCreatedJobs = createdJobs.filter(j => j.type === 'subscription');
    if (subCreatedJobs.length === 0 && subJobs.length === 0) {
      toast.warning('Create at least one subscription job before activating the cycle');
      return;
    }
    setCycleState('active');
    setCurrentDay(1);
    toast.success(`Subscription cycle activated — ${cycleDays}-day processing started`);
  };

  // ---- Drag-and-Drop Handlers ----
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
    const allJobs = [...otJobs, ...subJobs];
    const job = allJobs.find(j => j.job_id === jobId);
    if (!job) return;
    const currentColIdx = KANBAN_COLUMNS.findIndex(c => c.statusMatch.includes(job.status));
    const targetColIdx = KANBAN_COLUMNS.findIndex(c => c.id === targetColumnId);
    if (currentColIdx === targetColIdx) return;
    const currentCol = KANBAN_COLUMNS[currentColIdx];
    const isBackward = targetColIdx < currentColIdx;
    const isSkipping = Math.abs(targetColIdx - currentColIdx) > 1;
    if (isBackward || isSkipping) {
      setShowMoveConfirm({ jobId, from: currentCol?.id || '', to: targetColumnId, fromLabel: currentCol?.label || '', toLabel: targetCol.label, isBackward });
      return;
    }
    executeMove(jobId, targetCol.dropStatus, currentCol?.label || '', targetCol.label);
  }, [otJobs, subJobs]);

  const executeMove = useCallback((jobId: string, newStatus: string, fromLabel: string, toLabel: string) => {
    const allJobs = [...otJobs, ...subJobs];
    const oldStatus = jobStatusOverrides[jobId] || allJobs.find(j => j.job_id === jobId)?.status || '';
    setJobStatusOverrides(prev => ({ ...prev, [jobId]: newStatus }));
    setMoveHistory(prev => [...prev, { jobId, from: oldStatus, to: newStatus, timestamp: Date.now() }]);
    toast.success(`Job moved: ${fromLabel} → ${toLabel}`);
    setShowMoveConfirm(null);
  }, [jobStatusOverrides, otJobs, subJobs]);

  const undoLastMove = useCallback(() => {
    if (moveHistory.length === 0) return;
    const last = moveHistory[moveHistory.length - 1];
    const allJobs = [...otJobs, ...subJobs];
    setJobStatusOverrides(prev => {
      const next = { ...prev };
      if (last.from === allJobs.find(j => j.job_id === last.jobId)?.status) delete next[last.jobId];
      else next[last.jobId] = last.from;
      return next;
    });
    setMoveHistory(prev => prev.slice(0, -1));
    toast.info('Last move undone');
  }, [moveHistory, otJobs, subJobs]);

  // ---- Cycle Analytics ----
  const renderCycleAnalytics = () => {
    const maxHours = Math.max(...CYCLE_ANALYTICS.map(s => Math.max(s.avgHours, s.lastCycleHours)));
    const totalAvg = CYCLE_ANALYTICS.reduce((sum, s) => sum + s.avgHours, 0);
    const totalLast = CYCLE_ANALYTICS.reduce((sum, s) => sum + s.lastCycleHours, 0);
    const bottleneck = CYCLE_ANALYTICS.reduce((max, s) => s.avgHours > max.avgHours ? s : max, CYCLE_ANALYTICS[0]);

    return (
      <SectionCard
        title="Cycle Analytics"
        subtitle="Average processing time per station across past cycles"
        headerActions={
          <StatusBadge variant={totalLast < totalAvg ? 'success' : 'warning'}>
            {totalLast < totalAvg ? 'Improving' : 'Slower'}
          </StatusBadge>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-lg font-bold">{totalAvg.toFixed(1)}h</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Total</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-lg font-bold">{totalLast.toFixed(1)}h</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Cycle</p>
            </div>
            <div className={cn('p-3 rounded-lg border text-center', totalLast < totalAvg ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20')}>
              <div className="flex items-center justify-center gap-1">
                {totalLast < totalAvg ? <TrendingDown className="w-4 h-4 text-emerald-500" /> : <TrendingUp className="w-4 h-4 text-amber-500" />}
                <p className={cn('text-lg font-bold', totalLast < totalAvg ? 'text-emerald-600' : 'text-amber-600')}>
                  {Math.abs(totalLast - totalAvg).toFixed(1)}h
                </p>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{totalLast < totalAvg ? 'Faster' : 'Slower'}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
              <p className="text-lg font-bold text-red-600">{bottleneck.station}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bottleneck</p>
            </div>
          </div>
          <div className="space-y-2">
            {CYCLE_ANALYTICS.map(s => (
              <div key={s.station} className="flex items-center gap-3">
                <div className="w-20 text-right">
                  <span className="text-xs font-medium">{s.station}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">{s.label}</span>
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500/60 rounded-full transition-all duration-500" style={{ width: `${(s.avgHours / maxHours) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-10 text-right">{s.avgHours}h</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-500', s.trend === 'down' ? 'bg-emerald-500/60' : 'bg-amber-500/60')} style={{ width: `${(s.lastCycleHours / maxHours) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-10 text-right">{s.lastCycleHours}h</span>
                  </div>
                </div>
                <div className="w-6 flex items-center justify-center">
                  {s.trend === 'down' ? <TrendingDown className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingUp className="w-3.5 h-3.5 text-amber-500" />}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border">
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-blue-500/60" /><span>Avg across cycles</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-emerald-500/60" /><span>Last cycle (improved)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-amber-500/60" /><span>Last cycle (slower)</span></div>
          </div>
        </div>
      </SectionCard>
    );
  };

  // ---- Gantt Timeline ----
  const renderGanttTimeline = () => {
    if (cycleState !== 'active') return null;
    const today = currentDay;
    const cycleStartDate = new Date();
    cycleStartDate.setDate(cycleStartDate.getDate() - (today - 1));

    return (
      <SectionCard
        title="Cycle Timeline"
        subtitle={`${cycleDays}-day processing cycle — Day ${today} of ${cycleDays}`}
        headerActions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => setShowAnalytics(!showAnalytics)}>
              <BarChart3 className="w-3 h-3" /> {showAnalytics ? 'Hide' : 'Show'} Analytics
            </Button>
            <StatusBadge variant={today <= 4 ? 'info' : 'gold'}>
              {today <= 4 ? 'Batch Phase' : today <= 6 ? 'Per-Order Phase' : 'Buffer'}
            </StatusBadge>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <div className="grid grid-cols-7 gap-0 mb-1">
              {CYCLE_DAYS.map(d => {
                const dayDate = new Date(cycleStartDate);
                dayDate.setDate(dayDate.getDate() + (d.day - 1));
                return (
                  <div key={d.day} className={cn(
                    'text-center py-1.5 text-[10px] font-medium border-b-2 transition-all',
                    d.day === today ? 'border-gold text-gold bg-gold/5' :
                    d.day < today ? 'border-success/50 text-success' : 'border-border text-muted-foreground',
                  )}>
                    <div className="font-semibold">{d.label}</div>
                    <div className="text-[9px] opacity-70">{dayDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                  </div>
                );
              })}
            </div>

            {/* Batch Phase Bar */}
            <div className="relative h-10 mt-2 mb-1">
              <div className="absolute left-0 top-0 h-full rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center px-3" style={{ width: `${(4/7)*100}%` }}>
                <Boxes className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0" />
                <span className="text-xs font-medium text-blue-700 truncate">Batch Operations (S1–S4)</span>
                {today <= 4 && (
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-blue-600">ACTIVE</span>
                  </div>
                )}
              </div>
              <div className="absolute left-0 top-0 h-full rounded-lg bg-blue-500/20 transition-all duration-500" style={{ width: `${Math.min((Math.max(today - 1, 0) / 7) * 100, (4/7)*100)}%` }} />
            </div>

            {/* Per-Order Phase Bar */}
            <div className="relative h-10 mb-1">
              <div className="absolute top-0 h-full rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center px-3" style={{ left: `${(4/7)*100}%`, width: `${(2/7)*100}%` }}>
                <Box className="w-3.5 h-3.5 text-orange-500 mr-2 shrink-0" />
                <span className="text-xs font-medium text-orange-700 truncate">Per-Order (S5–S6)</span>
                {today >= 5 && today <= 6 && (
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-orange-600">ACTIVE</span>
                  </div>
                )}
              </div>
              {today >= 5 && (
                <div className="absolute top-0 h-full rounded-lg bg-orange-500/20 transition-all duration-500" style={{ left: `${(4/7)*100}%`, width: `${Math.min(((today - 4) / 7) * 100, (2/7)*100)}%` }} />
              )}
            </div>

            {/* Buffer Bar */}
            <div className="relative h-10">
              <div className="absolute top-0 h-full rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center px-3" style={{ left: `${(6/7)*100}%`, width: `${(1/7)*100}%` }}>
                <RotateCcw className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" />
                <span className="text-xs font-medium text-slate-600 truncate">Buffer</span>
              </div>
            </div>

            {/* Today Marker */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-gold z-10 transition-all duration-500" style={{ left: `${((today - 0.5) / 7) * 100}%` }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gold border-2 border-background shadow-md" />
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gold whitespace-nowrap">TODAY</div>
            </div>
          </div>

          {/* Station Milestones */}
          <div className="grid grid-cols-7 gap-1 mt-8">
            {CYCLE_DAYS.map(d => {
              const isComplete = d.day < today;
              const isCurrent = d.day === today;
              const dayDate = new Date(cycleStartDate);
              dayDate.setDate(dayDate.getDate() + (d.day - 1));
              return (
                <button key={d.day} onClick={() => setCurrentDay(d.day)} className={cn(
                  'p-2 rounded-lg border text-left transition-all group hover:shadow-sm',
                  isCurrent ? 'border-gold bg-gold/10 ring-1 ring-gold/30 shadow-sm' :
                  isComplete ? 'border-success/30 bg-success/5' : 'border-border hover:border-muted-foreground/30',
                )}>
                  <div className="flex items-center gap-1 mb-1">
                    {isComplete && <CheckCircle2 className="w-3 h-3 text-success" />}
                    {isCurrent && <Timer className="w-3 h-3 text-gold animate-pulse" />}
                    {!isComplete && !isCurrent && <Clock className="w-3 h-3 text-muted-foreground/50" />}
                    <span className={cn('text-[10px] font-bold', isCurrent ? 'text-gold' : isComplete ? 'text-success' : 'text-muted-foreground')}>{d.station}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground leading-tight line-clamp-2">{d.description}</p>
                  <div className="mt-1 flex items-center gap-1">
                    {d.mode === 'batch' ? <Boxes className="w-2.5 h-2.5 text-blue-500" /> : <Box className="w-2.5 h-2.5 text-orange-500" />}
                    <span className="text-[8px] text-muted-foreground">
                      {isComplete ? 'Done' : isCurrent ? 'In Progress' : dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>
    );
  };

  // ---- Kanban Board ----
  const renderKanbanBoard = (columns: ReturnType<typeof buildKanbanData>) => (
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
          {columns.map(col => {
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
                      const isSubJob = j.source === 'subscription';
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
                            <Badge variant="outline" className={cn('text-[8px] px-1 py-0', isSubJob ? 'border-blue-500/30 text-blue-600' : 'border-amber-500/30 text-amber-600')}>
                              {isSubJob ? 'SUB · 7d' : 'OT · 1d'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-4.5">
                            <span>{j.order_ids.length} orders</span>
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
          {columns.map(col => {
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
                  {col.jobs.map(j => (
                    <div key={j.job_id} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
                      <p className="text-[10px] font-mono font-medium truncate">{j.job_id}</p>
                      <Badge variant="outline" className={cn('text-[8px] px-1 py-0 ml-auto', j.source === 'subscription' ? 'border-blue-500/30 text-blue-600' : 'border-amber-500/30 text-amber-600')}>
                        {j.source === 'subscription' ? 'SUB' : 'OT'}
                      </Badge>
                    </div>
                  ))}
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
                <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">From</p><p className="text-sm font-semibold">{showMoveConfirm.fromLabel}</p></div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">To</p><p className="text-sm font-semibold">{showMoveConfirm.toLabel}</p></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowMoveConfirm(null)}>Cancel</Button>
                <Button size="sm" className={cn('flex-1 gap-1', showMoveConfirm.isBackward ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gold hover:bg-gold/90 text-gold-foreground')} onClick={() => {
                  const targetCol = KANBAN_COLUMNS.find(c => c.id === showMoveConfirm.to);
                  if (targetCol) executeMove(showMoveConfirm.jobId, targetCol.dropStatus, showMoveConfirm.fromLabel, showMoveConfirm.toLabel);
                }}>
                  <ArrowRight className="w-3 h-3" /> Confirm Move
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ---- Create Job Dialog ----
  const renderCreateJobDialog = () => {
    const unassigned = createJobType === 'subscription' ? unassignedSubOrders : unassignedOtOrders;
    const typeLabel = createJobType === 'subscription' ? 'Subscription' : 'One-Time';
    const windowLabel = createJobType === 'subscription' ? '7-day window' : '1-day window';

    return (
      <AnimatePresence>
        {showCreateJobDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateJobDialog(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-card border border-border rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Create {typeLabel} Job</h3>
                  <p className="text-xs text-muted-foreground">{windowLabel} · Select orders, split, and assign operator</p>
                </div>
                <Badge variant="outline" className={cn('ml-auto text-[9px]', createJobType === 'subscription' ? 'border-blue-500/30 text-blue-600' : 'border-amber-500/30 text-amber-600')}>
                  {createJobType === 'subscription' ? 'SUB · 7d' : 'OT · 1d'}
                </Badge>
              </div>

              {/* Select All */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <button onClick={() => selectAllUnassigned(unassigned)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-colors', selectedOrderIds.size === unassigned.length && unassigned.length > 0 ? 'bg-gold border-gold' : 'border-muted-foreground/30')}>
                    {selectedOrderIds.size === unassigned.length && unassigned.length > 0 && <CheckCircle2 className="w-3 h-3 text-gold-foreground" />}
                  </div>
                  Select All ({unassigned.length})
                </button>
                <span className="text-xs font-medium text-gold">{selectedOrderIds.size} selected</span>
              </div>

              {/* Order List */}
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto mb-4">
                {unassigned.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-success" />
                    All orders are assigned to jobs
                  </div>
                ) : (
                  unassigned.map(o => {
                    const isSelected = selectedOrderIds.has(o.order_id);
                    return (
                      <button key={o.order_id} onClick={() => toggleOrderSelection(o.order_id)} className={cn(
                        'w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left',
                        isSelected ? 'border-gold bg-gold/5 ring-1 ring-gold/20' : 'border-border hover:bg-muted/30',
                      )}>
                        <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors', isSelected ? 'bg-gold border-gold' : 'border-muted-foreground/30')}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-gold-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium">{o.order_id}</span>
                            <StatusBadge variant={o.status === 'new' ? 'gold' : 'info'}>{o.status}</StatusBadge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{o.customer.name} · {o.items.length} items</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{o.items.reduce((sum, i) => sum + i.qty, 0)} decants</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Job Split & Auto-Distribution */}
              {selectedOrderIds.size > 0 && (
                <div className="mb-4 p-3 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <SplitSquareVertical className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-semibold">Split into multiple jobs</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{selectedOrderIds.size} orders → {splitCount} {splitCount === 1 ? 'job' : 'jobs'}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {[1, 2, 3, 4, 5].filter(n => n <= selectedOrderIds.size).map(n => (
                      <button key={n} onClick={() => handleSplitChange(n)} className={cn(
                        'flex-1 py-1.5 rounded-md text-xs font-medium border transition-all',
                        splitCount === n ? 'bg-gold/10 border-gold text-gold' : 'border-border hover:bg-muted/50',
                      )}>
                        {n === 1 ? '1 Job' : `${n} Jobs`}
                      </button>
                    ))}
                  </div>
                  {splitCount > 1 && (
                    <div className="mt-2 p-2 rounded-md bg-blue-500/5 border border-blue-500/10">
                      <div className="flex items-center gap-1.5 text-[10px] text-blue-600">
                        <Zap className="w-3 h-3" />
                        <span className="font-medium">Auto-distribution active</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {Math.ceil(selectedOrderIds.size / splitCount)} orders per job · Specialists auto-selected below
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Station-Level Person Assignment */}
              <div className="mb-4 p-3 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-violet-500" />
                  <span className="text-xs font-semibold">Station Assignment</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">Assign a person to each station</span>
                </div>
                <div className="space-y-2">
                  {stationAssignments.map(sa => (
                    <div key={sa.station} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
                      <div className={cn('w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white', sa.mode === 'batch' ? 'bg-blue-500' : 'bg-orange-500')}>
                        S{sa.station}
                      </div>
                      <span className="text-[11px] font-medium w-28 truncate">{sa.stationLabel}</span>
                      <Badge variant="outline" className={cn('text-[8px] px-1 py-0', sa.mode === 'batch' ? 'border-blue-500/30 text-blue-600' : 'border-orange-500/30 text-orange-600')}>
                        {sa.mode === 'batch' ? 'Batch' : 'Per-Order'}
                      </Badge>
                      <select
                        value={sa.operatorId || ''}
                        onChange={e => assignPersonToStation(sa.station, e.target.value || null)}
                        className="flex-1 h-7 text-xs bg-background border border-input rounded-md px-2"
                      >
                        <option value="">— Unassigned —</option>
                        {ALL_TEAM.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.specialization})</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2" onClick={() => {
                    // Auto-assign: decant specialists to S1-S4, fulfillment to S5-S6
                    const decantOps = OPERATORS.map(o => o.id);
                    const ffOps = FULFILLMENT_OPS.map(o => o.id);
                    setStationAssignments(prev => prev.map((s, i) => {
                      if (s.mode === 'batch') return { ...s, operatorId: decantOps[i % decantOps.length], operatorName: OPERATORS[i % decantOps.length]?.name || null };
                      return { ...s, operatorId: ffOps[(i - 4) % ffOps.length], operatorName: FULFILLMENT_OPS[(i - 4) % ffOps.length]?.name || null };
                    }));
                    setSelectedOperatorIds(decantOps);
                    setSelectedFulfillmentIds(ffOps);
                    toast.info('Auto-assigned team to stations');
                  }}>
                    <Zap className="w-3 h-3 mr-1" /> Auto-Assign
                  </Button>
                  <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2" onClick={() => {
                    setStationAssignments(STATION_DEFS.map(s => ({ station: s.station, stationLabel: s.label, operatorId: null, operatorName: null, mode: s.mode })));
                    setSelectedOperatorIds([]);
                    setSelectedFulfillmentIds([]);
                  }}>
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Distribution Preview */}
              {splitCount > 1 && selectedOperatorIds.length > 0 && (
                <div className="mb-4 p-3 rounded-lg border border-gold/20 bg-gold/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-gold" />
                    <span className="text-xs font-semibold text-gold">Auto-Distribution Preview</span>
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: splitCount }).map((_, i) => {
                      const op = OPERATORS.find(o => o.id === selectedOperatorIds[i % selectedOperatorIds.length]);
                      const ff = selectedFulfillmentIds.length > 0 ? FULFILLMENT_OPS.find(o => o.id === selectedFulfillmentIds[i % selectedFulfillmentIds.length]) : undefined;
                      const chunkSize = Math.ceil(selectedOrderIds.size / splitCount);
                      const start = i * chunkSize;
                      const end = Math.min(start + chunkSize, selectedOrderIds.size);
                      const count = end - start;
                      if (count <= 0) return null;
                      return (
                        <div key={i} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-card border border-border">
                          <span className="font-mono font-bold text-gold">Job {i + 1}</span>
                          <span className="text-muted-foreground">{count} orders</span>
                          <span className="text-muted-foreground">→</span>
                          {op && <span className="font-medium text-violet-600">{op.name}</span>}
                          {ff && <><span className="text-muted-foreground">+</span><span className="font-medium text-emerald-600">{ff.name}</span></>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setShowCreateJobDialog(false); setSplitCount(1); setSelectedOperatorIds([]); setSelectedFulfillmentIds([]); setSelectedOrderIds(new Set()); }}>Cancel</Button>
                <Button size="sm" className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground gap-1" onClick={createJob} disabled={selectedOrderIds.size === 0}>
                  <Plus className="w-3 h-3" /> {splitCount > 1 ? `Create & Distribute ${splitCount} Jobs` : 'Create Job'} ({selectedOrderIds.size})
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // ---- Pick List Overlay ----
  const renderPickListOverlay = () => {
    if (!showPickListForJob) return null;
    const job = createdJobs.find(j => j.id === showPickListForJob);
    if (!job) return null;
    const allOrders = [...otOrders, ...subOrders];
    const jobOrders = allOrders.filter(o => job.orderIds.includes(o.order_id));

    return (
      <JobPickList
        open={!!showPickListForJob}
        onClose={() => setShowPickListForJob(null)}
        jobCode={job.id}
        orders={jobOrders}
        mode={job.type === 'subscription' ? 'subscription' : 'one_time'}
      />
    );
  };

  // ---- Render Summary Cards ----
  const renderSummaryCards = (summary: typeof otSummary) => (
    <div className="grid grid-cols-4 gap-4">
      <div className="p-4 rounded-lg border border-border bg-card text-center">
        <p className="text-2xl font-bold">{summary.total}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Total Jobs</p>
      </div>
      <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-center">
        <p className="text-2xl font-bold text-amber-600">{summary.pending}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Pending</p>
      </div>
      <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 text-center">
        <p className="text-2xl font-bold text-blue-600">{summary.inProgress}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">In Progress</p>
      </div>
      <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center">
        <p className="text-2xl font-bold text-emerald-600">{summary.fulfilled}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Fulfilled</p>
      </div>
    </div>
  );

  // ---- Render Order List ----
  const renderOrderList = (orderList: Order[], typeLabel: string) => (
    <SectionCard
      title={`${typeLabel} Order Queue`}
      subtitle={`${orderList.length} orders`}
      headerActions={
        <Link href={typeLabel === 'Subscription' ? '/orders/subscriptions' : '/orders/one-time'}>
          <Button size="sm" variant="ghost" className="text-xs gap-1">View All <ArrowRight className="w-3 h-3" /></Button>
        </Link>
      }
    >
      {orderList.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No pending orders" description={`No ${typeLabel.toLowerCase()} orders in the queue.`} />
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {orderList.map(o => {
            const isExpanded = expandedOrder === o.order_id;
            return (
              <div key={o.order_id} className="rounded-lg border border-border overflow-hidden">
                <button onClick={() => setExpandedOrder(isExpanded ? null : o.order_id)} className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium font-mono">{o.order_id}</p>
                        <StatusBadge variant={o.status === 'new' ? 'gold' : 'info'}>{o.status}</StatusBadge>
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
  );

  // ---- Created Jobs Section ----
  const renderCreatedJobs = (type: 'one_time' | 'subscription') => {
    const typeJobs = createdJobs.filter(j => j.type === type);
    if (typeJobs.length === 0) return null;
    return (
      <SectionCard title="Created Jobs" subtitle={`${typeJobs.length} jobs created this session`}>
        <div className="space-y-2">
          {typeJobs.map(j => (
            <div key={j.id} className="flex items-center justify-between p-3 rounded-lg border border-gold/20 bg-gold/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono font-semibold">{j.id}</p>
                    <Badge variant="outline" className={cn('text-[9px] px-1 py-0', j.type === 'subscription' ? 'border-blue-500/30 text-blue-600' : 'border-amber-500/30 text-amber-600')}>
                      {j.type === 'subscription' ? 'SUB · 7d' : 'OT · 1d'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {j.orderIds.length} orders · Created {new Date(j.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {j.operatorName && <> · <span className="text-violet-600 font-medium">{j.operatorName}</span></>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700" onClick={() => setShowPickListForJob(j.id)}>
                  <Package className="w-3 h-3" /> Pick List
                </Button>
                <StatusBadge variant="gold">Queued</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  };

  return (
    <div>
      <PageHeader
        title="Job Creation"
        subtitle="Create and manage jobs from incoming orders — one-time and subscription"
        breadcrumbs={[
          { label: 'Job Management' },
          { label: 'Job Creation' },
        ]}
        actions={
          <div className="flex gap-2">
            <Link href="/order-grouping">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Order Grouping
              </Button>
            </Link>
            <Link href="/work-allocation">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Work Allocation <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Overview KPIs — 6 Job Types */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <button onClick={() => setActiveTab('one-time')} className={cn('p-3 rounded-xl border text-left transition-all', activeTab === 'one-time' ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20' : 'border-border/50 hover:bg-muted/30')}>
            <ShoppingCart className="w-5 h-5 text-amber-600 mb-1" />
            <p className="text-xs font-semibold">Sub 1st Order</p>
            <p className="text-lg font-bold">{unassignedOtOrders.length}</p>
            <p className="text-[9px] text-muted-foreground">{otJobs.length} jobs</p>
          </button>
          <button onClick={() => setActiveTab('subscription')} className={cn('p-3 rounded-xl border text-left transition-all', activeTab === 'subscription' ? 'border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20' : 'border-border/50 hover:bg-muted/30')}>
            <RotateCcw className="w-5 h-5 text-blue-600 mb-1" />
            <p className="text-xs font-semibold">Sub Cycle</p>
            <p className="text-lg font-bold">{subJobs.length}</p>
            <p className="text-[9px] text-muted-foreground">{cycleState}</p>
          </button>
          <button onClick={() => setActiveTab('production')} className={cn('p-3 rounded-xl border text-left transition-all', activeTab === 'production' ? 'border-purple-500/40 bg-purple-500/5 ring-1 ring-purple-500/20' : 'border-border/50 hover:bg-muted/30')}>
            <Factory className="w-5 h-5 text-purple-600 mb-1" />
            <p className="text-xs font-semibold">Production</p>
            <p className="text-lg font-bold">2</p>
            <p className="text-[9px] text-muted-foreground">7-stage funnel</p>
          </button>
          <button onClick={() => setActiveTab('aurakey')} className={cn('p-3 rounded-xl border text-left transition-all', activeTab === 'aurakey' ? 'border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20' : 'border-border/50 hover:bg-muted/30')}>
            <Droplets className="w-5 h-5 text-emerald-600 mb-1" />
            <p className="text-xs font-semibold">AuraKey</p>
            <p className="text-lg font-bold">3</p>
            <p className="text-[9px] text-muted-foreground">on-demand</p>
          </button>
          <button onClick={() => setActiveTab('ready-ship')} className={cn('p-3 rounded-xl border text-left transition-all', activeTab === 'ready-ship' ? 'border-orange-500/40 bg-orange-500/5 ring-1 ring-orange-500/20' : 'border-border/50 hover:bg-muted/30')}>
            <PackageCheck className="w-5 h-5 text-orange-600 mb-1" />
            <p className="text-xs font-semibold">Ready Ship</p>
            <p className="text-lg font-bold">2</p>
            <p className="text-[9px] text-muted-foreground">no decanting</p>
          </button>
          <button onClick={() => setActiveTab('corporate')} className={cn('p-3 rounded-xl border text-left transition-all', activeTab === 'corporate' ? 'border-slate-500/40 bg-slate-500/5 ring-1 ring-slate-500/20' : 'border-border/50 hover:bg-muted/30')}>
            <Building2 className="w-5 h-5 text-slate-600 mb-1" />
            <p className="text-xs font-semibold">Corporate</p>
            <p className="text-lg font-bold">1</p>
            <p className="text-[9px] text-muted-foreground">custom flow</p>
          </button>
        </div>

        {/* Job Type Tabs — 6 types */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="one-time" className="text-[10px] gap-1">
              <ShoppingCart className="w-3 h-3" /> Sub 1st Order
            </TabsTrigger>
            <TabsTrigger value="subscription" className="text-[10px] gap-1">
              <RotateCcw className="w-3 h-3" /> Sub Cycle
            </TabsTrigger>
            <TabsTrigger value="production" className="text-[10px] gap-1" onClick={() => toast.info('Internal Production managed via Production Center → Production Jobs')}>
              <Factory className="w-3 h-3" /> Production
            </TabsTrigger>
            <TabsTrigger value="aurakey" className="text-[10px] gap-1" onClick={() => toast.info('AuraKey & Refills — coming soon')}>
              <Droplets className="w-3 h-3" /> AuraKey
            </TabsTrigger>
            <TabsTrigger value="ready-ship" className="text-[10px] gap-1" onClick={() => toast.info('Ready Product Fulfillment — coming soon')}>
              <PackageCheck className="w-3 h-3" /> Ready Ship
            </TabsTrigger>
            <TabsTrigger value="corporate" className="text-[10px] gap-1" onClick={() => toast.info('Corporate Gift Activation — coming soon')}>
              <Building2 className="w-3 h-3" /> Corporate
            </TabsTrigger>
          </TabsList>

          {/* ========== ONE-TIME TAB ========== */}
          <TabsContent value="one-time" className="space-y-6 mt-4">
            {/* Cutoff Time Selector */}
            <SectionCard title="Cutoff Time" subtitle="Select which cutoff batch you're working in">
              <div className="space-y-2">
                {MOCK_CUTOFFS.map(cutoff => (
                  <button key={cutoff.id} onClick={() => setSelectedCutoff(cutoff.id)} className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left',
                    selectedCutoff === cutoff.id ? 'border-gold bg-gold/5 ring-1 ring-gold/30' : 'border-border hover:bg-muted/30',
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn('w-3 h-3 rounded-full', cutoff.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                      <div>
                        <p className="text-sm font-medium">{cutoff.label}</p>
                        <p className="text-xs text-muted-foreground">{cutoff.orderCount} orders · {cutoff.status === 'active' ? 'Currently active' : 'Upcoming'}</p>
                      </div>
                    </div>
                    {selectedCutoff === cutoff.id && <StatusBadge variant="gold">Selected</StatusBadge>}
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* Pending Orders */}
            <SectionCard
              title="Pending Orders"
              subtitle={`${unassignedOtOrders.length} orders not yet assigned to a job`}
              headerActions={
                unassignedOtOrders.length > 0 ? (
                  <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => openCreateJobDialog('one_time')}>
                    <Plus className="w-3.5 h-3.5" /> Create Job
                  </Button>
                ) : undefined
              }
            >
              {unassignedOtOrders.length === 0 ? (
                <div className="p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
                  <p className="text-sm font-medium">All orders assigned</p>
                  <p className="text-xs text-muted-foreground">Every order has been grouped into a job.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-700">{unassignedOtOrders.length} orders waiting for job creation</p>
                      <p className="text-xs text-amber-600/80">Select orders and create a job. Jobs move through S1→S6 with a 1-day processing window.</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {unassignedOtOrders.slice(0, 10).map(o => (
                      <div key={o.order_id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                        <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium">{o.order_id}</span>
                            <StatusBadge variant={o.status === 'new' ? 'gold' : 'info'}>{o.status}</StatusBadge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{o.customer.name} · {o.items.length} items</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    ))}
                    {unassignedOtOrders.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">+ {unassignedOtOrders.length - 10} more orders</p>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            {renderCreatedJobs('one_time')}
            {renderSummaryCards(otSummary)}

            {/* One-Time Kanban */}
            <SectionCard
              title="One-Time Job Kanban"
              subtitle="Job flow through stations — drag to move"
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
              {renderKanbanBoard(otKanbanData)}
            </SectionCard>

            {renderOrderList(otOrders, 'One-Time')}
          </TabsContent>

          {/* ========== SUBSCRIPTION TAB ========== */}
          <TabsContent value="subscription" className="space-y-6 mt-4">
            {/* Cycle State Card */}
            <SectionCard
              title="Subscription Cycle"
              subtitle={activeCycle
                ? `Cycle ${activeCycle.cycle_id} · Cutoff: ${new Date(activeCycle.cutoff_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'No active cycle'
              }
              headerActions={
                <div className="flex items-center gap-2">
                  <StatusBadge variant={cycleState === 'active' ? 'success' : cycleState === 'locked' ? 'gold' : 'info'}>
                    {cycleState === 'active' ? 'Active' : cycleState === 'locked' ? 'Locked' : 'Collecting'}
                  </StatusBadge>
                  <Link href="/orders/subscriptions">
                    <Button size="sm" variant="ghost" className="text-xs gap-1">Manage <ArrowRight className="w-3 h-3" /></Button>
                  </Link>
                </div>
              }
            >
              <div className="space-y-4">
                {cycleState === 'collecting' && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Unlock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-700">Collecting Orders</p>
                      <p className="text-xs text-blue-600/80">New orders are being added. Lock the cycle when ready to stop accepting orders and start processing.</p>
                    </div>
                    <Button size="sm" onClick={lockCycle} className="ml-auto bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Lock Cycle
                    </Button>
                  </div>
                )}
                {cycleState === 'locked' && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Lock className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-700">Cycle Locked — Ready for Job Creation</p>
                      <p className="text-xs text-amber-600/80">No new orders will be added. Create jobs, then activate the cycle.</p>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openCreateJobDialog('subscription')}>
                        <Plus className="w-3.5 h-3.5" /> Create Job
                      </Button>
                      <Button size="sm" onClick={activateCycle} className="bg-success hover:bg-success/90 text-success-foreground gap-1.5" disabled={createdJobs.filter(j => j.type === 'subscription').length === 0 && subJobs.length === 0}>
                        <Play className="w-3.5 h-3.5" /> Activate
                      </Button>
                    </div>
                  </div>
                )}
                {cycleState === 'active' && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-success/10 border border-success/20">
                    <Layers className="w-5 h-5 text-success animate-pulse" />
                    <div>
                      <p className="text-sm font-medium text-success">Cycle Active — Day {currentDay} of {cycleDays}</p>
                      <p className="text-xs text-success/80">
                        {currentDay <= 4 ? `Batch phase: ${CYCLE_DAYS[currentDay - 1]?.description}` : currentDay <= 6 ? `Per-order phase: ${CYCLE_DAYS[currentDay - 1]?.description}` : 'Buffer day'}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {currentDay < cycleDays && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCurrentDay(d => Math.min(d + 1, cycleDays))}>
                          Advance Day <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Gantt Timeline */}
            {renderGanttTimeline()}

            {/* Analytics */}
            {showAnalytics && renderCycleAnalytics()}

            {/* Pending Sub Orders */}
            {cycleState !== 'active' && (
              <SectionCard
                title="Subscription Orders"
                subtitle={`${unassignedSubOrders.length} orders not yet assigned`}
                headerActions={
                  unassignedSubOrders.length > 0 && cycleState === 'locked' ? (
                    <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => openCreateJobDialog('subscription')}>
                      <Plus className="w-3.5 h-3.5" /> Create Job
                    </Button>
                  ) : undefined
                }
              >
                {unassignedSubOrders.length === 0 ? (
                  <EmptyState icon={RotateCcw} title="No pending subscription orders" description="All subscription orders are assigned." />
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {unassignedSubOrders.slice(0, 10).map(o => (
                      <div key={o.order_id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                        <RotateCcw className="w-4 h-4 text-blue-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium">{o.order_id}</span>
                            <StatusBadge variant={o.status === 'new' ? 'gold' : 'info'}>{o.status}</StatusBadge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{o.customer.name} · {o.items.length} items</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}

            {renderCreatedJobs('subscription')}
            {renderSummaryCards(subSummary)}

            {/* Subscription Kanban */}
            <SectionCard
              title="Subscription Job Kanban"
              subtitle="7-day cycle flow — drag to move"
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
              {renderKanbanBoard(subKanbanData)}
            </SectionCard>

            {renderOrderList(subOrders, 'Subscription')}
          </TabsContent>

          {/* ========== PRODUCTION TAB ========== */}
          <TabsContent value="production" className="space-y-6 mt-4">
            <SectionCard title="Internal Production" subtitle="Create capsules, gift sets, and inventory batches">
              <div className="p-8 text-center">
                <Factory className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Production Jobs</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Internal production follows a 7-stage funnel: Picking → Prep Labels → Print → Decant → Compile → QC → Log Inventory.
                  Manage production jobs from the Production Center.
                </p>
                <Link href="/production/jobs">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
                    <Factory className="w-4 h-4" /> Go to Production Jobs
                  </Button>
                </Link>
              </div>
            </SectionCard>
          </TabsContent>

          {/* ========== AURAKEY TAB ========== */}
          <TabsContent value="aurakey" className="space-y-6 mt-4">
            <SectionCard title="AuraKey & Refills" subtitle="On-demand AuraKey, refill, and Whisper vial orders">
              <div className="p-8 text-center">
                <Droplets className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">AuraKey On-Demand Processing</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  When a customer orders an AuraKey, AuraKey refill, or Whisper vial, the order enters the full decanting pipeline (S1–S6).
                  Each order is processed individually as a one-time job.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">S1 → S2 → S3 → S4 → S5 → S6</Badge>
                  <span>·</span>
                  <span>Same flow as Subscription First Order</span>
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          {/* ========== READY SHIP TAB ========== */}
          <TabsContent value="ready-ship" className="space-y-6 mt-4">
            <SectionCard title="Ready Product Fulfillment" subtitle="Pre-made items — pick, pack, ship (no decanting)">
              <div className="p-8 text-center">
                <PackageCheck className="w-12 h-12 text-orange-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Ready Product Shipping</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Capsules, gift sets, and other pre-made products skip the decanting stations.
                  They go directly from S1 (pick from inventory) → S5 (pack) → S6 (ship).
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-orange-600 border-orange-500/30">S1 → S5 → S6</Badge>
                  <span>·</span>
                  <span>No decanting required</span>
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          {/* ========== CORPORATE TAB ========== */}
          <TabsContent value="corporate" className="space-y-6 mt-4">
            <SectionCard title="Corporate Gift Activation" subtitle="Prepare, customize, and activate corporate gifts">
              <div className="p-8 text-center">
                <Building2 className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Corporate Gift Jobs</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Corporate gifting jobs involve custom preparation, branding, and activation.
                  These follow a custom workflow managed through the Corporate Gifting module.
                </p>
                <Link href="/gifting/corporate">
                  <Button className="bg-slate-600 hover:bg-slate-700 text-white gap-1.5">
                    <Building2 className="w-4 h-4" /> Go to Corporate Gifting
                  </Button>
                </Link>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {renderCreateJobDialog()}
      {renderPickListOverlay()}
    </div>
  );
}
