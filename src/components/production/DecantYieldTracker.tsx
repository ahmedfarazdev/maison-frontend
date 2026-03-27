// ============================================================
// C5 — Decant Yield Tracking
// Track actual vs expected ML per decant. Calculate yield %,
// waste, and operator accuracy. Dashboard widget + detail view.
// ============================================================

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Droplets, TrendingUp, TrendingDown, AlertTriangle, Target,
  User, BarChart3, Info, Minus, Beaker,
} from 'lucide-react';

// ---- Types ----
export interface DecantRecord {
  decant_id: string;
  job_id: string;
  bottle_id: string;
  perfume_name: string;
  operator_name: string;
  expected_ml: number;
  actual_ml: number;
  waste_ml: number;
  yield_pct: number;
  timestamp: string;
}

export interface YieldSummary {
  total_decants: number;
  total_expected_ml: number;
  total_actual_ml: number;
  total_waste_ml: number;
  avg_yield_pct: number;
  best_operator: { name: string; yield_pct: number };
  worst_operator: { name: string; yield_pct: number };
  by_operator: OperatorYield[];
  by_perfume: PerfumeYield[];
}

export interface OperatorYield {
  operator_name: string;
  decant_count: number;
  total_expected_ml: number;
  total_actual_ml: number;
  total_waste_ml: number;
  avg_yield_pct: number;
}

export interface PerfumeYield {
  perfume_name: string;
  decant_count: number;
  total_expected_ml: number;
  total_actual_ml: number;
  total_waste_ml: number;
  avg_yield_pct: number;
}

// ---- Mock decant records ----
const mockDecantRecords: DecantRecord[] = [
  { decant_id: 'DEC-001', job_id: 'JOB-101', bottle_id: 'BTL-001', perfume_name: 'Baccarat Rouge 540', operator_name: 'Khalid', expected_ml: 5, actual_ml: 4.8, waste_ml: 0.2, yield_pct: 96, timestamp: '2025-02-14T09:00:00Z' },
  { decant_id: 'DEC-002', job_id: 'JOB-101', bottle_id: 'BTL-001', perfume_name: 'Baccarat Rouge 540', operator_name: 'Khalid', expected_ml: 10, actual_ml: 9.5, waste_ml: 0.5, yield_pct: 95, timestamp: '2025-02-14T09:05:00Z' },
  { decant_id: 'DEC-003', job_id: 'JOB-102', bottle_id: 'BTL-005', perfume_name: 'Oud Wood', operator_name: 'Sara', expected_ml: 5, actual_ml: 5.0, waste_ml: 0, yield_pct: 100, timestamp: '2025-02-14T09:10:00Z' },
  { decant_id: 'DEC-004', job_id: 'JOB-102', bottle_id: 'BTL-005', perfume_name: 'Oud Wood', operator_name: 'Sara', expected_ml: 8, actual_ml: 7.6, waste_ml: 0.4, yield_pct: 95, timestamp: '2025-02-14T09:15:00Z' },
  { decant_id: 'DEC-005', job_id: 'JOB-103', bottle_id: 'BTL-010', perfume_name: 'Lost Cherry', operator_name: 'Ahmed', expected_ml: 5, actual_ml: 4.5, waste_ml: 0.5, yield_pct: 90, timestamp: '2025-02-14T09:20:00Z' },
  { decant_id: 'DEC-006', job_id: 'JOB-103', bottle_id: 'BTL-010', perfume_name: 'Lost Cherry', operator_name: 'Ahmed', expected_ml: 10, actual_ml: 9.0, waste_ml: 1.0, yield_pct: 90, timestamp: '2025-02-14T09:25:00Z' },
  { decant_id: 'DEC-007', job_id: 'JOB-104', bottle_id: 'BTL-002', perfume_name: 'Aventus', operator_name: 'Khalid', expected_ml: 5, actual_ml: 4.9, waste_ml: 0.1, yield_pct: 98, timestamp: '2025-02-14T09:30:00Z' },
  { decant_id: 'DEC-008', job_id: 'JOB-105', bottle_id: 'BTL-008', perfume_name: 'Tobacco Vanille', operator_name: 'Sara', expected_ml: 10, actual_ml: 9.8, waste_ml: 0.2, yield_pct: 98, timestamp: '2025-02-14T09:35:00Z' },
];

// ---- Helper: calculate yield summary ----
export function calculateYieldSummary(records: DecantRecord[]): YieldSummary {
  const totalExpected = records.reduce((s, r) => s + r.expected_ml, 0);
  const totalActual = records.reduce((s, r) => s + r.actual_ml, 0);
  const totalWaste = records.reduce((s, r) => s + r.waste_ml, 0);
  const avgYield = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 0;

  // By operator
  const opMap = new Map<string, DecantRecord[]>();
  records.forEach(r => {
    const arr = opMap.get(r.operator_name) || [];
    arr.push(r);
    opMap.set(r.operator_name, arr);
  });

  const byOperator: OperatorYield[] = Array.from(opMap.entries()).map(([name, recs]) => {
    const exp = recs.reduce((s, r) => s + r.expected_ml, 0);
    const act = recs.reduce((s, r) => s + r.actual_ml, 0);
    const waste = recs.reduce((s, r) => s + r.waste_ml, 0);
    return {
      operator_name: name,
      decant_count: recs.length,
      total_expected_ml: exp,
      total_actual_ml: act,
      total_waste_ml: waste,
      avg_yield_pct: exp > 0 ? (act / exp) * 100 : 0,
    };
  }).sort((a, b) => b.avg_yield_pct - a.avg_yield_pct);

  // By perfume
  const perfMap = new Map<string, DecantRecord[]>();
  records.forEach(r => {
    const arr = perfMap.get(r.perfume_name) || [];
    arr.push(r);
    perfMap.set(r.perfume_name, arr);
  });

  const byPerfume: PerfumeYield[] = Array.from(perfMap.entries()).map(([name, recs]) => {
    const exp = recs.reduce((s, r) => s + r.expected_ml, 0);
    const act = recs.reduce((s, r) => s + r.actual_ml, 0);
    const waste = recs.reduce((s, r) => s + r.waste_ml, 0);
    return {
      perfume_name: name,
      decant_count: recs.length,
      total_expected_ml: exp,
      total_actual_ml: act,
      total_waste_ml: waste,
      avg_yield_pct: exp > 0 ? (act / exp) * 100 : 0,
    };
  }).sort((a, b) => b.avg_yield_pct - a.avg_yield_pct);

  return {
    total_decants: records.length,
    total_expected_ml: totalExpected,
    total_actual_ml: totalActual,
    total_waste_ml: totalWaste,
    avg_yield_pct: avgYield,
    best_operator: byOperator[0] ? { name: byOperator[0].operator_name, yield_pct: byOperator[0].avg_yield_pct } : { name: 'N/A', yield_pct: 0 },
    worst_operator: byOperator.length > 0 ? { name: byOperator[byOperator.length - 1].operator_name, yield_pct: byOperator[byOperator.length - 1].avg_yield_pct } : { name: 'N/A', yield_pct: 0 },
    by_operator: byOperator,
    by_perfume: byPerfume,
  };
}

// ---- Yield Indicator ----
function YieldIndicator({ pct, size = 'sm' }: { pct: number; size?: 'sm' | 'md' }) {
  const color = pct >= 97 ? 'text-success' : pct >= 93 ? 'text-gold' : pct >= 88 ? 'text-warning' : 'text-destructive';
  const Icon = pct >= 95 ? TrendingUp : pct >= 90 ? Minus : TrendingDown;
  return (
    <span className={cn('flex items-center gap-0.5 font-semibold', color, size === 'md' ? 'text-sm' : 'text-xs')}>
      <Icon className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
      {pct.toFixed(1)}%
    </span>
  );
}

// ---- Record Decant Dialog ----
export function RecordDecantDialog({ open, onOpenChange, onRecord }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecord: (record: DecantRecord) => void;
}) {
  const [expectedMl, setExpectedMl] = useState('');
  const [actualMl, setActualMl] = useState('');
  const [perfumeName, setPerfumeName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [bottleId, setBottleId] = useState('');
  const [jobId, setJobId] = useState('');

  const waste = parseFloat(expectedMl || '0') - parseFloat(actualMl || '0');
  const yieldPct = parseFloat(expectedMl || '0') > 0
    ? (parseFloat(actualMl || '0') / parseFloat(expectedMl || '0')) * 100
    : 0;

  const handleSubmit = () => {
    const record: DecantRecord = {
      decant_id: `DEC-${Date.now().toString().slice(-6)}`,
      job_id: jobId || 'JOB-MANUAL',
      bottle_id: bottleId || 'BTL-MANUAL',
      perfume_name: perfumeName,
      operator_name: operatorName,
      expected_ml: parseFloat(expectedMl),
      actual_ml: parseFloat(actualMl),
      waste_ml: Math.max(0, waste),
      yield_pct: Math.min(100, yieldPct),
      timestamp: new Date().toISOString(),
    };
    onRecord(record);
    onOpenChange(false);
    setExpectedMl(''); setActualMl(''); setPerfumeName(''); setOperatorName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="w-5 h-5 text-gold" />
            Record Decant Yield
          </DialogTitle>
          <DialogDescription>
            Log actual vs expected ML for yield tracking.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Perfume</label>
              <Input value={perfumeName} onChange={e => setPerfumeName(e.target.value)} placeholder="e.g. Baccarat Rouge 540" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Operator</label>
              <Input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="e.g. Khalid" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bottle ID</label>
              <Input value={bottleId} onChange={e => setBottleId(e.target.value)} placeholder="BTL-XXX" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Job ID</label>
              <Input value={jobId} onChange={e => setJobId(e.target.value)} placeholder="JOB-XXX" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected ML</label>
              <Input type="number" step="0.1" value={expectedMl} onChange={e => setExpectedMl(e.target.value)} placeholder="5.0" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual ML</label>
              <Input type="number" step="0.1" value={actualMl} onChange={e => setActualMl(e.target.value)} placeholder="4.8" />
            </div>
          </div>
          {expectedMl && actualMl && (
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 text-xs">
              <span>Waste: <span className={cn('font-mono font-medium', waste > 0.5 ? 'text-destructive' : 'text-muted-foreground')}>{Math.max(0, waste).toFixed(1)} ml</span></span>
              <span>Yield: <YieldIndicator pct={Math.min(100, yieldPct)} /></span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!expectedMl || !actualMl || !perfumeName || !operatorName}
            className="bg-gold hover:bg-gold/90 text-gold-foreground"
          >
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Yield Dashboard Widget ----
export function DecantYieldWidget() {
  const summary = useMemo(() => calculateYieldSummary(mockDecantRecords), []);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-gold" />
          Decant Yield
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-xs">
              Tracks actual vs expected ML per decant. Target yield: 95%+.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        {/* Overall stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-[10px] text-muted-foreground">Avg Yield</p>
            <YieldIndicator pct={summary.avg_yield_pct} size="md" />
          </div>
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-[10px] text-muted-foreground">Total Waste</p>
            <p className={cn('text-sm font-semibold font-mono', summary.total_waste_ml > 5 ? 'text-destructive' : 'text-muted-foreground')}>
              {summary.total_waste_ml.toFixed(1)} ml
            </p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/50">
            <p className="text-[10px] text-muted-foreground">Decants</p>
            <p className="text-sm font-semibold">{summary.total_decants}</p>
          </div>
        </div>

        {/* Operator leaderboard */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Operator Accuracy</p>
          <div className="space-y-1">
            {summary.by_operator.map((op, idx) => (
              <div key={op.operator_name} className="flex items-center gap-2 text-xs">
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                  idx === 0 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                )}>
                  {idx + 1}
                </span>
                <User className="w-3 h-3 text-muted-foreground" />
                <span className="flex-1 font-medium">{op.operator_name}</span>
                <span className="text-[10px] text-muted-foreground">{op.decant_count} decants</span>
                <YieldIndicator pct={op.avg_yield_pct} />
              </div>
            ))}
          </div>
        </div>

        {/* Perfume yield */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">By Perfume</p>
          <div className="space-y-1">
            {summary.by_perfume.slice(0, 4).map(p => (
              <div key={p.perfume_name} className="flex items-center gap-2 text-xs">
                <Droplets className="w-3 h-3 text-info" />
                <span className="flex-1 truncate">{p.perfume_name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{p.total_waste_ml.toFixed(1)}ml waste</span>
                <YieldIndicator pct={p.avg_yield_pct} />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
