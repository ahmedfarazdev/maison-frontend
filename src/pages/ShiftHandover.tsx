// ============================================================
// Shift Handover Report — End-of-Day Summary
// Auto-generates a comprehensive shift summary showing each operator's
// completed jobs, pending items, and bottles still checked out from vault.
// Accessible to admin, owner, pod_leader
// ============================================================

import { useState, useMemo, useRef } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  FileText, Download, Printer, Clock, CheckCircle2, AlertTriangle,
  Package, FlaskConical, Truck, Shield, Users, BarChart3,
  TrendingUp, Target, Zap, Calendar, ChevronDown, ChevronUp,
  ArrowRight, AlertCircle, Beaker, ScanBarcode, ClipboardList,
  CheckSquare, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Job, UserRole } from '@/types';

// ===== Mock Data for Shift Report =====
// In production, this would come from tRPC queries aggregating the day's data

interface ShiftOperatorSummary {
  id: string;
  name: string;
  avatar: string;
  role: string;
  specialization: string;
  shiftStart: string;
  shiftEnd: string | null;
  completedJobs: Array<{
    jobId: string;
    source: string;
    orderCount: number;
    startedAt: string;
    completedAt: string;
    durationMinutes: number;
    station: number;
  }>;
  pendingJobs: Array<{
    jobId: string;
    source: string;
    orderCount: number;
    currentStation: number;
    progress: number; // 0-100
  }>;
  bottlesCheckedOut: Array<{
    bottleId: string;
    perfumeName: string;
    checkedOutAt: string;
    jobId: string;
    hoursOut: number;
  }>;
  metrics: {
    totalJobsCompleted: number;
    totalOrdersProcessed: number;
    avgTimePerJob: number;
    efficiency: number; // percentage
  };
}

const MOCK_SHIFT_DATE = '2026-02-15';

const MOCK_SHIFT_SUMMARIES: ShiftOperatorSummary[] = [
  {
    id: 'op-1',
    name: 'Ahmed K.',
    avatar: 'AK',
    role: 'pod_senior',
    specialization: 'Pod Senior',
    shiftStart: '2026-02-15T06:30:00Z',
    shiftEnd: null,
    completedJobs: [
      { jobId: 'JOB-OT-010', source: 'one_time', orderCount: 3, startedAt: '2026-02-15T06:35:00Z', completedAt: '2026-02-15T07:15:00Z', durationMinutes: 40, station: 4 },
      { jobId: 'JOB-OT-011', source: 'one_time', orderCount: 5, startedAt: '2026-02-15T07:20:00Z', completedAt: '2026-02-15T08:05:00Z', durationMinutes: 45, station: 4 },
      { jobId: 'JOB-SUB-008', source: 'subscription', orderCount: 8, startedAt: '2026-02-15T08:10:00Z', completedAt: '2026-02-15T09:00:00Z', durationMinutes: 50, station: 4 },
    ],
    pendingJobs: [
      { jobId: 'JOB-OT-012', source: 'one_time', orderCount: 4, currentStation: 3, progress: 60 },
    ],
    bottlesCheckedOut: [
      { bottleId: 'BTL-0234', perfumeName: 'Baccarat Rouge 540', checkedOutAt: '2026-02-15T08:30:00Z', jobId: 'JOB-OT-012', hoursOut: 3.5 },
      { bottleId: 'BTL-0891', perfumeName: 'Aventus', checkedOutAt: '2026-02-15T09:15:00Z', jobId: 'JOB-OT-012', hoursOut: 2.75 },
    ],
    metrics: { totalJobsCompleted: 3, totalOrdersProcessed: 16, avgTimePerJob: 45, efficiency: 92 },
  },
  {
    id: 'op-2',
    name: 'Sara M.',
    avatar: 'SM',
    role: 'pod_senior',
    specialization: 'General Ops',
    shiftStart: '2026-02-15T07:00:00Z',
    shiftEnd: null,
    completedJobs: [
      { jobId: 'JOB-SUB-009', source: 'subscription', orderCount: 12, startedAt: '2026-02-15T07:05:00Z', completedAt: '2026-02-15T08:00:00Z', durationMinutes: 55, station: 2 },
    ],
    pendingJobs: [
      { jobId: 'JOB-SUB-010', source: 'subscription', orderCount: 10, currentStation: 2, progress: 40 },
    ],
    bottlesCheckedOut: [
      { bottleId: 'BTL-1102', perfumeName: 'Oud Wood', checkedOutAt: '2026-02-15T08:10:00Z', jobId: 'JOB-SUB-010', hoursOut: 3.8 },
      { bottleId: 'BTL-0445', perfumeName: 'Lost Cherry', checkedOutAt: '2026-02-15T08:10:00Z', jobId: 'JOB-SUB-010', hoursOut: 3.8 },
      { bottleId: 'BTL-0776', perfumeName: 'Tobacco Vanille', checkedOutAt: '2026-02-15T08:15:00Z', jobId: 'JOB-SUB-010', hoursOut: 3.75 },
    ],
    metrics: { totalJobsCompleted: 1, totalOrdersProcessed: 12, avgTimePerJob: 55, efficiency: 78 },
  },
  {
    id: 'op-3',
    name: 'Khalid R.',
    avatar: 'KR',
    role: 'pod_junior',
    specialization: 'Pod Junior',
    shiftStart: '2026-02-15T06:00:00Z',
    shiftEnd: null,
    completedJobs: [
      { jobId: 'JOB-OT-007', source: 'one_time', orderCount: 2, startedAt: '2026-02-15T06:05:00Z', completedAt: '2026-02-15T06:25:00Z', durationMinutes: 20, station: 6 },
      { jobId: 'JOB-OT-008', source: 'one_time', orderCount: 3, startedAt: '2026-02-15T06:30:00Z', completedAt: '2026-02-15T06:48:00Z', durationMinutes: 18, station: 6 },
      { jobId: 'JOB-SUB-005', source: 'subscription', orderCount: 6, startedAt: '2026-02-15T06:50:00Z', completedAt: '2026-02-15T07:08:00Z', durationMinutes: 18, station: 6 },
      { jobId: 'JOB-SUB-006', source: 'subscription', orderCount: 4, startedAt: '2026-02-15T07:10:00Z', completedAt: '2026-02-15T07:30:00Z', durationMinutes: 20, station: 6 },
      { jobId: 'JOB-OT-009', source: 'one_time', orderCount: 1, startedAt: '2026-02-15T07:35:00Z', completedAt: '2026-02-15T07:50:00Z', durationMinutes: 15, station: 6 },
    ],
    pendingJobs: [
      { jobId: 'JOB-OT-013', source: 'one_time', orderCount: 3, currentStation: 5, progress: 75 },
    ],
    bottlesCheckedOut: [],
    metrics: { totalJobsCompleted: 5, totalOrdersProcessed: 16, avgTimePerJob: 18, efficiency: 96 },
  },
  {
    id: 'op-5',
    name: 'Omar H.',
    avatar: 'OH',
    role: 'pod_senior',
    specialization: 'Pod Senior',
    shiftStart: '2026-02-15T07:15:00Z',
    shiftEnd: null,
    completedJobs: [
      { jobId: 'JOB-SUB-007', source: 'subscription', orderCount: 10, startedAt: '2026-02-15T07:20:00Z', completedAt: '2026-02-15T08:10:00Z', durationMinutes: 50, station: 4 },
      { jobId: 'JOB-OT-014', source: 'one_time', orderCount: 6, startedAt: '2026-02-15T08:15:00Z', completedAt: '2026-02-15T09:00:00Z', durationMinutes: 45, station: 4 },
    ],
    pendingJobs: [
      { jobId: 'JOB-SUB-011', source: 'subscription', orderCount: 8, currentStation: 4, progress: 30 },
    ],
    bottlesCheckedOut: [
      { bottleId: 'BTL-0567', perfumeName: 'Layton', checkedOutAt: '2026-02-15T09:05:00Z', jobId: 'JOB-SUB-011', hoursOut: 2.9 },
    ],
    metrics: { totalJobsCompleted: 2, totalOrdersProcessed: 16, avgTimePerJob: 48, efficiency: 85 },
  },
  {
    id: 'op-6',
    name: 'Layla B.',
    avatar: 'LB',
    role: 'vault_guardian',
    specialization: 'Vault Guardian',
    shiftStart: '2026-02-15T06:00:00Z',
    shiftEnd: null,
    completedJobs: [],
    pendingJobs: [],
    bottlesCheckedOut: [],
    metrics: { totalJobsCompleted: 0, totalOrdersProcessed: 0, avgTimePerJob: 5, efficiency: 98 },
  },
  {
    id: 'op-7',
    name: 'Youssef T.',
    avatar: 'YT',
    role: 'pod_junior',
    specialization: 'Pod Junior',
    shiftStart: '2026-02-15T06:45:00Z',
    shiftEnd: null,
    completedJobs: [
      { jobId: 'JOB-OT-015', source: 'one_time', orderCount: 4, startedAt: '2026-02-15T06:50:00Z', completedAt: '2026-02-15T07:12:00Z', durationMinutes: 22, station: 6 },
      { jobId: 'JOB-SUB-012', source: 'subscription', orderCount: 7, startedAt: '2026-02-15T07:15:00Z', completedAt: '2026-02-15T07:40:00Z', durationMinutes: 25, station: 6 },
      { jobId: 'JOB-OT-016', source: 'one_time', orderCount: 2, startedAt: '2026-02-15T07:45:00Z', completedAt: '2026-02-15T08:05:00Z', durationMinutes: 20, station: 6 },
      { jobId: 'JOB-SUB-013', source: 'subscription', orderCount: 5, startedAt: '2026-02-15T08:10:00Z', completedAt: '2026-02-15T08:32:00Z', durationMinutes: 22, station: 6 },
    ],
    pendingJobs: [
      { jobId: 'JOB-OT-017', source: 'one_time', orderCount: 3, currentStation: 6, progress: 50 },
    ],
    bottlesCheckedOut: [],
    metrics: { totalJobsCompleted: 4, totalOrdersProcessed: 18, avgTimePerJob: 22, efficiency: 94 },
  },
];

// Vault summary mock
const VAULT_SUMMARY = {
  totalCheckouts: 24,
  totalReturns: 18,
  bottlesCurrentlyOut: 6,
  emptyBottlesLogged: 3,
  brokenBottlesLogged: 0,
};

const STATION_LABELS: Record<number, string> = {
  1: 'Job Board', 2: 'Picking', 3: 'Prep & Label',
  4: 'Batch Decant', 5: 'Fulfillment', 6: 'Shipping',
};

// ============================================================
// Operator Shift Card
// ============================================================
function OperatorShiftCard({ summary }: { summary: ShiftOperatorSummary }) {
  const [expanded, setExpanded] = useState(false);

  const shiftDuration = useMemo(() => {
    const start = new Date(summary.shiftStart).getTime();
    const end = summary.shiftEnd ? new Date(summary.shiftEnd).getTime() : Date.now();
    const hours = Math.floor((end - start) / 3600000);
    const minutes = Math.floor(((end - start) % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }, [summary.shiftStart, summary.shiftEnd]);

  const hasWarnings = summary.bottlesCheckedOut.length > 0 || summary.pendingJobs.length > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-4 p-4 cursor-pointer transition-colors',
          hasWarnings ? 'hover:bg-amber-50/30 dark:hover:bg-amber-900/5' : 'hover:bg-muted/30',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
          summary.metrics.efficiency >= 90 ? 'bg-emerald-100 text-emerald-700' :
          summary.metrics.efficiency >= 75 ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700',
        )}>
          {summary.avatar}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{summary.name}</span>
            <Badge variant="outline" className="text-[10px]">{summary.specialization}</Badge>
            {hasWarnings && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px] gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                {summary.bottlesCheckedOut.length > 0 && `${summary.bottlesCheckedOut.length} bottles out`}
                {summary.bottlesCheckedOut.length > 0 && summary.pendingJobs.length > 0 && ' · '}
                {summary.pendingJobs.length > 0 && `${summary.pendingJobs.length} pending`}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Shift: {shiftDuration}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {summary.metrics.totalJobsCompleted} jobs done</span>
            <span>·</span>
            <span>{summary.metrics.totalOrdersProcessed} orders</span>
          </div>
        </div>

        {/* Efficiency score */}
        <div className="text-center shrink-0">
          <div className={cn(
            'text-xl font-bold',
            summary.metrics.efficiency >= 90 ? 'text-emerald-600' :
            summary.metrics.efficiency >= 75 ? 'text-amber-600' :
            'text-red-600',
          )}>
            {summary.metrics.efficiency}%
          </div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Efficiency</p>
        </div>

        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
              {/* Quick metrics */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <p className="text-lg font-bold">{summary.metrics.totalJobsCompleted}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Jobs Done</p>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <p className="text-lg font-bold">{summary.metrics.totalOrdersProcessed}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Orders</p>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <p className="text-lg font-bold">{summary.metrics.avgTimePerJob}m</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg/Job</p>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <p className="text-lg font-bold">{shiftDuration}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Shift Time</p>
                </div>
              </div>

              {/* Completed Jobs */}
              {summary.completedJobs.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Completed Jobs ({summary.completedJobs.length})
                  </p>
                  <div className="space-y-1">
                    {summary.completedJobs.map(job => (
                      <div key={job.jobId} className="flex items-center gap-3 p-2 rounded-md bg-emerald-50/30 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-800/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-xs font-mono font-semibold">{job.jobId}</span>
                        <Badge variant="outline" className="text-[9px]">{job.source === 'subscription' ? 'SUB' : 'OT'}</Badge>
                        <span className="text-[10px] text-muted-foreground">{job.orderCount} orders</span>
                        <span className="text-[10px] text-muted-foreground">S{job.station} {STATION_LABELS[job.station]}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{job.durationMinutes}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Jobs */}
              {summary.pendingJobs.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-amber-600 font-medium mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Pending / In Progress ({summary.pendingJobs.length})
                  </p>
                  <div className="space-y-1">
                    {summary.pendingJobs.map(job => (
                      <div key={job.jobId} className="flex items-center gap-3 p-2 rounded-md bg-amber-50/30 dark:bg-amber-900/5 border border-amber-100 dark:border-amber-800/20">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-xs font-mono font-semibold">{job.jobId}</span>
                        <Badge variant="outline" className="text-[9px]">{job.source === 'subscription' ? 'SUB' : 'OT'}</Badge>
                        <span className="text-[10px] text-muted-foreground">{job.orderCount} orders</span>
                        <span className="text-[10px] text-muted-foreground">S{job.currentStation} {STATION_LABELS[job.currentStation]}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${job.progress}%` }} />
                          </div>
                          <span className="text-[10px] text-amber-600">{job.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottles Still Checked Out */}
              {summary.bottlesCheckedOut.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-red-600 font-medium mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Bottles Still Checked Out ({summary.bottlesCheckedOut.length})
                  </p>
                  <div className="space-y-1">
                    {summary.bottlesCheckedOut.map(bottle => (
                      <div key={bottle.bottleId} className={cn(
                        'flex items-center gap-3 p-2 rounded-md border',
                        bottle.hoursOut > 3 ? 'bg-red-50/30 border-red-200 dark:bg-red-900/5 dark:border-red-800/20' : 'bg-amber-50/30 border-amber-100 dark:bg-amber-900/5 dark:border-amber-800/20',
                      )}>
                        <Shield className={cn('w-3.5 h-3.5 shrink-0', bottle.hoursOut > 3 ? 'text-red-500' : 'text-amber-500')} />
                        <span className="text-xs font-mono">{bottle.bottleId}</span>
                        <span className="text-xs font-medium">{bottle.perfumeName}</span>
                        <span className="text-[10px] text-muted-foreground">for {bottle.jobId}</span>
                        <span className={cn(
                          'ml-auto text-[10px] font-medium',
                          bottle.hoursOut > 3 ? 'text-red-600' : 'text-amber-600',
                        )}>
                          {bottle.hoursOut.toFixed(1)}h out
                          {bottle.hoursOut > 3 && ' ⚠️'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All clear */}
              {summary.completedJobs.length === 0 && summary.pendingJobs.length === 0 && summary.bottlesCheckedOut.length === 0 && (
                <div className="text-center py-3 text-sm text-muted-foreground">
                  {summary.role === 'vault_guardian'
                    ? 'Vault Guardian — see vault summary below for activity details'
                    : 'No job activity recorded for this shift'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Main Shift Handover Report Page
// ============================================================
export default function ShiftHandover() {
  const printRef = useRef<HTMLDivElement>(null);

  // Aggregate stats
  const totalStats = useMemo(() => {
    const totalJobs = MOCK_SHIFT_SUMMARIES.reduce((s, op) => s + op.metrics.totalJobsCompleted, 0);
    const totalOrders = MOCK_SHIFT_SUMMARIES.reduce((s, op) => s + op.metrics.totalOrdersProcessed, 0);
    const totalPending = MOCK_SHIFT_SUMMARIES.reduce((s, op) => s + op.pendingJobs.length, 0);
    const totalBottlesOut = MOCK_SHIFT_SUMMARIES.reduce((s, op) => s + op.bottlesCheckedOut.length, 0);
    const activeOps = MOCK_SHIFT_SUMMARIES.filter(op => op.metrics.totalJobsCompleted > 0 || op.pendingJobs.length > 0).length;
    const avgEfficiency = MOCK_SHIFT_SUMMARIES.filter(op => op.metrics.efficiency > 0).length > 0
      ? Math.round(MOCK_SHIFT_SUMMARIES.filter(op => op.metrics.efficiency > 0).reduce((s, op) => s + op.metrics.efficiency, 0) / MOCK_SHIFT_SUMMARIES.filter(op => op.metrics.efficiency > 0).length)
      : 0;
    return { totalJobs, totalOrders, totalPending, totalBottlesOut, activeOps, avgEfficiency };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div>
      <PageHeader
        title="Shift Handover Report"
        subtitle={`Generated ${currentDate} at ${currentTime}`}
        breadcrumbs={[{ label: 'Operations' }, { label: 'Shift Handover' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print Report
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6 print:p-2 print:space-y-4" ref={printRef}>
        {/* ===== Report Header (visible in print) ===== */}
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-xl font-bold">Maison Em — Shift Handover Report</h1>
          <p className="text-sm text-muted-foreground">{currentDate} · Generated at {currentTime}</p>
        </div>

        {/* ===== Overall Shift Summary ===== */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold">{totalStats.totalJobs}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Jobs Completed</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{totalStats.totalOrders}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Orders Processed</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold">{totalStats.totalPending}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending Jobs</p>
          </div>
          <div className={cn(
            'bg-card border rounded-lg p-4 text-center',
            totalStats.totalBottlesOut > 0 ? 'border-red-200 bg-red-50/20' : 'border-border',
          )}>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2', totalStats.totalBottlesOut > 0 ? 'bg-red-500/10' : 'bg-muted')}>
              <Shield className={cn('w-4 h-4', totalStats.totalBottlesOut > 0 ? 'text-red-500' : 'text-muted-foreground')} />
            </div>
            <p className={cn('text-2xl font-bold', totalStats.totalBottlesOut > 0 && 'text-red-600')}>{totalStats.totalBottlesOut}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bottles Out</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center mx-auto mb-2">
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold">{totalStats.activeOps}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active Operators</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center mx-auto mb-2">
              <Target className="w-4 h-4 text-gold" />
            </div>
            <p className="text-2xl font-bold">{totalStats.avgEfficiency}%</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Efficiency</p>
          </div>
        </div>

        {/* ===== Alerts / Action Items ===== */}
        {(totalStats.totalBottlesOut > 0 || totalStats.totalPending > 0) && (
          <div className="bg-amber-50/50 dark:bg-amber-900/5 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" /> Handover Action Items
            </h3>
            <div className="space-y-2">
              {totalStats.totalBottlesOut > 0 && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      {totalStats.totalBottlesOut} bottle{totalStats.totalBottlesOut !== 1 ? 's' : ''} still checked out from vault
                    </p>
                    <p className="text-xs text-muted-foreground">
                      These must be returned to the Vault Guardian before shift ends, or handed over to the next shift operator.
                    </p>
                  </div>
                </div>
              )}
              {totalStats.totalPending > 0 && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      {totalStats.totalPending} job{totalStats.totalPending !== 1 ? 's' : ''} still in progress
                    </p>
                    <p className="text-xs text-muted-foreground">
                      These jobs need to be handed over to the next shift or completed before leaving.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Per-Operator Breakdown ===== */}
        <SectionCard
          title="Operator Breakdown"
          subtitle="Click each operator to see detailed job history and pending items"
          headerActions={
            <Badge variant="outline" className="text-[10px]">
              {MOCK_SHIFT_SUMMARIES.length} operators
            </Badge>
          }
        >
          <div className="space-y-2">
            {MOCK_SHIFT_SUMMARIES.map(summary => (
              <OperatorShiftCard key={summary.id} summary={summary} />
            ))}
          </div>
        </SectionCard>

        {/* ===== Vault Guardian Summary ===== */}
        <SectionCard
          title="Vault Activity Summary"
          subtitle="Bottle movements tracked by the Vault Guardian today"
          headerActions={
            <StatusBadge variant={VAULT_SUMMARY.bottlesCurrentlyOut > 0 ? 'gold' : 'success'}>
              {VAULT_SUMMARY.bottlesCurrentlyOut} Currently Out
            </StatusBadge>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xl font-bold">{VAULT_SUMMARY.totalCheckouts}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Checkouts</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xl font-bold">{VAULT_SUMMARY.totalReturns}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Returns</p>
            </div>
            <div className={cn(
              'text-center p-3 rounded-lg',
              VAULT_SUMMARY.bottlesCurrentlyOut > 0 ? 'bg-red-50/50 dark:bg-red-900/10' : 'bg-muted/30',
            )}>
              <p className={cn('text-xl font-bold', VAULT_SUMMARY.bottlesCurrentlyOut > 0 && 'text-red-600')}>
                {VAULT_SUMMARY.bottlesCurrentlyOut}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Still Out</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xl font-bold">{VAULT_SUMMARY.emptyBottlesLogged}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Empty Logged</p>
            </div>
            <div className={cn(
              'text-center p-3 rounded-lg',
              VAULT_SUMMARY.brokenBottlesLogged > 0 ? 'bg-red-50/50 dark:bg-red-900/10' : 'bg-muted/30',
            )}>
              <p className={cn('text-xl font-bold', VAULT_SUMMARY.brokenBottlesLogged > 0 && 'text-red-600')}>
                {VAULT_SUMMARY.brokenBottlesLogged}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Broken Logged</p>
            </div>
          </div>
        </SectionCard>

        {/* ===== Performance Leaderboard ===== */}
        <SectionCard
          title="Performance Leaderboard"
          subtitle="Operators ranked by efficiency and output"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rank</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Operator</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Role</th>
                  <th className="text-center py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Jobs</th>
                  <th className="text-center py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Orders</th>
                  <th className="text-center py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Avg Time</th>
                  <th className="text-center py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {[...MOCK_SHIFT_SUMMARIES]
                  .filter(op => op.metrics.totalJobsCompleted > 0)
                  .sort((a, b) => b.metrics.efficiency - a.metrics.efficiency)
                  .map((op, idx) => (
                    <tr key={op.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2.5 px-3">
                        <span className={cn(
                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                          idx === 0 ? 'bg-gold/10 text-gold' :
                          idx === 1 ? 'bg-slate-200 text-slate-700' :
                          idx === 2 ? 'bg-amber-100 text-amber-700' :
                          'bg-muted text-muted-foreground',
                        )}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                            {op.avatar}
                          </div>
                          <span className="font-medium">{op.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px]">{op.specialization}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">{op.metrics.totalJobsCompleted}</td>
                      <td className="py-2.5 px-3 text-center">{op.metrics.totalOrdersProcessed}</td>
                      <td className="py-2.5 px-3 text-center">{op.metrics.avgTimePerJob}m</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={cn(
                          'font-bold',
                          op.metrics.efficiency >= 90 ? 'text-emerald-600' :
                          op.metrics.efficiency >= 75 ? 'text-amber-600' :
                          'text-red-600',
                        )}>
                          {op.metrics.efficiency}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ===== Print footer ===== */}
        <div className="hidden print:block text-center text-xs text-muted-foreground mt-8 pt-4 border-t border-border">
          <p>Maison Em Operations Console — Shift Handover Report</p>
          <p>Generated on {currentDate} at {currentTime} · Confidential</p>
        </div>
      </div>
    </div>
  );
}
