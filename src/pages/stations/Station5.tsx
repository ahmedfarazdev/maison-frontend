// ============================================================
// QC & Assembly — Order Fulfillment / Packing
// Flow: Order Realization → Box Serial + QR Sticker → QC Check → Ship
// Step 2 generates a box serial + QR code sticker for the assembled box
// Print button sends QR sticker to printer for physical application
// Box serial carries forward to Shipping & Dispatch
// ============================================================

import { useState, useRef } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  ArrowRight, CheckCircle2, Package, ShieldCheck,
  User, MapPin, ChevronRight, Box, Tag, AlertTriangle, Circle,
  ClipboardCheck, ArrowLeft, Layers, Shield, Eye, Timer,
  Printer, QrCode, Download, Copy, StickyNote,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Order, Job } from '@/types';
import StationHeader from '@/components/StationHeader';

type PackingStatus = 'pending' | 'items_confirmed' | 'assembled' | 'qc_passed';

interface BoxRealization {
  serial: string;
  qrData: string;
  generatedAt: string;
  printed: boolean;
}

interface JobGroup {
  job: Job | null;
  orders: Order[];
}

// Generate a deterministic QR data string for a box
function generateBoxQR(orderId: string, serial: string): string {
  return JSON.stringify({
    type: 'MAISON_EM_BOX',
    serial,
    orderId,
    generatedAt: new Date().toISOString(),
    version: 1,
  });
}

// Render a simple QR-like visual (in production, use a real QR library)
function QRCodeVisual({ data, size = 120 }: { data: string; size?: number }) {
  // Generate a deterministic pattern from the data string
  const hash = data.split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
  const cells = 11;
  const cellSize = size / cells;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="border border-border rounded">
      {/* Background */}
      <rect width={size} height={size} fill="white" />
      {/* Position markers (corners) */}
      {[0, cells - 3].map(x =>
        [0, cells - 3].map(y => {
          if (x === cells - 3 && y === cells - 3) return null;
          return (
            <g key={`marker-${x}-${y}`}>
              <rect x={x * cellSize} y={y * cellSize} width={cellSize * 3} height={cellSize * 3} fill="black" />
              <rect x={(x + 0.5) * cellSize} y={(y + 0.5) * cellSize} width={cellSize * 2} height={cellSize * 2} fill="white" />
              <rect x={(x + 1) * cellSize} y={(y + 1) * cellSize} width={cellSize} height={cellSize} fill="black" />
            </g>
          );
        })
      )}
      {/* Data cells */}
      {Array.from({ length: cells * cells }, (_, i) => {
        const x = i % cells;
        const y = Math.floor(i / cells);
        // Skip position marker areas
        if ((x < 3 && y < 3) || (x >= cells - 3 && y < 3) || (x < 3 && y >= cells - 3)) return null;
        const bit = ((hash * (i + 7) * 31) >>> 0) % 3 === 0;
        if (!bit) return null;
        return (
          <rect
            key={i}
            x={x * cellSize + 1}
            y={y * cellSize + 1}
            width={cellSize - 2}
            height={cellSize - 2}
            fill="black"
            rx={1}
          />
        );
      })}
    </svg>
  );
}

export default function Station5() {
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const { data: jobsRes } = useApiQuery(() => api.jobs.list(), []);
  const allJobs = (jobsRes || []) as Job[];
  const orders = ((ordersRes || []) as Order[]).filter(o =>
    ['picked', 'prepped', 'decanted', 'processing'].includes(o.status)
  );

  // Group orders by their parent job
  const jobGroups: JobGroup[] = (() => {
    const jobMap = new Map<string, { job: Job; orders: Order[] }>();
    const ungrouped: Order[] = [];
    for (const order of orders) {
      const parentJob = allJobs.find(j => j.order_ids.includes(order.order_id));
      if (parentJob) {
        const existing = jobMap.get(parentJob.job_id);
        if (existing) {
          existing.orders.push(order);
        } else {
          jobMap.set(parentJob.job_id, { job: parentJob, orders: [order] });
        }
      } else {
        ungrouped.push(order);
      }
    }
    const groups: JobGroup[] = Array.from(jobMap.values());
    if (ungrouped.length > 0) {
      groups.push({ job: null, orders: ungrouped });
    }
    return groups;
  })();

  const [collapsedJobs, setCollapsedJobs] = useState<Record<string, boolean>>({});
  const toggleJobCollapse = (jobId: string) => {
    setCollapsedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  const [activeOrderIdx, setActiveOrderIdx] = useState(0);
  const [orderStatuses, setOrderStatuses] = useState<Record<string, PackingStatus>>({});
  const [confirmedItems, setConfirmedItems] = useState<Record<string, Record<string, boolean>>>({});
  const [boxRealizations, setBoxRealizations] = useState<Record<string, BoxRealization>>({});
  const [qcChecks, setQcChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [qrPreviewDialog, setQrPreviewDialog] = useState<{ orderId: string; box: BoxRealization } | null>(null);

  const activeOrder = orders[activeOrderIdx];
  const allOrdersDone = orders.length > 0 && orders.every(o => orderStatuses[o.order_id] === 'qc_passed');

  const QC_ITEMS = [
    { id: 'items-match', label: 'All items match order manifest', severity: 'critical' as const },
    { id: 'labels-correct', label: 'Labels are correct and legible', severity: 'critical' as const },
    { id: 'no-damage', label: 'No visible damage or leaks', severity: 'critical' as const },
    { id: 'inserts-included', label: 'Inserts and cards included', severity: 'standard' as const },
    { id: 'box-sealed', label: 'Box properly sealed', severity: 'critical' as const },
    { id: 'weight-check', label: 'Package weight within expected range', severity: 'standard' as const },
    { id: 'fragrance-verify', label: 'Fragrance identity verified (sniff test)', severity: 'critical' as const },
    { id: 'qr-sticker', label: 'QR sticker applied to box', severity: 'critical' as const },
  ];

  const qcInspector = { name: 'Reem S.', avatar: 'RS', role: 'QC Inspector' };
  const qcStats = {
    totalToday: orders.length,
    passed: orders.filter(o => orderStatuses[o.order_id] === 'qc_passed').length,
    awaitingQC: orders.filter(o => orderStatuses[o.order_id] === 'assembled').length,
    inProgress: orders.filter(o => {
      const status = orderStatuses[o.order_id];
      return status === 'assembled' && Object.keys(qcChecks[o.order_id] || {}).length > 0;
    }).length,
  };

  const confirmItem = (orderId: string, itemId: string) => {
    setConfirmedItems(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], [itemId]: true },
    }));
    toast.success('Item confirmed');
  };

  const allItemsConfirmed = (order: Order) =>
    order.items.every(i => confirmedItems[order.order_id]?.[i.item_id]);

  const generateBoxRealization = (orderId: string) => {
    const serial = `BOX-${Date.now().toString(36).toUpperCase()}-${orderId.slice(-4)}`;
    const qrData = generateBoxQR(orderId, serial);
    const box: BoxRealization = {
      serial,
      qrData,
      generatedAt: new Date().toISOString(),
      printed: false,
    };
    setBoxRealizations(prev => ({ ...prev, [orderId]: box }));
    setOrderStatuses(prev => ({ ...prev, [orderId]: 'assembled' }));
    toast.success(`Box serial generated: ${serial}`);
    // Auto-open the QR preview for printing
    setQrPreviewDialog({ orderId, box });
  };

  const handlePrintQRSticker = (orderId: string) => {
    const box = boxRealizations[orderId];
    if (!box) return;
    // Mark as printed
    setBoxRealizations(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], printed: true },
    }));
    toast.success(`QR sticker sent to printer for ${box.serial}`);
  };

  const handleCopySerial = (serial: string) => {
    navigator.clipboard.writeText(serial);
    toast.success('Box serial copied');
  };

  const toggleQcCheck = (orderId: string, checkId: string) => {
    setQcChecks(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], [checkId]: !prev[orderId]?.[checkId] },
    }));
  };

  const allQcPassed = (orderId: string) =>
    QC_ITEMS.every(q => qcChecks[orderId]?.[q.id]);

  const markQCPassed = (orderId: string) => {
    if (!allQcPassed(orderId)) {
      toast.warning('Complete all QC checks first');
      return;
    }
    if (!boxRealizations[orderId]?.printed) {
      toast.warning('Print the QR sticker before passing QC');
      return;
    }
    setOrderStatuses(prev => ({ ...prev, [orderId]: 'qc_passed' }));
    toast.success('QC passed — ready for shipping');
    if (activeOrderIdx < orders.length - 1) setActiveOrderIdx(activeOrderIdx + 1);
  };

  const getStatusIcon = (status: PackingStatus) => {
    switch (status) {
      case 'qc_passed': return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
      case 'assembled': return <ShieldCheck className="w-4 h-4 text-gold shrink-0" />;
      case 'items_confirmed': return <Package className="w-4 h-4 text-blue-500 shrink-0" />;
      default: return <Circle className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  const completedCount = orders.filter(o => orderStatuses[o.order_id] === 'qc_passed').length;

  return (
    <div>
      <PageHeader
        title="QC & Assembly Ops"
        subtitle={`Order realization → QR Sticker → QC → Ship — ${completedCount}/${orders.length} complete`}
        breadcrumbs={[{ label: 'Pod Framework' }, { label: 'QC & Assembly Ops' }]}
        actions={
          <div className="flex gap-2">
            <Link href="/stations/4-batch-decant">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to S4
              </Button>
            </Link>
            <Link href="/fulfillment/shipping">
              <Button
                size="sm"
                disabled={!allOrdersDone}
                className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              >
                Move to Shipping <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        }
      />

      <StationHeader stationNumber={5} assignedPerson={qcInspector.name} assignedRole={qcInspector.role} queueCount={orders.length} />

      {/* QC Inspector Dashboard */}
      {orders.length > 0 && (
        <div className="mx-6 mt-3 p-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <p className="text-xs font-semibold">QC Dashboard — {qcInspector.name}</p>
                <p className="text-[10px] text-muted-foreground">Allocated across all jobs at this station</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-sm font-bold text-violet-600">{qcStats.awaitingQC}</p>
                <p className="text-[9px] text-muted-foreground">Awaiting QC</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-amber-600">{qcStats.inProgress}</p>
                <p className="text-[9px] text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-success">{qcStats.passed}</p>
                <p className="text-[9px] text-muted-foreground">Passed</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold">{qcStats.totalToday}</p>
                <p className="text-[9px] text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Explosion Banner */}
      {jobGroups.length > 0 && jobGroups.some(g => g.job) && (
        <div className="mx-6 mt-4 flex items-center gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Layers className="w-5 h-5 text-violet-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-violet-700">Job Explosion — Per-Order Processing</p>
            <p className="text-xs text-violet-600/80">
              {jobGroups.filter(g => g.job).length} job(s) have been split into {orders.length} individual orders.
              Earlier stations processed these as batches; this station handles each order individually.
            </p>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-12rem)]">
        {/* Left: Order List grouped by Job */}
        <div className="w-72 border-r border-border bg-card overflow-y-auto shrink-0">
          <div className="p-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Orders ({orders.length}) from {jobGroups.filter(g => g.job).length} jobs
            </p>
          </div>
          {orders.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No orders ready for packing</div>
          ) : (
            jobGroups.map((group, gi) => {
              const jobId = group.job?.job_id || 'ungrouped';
              const isCollapsed = collapsedJobs[jobId];
              const groupOrdersDone = group.orders.every(o => orderStatuses[o.order_id] === 'qc_passed');
              return (
                <div key={jobId}>
                  <button
                    onClick={() => toggleJobCollapse(jobId)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/50 text-left hover:bg-muted/50 transition-colors"
                  >
                    <Layers className={cn('w-3.5 h-3.5 shrink-0', groupOrdersDone ? 'text-success' : 'text-gold')} />
                    <span className="text-[10px] font-mono font-semibold flex-1 truncate">
                      {group.job ? group.job.job_id : 'Unassigned Orders'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {group.orders.filter(o => orderStatuses[o.order_id] === 'qc_passed').length}/{group.orders.length}
                    </span>
                    {groupOrdersDone && <CheckCircle2 className="w-3 h-3 text-success" />}
                  </button>
                  {!isCollapsed && group.orders.map((order) => {
                    const idx = orders.indexOf(order);
                    const status = orderStatuses[order.order_id] || 'pending';
                    const box = boxRealizations[order.order_id];
                    return (
                      <button
                        key={order.order_id}
                        onClick={() => setActiveOrderIdx(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 pl-6 py-2.5 border-b border-border/50 text-left transition-all',
                          idx === activeOrderIdx ? 'bg-accent' : 'hover:bg-muted/50',
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono font-medium">{order.order_id}</p>
                          {box && (
                            <p className="text-[10px] font-mono text-gold">{box.serial}</p>
                          )}
                          <p className="text-xs text-muted-foreground truncate">{order.customer.name}</p>
                          <p className="text-[10px] text-muted-foreground">{order.items.length} items</p>
                        </div>
                        {getStatusIcon(status)}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Active Order Packing */}
        {activeOrder ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Order Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold font-mono">{activeOrder.order_id}</h2>
                {boxRealizations[activeOrder.order_id] && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className="text-[10px] bg-gold/20 text-gold border-gold/30 font-mono">
                      <Box className="w-3 h-3 mr-1" />
                      {boxRealizations[activeOrder.order_id].serial}
                    </Badge>
                    {boxRealizations[activeOrder.order_id].printed && (
                      <Badge className="text-[10px] bg-success/20 text-success border-success/30">
                        <Printer className="w-3 h-3 mr-1" /> Sticker Printed
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{activeOrder.customer.name}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{activeOrder.customer.city}, {activeOrder.customer.country}</span>
                </div>
                {activeOrder.notes && (
                  <p className="text-sm mt-1 flex items-center gap-1 text-warning">
                    <AlertTriangle className="w-3.5 h-3.5" /> {activeOrder.notes}
                  </p>
                )}
              </div>
              <StatusBadge variant={
                orderStatuses[activeOrder.order_id] === 'qc_passed' ? 'success' :
                orderStatuses[activeOrder.order_id] === 'assembled' ? 'gold' : 'muted'
              }>
                {orderStatuses[activeOrder.order_id] || 'pending'}
              </StatusBadge>
            </div>

            {/* Step 1: Order Items Checklist */}
            <SectionCard
              title="Step 1 · Order Items"
              subtitle={`Confirm each item is in the box — ${activeOrder.items.filter(i => confirmedItems[activeOrder.order_id]?.[i.item_id]).length}/${activeOrder.items.length}`}
              headerActions={
                allItemsConfirmed(activeOrder)
                  ? <StatusBadge variant="success">All Confirmed</StatusBadge>
                  : <StatusBadge variant="gold">In Progress</StatusBadge>
              }
            >
              <div className="space-y-2">
                {activeOrder.items.map(item => {
                  const isConfirmed = confirmedItems[activeOrder.order_id]?.[item.item_id];
                  return (
                    <div key={item.item_id} className={cn(
                      'flex items-center justify-between p-3 rounded-md border transition-all cursor-pointer',
                      isConfirmed ? 'border-success/30 bg-success/5' : 'border-border hover:bg-muted/30',
                    )} onClick={() => !isConfirmed && confirmItem(activeOrder.order_id, item.item_id)}>
                      <div className="flex items-center gap-3">
                        {isConfirmed
                          ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                          : <Circle className="w-5 h-5 text-muted-foreground shrink-0" />}
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs font-mono font-bold">
                          {item.size_ml}ml
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.perfume_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {item.type} · ×{item.qty} · {item.master_id}
                          </p>
                        </div>
                      </div>
                      {!isConfirmed && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={(e) => { e.stopPropagation(); confirmItem(activeOrder.order_id, item.item_id); }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Step 2: Box Realization + QR Sticker */}
            <SectionCard
              title="Step 2 · Box Realization & QR Sticker"
              subtitle="Generate box serial, create QR sticker, print and apply to assembled box"
              headerActions={
                boxRealizations[activeOrder.order_id]
                  ? (
                    <div className="flex items-center gap-2">
                      {boxRealizations[activeOrder.order_id].printed
                        ? <StatusBadge variant="success">Printed & Applied</StatusBadge>
                        : <StatusBadge variant="gold">Awaiting Print</StatusBadge>
                      }
                    </div>
                  )
                  : <StatusBadge variant="muted">Not Generated</StatusBadge>
              }
            >
              {boxRealizations[activeOrder.order_id] ? (
                <div className="space-y-4">
                  {/* Box Serial + QR Preview */}
                  <div className="flex items-start gap-4 p-4 rounded-lg border border-gold/30 bg-gold/5">
                    <div className="shrink-0">
                      <QRCodeVisual data={boxRealizations[activeOrder.order_id].qrData} size={100} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Box className="w-4 h-4 text-gold" />
                        <span className="text-sm font-bold font-mono">{boxRealizations[activeOrder.order_id].serial}</span>
                        <button onClick={() => handleCopySerial(boxRealizations[activeOrder.order_id].serial)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Generated: {new Date(boxRealizations[activeOrder.order_id].generatedAt).toLocaleString('en-AE')}
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Order: {activeOrder.order_id} · {activeOrder.items.length} items · {activeOrder.customer.name}
                      </p>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className={cn(
                            'gap-1.5',
                            boxRealizations[activeOrder.order_id].printed
                              ? 'bg-success/20 text-success hover:bg-success/30'
                              : 'bg-gold hover:bg-gold/90 text-gold-foreground',
                          )}
                          onClick={() => handlePrintQRSticker(activeOrder.order_id)}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {boxRealizations[activeOrder.order_id].printed ? 'Re-Print Sticker' : 'Print QR Sticker'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setQrPreviewDialog({ orderId: activeOrder.order_id, box: boxRealizations[activeOrder.order_id] })}
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => toast.info('QR sticker PDF download — coming soon')}
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Print Status */}
                  {!boxRealizations[activeOrder.order_id].printed && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                      <StickyNote className="w-4 h-4 shrink-0" />
                      <span>Print the QR sticker and apply it to the assembled box before proceeding to QC.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => generateBoxRealization(activeOrder.order_id)}
                    disabled={!allItemsConfirmed(activeOrder)}
                    className="gap-1.5"
                  >
                    <QrCode className="w-4 h-4" /> Generate Box Serial & QR Sticker
                  </Button>
                  {!allItemsConfirmed(activeOrder) && (
                    <p className="text-xs text-muted-foreground">Confirm all items first</p>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Step 3: QC Check */}
            <SectionCard
              title="Step 3 · Quality Control"
              subtitle="Verify all QC criteria before sending to shipping"
              headerActions={
                allQcPassed(activeOrder.order_id)
                  ? <StatusBadge variant="success">All Passed</StatusBadge>
                  : <StatusBadge variant="gold">Pending</StatusBadge>
              }
            >
              <div className="space-y-2">
                {QC_ITEMS.map(qc => {
                  const checked = qcChecks[activeOrder.order_id]?.[qc.id];
                  return (
                    <div
                      key={qc.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all',
                        checked ? 'border-success/30 bg-success/5' : 'border-border hover:bg-muted/30',
                      )}
                      onClick={() => boxRealizations[activeOrder.order_id] && toggleQcCheck(activeOrder.order_id, qc.id)}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
                        checked ? 'bg-success border-success' : 'border-muted-foreground/30',
                      )}>
                        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{qc.label}</span>
                        {qc.id === 'qr-sticker' && (
                          <Badge className="text-[8px] bg-gold/20 text-gold">NEW</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!boxRealizations[activeOrder.order_id] && (
                  <p className="text-xs text-muted-foreground italic">Complete box realization first to enable QC checks</p>
                )}
              </div>
            </SectionCard>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              {orderStatuses[activeOrder.order_id] === 'assembled' && (
                <Button
                  onClick={() => markQCPassed(activeOrder.order_id)}
                  disabled={!allQcPassed(activeOrder.order_id) || !boxRealizations[activeOrder.order_id]?.printed}
                  className="bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" /> QC Passed — Send to Shipping
                </Button>
              )}

              {orderStatuses[activeOrder.order_id] === 'qc_passed' && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-success/30 bg-success/5 flex-1">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-sm font-medium text-success">Order packed and QC verified. Ready for Shipping & Dispatch.</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Box: {boxRealizations[activeOrder.order_id]?.serial} · Sticker: Applied
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            {activeOrderIdx < orders.length - 1 && orderStatuses[activeOrder.order_id] === 'qc_passed' && (
              <Button
                variant="outline"
                onClick={() => setActiveOrderIdx(activeOrderIdx + 1)}
                className="gap-1.5"
              >
                Next Order <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={Package}
              title="No orders to pack"
              description="All orders have been fulfilled or none are ready for packing."
            />
          </div>
        )}
      </div>

      {/* QR Sticker Preview Dialog */}
      <Dialog open={!!qrPreviewDialog} onOpenChange={() => setQrPreviewDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-gold" />
              QR Sticker Preview
            </DialogTitle>
            <DialogDescription>
              Print this sticker and apply it to the assembled box
            </DialogDescription>
          </DialogHeader>
          {qrPreviewDialog && (
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Sticker Preview */}
              <div className="border-2 border-dashed border-gold/40 rounded-xl p-6 bg-white text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">MAISON EM</p>
                <QRCodeVisual data={qrPreviewDialog.box.qrData} size={140} />
                <p className="text-sm font-bold font-mono mt-3">{qrPreviewDialog.box.serial}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{qrPreviewDialog.orderId}</p>
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(qrPreviewDialog.box.generatedAt).toLocaleDateString('en-AE')}
                  </p>
                </div>
              </div>

              {/* Print Actions */}
              <div className="flex gap-2 w-full">
                <Button
                  className="flex-1 gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground"
                  onClick={() => {
                    handlePrintQRSticker(qrPreviewDialog.orderId);
                    setQrPreviewDialog(null);
                  }}
                >
                  <Printer className="w-4 h-4" /> Send to Printer
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => toast.info('PDF download — coming soon')}
                >
                  <Download className="w-4 h-4" /> PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
