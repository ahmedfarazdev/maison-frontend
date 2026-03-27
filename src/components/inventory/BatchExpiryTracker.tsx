// ============================================================
// B3 — Batch Expiry Tracking
// Track expiry dates on inventory bottles. Show "Expiring Soon"
// section. Alert when bottles are within 90 days of expiry.
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
  CalendarClock, AlertTriangle, CheckCircle2, Clock, Search,
  Calendar, Droplets, ArrowRight, Timer, Info,
} from 'lucide-react';
import type { InventoryBottle } from '@/types';

// ---- Expiry Status ----
export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'ok' | 'unknown';

export interface BottleExpiry {
  bottle_id: string;
  master_id: string;
  perfume_name: string;
  batch_number?: string;
  expiry_date?: string; // ISO date
  days_remaining: number;
  status: ExpiryStatus;
  current_ml?: number;
  size_ml: number;
}

// ---- Helper: calculate expiry status ----
export function getExpiryStatus(expiryDate?: string): { status: ExpiryStatus; daysRemaining: number } {
  if (!expiryDate) return { status: 'unknown', daysRemaining: -1 };

  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) return { status: 'expired', daysRemaining };
  if (daysRemaining <= 30) return { status: 'critical', daysRemaining };
  if (daysRemaining <= 90) return { status: 'warning', daysRemaining };
  return { status: 'ok', daysRemaining };
}

// ---- Expiry Badge ----
export function ExpiryBadge({ expiryDate, compact = false }: {
  expiryDate?: string;
  compact?: boolean;
}) {
  const { status, daysRemaining } = getExpiryStatus(expiryDate);

  if (status === 'unknown') return null;

  const config: Record<ExpiryStatus, { label: string; variant: string; icon: React.ElementType }> = {
    expired: { label: 'Expired', variant: 'border-destructive/40 text-destructive bg-destructive/5', icon: AlertTriangle },
    critical: { label: `${daysRemaining}d left`, variant: 'border-destructive/40 text-destructive bg-destructive/5', icon: Timer },
    warning: { label: `${daysRemaining}d left`, variant: 'border-warning/40 text-warning bg-warning/5', icon: CalendarClock },
    ok: { label: `${daysRemaining}d`, variant: 'border-success/40 text-success bg-success/5', icon: CheckCircle2 },
    unknown: { label: 'N/A', variant: 'border-muted text-muted-foreground', icon: Info },
  };

  const cfg = config[status];
  const Icon = cfg.icon;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn('text-[9px] gap-0.5 cursor-default', cfg.variant)}>
            <Icon className="w-2.5 h-2.5" />
            {cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          <p>Expiry: {expiryDate ? new Date(expiryDate).toLocaleDateString() : 'Not set'}</p>
          <p>{daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expired'}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs',
      cfg.variant,
    )}>
      <Icon className="w-3.5 h-3.5" />
      <span className="font-medium">{cfg.label}</span>
      {expiryDate && (
        <span className="text-[10px] opacity-70">
          ({new Date(expiryDate).toLocaleDateString()})
        </span>
      )}
    </div>
  );
}

// ---- Set Expiry Dialog ----
export function SetExpiryDialog({ open, onOpenChange, bottleId, currentExpiry, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bottleId: string;
  currentExpiry?: string;
  onSave: (bottleId: string, expiryDate: string) => void;
}) {
  const [date, setDate] = useState(currentExpiry?.split('T')[0] ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            Set Expiry Date
          </DialogTitle>
          <DialogDescription>
            Set the manufacturer expiry date for bottle {bottleId}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Expiry Date</label>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => { onSave(bottleId, date); onOpenChange(false); }}
            disabled={!date}
            className="bg-gold hover:bg-gold/90 text-gold-foreground"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Expiring Soon Dashboard Widget ----
export function ExpiringSoonWidget({ bottles }: {
  bottles: (InventoryBottle & { perfume_name?: string; expiry_date?: string })[];
}) {
  const expiringBottles = useMemo(() => {
    return bottles
      .filter(b => b.expiry_date)
      .map(b => {
        const { status, daysRemaining } = getExpiryStatus(b.expiry_date);
        return { ...b, expiry_status: status, days_remaining: daysRemaining };
      })
      .filter(b => b.expiry_status === 'expired' || b.expiry_status === 'critical' || b.expiry_status === 'warning')
      .sort((a, b) => a.days_remaining - b.days_remaining);
  }, [bottles]);

  if (expiringBottles.length === 0) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-success" />
            Expiry Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <p className="text-xs text-muted-foreground text-center py-4">No bottles expiring within 90 days.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/30">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-warning" />
          Expiring Soon
          <Badge variant="outline" className="text-[10px] border-warning/40 text-warning ml-auto">
            {expiringBottles.length} bottle{expiringBottles.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 space-y-1.5">
        {expiringBottles.slice(0, 5).map(b => (
          <div key={b.bottle_id} className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border-l-[3px]',
            b.expiry_status === 'expired' ? 'border-l-destructive bg-destructive/5' :
            b.expiry_status === 'critical' ? 'border-l-destructive bg-destructive/5' :
            'border-l-warning bg-warning/5',
          )}>
            <Droplets className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium truncate flex-1">{b.perfume_name || b.master_id}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{b.bottle_id}</span>
            <ExpiryBadge expiryDate={b.expiry_date} compact />
          </div>
        ))}
        {expiringBottles.length > 5 && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            +{expiringBottles.length - 5} more expiring bottles
          </p>
        )}
        <p className="text-[10px] text-warning text-center pt-1 italic">
          Prioritize these bottles for decanting to minimize waste.
        </p>
      </CardContent>
    </Card>
  );
}
