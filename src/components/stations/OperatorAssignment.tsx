// ============================================================
// Operator Assignment — C2 Feature
// Assign operators to stations per shift.
// Track who is working where.
// Show operator name on actions logged.
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User, UserPlus, UserMinus, Clock, MapPin, Check,
  ChevronDown, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---- Operator Types ----
export interface Operator {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  active: boolean;
}

export interface StationAssignment {
  stationId: number;
  stationName: string;
  operatorId: string | null;
  operatorName: string | null;
  assignedAt: string | null;
}

// ---- Mock Operators ----
const MOCK_OPERATORS: Operator[] = [
  { id: 'op-001', name: 'Karim', role: 'Vault Ops', active: true },
  { id: 'op-002', name: 'Sara', role: 'Fulfillment Ops', active: true },
  { id: 'op-003', name: 'Ahmed', role: 'QC', active: true },
  { id: 'op-004', name: 'Noor', role: 'Vault Ops', active: true },
  { id: 'op-005', name: 'Yusuf', role: 'Shipping', active: false },
];

const STATION_NAMES: Record<number, string> = {
  1: 'Pod Dashboard',
  2: 'Picking',
  3: 'Labeling',
  4: 'Decanting',
  5: 'QC & Assembly',
  6: 'Shipping',
};

// ---- Global state for operator assignments (in-memory) ----
let globalAssignments: StationAssignment[] = Object.entries(STATION_NAMES).map(([id, name]) => ({
  stationId: Number(id),
  stationName: name,
  operatorId: id === '1' || id === '2' || id === '3' || id === '4' ? 'op-001' : id === '5' ? 'op-002' : 'op-003',
  operatorName: id === '1' || id === '2' || id === '3' || id === '4' ? 'Karim' : id === '5' ? 'Sara' : 'Ahmed',
  assignedAt: new Date().toISOString(),
}));

export function getStationOperator(stationId: number): string | null {
  const assignment = globalAssignments.find(a => a.stationId === stationId);
  return assignment?.operatorName || null;
}

export function getAssignments(): StationAssignment[] {
  return [...globalAssignments];
}

// ---- Operator Badge (inline in station headers) ----
interface OperatorBadgeProps {
  stationId: number;
  className?: string;
  onClick?: () => void;
}

export function OperatorBadge({ stationId, className, onClick }: OperatorBadgeProps) {
  const assignment = globalAssignments.find(a => a.stationId === stationId);
  const name = assignment?.operatorName;

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
        name
          ? 'bg-primary/10 text-primary hover:bg-primary/20'
          : 'bg-muted text-muted-foreground hover:bg-muted/80',
        className,
      )}
    >
      <User className="w-3 h-3" />
      {name || 'Unassigned'}
    </button>
  );
}

// ---- Operator Assignment Dialog ----
interface OperatorAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  stationId?: number; // If provided, pre-select this station
}

export function OperatorAssignmentDialog({ open, onClose, stationId }: OperatorAssignmentDialogProps) {
  const [assignments, setAssignments] = useState<StationAssignment[]>(() => getAssignments());
  const operators = MOCK_OPERATORS.filter(o => o.active);

  const handleAssign = useCallback((sId: number, operator: Operator | null) => {
    setAssignments(prev => prev.map(a =>
      a.stationId === sId
        ? {
            ...a,
            operatorId: operator?.id || null,
            operatorName: operator?.name || null,
            assignedAt: operator ? new Date().toISOString() : null,
          }
        : a
    ));
  }, []);

  const handleSave = useCallback(() => {
    globalAssignments = [...assignments];
    toast.success('Operator assignments updated');
    onClose();
  }, [assignments, onClose]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Operator Assignments
          </DialogTitle>
          <DialogDescription>
            Assign operators to stations for the current shift
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3 pr-2">
            {assignments.map(assignment => (
              <div
                key={assignment.stationId}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  stationId === assignment.stationId ? 'border-primary/30 bg-primary/5' : 'border-border',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{assignment.stationName}</p>
                  {assignment.assignedAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Since {new Date(assignment.assignedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <select
                  value={assignment.operatorId || ''}
                  onChange={e => {
                    const op = operators.find(o => o.id === e.target.value) || null;
                    handleAssign(assignment.stationId, op);
                  }}
                  className="h-8 px-2 text-xs rounded-md border border-border bg-background cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {operators.map(op => (
                    <option key={op.id} value={op.id}>{op.name} ({op.role})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Assignments</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Station Header with Timer + Operator ----
interface StationHeaderExtrasProps {
  stationId: number;
  className?: string;
}

export function StationHeaderExtras({ stationId, className }: StationHeaderExtrasProps) {
  const [showAssignment, setShowAssignment] = useState(false);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <OperatorBadge stationId={stationId} onClick={() => setShowAssignment(true)} />
      <OperatorAssignmentDialog
        open={showAssignment}
        onClose={() => setShowAssignment(false)}
        stationId={stationId}
      />
    </div>
  );
}
