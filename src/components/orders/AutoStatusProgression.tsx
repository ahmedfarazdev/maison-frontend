// ============================================================
// G2 — Auto-Status Progression
// Automatically advance order status when station actions complete.
// e.g. When all items decanted → status = "packed_ready"
// When QC passes → status = "ready_to_ship"
// Configurable rules engine with override capability.
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowRight, CheckCircle2, Settings, Zap, Play, Pause,
  RefreshCcw, AlertCircle, Clock, Shield, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ---- Types ----
export interface StatusRule {
  id: string;
  name: string;
  description: string;
  trigger_event: string;
  from_status: string;
  to_status: string;
  conditions: string[];
  enabled: boolean;
  auto_execute: boolean;
  last_triggered?: string;
  trigger_count: number;
}

export interface StatusTransition {
  order_id: string;
  from_status: string;
  to_status: string;
  rule_id: string;
  rule_name: string;
  timestamp: string;
  auto: boolean;
}

// ---- Status flow definition ----
const STATUS_FLOW = [
  { key: 'pending', label: 'Pending', color: 'bg-muted text-muted-foreground' },
  { key: 'assigned', label: 'Assigned', color: 'bg-info/10 text-info' },
  { key: 'picking', label: 'Picking', color: 'bg-gold/10 text-gold' },
  { key: 'decanting', label: 'Decanting', color: 'bg-purple-500/10 text-purple-500' },
  { key: 'qc_pending', label: 'QC Pending', color: 'bg-warning/10 text-warning' },
  { key: 'qc_passed', label: 'QC Passed', color: 'bg-success/10 text-success' },
  { key: 'packing', label: 'Packing', color: 'bg-gold/10 text-gold' },
  { key: 'ready_to_ship', label: 'Ready to Ship', color: 'bg-info/10 text-info' },
  { key: 'shipped', label: 'Shipped', color: 'bg-success/10 text-success' },
  { key: 'delivered', label: 'Delivered', color: 'bg-success text-success-foreground' },
];

// ---- Default rules ----
const defaultRules: StatusRule[] = [
  {
    id: 'R1', name: 'Auto-Assign on Batch',
    description: 'When an order is added to a batch, auto-assign it',
    trigger_event: 'order.added_to_batch',
    from_status: 'pending', to_status: 'assigned',
    conditions: ['Order has batch_id', 'Batch is open'],
    enabled: true, auto_execute: true, trigger_count: 142,
    last_triggered: '2025-02-14T08:30:00Z',
  },
  {
    id: 'R2', name: 'Start Picking on Station Scan',
    description: 'When operator scans order at picking station, advance to picking',
    trigger_event: 'station.scan_order',
    from_status: 'assigned', to_status: 'picking',
    conditions: ['Station type = picking', 'Operator assigned'],
    enabled: true, auto_execute: true, trigger_count: 138,
    last_triggered: '2025-02-14T09:15:00Z',
  },
  {
    id: 'R3', name: 'Auto-Decant on All Items Picked',
    description: 'When all items are marked as picked, advance to decanting',
    trigger_event: 'picking.all_items_complete',
    from_status: 'picking', to_status: 'decanting',
    conditions: ['All line items picked', 'No stock issues'],
    enabled: true, auto_execute: true, trigger_count: 130,
    last_triggered: '2025-02-14T09:45:00Z',
  },
  {
    id: 'R4', name: 'QC Queue on Decant Complete',
    description: 'When all decants are done, move to QC queue',
    trigger_event: 'decanting.all_complete',
    from_status: 'decanting', to_status: 'qc_pending',
    conditions: ['All decants recorded', 'Yield within tolerance'],
    enabled: true, auto_execute: true, trigger_count: 125,
    last_triggered: '2025-02-14T10:00:00Z',
  },
  {
    id: 'R5', name: 'QC Pass → Packing',
    description: 'When QC passes all checks, advance to packing',
    trigger_event: 'qc.all_passed',
    from_status: 'qc_passed', to_status: 'packing',
    conditions: ['All QC checks passed', 'No holds'],
    enabled: true, auto_execute: false, trigger_count: 118,
    last_triggered: '2025-02-14T10:30:00Z',
  },
  {
    id: 'R6', name: 'Ready to Ship on Pack Complete',
    description: 'When packing is done and label printed, mark ready to ship',
    trigger_event: 'packing.complete',
    from_status: 'packing', to_status: 'ready_to_ship',
    conditions: ['All items packed', 'Shipping label generated'],
    enabled: true, auto_execute: true, trigger_count: 110,
    last_triggered: '2025-02-14T11:00:00Z',
  },
  {
    id: 'R7', name: 'Auto-Ship on Courier Pickup',
    description: 'When courier pickup is confirmed, mark as shipped',
    trigger_event: 'shipping.courier_pickup',
    from_status: 'ready_to_ship', to_status: 'shipped',
    conditions: ['AWB number assigned', 'Courier confirmed'],
    enabled: true, auto_execute: true, trigger_count: 95,
    last_triggered: '2025-02-14T14:00:00Z',
  },
  {
    id: 'R8', name: 'Auto-Deliver on Tracking Confirm',
    description: 'When tracking shows delivered, auto-update status',
    trigger_event: 'shipping.delivered_confirmed',
    from_status: 'shipped', to_status: 'delivered',
    conditions: ['Tracking status = delivered', 'POD received'],
    enabled: false, auto_execute: false, trigger_count: 72,
    last_triggered: '2025-02-13T16:00:00Z',
  },
];

// ---- Recent transitions log ----
const recentTransitions: StatusTransition[] = [
  { order_id: 'ORD-2025-0198', from_status: 'picking', to_status: 'decanting', rule_id: 'R3', rule_name: 'Auto-Decant on All Items Picked', timestamp: '2025-02-14T10:05:00Z', auto: true },
  { order_id: 'ORD-2025-0195', from_status: 'decanting', to_status: 'qc_pending', rule_id: 'R4', rule_name: 'QC Queue on Decant Complete', timestamp: '2025-02-14T10:02:00Z', auto: true },
  { order_id: 'ORD-2025-0192', from_status: 'packing', to_status: 'ready_to_ship', rule_id: 'R6', rule_name: 'Ready to Ship on Pack Complete', timestamp: '2025-02-14T09:58:00Z', auto: true },
  { order_id: 'ORD-2025-0190', from_status: 'assigned', to_status: 'picking', rule_id: 'R2', rule_name: 'Start Picking on Station Scan', timestamp: '2025-02-14T09:55:00Z', auto: true },
  { order_id: 'ORD-2025-0188', from_status: 'qc_passed', to_status: 'packing', rule_id: 'R5', rule_name: 'QC Pass → Packing', timestamp: '2025-02-14T09:50:00Z', auto: false },
];

// ---- Auto-Status Progression Widget ----
export function AutoStatusWidget() {
  const [rules, setRules] = useState(defaultRules);
  const [showConfig, setShowConfig] = useState(false);

  const enabledCount = rules.filter(r => r.enabled).length;
  const autoCount = rules.filter(r => r.enabled && r.auto_execute).length;
  const totalTriggers = rules.reduce((s, r) => s + r.trigger_count, 0);

  const toggleRule = useCallback((ruleId: string) => {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
    toast.success('Rule updated');
  }, []);

  const toggleAutoExecute = useCallback((ruleId: string) => {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, auto_execute: !r.auto_execute } : r
    ));
    toast.success('Auto-execute updated');
  }, []);

  return (
    <>
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-gold" />
            Auto-Status Progression
            <Badge variant="outline" className="text-[10px] ml-auto">
              {enabledCount}/{rules.length} active
            </Badge>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowConfig(true)}>
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Active Rules</p>
              <p className="text-lg font-semibold text-success">{enabledCount}</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Auto-Execute</p>
              <p className="text-lg font-semibold text-gold">{autoCount}</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Total Triggers</p>
              <p className="text-lg font-semibold">{totalTriggers}</p>
            </div>
          </div>

          {/* Status Flow Visualization */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Order Status Flow</p>
            <div className="flex items-center gap-0.5 flex-wrap">
              {STATUS_FLOW.map((status, idx) => (
                <div key={status.key} className="flex items-center gap-0.5">
                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded', status.color)}>
                    {status.label}
                  </span>
                  {idx < STATUS_FLOW.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent transitions */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Recent Transitions</p>
            <div className="space-y-1">
              {recentTransitions.slice(0, 4).map((t, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-md bg-muted/50">
                  {t.auto ? (
                    <Zap className="w-3 h-3 text-gold shrink-0" />
                  ) : (
                    <Shield className="w-3 h-3 text-info shrink-0" />
                  )}
                  <span className="font-mono text-info">{t.order_id}</span>
                  <span className="text-muted-foreground">{t.from_status}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                  <span className="font-medium">{t.to_status}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">
                    {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gold" />
              Status Progression Rules
            </DialogTitle>
            <DialogDescription>
              Configure which status transitions happen automatically. Disable auto-execute to require manual confirmation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {rules.map(rule => (
              <div key={rule.id} className={cn(
                'p-3 rounded-lg border transition-all',
                rule.enabled ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60',
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[9px] font-mono">{rule.id}</Badge>
                      <span className="text-sm font-medium">{rule.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <Badge variant="outline" className="text-[9px]">{rule.from_status}</Badge>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <Badge variant="outline" className="text-[9px]">{rule.to_status}</Badge>
                      <span className="text-muted-foreground ml-2">Triggered {rule.trigger_count}x</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {rule.conditions.map((c, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Enabled</span>
                      <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Auto</span>
                      <Switch
                        checked={rule.auto_execute}
                        onCheckedChange={() => toggleAutoExecute(rule.id)}
                        disabled={!rule.enabled}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfig(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
