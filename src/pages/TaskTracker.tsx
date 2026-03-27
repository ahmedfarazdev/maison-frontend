// ============================================================
// Task Tracker — Gantt Chart & Team Allocation Overview
// Shows: active cycles, jobs across stations, team assignments,
// timeline view of processing, bottleneck indicators
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  BarChart3, Calendar, Clock, Users, Layers, Package,
  FlaskConical, Tag, Truck, PackageCheck, ClipboardList,
  ChevronRight, AlertTriangle, CheckCircle2, Timer,
  TrendingUp, TrendingDown, Boxes, Box, User, Zap,
  ArrowRight, Target, RotateCcw, ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Job, Order, SubscriptionCycle } from '@/types';

/* ---- Constants ---- */

const STATIONS = [
  { num: 1, label: 'Job Board', icon: ClipboardList, color: 'bg-slate-500', textColor: 'text-slate-600', mode: 'batch' },
  { num: 2, label: 'Picking', icon: Package, color: 'bg-amber-500', textColor: 'text-amber-600', mode: 'batch' },
  { num: 3, label: 'Prep & Label', icon: Tag, color: 'bg-blue-500', textColor: 'text-blue-600', mode: 'batch' },
  { num: 4, label: 'Decanting', icon: FlaskConical, color: 'bg-purple-500', textColor: 'text-purple-600', mode: 'batch' },
  { num: 5, label: 'Fulfillment', icon: PackageCheck, color: 'bg-orange-500', textColor: 'text-orange-600', mode: 'per_order' },
  { num: 6, label: 'Shipping', icon: Truck, color: 'bg-emerald-500', textColor: 'text-emerald-600', mode: 'per_order' },
];

const STATUS_TO_STATION: Record<string, number> = {
  pending: 1, picked: 2, prepped: 3, decanted: 4, packed: 5, shipped: 6,
};

// Mock team members
const TEAM_MEMBERS = [
  { id: 'op-1', name: 'Ahmed K.', avatar: 'AK', role: 'Pod Senior', stations: [1, 2, 3, 4] },
  { id: 'op-2', name: 'Sara M.', avatar: 'SM', role: 'Pod Senior', stations: [2, 3, 4] },
  { id: 'op-3', name: 'Khalid R.', avatar: 'KR', role: 'Pod Senior', stations: [3, 4] },
  { id: 'op-4', name: 'Fatima A.', avatar: 'FA', role: 'Pod Senior', stations: [1, 2] },
  { id: 'ff-1', name: 'Nora T.', avatar: 'NT', role: 'Pod Junior', stations: [5, 6] },
  { id: 'ff-2', name: 'Youssef B.', avatar: 'YB', role: 'Pod Junior', stations: [5, 6] },
  { id: 'qc-1', name: 'Reem S.', avatar: 'RS', role: 'QC Inspector', stations: [5] },
];

// Mock cycle timeline data (7-day cycle)
const CYCLE_DAYS = [
  { day: 1, station: 'S1', label: 'Job Board', mode: 'batch' },
  { day: 2, station: 'S2', label: 'Picking', mode: 'batch' },
  { day: 3, station: 'S3', label: 'Prep & Label', mode: 'batch' },
  { day: 4, station: 'S4', label: 'Decanting', mode: 'batch' },
  { day: 5, station: 'S5', label: 'Fulfillment', mode: 'per_order' },
  { day: 6, station: 'S6', label: 'Shipping', mode: 'per_order' },
  { day: 7, station: 'Buffer', label: 'Catch-up', mode: 'buffer' },
];

export default function TaskTracker() {
  const [activeTab, setActiveTab] = useState('gantt');
  const [selectedCycleDay, setSelectedCycleDay] = useState(3); // Mock: currently on day 3

  // Data
  const { data: jobsRes } = useApiQuery(() => api.jobs.list(), []);
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: cyclesRes } = useApiQuery(() => api.subscriptions.cycles(), []);

  const jobs = (jobsRes || []) as Job[];
  const orders = (ordersRes || []) as Order[];
  const cycles = (cyclesRes || []) as SubscriptionCycle[];

  const activeCycle = cycles.find((c: any) => ['processing', 'delivering', 'collecting'].includes(c.status));

  // Jobs by station
  const jobsByStation = useMemo(() => {
    const map: Record<number, Job[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    jobs.forEach(j => {
      const station = STATUS_TO_STATION[j.status] || 1;
      if (map[station]) map[station].push(j);
    });
    return map;
  }, [jobs]);

  // Summary stats
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'shipped').length;
  const activeJobs = jobs.filter(j => !['shipped'].includes(j.status)).length;
  const totalOrders = orders.filter(o => ['new', 'processing'].includes(o.status)).length;

  // Bottleneck detection
  const bottleneckStation = useMemo(() => {
    let maxJobs = 0;
    let bottleneck = 1;
    Object.entries(jobsByStation).forEach(([station, stationJobs]) => {
      if (stationJobs.length > maxJobs) {
        maxJobs = stationJobs.length;
        bottleneck = parseInt(station);
      }
    });
    return maxJobs > 0 ? bottleneck : null;
  }, [jobsByStation]);

  // ---- Gantt Timeline View ----
  const renderGanttTimeline = () => {
    const today = selectedCycleDay;
    const cycleStartDate = new Date();
    cycleStartDate.setDate(cycleStartDate.getDate() - (today - 1));

    return (
      <div className="space-y-6">
        {/* Cycle Overview */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <p className="text-2xl font-bold">{totalJobs}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Total Jobs</p>
          </div>
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.03] text-center">
            <p className="text-2xl font-bold text-blue-600">{activeJobs}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Active</p>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
            <p className="text-2xl font-bold text-emerald-600">{completedJobs}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Shipped</p>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] text-center">
            <p className="text-2xl font-bold text-amber-600">{totalOrders}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Pending Orders</p>
          </div>
        </div>

        {/* 7-Day Gantt */}
        <SectionCard
          title="Cycle Timeline"
          subtitle={activeCycle ? `Cycle ${activeCycle.cycle_id} — Day ${today} of 7` : 'No active cycle'}
          headerActions={
            <div className="flex items-center gap-2">
              {today > 1 && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSelectedCycleDay(d => Math.max(1, d - 1))}>
                  ← Prev Day
                </Button>
              )}
              {today < 7 && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSelectedCycleDay(d => Math.min(7, d + 1))}>
                  Next Day →
                </Button>
              )}
              <StatusBadge variant={today <= 4 ? 'info' : today <= 6 ? 'gold' : 'muted'}>
                {today <= 4 ? 'Batch Phase' : today <= 6 ? 'Per-Order Phase' : 'Buffer'}
              </StatusBadge>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-0">
              {CYCLE_DAYS.map(d => {
                const dayDate = new Date(cycleStartDate);
                dayDate.setDate(dayDate.getDate() + (d.day - 1));
                const isToday = d.day === today;
                const isPast = d.day < today;
                return (
                  <button
                    key={d.day}
                    onClick={() => setSelectedCycleDay(d.day)}
                    className={cn(
                      'text-center py-2 border-b-2 transition-all cursor-pointer',
                      isToday ? 'border-gold bg-gold/5' :
                      isPast ? 'border-success/50' : 'border-border',
                    )}
                  >
                    <div className={cn('text-[10px] font-bold', isToday ? 'text-gold' : isPast ? 'text-success' : 'text-muted-foreground')}>
                      Day {d.day}
                    </div>
                    <div className="text-[9px] text-muted-foreground">{d.station}</div>
                    <div className="text-[8px] text-muted-foreground/60">
                      {dayDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Phase Bars */}
            <div className="relative space-y-1">
              {/* Batch Phase */}
              <div className="relative h-8">
                <div className="absolute left-0 top-0 h-full rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center px-3" style={{ width: `${(4/7)*100}%` }}>
                  <Boxes className="w-3 h-3 text-blue-500 mr-1.5 shrink-0" />
                  <span className="text-[10px] font-medium text-blue-700">Batch Operations (S1–S4)</span>
                  {today <= 4 && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                </div>
                <div className="absolute left-0 top-0 h-full rounded-md bg-blue-500/20 transition-all" style={{ width: `${Math.min((Math.max(today - 1, 0) / 7) * 100, (4/7)*100)}%` }} />
              </div>

              {/* Per-Order Phase */}
              <div className="relative h-8">
                <div className="absolute top-0 h-full rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center px-3" style={{ left: `${(4/7)*100}%`, width: `${(2/7)*100}%` }}>
                  <Box className="w-3 h-3 text-orange-500 mr-1.5 shrink-0" />
                  <span className="text-[10px] font-medium text-orange-700">Per-Order (S5–S6)</span>
                  {today >= 5 && today <= 6 && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
                </div>
              </div>

              {/* Buffer */}
              <div className="relative h-8">
                <div className="absolute top-0 h-full rounded-md bg-muted/30 border border-border flex items-center px-3" style={{ left: `${(6/7)*100}%`, width: `${(1/7)*100}%` }}>
                  <span className="text-[10px] font-medium text-muted-foreground">Buffer</span>
                </div>
              </div>

              {/* Today Marker */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-gold z-10" style={{ left: `${((today - 0.5) / 7) * 100}%` }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-gold border-2 border-background shadow" />
              </div>
            </div>

            {/* Station Job Distribution */}
            <div className="grid grid-cols-6 gap-2 mt-4">
              {STATIONS.map(s => {
                const Icon = s.icon;
                const stationJobs = jobsByStation[s.num] || [];
                const isBottleneck = bottleneckStation === s.num && stationJobs.length > 0;
                const isActive = s.num === today || (today <= 4 && s.num <= 4) || (today >= 5 && s.num >= 5);
                return (
                  <div key={s.num} className={cn(
                    'p-3 rounded-lg border transition-all',
                    isBottleneck ? 'border-red-500/30 bg-red-500/5' :
                    isActive ? 'border-gold/30 bg-gold/5' : 'border-border',
                  )}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className={cn('w-5 h-5 rounded flex items-center justify-center text-white', s.color)}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <span className="text-[10px] font-semibold">S{s.num}</span>
                      {isBottleneck && <AlertTriangle className="w-3 h-3 text-red-500 ml-auto" />}
                    </div>
                    <p className="text-lg font-bold">{stationJobs.length}</p>
                    <p className="text-[9px] text-muted-foreground">jobs</p>
                    <Badge variant="outline" className={cn('text-[7px] px-1 py-0 mt-1', s.mode === 'batch' ? 'border-blue-500/20 text-blue-600' : 'border-orange-500/20 text-orange-600')}>
                      {s.mode === 'batch' ? 'Batch' : 'Per-Order'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {/* Bottleneck Alert */}
        {bottleneckStation && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">Bottleneck Detected — Station {bottleneckStation}</p>
              <p className="text-xs text-red-600/80">
                {(jobsByStation[bottleneckStation] || []).length} jobs are queued at S{bottleneckStation} ({STATIONS.find(s => s.num === bottleneckStation)?.label}).
                Consider reallocating team members to clear the backlog.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---- Team Allocation View ----
  const renderTeamAllocation = () => (
    <div className="space-y-6">
      {/* Team Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.03] text-center">
          <p className="text-2xl font-bold text-violet-600">{TEAM_MEMBERS.filter(t => t.role === 'Pod Senior').length}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Pod Seniors</p>
        </div>
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
          <p className="text-2xl font-bold text-emerald-600">{TEAM_MEMBERS.filter(t => t.role === 'Pod Junior').length}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Pod Juniors</p>
        </div>
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] text-center">
          <p className="text-2xl font-bold text-amber-600">{TEAM_MEMBERS.filter(t => t.role === 'QC Inspector').length}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">QC Inspectors</p>
        </div>
      </div>

      {/* Team × Station Matrix */}
      <SectionCard title="Team × Station Matrix" subtitle="Who can work at which station — current assignments">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-2 pr-4 w-48">Team Member</th>
                {STATIONS.map(s => (
                  <th key={s.num} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-2 px-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>S{s.num}</span>
                      <span className="text-[8px] font-normal">{s.label}</span>
                    </div>
                  </th>
                ))}
                <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-2 px-2">Workload</th>
              </tr>
            </thead>
            <tbody>
              {TEAM_MEMBERS.map(member => {
                // Count jobs at member's assigned stations
                const memberWorkload = member.stations.reduce((sum, s) => sum + (jobsByStation[s]?.length || 0), 0);
                return (
                  <tr key={member.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center text-[10px] font-bold text-violet-600">
                          {member.avatar}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{member.name}</p>
                          <p className="text-[10px] text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                    </td>
                    {STATIONS.map(s => {
                      const canWork = member.stations.includes(s.num);
                      const stationJobCount = jobsByStation[s.num]?.length || 0;
                      return (
                        <td key={s.num} className="text-center py-2.5 px-2">
                          {canWork ? (
                            <div className={cn(
                              'inline-flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-bold',
                              stationJobCount > 0 ? 'bg-gold/10 text-gold border border-gold/20' : 'bg-success/10 text-success border border-success/20',
                            )}>
                              {stationJobCount > 0 ? stationJobCount : '✓'}
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[10px] text-muted-foreground/30 bg-muted/10">
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center py-2.5 px-2">
                      <div className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium',
                        memberWorkload > 3 ? 'bg-red-500/10 text-red-600' :
                        memberWorkload > 1 ? 'bg-amber-500/10 text-amber-600' :
                        'bg-emerald-500/10 text-emerald-600',
                      )}>
                        {memberWorkload > 3 ? <AlertTriangle className="w-3 h-3" /> :
                         memberWorkload > 1 ? <Timer className="w-3 h-3" /> :
                         <CheckCircle2 className="w-3 h-3" />}
                        {memberWorkload} jobs
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Capacity Utilization */}
      <SectionCard title="Station Capacity" subtitle="Jobs per station vs. available team members">
        <div className="space-y-3">
          {STATIONS.map(s => {
            const stationJobs = jobsByStation[s.num]?.length || 0;
            const availableTeam = TEAM_MEMBERS.filter(t => t.stations.includes(s.num)).length;
            const utilization = availableTeam > 0 ? (stationJobs / availableTeam) * 100 : 0;
            const Icon = s.icon;
            return (
              <div key={s.num} className="flex items-center gap-3">
                <div className={cn('w-7 h-7 rounded flex items-center justify-center text-white shrink-0', s.color)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="w-24 shrink-0">
                  <p className="text-xs font-medium">S{s.num} · {s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{availableTeam} team · {stationJobs} jobs</p>
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        utilization > 200 ? 'bg-red-500' :
                        utilization > 100 ? 'bg-amber-500' :
                        'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    />
                  </div>
                </div>
                <span className={cn(
                  'text-[10px] font-bold w-12 text-right',
                  utilization > 200 ? 'text-red-600' :
                  utilization > 100 ? 'text-amber-600' :
                  'text-emerald-600',
                )}>
                  {utilization.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );

  // ---- Job Pipeline View ----
  const renderJobPipeline = () => (
    <div className="space-y-6">
      {/* Pipeline Flow */}
      <SectionCard title="Job Pipeline" subtitle="All active jobs flowing through stations">
        <div className="space-y-4">
          {STATIONS.map(s => {
            const Icon = s.icon;
            const stationJobs = jobsByStation[s.num] || [];
            return (
              <div key={s.num} className={cn('rounded-lg border p-3', stationJobs.length > 0 ? 'border-border' : 'border-border/50 opacity-60')}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('w-6 h-6 rounded flex items-center justify-center text-white', s.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold">S{s.num} · {s.label}</span>
                  <Badge variant="outline" className={cn('text-[8px] px-1 py-0', s.mode === 'batch' ? 'border-blue-500/20 text-blue-600' : 'border-orange-500/20 text-orange-600')}>
                    {s.mode === 'batch' ? 'Batch' : 'Per-Order'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">{stationJobs.length} jobs</span>
                </div>
                {stationJobs.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {stationJobs.map(j => (
                      <div key={j.job_id} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
                        <p className="text-[10px] font-mono font-medium truncate">{j.job_id}</p>
                        <Badge variant="outline" className={cn('text-[8px] px-1 py-0 ml-auto', j.source === 'subscription' ? 'border-blue-500/30 text-blue-600' : 'border-amber-500/30 text-amber-600')}>
                          {j.source === 'subscription' ? 'SUB' : 'OT'}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground">{j.order_ids.length}ord</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground text-center py-2">No jobs at this station</p>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Task Tracker"
        subtitle="Gantt chart, team allocation, and job pipeline overview"
        breadcrumbs={[
          { label: 'Job Management' },
          { label: 'Task Tracker' },
        ]}
        actions={
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs gap-1.5 px-3 py-1.5">
              <Users className="w-3.5 h-3.5" /> {TEAM_MEMBERS.length} Team
            </Badge>
            <Badge variant="outline" className="text-xs gap-1.5 px-3 py-1.5">
              <Layers className="w-3.5 h-3.5" /> {totalJobs} Jobs
            </Badge>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gantt" className="text-xs gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Gantt Timeline
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs gap-1.5">
              <Users className="w-3.5 h-3.5" /> Team Allocation
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Job Pipeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gantt" className="mt-4">
            {renderGanttTimeline()}
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            {renderTeamAllocation()}
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            {renderJobPipeline()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
