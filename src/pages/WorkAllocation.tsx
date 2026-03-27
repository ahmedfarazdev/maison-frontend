// ============================================================
// Work Allocation — Central Operations Hub
// Job creation, operator allocation, team day tracker, shift management
// Accessible to pod_leader, admin, owner
// Round 20: Restructured as the single command center for ops managers
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  Users, UserCheck, UserX, ClipboardList, ArrowRight, CheckCircle2,
  Clock, AlertTriangle, BarChart3, TrendingUp, Zap, Target,
  Briefcase, Shield, Package, FlaskConical, Truck, ScanBarcode,
  Printer, CheckSquare, ChevronDown, ChevronUp, GripVertical,
  Undo2, ArrowLeftRight, MoveHorizontal, Play, Square, Pause,
  RotateCcw, Timer, Calendar, Plus, FileText, Coffee,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Job, Order, UserRole, SubscriptionCycle } from '@/types';

// Station metadata
const STATION_META: Record<number, { label: string; icon: React.ElementType; color: string }> = {
  1: { label: 'Job Board', icon: ClipboardList, color: 'text-indigo-500' },
  2: { label: 'Picking', icon: ScanBarcode, color: 'text-amber-500' },
  3: { label: 'Prep & Label', icon: Printer, color: 'text-orange-500' },
  4: { label: 'Batch Decant', icon: FlaskConical, color: 'text-emerald-500' },
  5: { label: 'Fulfillment', icon: CheckSquare, color: 'text-teal-500' },
  6: { label: 'Shipping', icon: Truck, color: 'text-violet-500' },
};

// Mock operators with extended data
interface Operator {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  specialization: 'decant' | 'fulfillment' | 'general' | 'vault';
  currentStation: number | null;
  assignedJobs: string[];
  completedToday: number;
  avgTimePerJob: number;
  status: 'available' | 'working' | 'break' | 'offline';
  startedAt: string | null;
  breakStartedAt: string | null;
  totalBreakMinutes: number;
}

interface UnassignedJob {
  id: string;
  source: string;
  orderCount: number;
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
}

interface DaySession {
  startedAt: string;
  endedAt: string | null;
  status: 'active' | 'ended';
}

const INITIAL_OPERATORS: Operator[] = [
  { id: 'op-1', name: 'Ahmed K.', avatar: 'AK', role: 'pod_senior', specialization: 'decant', currentStation: 3, assignedJobs: ['JOB-OT-001', 'JOB-OT-002'], completedToday: 3, avgTimePerJob: 42, status: 'working', startedAt: '2026-02-15T06:30:00Z', breakStartedAt: null, totalBreakMinutes: 15 },
  { id: 'op-2', name: 'Sara M.', avatar: 'SM', role: 'pod_senior', specialization: 'general', currentStation: 2, assignedJobs: ['JOB-SUB-001'], completedToday: 1, avgTimePerJob: 55, status: 'working', startedAt: '2026-02-15T07:00:00Z', breakStartedAt: null, totalBreakMinutes: 0 },
  { id: 'op-3', name: 'Khalid R.', avatar: 'KR', role: 'pod_junior', specialization: 'fulfillment', currentStation: 5, assignedJobs: ['JOB-OT-003'], completedToday: 5, avgTimePerJob: 18, status: 'working', startedAt: '2026-02-15T06:00:00Z', breakStartedAt: null, totalBreakMinutes: 30 },
  { id: 'op-4', name: 'Fatima A.', avatar: 'FA', role: 'pod_senior', specialization: 'general', currentStation: null, assignedJobs: [], completedToday: 0, avgTimePerJob: 0, status: 'available', startedAt: null, breakStartedAt: null, totalBreakMinutes: 0 },
  { id: 'op-5', name: 'Omar H.', avatar: 'OH', role: 'pod_senior', specialization: 'decant', currentStation: 4, assignedJobs: ['JOB-SUB-002'], completedToday: 2, avgTimePerJob: 48, status: 'working', startedAt: '2026-02-15T07:15:00Z', breakStartedAt: null, totalBreakMinutes: 10 },
  { id: 'op-6', name: 'Layla B.', avatar: 'LB', role: 'vault_guardian', specialization: 'vault', currentStation: null, assignedJobs: [], completedToday: 12, avgTimePerJob: 5, status: 'working', startedAt: '2026-02-15T06:00:00Z', breakStartedAt: null, totalBreakMinutes: 20 },
  { id: 'op-7', name: 'Youssef T.', avatar: 'YT', role: 'pod_junior', specialization: 'fulfillment', currentStation: 6, assignedJobs: ['JOB-OT-004'], completedToday: 4, avgTimePerJob: 22, status: 'working', startedAt: '2026-02-15T06:45:00Z', breakStartedAt: null, totalBreakMinutes: 0 },
];

const INITIAL_UNASSIGNED: UnassignedJob[] = [
  { id: 'JOB-OT-005', source: 'one_time', orderCount: 4, priority: 'high', createdAt: '2026-02-15T08:00:00Z' },
  { id: 'JOB-SUB-003', source: 'subscription', orderCount: 8, priority: 'normal', createdAt: '2026-02-15T07:30:00Z' },
  { id: 'JOB-OT-006', source: 'one_time', orderCount: 2, priority: 'low', createdAt: '2026-02-15T09:00:00Z' },
  { id: 'JOB-SUB-004', source: 'subscription', orderCount: 5, priority: 'normal', createdAt: '2026-02-15T09:30:00Z' },
];

function getElapsedTime(startTime: string): string {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - start);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getNetWorkTime(startTime: string, totalBreakMinutes: number): string {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - start - totalBreakMinutes * 60000);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const SPECIALIZATION_LABELS: Record<string, { label: string; color: string }> = {
  decant: { label: 'Decant', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  fulfillment: { label: 'Fulfillment', color: 'text-teal-600 bg-teal-50 border-teal-200' },
  general: { label: 'General', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  vault: { label: 'Vault', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
};

const DND_JOB_TYPE = 'application/x-job-id';
const DND_SOURCE_TYPE = 'application/x-source';

// ============================================================
// Draggable Job Chip
// ============================================================
function DraggableJobChip({
  jobId, source, orderCount, priority, fromOperatorId, compact = false,
}: {
  jobId: string; source?: string; orderCount?: number; priority?: string;
  fromOperatorId?: string; compact?: boolean;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DND_JOB_TYPE, jobId);
    e.dataTransfer.setData(DND_SOURCE_TYPE, fromOperatorId || 'unassigned');
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).classList.add('opacity-40');
  };
  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('opacity-40');
  };

  if (compact) {
    return (
      <div draggable onDragStart={handleDragStart} onDragEnd={handleDragEnd}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-mono cursor-grab active:cursor-grabbing border-border bg-card hover:border-gold/40 hover:shadow-sm select-none">
        <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        <span className="font-semibold">{jobId}</span>
        {source && (
          <span className={cn('text-[9px] px-1 rounded', source === 'subscription' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}>
            {source === 'subscription' ? 'SUB' : 'OT'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div draggable onDragStart={handleDragStart} onDragEnd={handleDragEnd}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none',
        priority === 'high' ? 'border-red-200 bg-red-50/30' : 'border-border bg-card hover:border-gold/30 hover:shadow-sm',
      )}>
      <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-semibold">{jobId}</span>
          {source && (
            <Badge variant="outline" className="text-[10px]">
              {source === 'subscription' ? 'SUB' : 'OT'}
            </Badge>
          )}
          {priority === 'high' && (
            <Badge className="bg-red-100 text-red-700 text-[10px] gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" /> High
            </Badge>
          )}
        </div>
        {orderCount !== undefined && (
          <p className="text-xs text-muted-foreground mt-0.5">{orderCount} orders</p>
        )}
      </div>
      <MoveHorizontal className="w-4 h-4 text-muted-foreground/30" />
    </div>
  );
}

// ============================================================
// Team Day Tracker Row — shows operator shift status
// ============================================================
function TeamDayRow({ operator, onStartDay, onEndDay, onBreak, onResume }: {
  operator: Operator;
  onStartDay: (id: string) => void;
  onEndDay: (id: string) => void;
  onBreak: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const spec = SPECIALIZATION_LABELS[operator.specialization];
  const stationMeta = operator.currentStation ? STATION_META[operator.currentStation] : null;

  return (
    <div className={cn(
      'flex items-center gap-4 p-3 rounded-lg border transition-all',
      operator.status === 'working' ? 'border-gold/20 bg-gold/[0.02]' :
      operator.status === 'break' ? 'border-amber-300/30 bg-amber-50/30' :
      operator.status === 'available' ? 'border-emerald-200/50' : 'border-border',
    )}>
      {/* Avatar */}
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        operator.status === 'working' ? 'bg-gold/10 text-gold' :
        operator.status === 'break' ? 'bg-amber-100 text-amber-700' :
        operator.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
        'bg-muted text-muted-foreground',
      )}>
        {operator.avatar}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{operator.name}</span>
          <Badge variant="outline" className={cn('text-[10px] border', spec.color)}>{spec.label}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {operator.startedAt && (
            <>
              <Clock className="w-3 h-3" />
              <span>Started {getElapsedTime(operator.startedAt)} ago</span>
              <span>·</span>
              <span>Net: {getNetWorkTime(operator.startedAt, operator.totalBreakMinutes)}</span>
            </>
          )}
          {stationMeta && (
            <>
              <span>·</span>
              <span className={stationMeta.color}>S{operator.currentStation} {stationMeta.label}</span>
            </>
          )}
          {operator.totalBreakMinutes > 0 && (
            <>
              <span>·</span>
              <Coffee className="w-3 h-3" />
              <span>{operator.totalBreakMinutes}m break</span>
            </>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="hidden md:flex items-center gap-4 shrink-0">
        <div className="text-center">
          <p className="text-lg font-bold">{operator.completedToday}</p>
          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Done</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{operator.assignedJobs.length}</p>
          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Queue</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{operator.avgTimePerJob > 0 ? `${operator.avgTimePerJob}m` : '—'}</p>
          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Avg</p>
        </div>
      </div>

      {/* Status + Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium',
          operator.status === 'working' ? 'bg-gold/10 text-gold' :
          operator.status === 'break' ? 'bg-amber-100 text-amber-700' :
          operator.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
          'bg-muted text-muted-foreground',
        )}>
          {operator.status === 'working' && <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
          {operator.status === 'break' && <Coffee className="w-3 h-3" />}
          {operator.status === 'available' && <CheckCircle2 className="w-3 h-3" />}
          {operator.status.charAt(0).toUpperCase() + operator.status.slice(1)}
        </div>

        {!operator.startedAt && operator.status !== 'offline' && (
          <Button size="sm" className="h-7 text-xs gap-1 bg-gold hover:bg-gold/90 text-gold-foreground" onClick={() => onStartDay(operator.id)}>
            <Play className="w-3 h-3" /> Start
          </Button>
        )}
        {operator.status === 'working' && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-300 text-amber-600 hover:bg-amber-50" onClick={() => onBreak(operator.id)}>
            <Pause className="w-3 h-3" /> Break
          </Button>
        )}
        {operator.status === 'break' && (
          <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onResume(operator.id)}>
            <Play className="w-3 h-3" /> Resume
          </Button>
        )}
        {operator.startedAt && operator.status !== 'offline' && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-300 text-red-500 hover:bg-red-50" onClick={() => onEndDay(operator.id)}>
            <Square className="w-3 h-3" /> End
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Droppable Operator Card for Allocation
// ============================================================
function DroppableOperatorCard({
  operator, isExpanded, onToggle, onDropJob, dragOverOperatorId, onDragOver, onDragLeave,
}: {
  operator: Operator; isExpanded: boolean; onToggle: () => void;
  onDropJob: (jobId: string, fromSource: string, toOperatorId: string) => void;
  dragOverOperatorId: string | null;
  onDragOver: (e: React.DragEvent, opId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
}) {
  const spec = SPECIALIZATION_LABELS[operator.specialization];
  const stationMeta = operator.currentStation ? STATION_META[operator.currentStation] : null;
  const isDragOver = dragOverOperatorId === operator.id;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const jobId = e.dataTransfer.getData(DND_JOB_TYPE);
    const fromSource = e.dataTransfer.getData(DND_SOURCE_TYPE);
    if (jobId) onDropJob(jobId, fromSource, operator.id);
  };

  return (
    <div onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, operator.id); }}
      onDragLeave={onDragLeave}>
      <div
        className={cn(
          'flex items-center gap-4 p-3 rounded-lg border transition-all cursor-pointer relative',
          isDragOver ? 'border-gold border-2 bg-gold/5 shadow-md ring-2 ring-gold/20' :
          operator.status === 'working' ? 'border-gold/20 bg-gold/[0.02] hover:border-gold/40' :
          operator.status === 'available' ? 'border-emerald-200/50 hover:border-emerald-300' :
          'border-border hover:border-muted-foreground/30',
        )}
        onClick={onToggle}
      >
        {isDragOver && <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-gold rounded-full animate-pulse" />}
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 relative',
          isDragOver ? 'bg-gold/20 text-gold ring-2 ring-gold' :
          operator.status === 'working' ? 'bg-gold/10 text-gold' :
          operator.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
          'bg-muted text-muted-foreground',
        )}>
          {operator.avatar}
          {isDragOver && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gold rounded-full flex items-center justify-center">
              <ArrowRight className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{operator.name}</span>
            <Badge variant="outline" className={cn('text-[10px] border', spec.color)}>{spec.label}</Badge>
            {isDragOver && <Badge className="bg-gold/10 text-gold text-[10px] animate-pulse">Drop here</Badge>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {operator.status === 'working' && stationMeta && (
              <><span className={stationMeta.color}>S{operator.currentStation} {stationMeta.label}</span><span>·</span></>
            )}
            <span>{operator.assignedJobs.length} job{operator.assignedJobs.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{operator.completedToday} done today</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-16">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-300',
                operator.assignedJobs.length >= 3 ? 'bg-red-500' :
                operator.assignedJobs.length >= 2 ? 'bg-amber-500' :
                operator.assignedJobs.length >= 1 ? 'bg-emerald-500' : 'bg-muted',
              )} style={{ width: `${Math.min(100, operator.assignedJobs.length * 33)}%` }} />
            </div>
            <p className="text-[9px] text-muted-foreground text-center mt-0.5">
              {operator.assignedJobs.length >= 3 ? 'Heavy' : operator.assignedJobs.length >= 2 ? 'Moderate' : operator.assignedJobs.length >= 1 ? 'Light' : 'Free'}
            </p>
          </div>
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium',
            operator.status === 'working' ? 'bg-gold/10 text-gold' :
            operator.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
            operator.status === 'break' ? 'bg-amber-100 text-amber-700' :
            'bg-muted text-muted-foreground',
          )}>
            {operator.status === 'working' && <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
            {operator.status === 'available' && <CheckCircle2 className="w-3 h-3" />}
            {operator.status.charAt(0).toUpperCase() + operator.status.slice(1)}
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="ml-14 mt-2 mb-1 p-3 rounded-lg bg-muted/30 border border-border space-y-3">
              {operator.assignedJobs.length > 0 ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                    <GripVertical className="w-3 h-3" /> Assigned Jobs — drag to reassign
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {operator.assignedJobs.map(jid => (
                      <DraggableJobChip key={jid} jobId={jid} fromOperatorId={operator.id} compact
                        source={jid.includes('SUB') ? 'subscription' : 'one_time'} />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No jobs assigned — drop a job here</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-background rounded-md border border-border">
                  <p className="text-lg font-bold">{operator.completedToday}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Done Today</p>
                </div>
                <div className="text-center p-2 bg-background rounded-md border border-border">
                  <p className="text-lg font-bold">{operator.avgTimePerJob > 0 ? `${operator.avgTimePerJob}m` : '—'}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg/Job</p>
                </div>
                <div className="text-center p-2 bg-background rounded-md border border-border">
                  <p className="text-lg font-bold">{operator.assignedJobs.length}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">In Queue</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Main Work Allocation Page — Tabbed Hub
// ============================================================
export default function WorkAllocation() {
  const { data: jobsRes } = useApiQuery(() => api.jobs.list(), []);
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: cyclesRes } = useApiQuery(() => api.subscriptions.cycles(), []);
  const jobs = (jobsRes || []) as Job[];
  const orders = (ordersRes || []) as Order[];
  const cycles = (cyclesRes || []) as SubscriptionCycle[];
  const activeCycle = cycles.find(c => c.status === 'active' || c.status === 'processing');

  const [operators, setOperators] = useState(INITIAL_OPERATORS);
  const [unassignedJobs, setUnassignedJobs] = useState<UnassignedJob[]>(INITIAL_UNASSIGNED);
  const [expandedOp, setExpandedOp] = useState<string | null>(null);
  const [dragOverOperatorId, setDragOverOperatorId] = useState<string | null>(null);
  const [dragOverUnassigned, setDragOverUnassigned] = useState(false);
  const [daySession, setDaySession] = useState<DaySession | null>(null);
  const [activeTab, setActiveTab] = useState('day-tracker');

  // Undo history
  const [undoStack, setUndoStack] = useState<Array<{
    action: string; jobId: string; fromName: string; toName: string; restore: () => void;
  }>>([]);

  // Stats
  const totalOperators = operators.length;
  const workingCount = operators.filter(o => o.status === 'working').length;
  const availableCount = operators.filter(o => o.status === 'available').length;
  const onBreakCount = operators.filter(o => o.status === 'break').length;
  const totalCompletedToday = operators.reduce((s, o) => s + o.completedToday, 0);

  // Day session (unified)

  // Job stats
  const otJobs = useMemo(() => unassignedJobs.filter(j => j.source === 'one_time'), [unassignedJobs]);
  const subJobs = useMemo(() => unassignedJobs.filter(j => j.source === 'subscription'), [unassignedJobs]);

  // Pending orders
  const pendingOtOrders = useMemo(() => orders.filter(o => o.type === 'one_time' && ['new', 'processing'].includes(o.status)).length, [orders]);
  const pendingSubOrders = useMemo(() => orders.filter(o => o.type === 'subscription' && ['new', 'processing'].includes(o.status)).length, [orders]);

  // Workload balance
  const workloadBalance = useMemo(() => {
    const workingOps = operators.filter(o => o.status === 'working' && o.assignedJobs.length > 0);
    if (workingOps.length <= 1) return 100;
    const jobCounts = workingOps.map(o => o.assignedJobs.length);
    const avg = jobCounts.reduce((s, c) => s + c, 0) / jobCounts.length;
    const variance = jobCounts.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / jobCounts.length;
    return Math.max(0, Math.round(100 - Math.sqrt(variance) * 30));
  }, [operators]);

  // Day management handlers
  const startDay = () => {
    setDaySession({ startedAt: new Date().toISOString(), endedAt: null, status: 'active' });
    toast.success('Operations day started');
  };

  const endDay = () => {
    setDaySession(prev => prev ? { ...prev, endedAt: new Date().toISOString(), status: 'ended' as const } : null);
    toast.success('Operations day ended — shift report generated');
  };

  // Operator shift handlers
  const handleStartOperatorDay = (opId: string) => {
    setOperators(prev => prev.map(op =>
      op.id === opId ? { ...op, startedAt: new Date().toISOString(), status: 'working' as const } : op
    ));
    const op = operators.find(o => o.id === opId);
    toast.success(`${op?.name} started their day`);
  };

  const handleEndOperatorDay = (opId: string) => {
    setOperators(prev => prev.map(op =>
      op.id === opId ? { ...op, status: 'offline' as const } : op
    ));
    const op = operators.find(o => o.id === opId);
    toast.success(`${op?.name} ended their day — shift report generated`);
  };

  const handleBreak = (opId: string) => {
    setOperators(prev => prev.map(op =>
      op.id === opId ? { ...op, status: 'break' as const, breakStartedAt: new Date().toISOString() } : op
    ));
    const op = operators.find(o => o.id === opId);
    toast.info(`${op?.name} is on break`);
  };

  const handleResume = (opId: string) => {
    setOperators(prev => prev.map(op => {
      if (op.id !== opId) return op;
      const breakDuration = op.breakStartedAt ? Math.round((Date.now() - new Date(op.breakStartedAt).getTime()) / 60000) : 0;
      return { ...op, status: 'working' as const, breakStartedAt: null, totalBreakMinutes: op.totalBreakMinutes + breakDuration };
    }));
    const op = operators.find(o => o.id === opId);
    toast.success(`${op?.name} resumed work`);
  };

  // Job allocation handlers
  const handleDropOnOperator = useCallback((jobId: string, fromSource: string, toOperatorId: string) => {
    setDragOverOperatorId(null);
    if (fromSource === toOperatorId) return;
    const prevOperators = [...operators.map(o => ({ ...o, assignedJobs: [...o.assignedJobs] }))];
    const prevUnassigned = [...unassignedJobs];
    const toOp = operators.find(o => o.id === toOperatorId);
    const fromOp = fromSource !== 'unassigned' ? operators.find(o => o.id === fromSource) : null;
    if (toOp?.assignedJobs.includes(jobId)) return;

    setOperators(prev => prev.map(op => {
      if (fromSource !== 'unassigned' && op.id === fromSource) return { ...op, assignedJobs: op.assignedJobs.filter(j => j !== jobId) };
      if (op.id === toOperatorId) return { ...op, assignedJobs: [...op.assignedJobs, jobId], status: 'working' as const };
      return op;
    }));
    if (fromSource === 'unassigned') setUnassignedJobs(prev => prev.filter(j => j.id !== jobId));

    const restoreFn = () => { setOperators(prevOperators); setUnassignedJobs(prevUnassigned); };
    setUndoStack(prev => [...prev.slice(-9), {
      action: fromSource === 'unassigned' ? 'assigned' : 'reassigned', jobId,
      fromName: fromOp?.name || 'Unassigned Pool', toName: toOp?.name || 'Unknown', restore: restoreFn,
    }]);
    toast.success(<span><strong>{jobId}</strong> → <strong>{toOp?.name}</strong></span>, {
      action: { label: 'Undo', onClick: restoreFn }, duration: 5000,
    });
  }, [operators, unassignedJobs]);

  const handleDropOnUnassigned = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOverUnassigned(false);
    const jobId = e.dataTransfer.getData(DND_JOB_TYPE);
    const fromSource = e.dataTransfer.getData(DND_SOURCE_TYPE);
    if (!jobId || fromSource === 'unassigned') return;
    const prevOperators = [...operators.map(o => ({ ...o, assignedJobs: [...o.assignedJobs] }))];
    const prevUnassigned = [...unassignedJobs];
    const fromOp = operators.find(o => o.id === fromSource);
    setOperators(prev => prev.map(op => op.id === fromSource ? { ...op, assignedJobs: op.assignedJobs.filter(j => j !== jobId) } : op));
    setUnassignedJobs(prev => [...prev, { id: jobId, source: jobId.includes('SUB') ? 'subscription' : 'one_time', orderCount: 0, priority: 'normal' as const, createdAt: new Date().toISOString() }]);
    const restoreFn = () => { setOperators(prevOperators); setUnassignedJobs(prevUnassigned); };
    setUndoStack(prev => [...prev.slice(-9), { action: 'unassigned', jobId, fromName: fromOp?.name || 'Unknown', toName: 'Unassigned Pool', restore: restoreFn }]);
    toast.info(<span><strong>{jobId}</strong> returned to pool</span>, { action: { label: 'Undo', onClick: restoreFn }, duration: 5000 });
  }, [operators, unassignedJobs]);

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader
        title="Work Allocation"
        subtitle={`Operations command center · ${todayStr}`}
        breadcrumbs={[{ label: 'Job Management' }, { label: 'Work Allocation' }]}
      />

      <div className="p-6 space-y-6">
        {/* ===== KPI Overview ===== */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{totalOperators}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Team</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center mx-auto mb-2">
              <UserCheck className="w-4 h-4 text-gold" />
            </div>
            <p className="text-2xl font-bold">{workingCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Working</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold">{availableCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Available</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
              <Coffee className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold">{onBreakCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">On Break</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center mx-auto mb-2">
              <Zap className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-2xl font-bold">{totalCompletedToday}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Done Today</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center mx-auto mb-2">
              <Target className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold">{workloadBalance}%</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
          </div>
        </div>

        {/* ===== Tabbed Interface ===== */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="day-tracker" className="text-xs gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Team Day Tracker
            </TabsTrigger>
            <TabsTrigger value="allocation" className="text-xs gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Allocate & Assign
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB 1: Team Day Tracker ===== */}
          <TabsContent value="day-tracker" className="space-y-4 mt-4">
            {/* Unified Day Session Control */}
            <div className={cn('rounded-lg border p-4 transition-all', daySession?.status === 'active' ? 'border-gold/40 bg-gold/[0.03]' : 'border-border')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Operations Day</h3>
                    <p className="text-xs text-muted-foreground">
                      {unassignedJobs.length} unassigned jobs · {workingCount} operators active
                    </p>
                  </div>
                </div>
                {daySession?.status === 'active' ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Active · {getElapsedTime(daySession.startedAt)}
                    </div>
                    <Link href="/job-creation">
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                        <Plus className="w-3 h-3" /> Create Jobs
                      </Button>
                    </Link>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-red-300 text-red-500" onClick={endDay}>
                      <Square className="w-3 h-3" /> End Day
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link href="/job-creation">
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                        <Plus className="w-3 h-3" /> Create Jobs
                      </Button>
                    </Link>
                    <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1 h-7 text-xs" onClick={startDay}>
                      <Play className="w-3 h-3" /> Start Day
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Team Roster */}
            <SectionCard
              title="Team Roster"
              subtitle={`${workingCount} working · ${onBreakCount} on break · ${availableCount} available`}
              headerActions={
                <div className="flex items-center gap-2">
                  <Link href="/shift-handover">
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                      <FileText className="w-3 h-3" /> Shift Report
                    </Button>
                  </Link>
                </div>
              }
            >
              <div className="space-y-2">
                {operators.map(op => (
                  <TeamDayRow
                    key={op.id}
                    operator={op}
                    onStartDay={handleStartOperatorDay}
                    onEndDay={handleEndOperatorDay}
                    onBreak={handleBreak}
                    onResume={handleResume}
                  />
                ))}
              </div>
            </SectionCard>

            {/* Station Capacity */}
            <SectionCard title="Station Capacity" subtitle="Operators per station">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(STATION_META).map(([id, meta]) => {
                  const stationNum = Number(id);
                  const opsAtStation = operators.filter(o => o.currentStation === stationNum);
                  return (
                    <div key={id} className="bg-card border border-border rounded-lg p-3 text-center">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2', meta.color.replace('text-', 'bg-').replace('500', '500/10'))}>
                        <meta.icon className={cn('w-4 h-4', meta.color)} />
                      </div>
                      <p className="text-xs font-semibold mb-0.5">S{id} · {meta.label}</p>
                      <p className="text-lg font-bold">{opsAtStation.length}</p>
                      {opsAtStation.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                          {opsAtStation.map(op => (
                            <span key={op.id} className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">{op.avatar}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </TabsContent>

          {/* ===== TAB 2: Allocate & Assign (Full DnD) ===== */}
          <TabsContent value="allocation" className="space-y-4 mt-4">
            {/* DnD instruction */}
            <div className="bg-gold/5 border border-gold/20 rounded-lg p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-4 h-4 text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium">Drag-and-Drop Job Reassignment</p>
                <p className="text-xs text-muted-foreground">
                  Drag jobs between operators or back to the unassigned pool. Each action can be undone.
                </p>
              </div>
              {undoStack.length > 0 && (
                <Button size="sm" variant="outline" className="ml-auto text-xs h-7 gap-1 shrink-0"
                  onClick={() => {
                    const last = undoStack[undoStack.length - 1];
                    if (last) { last.restore(); setUndoStack(prev => prev.slice(0, -1)); toast.info(`Undid: ${last.jobId} ${last.action}`); }
                  }}>
                  <Undo2 className="w-3 h-3" /> Undo ({undoStack.length})
                </Button>
              )}
            </div>

            {/* Unassigned Pool */}
            <div
              onDrop={handleDropOnUnassigned}
              onDragOver={(e) => { e.preventDefault(); setDragOverUnassigned(true); }}
              onDragLeave={(e) => {
                const rel = e.relatedTarget as HTMLElement | null;
                if (!rel || !(e.currentTarget as HTMLElement).contains(rel)) setDragOverUnassigned(false);
              }}
            >
              <SectionCard
                title="Unassigned Jobs"
                subtitle={`${unassignedJobs.length} jobs waiting — drag to assign`}
                headerActions={
                  <div className="flex items-center gap-2">
                    {dragOverUnassigned && <Badge className="bg-amber-100 text-amber-700 text-[10px] animate-pulse">Drop to unassign</Badge>}
                    <StatusBadge variant="gold">{unassignedJobs.length} Pending</StatusBadge>
                  </div>
                }
              >
                <div className={cn('space-y-2 min-h-[60px] rounded-lg transition-all', dragOverUnassigned && 'bg-amber-50/50 border-2 border-dashed border-amber-300 p-2')}>
                  {unassignedJobs.length > 0 ? (
                    unassignedJobs.map(job => (
                      <DraggableJobChip key={job.id} jobId={job.id} source={job.source} orderCount={job.orderCount} priority={job.priority} fromOperatorId="unassigned" />
                    ))
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                      All jobs assigned
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* All Operators */}
            <SectionCard
              title="Operator Workloads"
              subtitle="Drop jobs onto operators to assign"
              headerActions={
                <Badge variant="outline" className="text-[10px] gap-1">
                  <BarChart3 className="w-3 h-3" /> Balance: {workloadBalance}%
                </Badge>
              }
            >
              <div className="space-y-2">
                {operators.filter(o => o.status !== 'offline').map(op => (
                  <DroppableOperatorCard
                    key={op.id} operator={op} isExpanded={expandedOp === op.id}
                    onToggle={() => setExpandedOp(expandedOp === op.id ? null : op.id)}
                    onDropJob={handleDropOnOperator} dragOverOperatorId={dragOverOperatorId}
                    onDragOver={(e, id) => { e.preventDefault(); setDragOverOperatorId(id); }}
                    onDragLeave={(e) => {
                      const rel = e.relatedTarget as HTMLElement | null;
                      if (!rel || !(e.currentTarget as HTMLElement).contains(rel)) setDragOverOperatorId(null);
                    }}
                  />
                ))}
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
