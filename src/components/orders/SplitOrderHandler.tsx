// ============================================================
// A4 — Split Order Handling
// When an order has mixed item types (decants + sealed bottles),
// split into sub-jobs that move through stations independently
// and rejoin at S5 (Packing).
// ============================================================

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Split, Merge, Package, Droplets, Box, AlertTriangle, CheckCircle2,
  ArrowRight, GitBranch, Undo2,
} from 'lucide-react';
import type { Order, OrderItem } from '@/types';
import { toast } from 'sonner';

// ---- Types ----
export interface SubJob {
  sub_job_id: string;
  parent_order_id: string;
  type: 'decant' | 'sealed_bottle';
  items: OrderItem[];
  station: number; // current station (1-6)
  status: 'pending' | 'in_progress' | 'completed' | 'waiting_merge';
}

export interface SplitOrderState {
  order_id: string;
  is_split: boolean;
  sub_jobs: SubJob[];
  merge_ready: boolean; // all sub-jobs at S5 or completed
}

// ---- Helper: detect if order needs splitting ----
export function orderNeedsSplit(order: Order): boolean {
  const hasDecants = order.items.some(i => i.type === 'decant');
  const hasSealed = order.items.some(i => i.type === 'sealed_bottle');
  return hasDecants && hasSealed;
}

// ---- Helper: generate sub-jobs from an order ----
export function generateSubJobs(order: Order): SubJob[] {
  const decantItems = order.items.filter(i => i.type === 'decant');
  const sealedItems = order.items.filter(i => i.type === 'sealed_bottle');

  const subJobs: SubJob[] = [];

  if (decantItems.length > 0) {
    subJobs.push({
      sub_job_id: `${order.order_id}-DEC`,
      parent_order_id: order.order_id,
      type: 'decant',
      items: decantItems,
      station: 1,
      status: 'pending',
    });
  }

  if (sealedItems.length > 0) {
    subJobs.push({
      sub_job_id: `${order.order_id}-SLD`,
      parent_order_id: order.order_id,
      type: 'sealed_bottle',
      items: sealedItems,
      station: 1,
      status: 'pending',
    });
  }

  return subJobs;
}

// ---- Split Indicator Badge ----
export function SplitIndicator({ order, splitState }: {
  order: Order;
  splitState?: SplitOrderState;
}) {
  const needsSplit = orderNeedsSplit(order);

  if (!needsSplit && !splitState?.is_split) return null;

  if (splitState?.is_split) {
    const allReady = splitState.sub_jobs.every(
      sj => sj.status === 'completed' || sj.status === 'waiting_merge'
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1 text-[10px] font-semibold cursor-default',
              allReady
                ? 'border-success/40 text-success bg-success/5'
                : 'border-gold/40 text-gold bg-gold/5'
            )}
          >
            {allReady ? <Merge className="w-3 h-3" /> : <GitBranch className="w-3 h-3" />}
            {allReady ? 'Merge Ready' : `Split (${splitState.sub_jobs.length})`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs font-medium mb-1">Split Order — {splitState.sub_jobs.length} sub-jobs</p>
          {splitState.sub_jobs.map(sj => (
            <div key={sj.sub_job_id} className="flex items-center gap-2 text-xs py-0.5">
              {sj.type === 'decant' ? <Droplets className="w-3 h-3" /> : <Box className="w-3 h-3" />}
              <span className="font-mono">{sj.sub_job_id}</span>
              <span className="text-muted-foreground">· S{sj.station}</span>
              <span className={cn(
                'font-medium',
                sj.status === 'completed' ? 'text-success' : sj.status === 'in_progress' ? 'text-gold' : 'text-muted-foreground'
              )}>
                {sj.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Not yet split — show suggestion
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1 text-[10px] font-semibold border-warning/40 text-warning bg-warning/5 cursor-default">
          <Split className="w-3 h-3" />
          Mixed Items
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">This order has both decants and sealed bottles. Consider splitting for parallel processing.</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ---- Split Order Dialog ----
export function SplitOrderDialog({ order, open, onOpenChange, onSplit }: {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSplit: (subJobs: SubJob[]) => void;
}) {
  const subJobs = useMemo(() => generateSubJobs(order), [order]);

  const decantItems = order.items.filter(i => i.type === 'decant');
  const sealedItems = order.items.filter(i => i.type === 'sealed_bottle');

  const handleSplit = () => {
    onSplit(subJobs);
    onOpenChange(false);
    toast.success(`Order ${order.order_id} split into ${subJobs.length} sub-jobs`, {
      description: 'Sub-jobs will move through stations independently and merge at S5 Packing.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="w-5 h-5 text-gold" />
            Split Order {order.order_id}
          </DialogTitle>
          <DialogDescription>
            This order contains both decants and sealed bottles. Splitting creates independent sub-jobs that can be processed in parallel and merge at QC & Assembly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Decant sub-job */}
          {decantItems.length > 0 && (
            <Card className="border-info/30">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-info" />
                  Sub-Job: Decants
                  <span className="text-xs font-mono text-muted-foreground ml-auto">{order.order_id}-DEC</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="space-y-1.5">
                  {decantItems.map(item => (
                    <div key={item.item_id} className="flex items-center justify-between text-xs">
                      <span>{item.perfume_name}</span>
                      <span className="text-muted-foreground">{item.size_ml}ml × {item.qty}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
                  <span className="font-medium">Route:</span>
                  {['S1', 'S2', 'S3', 'S4', 'S5'].map((s, i) => (
                    <span key={s} className="flex items-center gap-0.5">
                      {i > 0 && <ArrowRight className="w-2.5 h-2.5" />}
                      <span className="font-mono">{s}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sealed sub-job */}
          {sealedItems.length > 0 && (
            <Card className="border-gold/30">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Box className="w-4 h-4 text-gold" />
                  Sub-Job: Sealed Bottles
                  <span className="text-xs font-mono text-muted-foreground ml-auto">{order.order_id}-SLD</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="space-y-1.5">
                  {sealedItems.map(item => (
                    <div key={item.item_id} className="flex items-center justify-between text-xs">
                      <span>{item.perfume_name}</span>
                      <span className="text-muted-foreground">{item.size_ml}ml × {item.qty}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
                  <span className="font-medium">Route:</span>
                  {['S1', 'S2', 'S5'].map((s, i) => (
                    <span key={s} className="flex items-center gap-0.5">
                      {i > 0 && <ArrowRight className="w-2.5 h-2.5" />}
                      <span className="font-mono">{s}</span>
                    </span>
                  ))}
                  <span className="text-[9px] italic ml-1">(skips S3-S4)</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Merge point */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-success/5 border border-success/20 text-xs">
            <Merge className="w-4 h-4 text-success shrink-0" />
            <span>Sub-jobs merge at <strong>Station 5 (Packing)</strong> for unified fulfillment and shipping.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSplit} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
            <Split className="w-4 h-4" />
            Split into {subJobs.length} Sub-Jobs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Sub-Job Card (for station views) ----
export function SubJobCard({ subJob, onProgress }: {
  subJob: SubJob;
  onProgress?: (subJobId: string) => void;
}) {
  const isDecant = subJob.type === 'decant';
  const totalItems = subJob.items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className={cn(
      'border rounded-lg p-3 transition-all',
      isDecant ? 'border-info/30 bg-info/5' : 'border-gold/30 bg-gold/5',
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isDecant ? <Droplets className="w-4 h-4 text-info" /> : <Box className="w-4 h-4 text-gold" />}
          <span className="text-xs font-mono font-semibold">{subJob.sub_job_id}</span>
          <Badge variant="outline" className="text-[9px]">
            {isDecant ? 'Decant Path' : 'Sealed Path'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Station {subJob.station}</span>
          {subJob.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
          {subJob.status === 'waiting_merge' && <Merge className="w-3.5 h-3.5 text-gold" />}
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        {totalItems} item{totalItems !== 1 ? 's' : ''} · {subJob.items.length} perfume{subJob.items.length !== 1 ? 's' : ''}
      </div>

      {/* Item list */}
      <div className="space-y-1">
        {subJob.items.slice(0, 3).map(item => (
          <div key={item.item_id} className="flex items-center justify-between text-[11px]">
            <span className="truncate">{item.perfume_name}</span>
            <span className="text-muted-foreground font-mono">{item.size_ml}ml×{item.qty}</span>
          </div>
        ))}
        {subJob.items.length > 3 && (
          <p className="text-[10px] text-muted-foreground italic">+{subJob.items.length - 3} more</p>
        )}
      </div>

      {onProgress && subJob.status !== 'completed' && subJob.status !== 'waiting_merge' && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2 h-7 text-xs"
          onClick={() => onProgress(subJob.sub_job_id)}
        >
          Advance to Next Station
        </Button>
      )}
    </div>
  );
}

// ---- Merge Panel (shown at S5 when sub-jobs arrive) ----
export function MergePanel({ splitState, onMerge }: {
  splitState: SplitOrderState;
  onMerge: (orderId: string) => void;
}) {
  const allReady = splitState.sub_jobs.every(
    sj => sj.status === 'completed' || sj.status === 'waiting_merge'
  );
  const readyCount = splitState.sub_jobs.filter(
    sj => sj.status === 'completed' || sj.status === 'waiting_merge'
  ).length;

  return (
    <Card className={cn(
      'border-2',
      allReady ? 'border-success/40 bg-success/5' : 'border-warning/30 bg-warning/5'
    )}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Merge className={cn('w-4 h-4', allReady ? 'text-success' : 'text-warning')} />
          Merge Point — Order {splitState.order_id}
          <Badge variant={allReady ? 'default' : 'outline'} className={cn(
            'ml-auto text-[10px]',
            allReady ? 'bg-success text-white' : ''
          )}>
            {readyCount}/{splitState.sub_jobs.length} Ready
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 space-y-2">
        {splitState.sub_jobs.map(sj => (
          <div key={sj.sub_job_id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/50 last:border-0">
            {sj.type === 'decant' ? <Droplets className="w-3.5 h-3.5 text-info" /> : <Box className="w-3.5 h-3.5 text-gold" />}
            <span className="font-mono">{sj.sub_job_id}</span>
            <span className="text-muted-foreground flex-1">{sj.items.length} items</span>
            {(sj.status === 'completed' || sj.status === 'waiting_merge') ? (
              <CheckCircle2 className="w-4 h-4 text-success" />
            ) : (
              <span className="text-warning flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                At S{sj.station}
              </span>
            )}
          </div>
        ))}

        {allReady ? (
          <Button
            className="w-full bg-success hover:bg-success/90 text-white gap-1.5"
            onClick={() => onMerge(splitState.order_id)}
          >
            <Merge className="w-4 h-4" />
            Merge & Continue to Packing
          </Button>
        ) : (
          <p className="text-xs text-warning text-center py-1">
            Waiting for all sub-jobs to arrive at Station 5 before merging.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
