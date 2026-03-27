// ============================================================
// Subscription Cycle Production — Production Center Module 3
// Unified production hub per cycle — no tier separation
// Each month has multiple cycles (e.g., 4 per month), each cycle
// combines ALL subscribers regardless of vial count into one batch
// ============================================================
import { useState, useMemo } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  RotateCcw, Users, Clock, Timer, CheckCircle2,
  AlertTriangle, Package, Search, ArrowRight, Play,
  Calendar, Beaker, Truck, Eye, Layers, Droplets,
  CalendarDays, Hash, Pause, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
type CycleStatus = 'planning' | 'in_production' | 'fulfillment' | 'completed';
type ProductionStage = 'queued' | 'picking' | 'labeling' | 'decanting' | 'compiling' | 'qc' | 'fulfillment' | 'done';

interface SubscriptionCycleItem {
  id: string;
  cycleNumber: number; // 1, 2, 3, 4 within the month
  month: string;
  year: number;
  status: CycleStatus;
  startDate: string;
  endDate: string;
  // Unified batch — all subscribers combined
  subscriberCount: number;
  totalVials: number;
  perfumes: string[];
  stage: ProductionStage;
  progress: number;
  assignedStation?: string;
  startedAt?: string;
  completedAt?: string;
  // Breakdown for visibility (not for splitting)
  vialBreakdown: { vialCount: number; subscribers: number }[];
}

// ---- Config ----
const CYCLE_STATUS_CONFIG: Record<CycleStatus, { label: string; color: string; icon: React.ElementType }> = {
  planning: { label: 'Planning', color: 'bg-slate-100 text-slate-700', icon: Calendar },
  in_production: { label: 'In Production', color: 'bg-blue-100 text-blue-700', icon: Beaker },
  fulfillment: { label: 'Fulfillment', color: 'bg-amber-100 text-amber-700', icon: Package },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

const STAGE_CONFIG: Record<ProductionStage, { label: string; color: string; step: number }> = {
  queued: { label: 'Queued', color: 'bg-slate-200', step: 0 },
  picking: { label: 'Picking', color: 'bg-blue-400', step: 1 },
  labeling: { label: 'Labeling', color: 'bg-indigo-400', step: 2 },
  decanting: { label: 'Decanting', color: 'bg-purple-400', step: 3 },
  compiling: { label: 'Compiling', color: 'bg-amber-400', step: 4 },
  qc: { label: 'QC', color: 'bg-orange-400', step: 5 },
  fulfillment: { label: 'Fulfillment', color: 'bg-emerald-400', step: 6 },
  done: { label: 'Done', color: 'bg-green-500', step: 7 },
};

const STAGES_ORDER: ProductionStage[] = ['queued', 'picking', 'labeling', 'decanting', 'compiling', 'qc', 'fulfillment', 'done'];

// ---- Mock Data ----
// March 2026: 4 cycles per month
const mockCycles: SubscriptionCycleItem[] = [
  {
    id: 'CYC-2026-03-W1',
    cycleNumber: 1,
    month: 'March',
    year: 2026,
    status: 'in_production',
    startDate: '2026-03-01',
    endDate: '2026-03-07',
    subscriberCount: 297,
    totalVials: 1341,
    perfumes: ['Baccarat Rouge 540', 'Aventus', 'Oud Wood', 'Layton', 'Lost Cherry', 'Sauvage Elixir', 'Tobacco Vanille', 'Rehab'],
    stage: 'decanting',
    progress: 52,
    assignedStation: 'S4',
    startedAt: '2026-02-25',
    vialBreakdown: [
      { vialCount: 3, subscribers: 180 },
      { vialCount: 5, subscribers: 85 },
      { vialCount: 8, subscribers: 32 },
    ],
  },
  {
    id: 'CYC-2026-03-W2',
    cycleNumber: 2,
    month: 'March',
    year: 2026,
    status: 'planning',
    startDate: '2026-03-08',
    endDate: '2026-03-14',
    subscriberCount: 305,
    totalVials: 1380,
    perfumes: ['Interlude Man', 'Delina', 'Grand Soir', 'Oud Satin Mood', 'Tuscan Leather', 'Green Irish Tweed', 'Viking', 'Layton'],
    stage: 'queued',
    progress: 0,
    vialBreakdown: [
      { vialCount: 3, subscribers: 185 },
      { vialCount: 5, subscribers: 88 },
      { vialCount: 8, subscribers: 32 },
    ],
  },
  {
    id: 'CYC-2026-03-W3',
    cycleNumber: 3,
    month: 'March',
    year: 2026,
    status: 'planning',
    startDate: '2026-03-15',
    endDate: '2026-03-21',
    subscriberCount: 310,
    totalVials: 1405,
    perfumes: [],
    stage: 'queued',
    progress: 0,
    vialBreakdown: [
      { vialCount: 3, subscribers: 190 },
      { vialCount: 5, subscribers: 86 },
      { vialCount: 8, subscribers: 34 },
    ],
  },
  {
    id: 'CYC-2026-03-W4',
    cycleNumber: 4,
    month: 'March',
    year: 2026,
    status: 'planning',
    startDate: '2026-03-22',
    endDate: '2026-03-31',
    subscriberCount: 298,
    totalVials: 1350,
    perfumes: [],
    stage: 'queued',
    progress: 0,
    vialBreakdown: [
      { vialCount: 3, subscribers: 182 },
      { vialCount: 5, subscribers: 84 },
      { vialCount: 8, subscribers: 32 },
    ],
  },
  // February completed
  {
    id: 'CYC-2026-02-W1',
    cycleNumber: 1,
    month: 'February',
    year: 2026,
    status: 'completed',
    startDate: '2026-02-01',
    endDate: '2026-02-07',
    subscriberCount: 278,
    totalVials: 1244,
    perfumes: ['Aventus', 'Layton', 'Baccarat Rouge 540', 'Oud Wood', 'Sauvage Elixir', 'Lost Cherry'],
    stage: 'done',
    progress: 100,
    startedAt: '2026-01-25',
    completedAt: '2026-02-03',
    vialBreakdown: [
      { vialCount: 3, subscribers: 172 },
      { vialCount: 5, subscribers: 78 },
      { vialCount: 8, subscribers: 28 },
    ],
  },
  {
    id: 'CYC-2026-02-W2',
    cycleNumber: 2,
    month: 'February',
    year: 2026,
    status: 'completed',
    startDate: '2026-02-08',
    endDate: '2026-02-14',
    subscriberCount: 280,
    totalVials: 1256,
    perfumes: ['Tobacco Vanille', 'Rehab', 'Interlude Man', 'Delina', 'Grand Soir', 'Oud Satin Mood'],
    stage: 'done',
    progress: 100,
    startedAt: '2026-02-02',
    completedAt: '2026-02-10',
    vialBreakdown: [
      { vialCount: 3, subscribers: 174 },
      { vialCount: 5, subscribers: 78 },
      { vialCount: 8, subscribers: 28 },
    ],
  },
];

// ---- Helpers ----
const monthGroups = (cycles: SubscriptionCycleItem[]) => {
  const groups = new Map<string, SubscriptionCycleItem[]>();
  for (const c of cycles) {
    const key = `${c.month} ${c.year}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  return groups;
};

// ---- Component ----
export default function SubscriptionCycleProduction() {
  const [selectedMonth, setSelectedMonth] = useState<string>('March 2026');
  const [detailCycle, setDetailCycle] = useState<SubscriptionCycleItem | null>(null);

  const grouped = useMemo(() => monthGroups(mockCycles), []);
  const months = Array.from(grouped.keys());
  const currentCycles = grouped.get(selectedMonth) || [];

  // Month-level stats
  const monthStats = useMemo(() => {
    const totalSubs = currentCycles.reduce((s, c) => s + c.subscriberCount, 0);
    const totalVials = currentCycles.reduce((s, c) => s + c.totalVials, 0);
    const avgProgress = currentCycles.length > 0 ? Math.round(currentCycles.reduce((s, c) => s + c.progress, 0) / currentCycles.length) : 0;
    const completedCycles = currentCycles.filter(c => c.status === 'completed').length;
    const totalMl = totalVials * 8; // 8ml per vial
    return { totalSubs, totalVials, avgProgress, completedCycles, totalCycles: currentCycles.length, totalMl };
  }, [currentCycles]);

  const handleAdvanceCycle = (cycle: SubscriptionCycleItem) => {
    const currentIdx = STAGES_ORDER.indexOf(cycle.stage);
    if (currentIdx < STAGES_ORDER.length - 1) {
      toast.success(`Cycle ${cycle.cycleNumber} advanced to ${STAGE_CONFIG[STAGES_ORDER[currentIdx + 1]].label}`);
    }
  };

  const handleStartCycle = (cycle: SubscriptionCycleItem) => {
    toast.success(`Cycle ${cycle.cycleNumber} production started — ${cycle.subscriberCount} subscribers, ${cycle.totalVials} vials`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Cycle Production"
        subtitle="Unified production hub per cycle — all subscribers combined into one batch"
      />

      {/* Month Selector + KPIs */}
      <div className="flex flex-wrap items-center gap-4 mb-2">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-64 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => {
              const cycles = grouped.get(m) || [];
              const completed = cycles.filter(c => c.status === 'completed').length;
              return (
                <SelectItem key={m} value={m}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{m}</span>
                    <Badge className="text-[10px] ml-2 bg-muted text-muted-foreground">
                      {completed}/{cycles.length} done
                    </Badge>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-xs gap-1">
          <CalendarDays className="w-3 h-3" />
          {currentCycles.length} cycles this month
        </Badge>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50"><Users className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{monthStats.totalSubs.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Subscribers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-50"><Package className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold">{monthStats.totalVials.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Vials</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-50"><Droplets className="w-5 h-5 text-indigo-600" /></div>
              <div>
                <p className="text-2xl font-bold">{(monthStats.totalMl / 1000).toFixed(1)}L</p>
                <p className="text-xs text-muted-foreground">Total Liquid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50"><Timer className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">{monthStats.avgProgress}%</p>
                <p className="text-xs text-muted-foreground">Avg Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{monthStats.completedCycles}/{monthStats.totalCycles}</p>
                <p className="text-xs text-muted-foreground">Cycles Done</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cycle Cards — One card per cycle */}
      <SectionCard title={`${selectedMonth} — Production Cycles`} subtitle="Each cycle is one unified production batch combining all subscribers">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {currentCycles.sort((a, b) => a.cycleNumber - b.cycleNumber).map(cycle => {
            const statusCfg = CYCLE_STATUS_CONFIG[cycle.status];
            const StatusIcon = statusCfg.icon;
            const stageCfg = STAGE_CONFIG[cycle.stage];
            const stageIdx = STAGES_ORDER.indexOf(cycle.stage);

            return (
              <Card key={cycle.id} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        C{cycle.cycleNumber}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Cycle {cycle.cycleNumber}</h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(cycle.startDate).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })} — {new Date(cycle.endDate).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={cn('text-[10px]', statusCfg.color)}>
                        {statusCfg.label}
                      </Badge>
                      <Badge className={cn('text-[10px]', stageCfg.color === 'bg-slate-200' ? 'bg-slate-100 text-slate-700' : `${stageCfg.color} text-white`)}>
                        {stageCfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Unified Stats */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{cycle.subscriberCount}</p>
                      <p className="text-[10px] text-muted-foreground">Subscribers</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{cycle.totalVials.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Vials</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{(cycle.totalVials * 8 / 1000).toFixed(1)}L</p>
                      <p className="text-[10px] text-muted-foreground">Liquid</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{cycle.perfumes.length || '—'}</p>
                      <p className="text-[10px] text-muted-foreground">Perfumes</p>
                    </div>
                  </div>

                  {/* Vial Breakdown (informational, not for splitting) */}
                  {cycle.vialBreakdown.length > 0 && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-muted-foreground">Breakdown:</span>
                      {cycle.vialBreakdown.map((b, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-muted font-medium">
                          {b.subscribers} × {b.vialCount} vials
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Production Pipeline */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Production Pipeline</span>
                      <span className="font-medium">{cycle.progress}%</span>
                    </div>
                    <div className="flex gap-0.5">
                      {STAGES_ORDER.slice(0, -1).map((s, i) => (
                        <div
                          key={s}
                          className={cn(
                            'h-2 flex-1 rounded-sm transition-colors',
                            i < stageIdx ? 'bg-emerald-400' : i === stageIdx ? 'bg-blue-500 animate-pulse' : 'bg-muted',
                          )}
                          title={STAGE_CONFIG[s].label}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>Pick</span>
                      <span>Label</span>
                      <span>Decant</span>
                      <span>Compile</span>
                      <span>QC</span>
                      <span>Fulfill</span>
                      <span>Done</span>
                    </div>
                  </div>

                  {/* Perfumes Preview */}
                  {cycle.perfumes.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5">Rotation ({cycle.perfumes.length} perfumes)</p>
                      <div className="flex flex-wrap gap-1">
                        {cycle.perfumes.slice(0, 4).map(p => (
                          <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium">{p}</span>
                        ))}
                        {cycle.perfumes.length > 4 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{cycle.perfumes.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => setDetailCycle(cycle)}>
                      <Eye className="w-3 h-3" /> Details
                    </Button>
                    {cycle.stage !== 'done' && cycle.stage !== 'queued' && (
                      <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => handleAdvanceCycle(cycle)}>
                        Advance <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                    {cycle.stage === 'queued' && cycle.status !== 'planning' && (
                      <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => handleStartCycle(cycle)}>
                        <Play className="w-3 h-3" /> Start Production
                      </Button>
                    )}
                  </div>

                  {/* Timestamps */}
                  {(cycle.startedAt || cycle.completedAt) && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t">
                      {cycle.startedAt && <span>Started: {new Date(cycle.startedAt).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}</span>}
                      {cycle.completedAt && <span>Completed: {new Date(cycle.completedAt).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SectionCard>

      {/* Cycle Detail Dialog */}
      <Dialog open={!!detailCycle} onOpenChange={() => setDetailCycle(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                C{detailCycle?.cycleNumber}
              </div>
              Cycle {detailCycle?.cycleNumber} — {detailCycle?.month} {detailCycle?.year}
            </DialogTitle>
            <DialogDescription>
              Production hub for cycle {detailCycle?.id}
            </DialogDescription>
          </DialogHeader>
          {detailCycle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Subscribers</p>
                  <p className="font-bold text-lg">{detailCycle.subscriberCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Vials</p>
                  <p className="font-bold text-lg">{detailCycle.totalVials.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Liquid (8ml/vial)</p>
                  <p className="font-bold text-lg">{(detailCycle.totalVials * 8).toLocaleString()} ml</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date Range</p>
                  <p className="font-bold text-sm">
                    {new Date(detailCycle.startDate).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })} — {new Date(detailCycle.endDate).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Vial Breakdown */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Subscriber Vial Breakdown</p>
                <div className="space-y-1.5">
                  {detailCycle.vialBreakdown.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/50">
                      <span className="font-medium">{b.subscribers} subscribers</span>
                      <span className="text-muted-foreground">× {b.vialCount} vials = {(b.subscribers * b.vialCount).toLocaleString()} vials</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Stage</p>
                <Badge className={cn('text-xs', STAGE_CONFIG[detailCycle.stage].color === 'bg-slate-200' ? 'bg-slate-100 text-slate-700' : `${STAGE_CONFIG[detailCycle.stage].color} text-white`)}>
                  {STAGE_CONFIG[detailCycle.stage].label}
                </Badge>
                {detailCycle.assignedStation && (
                  <Badge variant="outline" className="text-xs ml-2">{detailCycle.assignedStation}</Badge>
                )}
              </div>

              {detailCycle.perfumes.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Perfume Rotation ({detailCycle.perfumes.length})</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {detailCycle.perfumes.map((p, i) => (
                      <div key={i} className="text-xs px-2.5 py-1.5 rounded-md bg-muted/50 font-medium">{p}</div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-2">Progress</p>
                <Progress value={detailCycle.progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{detailCycle.progress}% complete</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailCycle(null)}>Close</Button>
            {detailCycle && detailCycle.stage !== 'done' && (
              <Button onClick={() => { handleAdvanceCycle(detailCycle); setDetailCycle(null); }}>
                Advance Stage <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
