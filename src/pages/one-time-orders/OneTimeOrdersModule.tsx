// ============================================================
// One-Time Orders — Production Planning Module
// Overview of one-time order batches and their progress
// Daily cutoff → jobs flow to Job Management → work at Pod Operations → Fulfillment → Shipping
// This is a PLANNING view — actual production work is at the stations
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ShoppingCart, Key, RefreshCw, Wind, Clock, CheckCircle2,
  AlertTriangle, Package, ArrowRight, Calendar, Truck,
  Layers, Tag, FlaskConical, Box, PackageCheck,
  BarChart3, ExternalLink, Scissors, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

// ---- Pipeline Stages (for progress visualization only) ----
const ALL_STAGES = [
  { id: 'picking', label: 'Picking', short: 'S2', icon: Package, color: 'bg-amber-500' },
  { id: 'labeling', label: 'Labeling', short: 'S3', icon: Tag, color: 'bg-blue-500' },
  { id: 'decanting', label: 'Decanting', short: 'S4', icon: FlaskConical, color: 'bg-purple-500' },
  { id: 'assembly', label: 'Assembly', short: 'S5', icon: Layers, color: 'bg-orange-500' },
  { id: 'fulfillment', label: 'Fulfillment', short: 'S5', icon: PackageCheck, color: 'bg-cyan-500' },
  { id: 'shipping', label: 'Shipping', short: 'S6', icon: Truck, color: 'bg-emerald-500' },
] as const;

type StageId = typeof ALL_STAGES[number]['id'];
type OrderCategory = 'aurakey' | 'aurakey_refill' | 'whisper' | 'first_sub';
type BatchStatus = 'pending_cutoff' | 'ready' | 'in_production' | 'fulfillment' | 'shipping' | 'completed';

interface DailyBatch {
  id: string;
  date: string;
  cutoffTime: string;
  status: BatchStatus;
  orderCount: number;
  completedOrders: number;
  currentStage: StageId;
  jobRef?: string;
  categories: { type: OrderCategory; count: number }[];
}

const CATEGORY_CONFIG: Record<OrderCategory, { label: string; icon: React.ElementType; color: string }> = {
  aurakey: { label: 'AuraKey', icon: Key, color: 'text-purple-600' },
  aurakey_refill: { label: 'AuraKey Refill', icon: RefreshCw, color: 'text-emerald-600' },
  whisper: { label: 'Whisper Vials', icon: Wind, color: 'text-blue-600' },
  first_sub: { label: 'First-Time Sub', icon: ShoppingCart, color: 'text-amber-600' },
};

const STATUS_CONFIG: Record<BatchStatus, { label: string; color: string }> = {
  pending_cutoff: { label: 'Pending Cutoff', color: 'bg-slate-100 text-slate-700' },
  ready: { label: 'Ready', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'In Production', color: 'bg-amber-100 text-amber-700' },
  fulfillment: { label: 'Fulfillment', color: 'bg-cyan-100 text-cyan-700' },
  shipping: { label: 'Shipping', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
};

// ---- Mock Data ----
const mockBatches: DailyBatch[] = [
  {
    id: 'OT-2026-02-28', date: '2026-02-28', cutoffTime: '14:00',
    status: 'in_production', orderCount: 34, completedOrders: 18, currentStage: 'decanting',
    jobRef: 'JOB-2026-0047',
    categories: [
      { type: 'aurakey', count: 8 }, { type: 'aurakey_refill', count: 12 },
      { type: 'whisper', count: 6 }, { type: 'first_sub', count: 8 },
    ],
  },
  {
    id: 'OT-2026-02-27', date: '2026-02-27', cutoffTime: '14:00',
    status: 'shipping', orderCount: 28, completedOrders: 24, currentStage: 'shipping',
    jobRef: 'JOB-2026-0044',
    categories: [
      { type: 'aurakey', count: 5 }, { type: 'aurakey_refill', count: 10 },
      { type: 'whisper', count: 8 }, { type: 'first_sub', count: 5 },
    ],
  },
  {
    id: 'OT-2026-03-01', date: '2026-03-01', cutoffTime: '14:00',
    status: 'pending_cutoff', orderCount: 12, completedOrders: 0, currentStage: 'picking',
    categories: [
      { type: 'aurakey', count: 4 }, { type: 'aurakey_refill', count: 3 },
      { type: 'whisper', count: 2 }, { type: 'first_sub', count: 3 },
    ],
  },
  {
    id: 'OT-2026-02-26', date: '2026-02-26', cutoffTime: '14:00',
    status: 'completed', orderCount: 31, completedOrders: 31, currentStage: 'shipping',
    jobRef: 'JOB-2026-0041',
    categories: [
      { type: 'aurakey', count: 7 }, { type: 'aurakey_refill', count: 11 },
      { type: 'whisper', count: 5 }, { type: 'first_sub', count: 8 },
    ],
  },
];

export default function OneTimeOrdersModule() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<DailyBatch | null>(null);

  const filteredBatches = useMemo(() => {
    return mockBatches.filter(b => statusFilter === 'all' || b.status === statusFilter);
  }, [statusFilter]);

  const stats = useMemo(() => ({
    active: mockBatches.filter(b => b.status === 'in_production').length,
    ready: mockBatches.filter(b => b.status === 'ready' || b.status === 'pending_cutoff').length,
    totalOrders: mockBatches.filter(b => b.status !== 'completed').reduce((s, b) => s + b.orderCount, 0),
    todayOrders: mockBatches.filter(b => b.date === '2026-02-28').reduce((s, b) => s + b.orderCount, 0),
  }), []);

  const getStageIndex = (stage: StageId) => ALL_STAGES.findIndex(s => s.id === stage);

  return (
    <div className="space-y-6">
      <PageHeader
        title="One-Time Orders"
        subtitle="Plan and track daily order batches — AuraKey, Refills, Whisper Vials, First-Time Subscriptions"
      />

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-purple-200/60 bg-purple-50/40">
        <ShoppingCart className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-purple-800">Order Queue & Tracking</p>
          <p className="text-purple-700/70 mt-0.5">
            Orders accumulate until the daily cutoff (2:00 PM), then batch into production jobs.
            Jobs flow to{' '}
            <Link href="/jobs/allocation" className="underline font-medium">Job Management</Link>{' '}
            for station allocation. Track progress through{' '}
            <Link href="/ops/pod-dashboard" className="underline font-medium">Pod Operations</Link>{' '}
            → Fulfillment → Shipping.
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-amber-200/50 bg-amber-50/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-700">{stats.active}</div>
            <div className="text-xs text-muted-foreground mt-1">In Production</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200/50 bg-blue-50/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{stats.ready}</div>
            <div className="text-xs text-muted-foreground mt-1">Pending / Ready</div>
          </CardContent>
        </Card>
        <Card className="border-purple-200/50 bg-purple-50/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">{stats.totalOrders}</div>
            <div className="text-xs text-muted-foreground mt-1">Active Orders</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/50 bg-emerald-50/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">{stats.todayOrders}</div>
            <div className="text-xs text-muted-foreground mt-1">Today's Orders</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending_cutoff">Pending Cutoff</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="in_production">In Production</SelectItem>
            <SelectItem value="fulfillment">Fulfillment</SelectItem>
            <SelectItem value="shipping">Shipping</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch Cards */}
      <div className="space-y-3">
        {filteredBatches.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No batches found" description="Adjust your filters to see order batches." />
        ) : (
          filteredBatches.map(batch => {
            const stageIdx = getStageIndex(batch.currentStage);
            const progress = batch.orderCount > 0 ? Math.round((batch.completedOrders / batch.orderCount) * 100) : 0;
            const dateStr = new Date(batch.date).toLocaleDateString('en-AE', { weekday: 'short', month: 'short', day: 'numeric' });
            return (
              <Card key={batch.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedBatch(batch)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{batch.id}</span>
                        <Badge variant="outline" className={cn('text-[10px]', STATUS_CONFIG[batch.status].color)}>
                          {STATUS_CONFIG[batch.status].label}
                        </Badge>
                        {batch.jobRef && (
                          <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-600">
                            {batch.jobRef}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm">{dateStr}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        {batch.categories.map(cat => {
                          const config = CATEGORY_CONFIG[cat.type];
                          const CatIcon = config.icon;
                          return (
                            <span key={cat.type} className={cn('flex items-center gap-1 text-[10px]', config.color)}>
                              <CatIcon className="w-3 h-3" /> {cat.count}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{batch.orderCount}</div>
                      <div className="text-[10px] text-muted-foreground">orders</div>
                    </div>
                  </div>

                  {/* Pipeline Progress (read-only) */}
                  {batch.status !== 'pending_cutoff' && batch.status !== 'ready' && (
                    <div className="flex items-center gap-1 mb-2">
                      {ALL_STAGES.map((stage, idx) => {
                        const StageIcon = stage.icon;
                        const isComplete = idx < stageIdx;
                        const isCurrent = idx === stageIdx;
                        return (
                          <div key={stage.id} className="flex items-center gap-1 flex-1">
                            <div className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                              isComplete ? 'bg-emerald-500 text-white' : isCurrent ? `${stage.color} text-white` : 'bg-muted text-muted-foreground',
                            )}>
                              {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : <StageIcon className="w-3 h-3" />}
                            </div>
                            {idx < ALL_STAGES.length - 1 && (
                              <div className={cn('h-0.5 flex-1', isComplete ? 'bg-emerald-500' : 'bg-muted')} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="flex-1 h-2" />
                    <span className="text-xs font-medium text-muted-foreground">{batch.completedOrders}/{batch.orderCount}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Batch Detail Dialog */}
      <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-500" />
              {selectedBatch && new Date(selectedBatch.date).toLocaleDateString('en-AE', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </DialogTitle>
            <DialogDescription>{selectedBatch?.id} · Cutoff: {selectedBatch?.cutoffTime}</DialogDescription>
          </DialogHeader>
          {selectedBatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-[10px] text-muted-foreground">Total Orders</div>
                  <div className="text-lg font-bold">{selectedBatch.orderCount}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-[10px] text-muted-foreground">Completed</div>
                  <div className="text-lg font-bold text-emerald-600">{selectedBatch.completedOrders}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-[10px] text-muted-foreground">Current Stage</div>
                  <div className="text-sm font-semibold mt-1">{ALL_STAGES.find(s => s.id === selectedBatch.currentStage)?.label || 'N/A'}</div>
                </div>
              </div>

              {/* Category breakdown */}
              <div>
                <h4 className="text-xs font-semibold mb-2">Order Categories</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedBatch.categories.map(cat => {
                    const config = CATEGORY_CONFIG[cat.type];
                    const CatIcon = config.icon;
                    return (
                      <div key={cat.type} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <CatIcon className={cn('w-4 h-4', config.color)} />
                        <span className="text-xs font-medium">{config.label}</span>
                        <span className="ml-auto text-sm font-bold">{cat.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedBatch.jobRef && (
                <div className="p-3 rounded-lg border border-violet-200/60 bg-violet-50/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-500" />
                      <span className="text-xs">Job Reference: <strong>{selectedBatch.jobRef}</strong></span>
                    </div>
                    <Link href="/jobs/allocation">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-violet-600">
                        View in Job Management <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Pipeline visualization (read-only) */}
              <div>
                <h4 className="text-xs font-semibold mb-2">Pipeline Progress</h4>
                <div className="flex items-center gap-1">
                  {ALL_STAGES.map((stage, idx) => {
                    const stageIdx = getStageIndex(selectedBatch.currentStage);
                    const isComplete = idx < stageIdx;
                    const isCurrent = idx === stageIdx;
                    const StageIcon = stage.icon;
                    return (
                      <div key={stage.id} className="flex items-center gap-1 flex-1">
                        <div className="flex flex-col items-center gap-1">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            isComplete ? 'bg-emerald-500 text-white' : isCurrent ? `${stage.color} text-white ring-2 ring-offset-2 ring-purple-300` : 'bg-muted text-muted-foreground',
                          )}>
                            {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <StageIcon className="w-3.5 h-3.5" />}
                          </div>
                          <span className={cn('text-[9px]', isCurrent ? 'font-bold' : 'text-muted-foreground')}>{stage.label}</span>
                        </div>
                        {idx < ALL_STAGES.length - 1 && (
                          <div className={cn('h-0.5 flex-1 mt-[-12px]', isComplete ? 'bg-emerald-500' : 'bg-muted')} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBatch(null)}>Close</Button>
            {selectedBatch?.status === 'ready' && (
              <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5" onClick={() => {
                toast.success(`Batch ${selectedBatch.id} sent to Job Management for allocation`);
                setSelectedBatch(null);
              }}>
                <ArrowRight className="w-4 h-4" /> Send to Job Management
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
