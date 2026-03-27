// ============================================================
// StationHeader — Shared header banner for Pod Operations
// Shows: batch/per-order mode, assigned person, queue count
// NO station-to-station navigation — each station is standalone
// Products auto-advance when work is completed
// ============================================================

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Boxes, Box, User, ClipboardList, Package, Tag, FlaskConical,
  PackageCheck, Truck,
} from 'lucide-react';

interface StationHeaderProps {
  stationNumber: number;
  /** Optional: name of the person assigned to this station for the current job */
  assignedPerson?: string | null;
  /** Optional: role/specialization of the assigned person */
  assignedRole?: string;
  /** Optional: current job ID being worked on */
  currentJobId?: string;
  /** Optional: total items/orders in this station's queue */
  queueCount?: number;
}

const STATIONS = [
  { num: 1, label: 'Receiving & Sorting', icon: ClipboardList, mode: 'batch' as const },
  { num: 2, label: 'Picking', icon: Package, mode: 'batch' as const },
  { num: 3, label: 'Prep & Label', icon: Tag, mode: 'batch' as const },
  { num: 4, label: 'Batch Decanting', icon: FlaskConical, mode: 'batch' as const },
  { num: 5, label: 'QC & Assembly', icon: PackageCheck, mode: 'per_order' as const },
  { num: 6, label: 'Final Check', icon: Truck, mode: 'per_order' as const },
];

export default function StationHeader({
  stationNumber,
  assignedPerson,
  assignedRole,
  currentJobId,
  queueCount,
}: StationHeaderProps) {
  const current = STATIONS.find(s => s.num === stationNumber);
  if (!current) return null;

  const isBatch = current.mode === 'batch';

  return (
    <div className="mx-6 mt-3">
      {/* Mode + Assignment Banner */}
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        isBatch
          ? 'bg-blue-500/[0.04] border-blue-500/20'
          : 'bg-orange-500/[0.04] border-orange-500/20',
      )}>
        {/* Mode Icon */}
        <div className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
          isBatch ? 'bg-blue-500/10' : 'bg-orange-500/10',
        )}>
          {isBatch
            ? <Boxes className="w-4.5 h-4.5 text-blue-500" />
            : <Box className="w-4.5 h-4.5 text-orange-500" />
          }
        </div>

        {/* Mode Label */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(
              'text-[9px] px-1.5 py-0 font-semibold',
              isBatch ? 'border-blue-500/30 text-blue-600' : 'border-orange-500/30 text-orange-600',
            )}>
              {isBatch ? 'BATCH MODE' : 'PER-ORDER MODE'}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-semibold border-slate-300 text-slate-600">
              {current.label}
            </Badge>
            {currentJobId && (
              <span className="text-[10px] font-mono text-muted-foreground">
                Job: {currentJobId}
              </span>
            )}
            {queueCount !== undefined && (
              <span className="text-[10px] text-muted-foreground">
                · {queueCount} {isBatch ? 'items' : 'orders'} in queue
              </span>
            )}
          </div>
          <p className={cn('text-[10px] mt-0.5', isBatch ? 'text-blue-600/70' : 'text-orange-600/70')}>
            {isBatch
              ? 'Processing all items across jobs as a single batch — grouped by perfume/size'
              : 'Processing one order at a time — segregate, QC, pack individually'
            }
          </p>
        </div>

        {/* Assigned Person — only shown when explicitly assigned (e.g., QC Inspector) */}
        {assignedPerson && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border">
              <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-violet-500" />
              </div>
              <div>
                <p className="text-[11px] font-medium leading-tight">{assignedPerson}</p>
                {assignedRole && (
                  <p className="text-[9px] text-muted-foreground capitalize">{assignedRole}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
